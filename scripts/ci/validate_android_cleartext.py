#!/usr/bin/env python3
"""Validate Android cleartext policy against the application manifest.

Only explicitly enabled, fully-qualified domains may be allowlisted. Global and
base cleartext policies are intentionally unsupported so that a stale or
malformed allowlist can never turn a broad policy into an apparent exception.
"""

from __future__ import annotations

import argparse
import ipaddress
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ANDROID_NS = "http://schemas.android.com/apk/res/android"
ANDROID_ATTR = "{" + ANDROID_NS + "}"
HOST_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
HOST_NAME = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")
XML_NAME = re.compile(r"^[a-z][a-z0-9_]*$")


class PolicyError(Exception):
    """Raised when the production cleartext policy is unsafe or ambiguous."""


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def android_attr(element: ET.Element, name: str) -> str | None:
    return element.attrib.get(ANDROID_ATTR + name)


def parse_boolean(value: str, context: str) -> bool:
    if value == "true":
        return True
    if value == "false":
        return False
    raise PolicyError(f"{context} must be exactly true or false")


def canonical_host(raw_host: str, context: str) -> str:
    host = raw_host.strip().lower()
    if not host:
        raise PolicyError(f"{context} must not be empty")
    if host == "*" or "*" in host:
        raise PolicyError(f"{context} must not use wildcard hosts")
    if any(ord(character) > 127 for character in host):
        raise PolicyError(f"{context} must use ASCII DNS names")
    if ":" in host:
        raise PolicyError(f"{context} must not use IPv4/IPv6 address syntax")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise PolicyError(f"{context} must not use IP addresses")
    if not HOST_NAME.fullmatch(host):
        raise PolicyError(
            f"{context} must be a fully-qualified DNS host with valid labels; "
            "wildcards, single-label hosts, and IP addresses are unsupported"
        )
    for label in host.split("."):
        if not HOST_LABEL.fullmatch(label):
            raise PolicyError(f"{context} contains an invalid DNS label")
    return host


def parse_domain(element: ET.Element, context: str) -> tuple[str, bool]:
    supported_attributes = {ANDROID_ATTR + "includeSubdomains"}
    unknown_attributes = set(element.attrib) - supported_attributes
    if unknown_attributes:
        names = ", ".join(sorted(local_name(name) for name in unknown_attributes))
        raise PolicyError(f"{context} has unsupported attributes: {names}")

    host = canonical_host("" if element.text is None else element.text, context)
    include_subdomains_value = android_attr(element, "includeSubdomains")
    include_subdomains = (
        False
        if include_subdomains_value is None
        else parse_boolean(include_subdomains_value, f"{context} includeSubdomains")
    )
    return host, include_subdomains


def inspect_domain_config(
    element: ET.Element,
    inherited_cleartext: bool,
    context: str,
    active_domains: list[tuple[str, bool]],
) -> bool:
    cleartext_value = android_attr(element, "cleartextTrafficPermitted")
    effective_cleartext = (
        inherited_cleartext
        if cleartext_value is None
        else parse_boolean(cleartext_value, f"{context} cleartextTrafficPermitted")
    )
    enabled_domain_count = 0

    for child_index, child in enumerate(list(element), start=1):
        child_name = local_name(child.tag)
        child_context = f"{context}/{child_name}[{child_index}]"
        if child_name == "domain":
            domain = parse_domain(child, child_context)
            if effective_cleartext:
                active_domains.append(domain)
                enabled_domain_count += 1
        elif child_name == "domain-config":
            if inspect_domain_config(child, effective_cleartext, child_context, active_domains):
                enabled_domain_count += 1

    if effective_cleartext and enabled_domain_count == 0:
        raise PolicyError(f"{context} enables cleartext without a specific domain")
    return enabled_domain_count > 0


def parse_config(config_path: Path) -> list[tuple[str, bool]]:
    try:
        root = ET.parse(config_path).getroot()
    except (ET.ParseError, OSError) as error:
        raise PolicyError(f"unable to parse referenced network security config {config_path}: {error}") from error

    if local_name(root.tag) != "network-security-config":
        raise PolicyError(f"network security config must use the network-security-config root: {config_path}")

    root_cleartext = android_attr(root, "cleartextTrafficPermitted")
    if root_cleartext is not None:
        if parse_boolean(root_cleartext, "network-security-config cleartextTrafficPermitted"):
            raise PolicyError("global cleartextTrafficPermitted=true is not supported")
        raise PolicyError("network-security-config must not declare a global cleartext policy")

    active_domains: list[tuple[str, bool]] = []
    for child_index, child in enumerate(list(root), start=1):
        child_name = local_name(child.tag)
        context = f"network-security-config/{child_name}[{child_index}]"
        if child_name == "base-config":
            cleartext_value = android_attr(child, "cleartextTrafficPermitted")
            if cleartext_value is not None and parse_boolean(cleartext_value, f"{context} cleartextTrafficPermitted"):
                raise PolicyError("base-config cleartextTrafficPermitted=true is not supported")
        elif child_name == "domain-config":
            inspect_domain_config(child, False, context, active_domains)

    if len(set(active_domains)) != len(active_domains):
        raise PolicyError("the referenced network security config contains duplicate enabled domains")
    return active_domains


def parse_manifest(manifest_path: Path) -> list[tuple[str, bool]]:
    try:
        root = ET.parse(manifest_path).getroot()
    except (ET.ParseError, OSError) as error:
        raise PolicyError(f"unable to parse Android manifest {manifest_path}: {error}") from error

    if local_name(root.tag) != "manifest":
        raise PolicyError("Android manifest must use the manifest root")
    applications = [child for child in list(root) if local_name(child.tag) == "application"]
    if len(applications) != 1:
        raise PolicyError("Android manifest must contain exactly one application element")
    application = applications[0]

    uses_cleartext_value = android_attr(application, "usesCleartextTraffic")
    if uses_cleartext_value is None:
        raise PolicyError('application must explicitly set android:usesCleartextTraffic="false"')
    if parse_boolean(uses_cleartext_value, "application usesCleartextTraffic"):
        raise PolicyError("application-wide usesCleartextTraffic=true is not supported")

    config_reference = android_attr(application, "networkSecurityConfig")
    if config_reference is None:
        return []
    match = re.fullmatch(r"@xml/([a-z][a-z0-9_]*)", config_reference)
    if not match or not XML_NAME.fullmatch(match.group(1)):
        raise PolicyError(
            "application networkSecurityConfig must be a direct @xml/<lowercase-resource> reference"
        )

    resource_name = f"{match.group(1)}.xml"
    resource_root = manifest_path.parent / "res"
    config_paths = sorted(
        directory / resource_name
        for directory in resource_root.glob("xml*")
        if directory.is_dir() and (directory.name == "xml" or directory.name.startswith("xml-"))
        and (directory / resource_name).is_file()
    )
    if not config_paths:
        raise PolicyError(f"referenced network security config is missing under {resource_root}: {resource_name}")

    variant_policies = [(path, set(parse_config(path))) for path in config_paths]
    reference_policy = variant_policies[0][1]
    for config_path, policy in variant_policies[1:]:
        if policy != reference_policy:
            raise PolicyError(
                "resource-qualified network security configs must have identical cleartext policies; "
                f"{config_paths[0]} and {config_path} differ"
            )
    return sorted(reference_policy)


def parse_allowlist(allowlist_path: Path) -> set[tuple[str, bool]]:
    entries: set[tuple[str, bool]] = set()
    try:
        lines = allowlist_path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise PolicyError(f"unable to read cleartext allowlist {allowlist_path}: {error}") from error

    for line_number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in line.split(";")]
        if not parts or not parts[0].startswith("host="):
            raise PolicyError(f"allowlist line {line_number} must use host=<fqdn>[;includeSubdomains=true|false]")
        host = canonical_host(parts[0][len("host=") :], f"allowlist line {line_number} host")
        include_subdomains = False
        if len(parts) > 2 or (len(parts) == 2 and not parts[1].startswith("includeSubdomains=")):
            raise PolicyError(f"allowlist line {line_number} has unsupported fields")
        if len(parts) == 2:
            include_subdomains = parse_boolean(
                parts[1][len("includeSubdomains=") :],
                f"allowlist line {line_number} includeSubdomains",
            )
        entry = (host, include_subdomains)
        if entry in entries:
            raise PolicyError(f"allowlist line {line_number} duplicates {host}")
        entries.add(entry)
    return entries


def validate(manifest_path: Path, allowlist_path: Path) -> list[tuple[str, bool]]:
    active_domains = parse_manifest(manifest_path)
    allowlisted_domains = parse_allowlist(allowlist_path)
    active_set = set(active_domains)
    if active_set != allowlisted_domains:
        missing = sorted(active_set - allowlisted_domains)
        stale = sorted(allowlisted_domains - active_set)
        details = []
        if missing:
            details.append(f"missing allowlist entries: {missing}")
        if stale:
            details.append(f"stale/unused allowlist entries: {stale}")
        raise PolicyError("cleartext allowlist must exactly match enabled domains; " + "; ".join(details))
    return active_domains


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("allowlist", type=Path)
    args = parser.parse_args()
    try:
        active_domains = validate(args.manifest, args.allowlist)
    except PolicyError as error:
        print(f"::error::Android cleartext policy: {error}", file=sys.stderr)
        return 1

    if active_domains:
        formatted = ", ".join(
            f"{host}{';includeSubdomains=true' if include_subdomains else ''}"
            for host, include_subdomains in sorted(active_domains)
        )
        print(f"Android cleartext policy: explicitly allowlisted domains: {formatted}")
    else:
        print("Android cleartext policy: no cleartext traffic is enabled and the allowlist is empty.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
