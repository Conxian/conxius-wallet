#!/usr/bin/env ruby
# frozen_string_literal: true

require "psych"

REPOSITORY_ROOT = File.expand_path("../..", __dir__)
CONFIG_PATH = File.join(REPOSITORY_ROOT, ".github", "dependabot.yml")
REQUIRED_NPM_MIGRATION_DEPENDENCIES = ["typescript", "@testing-library/jest-dom"].freeze
REQUIRED_TYPESCRIPT_PROMOTION_GUARDS = ["typescript", "@typescript/native"].freeze
EXPECTED_CARGO_DIRECTORIES = [
  "/native/silent-payments",
  "/native/silent-payments-jni"
].freeze
VALID_INTERVALS = %w[daily weekly monthly quarterly semiannually yearly cron].freeze

def fail_validation(message)
  warn "Dependabot configuration validation failed: #{message}"
  exit 1
end

def require_value(hash, key, context)
  fail_validation("#{context} is missing #{key}") unless hash.key?(key)

  hash.fetch(key)
end

def find_update(updates, ecosystem, directory)
  matches = updates.select do |update|
    update["package-ecosystem"] == ecosystem && update["directory"] == directory
  end
  fail_validation("expected one #{ecosystem} update entry for #{directory}, found #{matches.length}") unless matches.length == 1

  matches.first
end

unless File.file?(CONFIG_PATH)
  fail_validation("missing #{CONFIG_PATH}")
end

begin
  config = Psych.safe_load(File.read(CONFIG_PATH), aliases: false)
rescue Psych::Exception => e
  fail_validation("invalid YAML: #{e.message}")
end

fail_validation("top-level document must be a mapping") unless config.is_a?(Hash)
fail_validation("version must be 2") unless config["version"] == 2

updates = config["updates"]
fail_validation("updates must be a non-empty list") unless updates.is_a?(Array) && !updates.empty?

seen_locations = {}
updates.each_with_index do |update, index|
  context = "updates[#{index}]"
  fail_validation("#{context} must be a mapping") unless update.is_a?(Hash)

  ecosystem = require_value(update, "package-ecosystem", context)
  directory = require_value(update, "directory", context)
  schedule = require_value(update, "schedule", context)
  fail_validation("#{context}.schedule must be a mapping") unless schedule.is_a?(Hash)

  interval = require_value(schedule, "interval", "#{context}.schedule")
  fail_validation("#{context}.schedule.interval #{interval.inspect} is unsupported") unless VALID_INTERVALS.include?(interval)

  location_key = [ecosystem, directory]
  fail_validation("duplicate update entry for #{ecosystem} at #{directory}") if seen_locations.key?(location_key)

  seen_locations[location_key] = true
end

npm = find_update(updates, "npm", "/")
actions = find_update(updates, "github-actions", "/")
gradle = find_update(updates, "gradle", "/android")

fail_validation("npm must run daily") unless npm.dig("schedule", "interval") == "daily"
fail_validation("GitHub Actions must run weekly") unless actions.dig("schedule", "interval") == "weekly"
fail_validation("Gradle must run weekly") unless gradle.dig("schedule", "interval") == "weekly"

expected_labels = {
  "npm" => %w[dependencies javascript],
  "github-actions" => %w[dependencies github_actions],
  "gradle" => %w[dependencies]
}

expected_labels.each do |ecosystem, labels|
  update = { "npm" => npm, "github-actions" => actions, "gradle" => gradle }.fetch(ecosystem)
  actual_labels = Array(update["labels"])
  missing_labels = labels - actual_labels
  fail_validation("#{ecosystem} is missing labels #{missing_labels.join(", ")}") unless missing_labels.empty?
end

groups = require_value(npm, "groups", "npm update entry")
fail_validation("npm groups must be a mapping") unless groups.is_a?(Hash)

{
  "production-routine" => "production",
  "development-routine" => "development"
}.each do |group_name, dependency_type|
  group = groups[group_name]
  fail_validation("npm group #{group_name} is missing") unless group.is_a?(Hash)
  fail_validation("npm group #{group_name} must apply only to version updates") unless group["applies-to"] == "version-updates"
  fail_validation("npm group #{group_name} has the wrong dependency type") unless group["dependency-type"] == dependency_type
  fail_validation("npm group #{group_name} must contain only minor and patch updates") unless Array(group["update-types"]).sort == %w[minor patch]

  excluded = Array(group["exclude-patterns"])
  missing_migrations = REQUIRED_NPM_MIGRATION_DEPENDENCIES - excluded
  fail_validation("npm group #{group_name} must exclude #{missing_migrations.join(", ")}") unless missing_migrations.empty?
  fail_validation("npm group #{group_name} must not include major updates") if Array(group["update-types"]).include?("major")
end

ignore_rules = Array(npm["ignore"])
fail_validation("npm ignore rules must preserve @noble/hashes") unless ignore_rules.any? do |rule|
  rule.is_a?(Hash) && rule["dependency-name"] == "@noble/hashes" && Array(rule["versions"]) == ["< 2.0.1"]
end

REQUIRED_NPM_MIGRATION_DEPENDENCIES.each do |dependency_name|
  next if dependency_name == "typescript"

  fail_validation("#{dependency_name} must not be suppressed by an ignore rule") if ignore_rules.any? do |rule|
    rule.is_a?(Hash) && rule["dependency-name"] == dependency_name
  end
end

REQUIRED_TYPESCRIPT_PROMOTION_GUARDS.each do |dependency_name|
  matching_rules = ignore_rules.select do |rule|
    rule.is_a?(Hash) && rule["dependency-name"] == dependency_name
  end
  fail_validation("#{dependency_name} must ignore TypeScript 7 or later") unless matching_rules.any? do |rule|
    Array(rule["versions"]) == [">= 7.0.0"]
  end
end

EXPECTED_CARGO_DIRECTORIES.each do |directory|
  cargo = find_update(updates, "cargo", directory)
  fail_validation("Cargo entry for #{directory} must run weekly") unless cargo.dig("schedule", "interval") == "weekly"
  fail_validation("Cargo entry for #{directory} must have the dependencies label") unless Array(cargo["labels"]).include?("dependencies")

  manifest_root = File.join(REPOSITORY_ROOT, directory.delete_prefix("/"))
  %w[Cargo.toml Cargo.lock].each do |filename|
    fail_validation("missing #{directory}/#{filename}") unless File.file?(File.join(manifest_root, filename))
  end
end

fail_validation("GitHub Actions workflow directory is missing") unless Dir.exist?(File.join(REPOSITORY_ROOT, ".github", "workflows"))

puts "Dependabot configuration is valid: npm routine groups, major isolation, Actions, Gradle, and Cargo coverage verified."
