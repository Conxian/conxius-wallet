#!/usr/bin/env python3
import os
import sys
import json
import re
import subprocess

# Color definitions
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_section(title):
    print(f"\n{BOLD}=== {title} ==={RESET}")

def run_cmd(cmd, cwd=None):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return result.returncode, result.stdout.strip(), result.stderr.strip()

def main():
    print(f"{BOLD}{GREEN}Starting Conxian Baseline Hygiene Scanner...{RESET}")
    repo_root = os.getcwd()

    # 1. Check Governance Files
    print_section("1. Governance Files Check")
    gov_files = ["README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CODEOWNERS", "CHANGELOG.md"]
    gov_passed = True
    for f in gov_files:
        path = os.path.join(repo_root, f)
        if os.path.exists(path):
            print(f"  {GREEN}✓{RESET} {f} exists")
        else:
            print(f"  {RED}✗{RESET} {f} is MISSING!")
            gov_passed = False

    # 2. Check Git Tracked Files & Ignore Rule Hygiene
    print_section("2. Tracked Sensitive, Generated Files & Ignore Rules Check")
    code, stdout, stderr = run_cmd("git ls-files", cwd=repo_root)
    if code != 0:
        print(f"  {RED}✗ Failed to execute git ls-files. Is this a git repository?{RESET}")
        sys.exit(1)

    tracked_files = stdout.splitlines()

    sensitive_patterns = [
        r"\.env$",
        r"\.key$",
        r"\.pem$",
        r"id_rsa",
        r"id_ecdsa",
        r"\.jks$",
        r"\.keystore$",
        r"service-account.*\.json$",
    ]

    generated_patterns = [
        r"^node_modules/",
        r"^test-results/",
        r"^playwright-report/",
        r"^dist/",
        r"^build/",
        r"android/app/build/",
        r"android/\.gradle/",
    ]

    sensitive_found = []
    generated_found = []

    for f in tracked_files:
        # Skip env.example / env.template files
        if "example" in f or "template" in f or "sample" in f:
            continue
        for p in sensitive_patterns:
            if re.search(p, f, re.IGNORECASE):
                sensitive_found.append(f)
        for p in generated_patterns:
            if re.search(p, f, re.IGNORECASE):
                generated_found.append(f)

    if sensitive_found:
        print(f"  {RED}✗ CRITICAL SECURITY RISK: Tracked sensitive files found in git!{RESET}")
        for f in sensitive_found:
            print(f"    - {f}")
    else:
        print(f"  {GREEN}✓{RESET} No tracked sensitive files found in git history.")

    if generated_found:
        print(f"  {RED}✗ HYGIENE ISSUE: Tracked generated artifacts/build files found in git!{RESET}")
        for f in generated_found:
            print(f"    - {f}")
    else:
        print(f"  {GREEN}✓{RESET} No tracked generated artifacts or build files in git.")

    # 2b. Check .gitignore rule hygiene
    gitignore_passed = True
    gitignore_path = os.path.join(repo_root, ".gitignore")
    if os.path.exists(gitignore_path):
        with open(gitignore_path, "r") as gf:
            lines = [line.strip() for line in gf.readlines() if line.strip() and not line.strip().startswith("#")]
        seen_rules = set()
        duplicate_rules = []
        for line in lines:
            if line in seen_rules:
                duplicate_rules.append(line)
            else:
                seen_rules.add(line)

        if duplicate_rules:
            print(f"  {RED}✗ HYGIENE ISSUE: Duplicate rules found in .gitignore!{RESET}")
            for r in duplicate_rules:
                print(f"    - Duplicate rule: {r}")
            gitignore_passed = False
        else:
            print(f"  {GREEN}✓{RESET} .gitignore contains no duplicate rules.")
    else:
        print(f"  {RED}✗ .gitignore is MISSING!{RESET}")
        gitignore_passed = False

    # 3. Check Version Consistency (Drift Detection)
    print_section("3. Release & Versioning Consistency Check")
    versions = {}

    # package.json
    try:
        with open(os.path.join(repo_root, "package.json"), "r") as f:
            versions["package.json"] = json.load(f).get("version")
    except Exception as e:
        print(f"  {RED}✗{RESET} package.json version read failed: {e}")

    # metadata.json
    try:
        with open(os.path.join(repo_root, "metadata.json"), "r") as f:
            versions["metadata.json"] = json.load(f).get("version")
    except Exception as e:
        print(f"  {RED}✗{RESET} metadata.json version read failed: {e}")

    # android versionName
    try:
        with open(os.path.join(repo_root, "android/app/build.gradle.kts"), "r") as f:
            content = f.read()
            match = re.search(r'\bversionName\s*=\s*"([^"]+)"', content)
            if match:
                versions["android (versionName)"] = match.group(1)
            else:
                versions["android (versionName)"] = None
    except Exception as e:
        print(f"  {RED}✗{RESET} android build.gradle.kts version read failed: {e}")

    # README.md production version claim
    try:
        with open(os.path.join(repo_root, "README.md"), "r") as f:
            content = f.read()
            match = re.search(r'\*\*Production \(v([^\s)]+)\)\.\*\*', content)
            if match:
                versions["README.md (production claim)"] = match.group(1)
            else:
                versions["README.md (production claim)"] = None
    except Exception as e:
        print(f"  {RED}✗{RESET} README.md version read failed: {e}")

    # CHANGELOG.md top released version
    try:
        with open(os.path.join(repo_root, "CHANGELOG.md"), "r") as f:
            content = f.read()
            match = re.search(r'^## \[([^\]]+)\]', content, re.MULTILINE)
            if match:
                versions["CHANGELOG.md (latest version)"] = match.group(1)
            else:
                versions["CHANGELOG.md (latest version)"] = None
    except Exception as e:
        print(f"  {RED}✗{RESET} CHANGELOG.md version read failed: {e}")

    # Compare versions
    any_version_failed = any(v is None for v in versions.values())
    version_values = [v for v in versions.values() if v is not None]

    version_sync_passed = False
    if len(version_values) == len(versions):
        canonical_version = version_values[0]
        drift = False
        for key, val in versions.items():
            if val != canonical_version:
                print(f"  {RED}✗ Version Drift!{RESET} {key} has '{val}', expected '{canonical_version}'")
                drift = True
            else:
                print(f"  {GREEN}✓{RESET} {key} matches: {val}")
        if not drift:
            print(f"  {GREEN}✓ SUCCESS:{RESET} All versions are perfectly synchronized at {canonical_version}!")
            version_sync_passed = True
    else:
        print(f"  {RED}✗ ERROR:{RESET} Some versions failed to parse or are missing:")
        for key, val in versions.items():
            if val is None:
                print(f"    - {key}: {RED}FAILED TO PARSE/MISSING{RESET}")
            else:
                print(f"    - {key}: {val}")

    # 4. Public Clarity / Purpose & Status Check
    print_section("4. Public-facing Purpose & Status Verification")
    purpose_found = False
    status_found = False
    try:
        with open(os.path.join(repo_root, "README.md"), "r") as f:
            readme_content = f.read()
            purpose_found = "## Purpose" in readme_content
            status_found = "## Status" in readme_content

            if purpose_found:
                print(f"  {GREEN}✓{RESET} Purpose section found in README.md")
            else:
                print(f"  {YELLOW}⚠{RESET} Purpose section NOT found in README.md")

            if status_found:
                print(f"  {GREEN}✓{RESET} Status section found in README.md")
            else:
                print(f"  {YELLOW}⚠{RESET} Status section NOT found in README.md")
    except Exception as e:
        print(f"  {RED}✗{RESET} README.md public clarity audit failed: {e}")

    # Summary
    print_section("Summary")
    success = (gov_passed and
               not sensitive_found and
               not generated_found and
               gitignore_passed and
               not any_version_failed and
               version_sync_passed and
               purpose_found and
               status_found)

    if success:
        print(f"{BOLD}{GREEN}ALL BASELINE HYGIENE CHECKS PASSED SUCCESSFULLY!{RESET}\n")
        sys.exit(0)
    else:
        print(f"{BOLD}{RED}SOME BASELINE HYGIENE CHECKS FAILED!{RESET}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
