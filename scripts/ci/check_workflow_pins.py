#!/usr/bin/env python3
"""Fail closed when a repository workflow references a mutable action ref."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from pathlib import PurePosixPath


USES_PATTERN = re.compile(r"^\s*(?:-\s+)?uses:\s*([^\s#]+)")
REMOTE_ACTION_PATTERN = re.compile(r"^[^\s/@]+/[^\s@]+@[0-9a-fA-F]{40}$")
ARTIFACT_ACTIONS = {"actions/upload-artifact", "actions/download-artifact"}


def artifact_action_pins() -> dict[str, set[str]]:
    """Read the curated upstream tag-to-commit catalog, never a mutable ref."""
    path = Path(__file__).with_name("artifact_action_pins.json")
    if path.stat().st_size > 8192:
        raise ValueError("artifact action pin catalog exceeds bound")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or set(data) != {"schema_version", "actions"} or type(data["schema_version"]) is not int or data["schema_version"] != 1:
        raise ValueError("invalid artifact action pin catalog")
    actions = data["actions"]
    if not isinstance(actions, dict) or set(actions) != ARTIFACT_ACTIONS:
        raise ValueError("invalid artifact action catalog scope")
    result: dict[str, set[str]] = {}
    for action, versions in actions.items():
        if not isinstance(versions, dict) or not versions:
            raise ValueError("missing reviewed artifact action pins")
        for version, sha in versions.items():
            if not re.fullmatch(r"v\d+\.\d+\.\d+", version) or not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{40}", sha):
                raise ValueError("invalid artifact action tag or SHA")
        result[action] = set(versions.values())
    return result


def check_workflows(workflow_root: Path) -> list[str]:
    errors: list[str] = []
    try:
        artifact_pins = artifact_action_pins()
    except (OSError, ValueError, TypeError):
        return ["artifact action pin catalog unavailable or invalid"]
    workflow_files = sorted((*workflow_root.rglob("*.yml"), *workflow_root.rglob("*.yaml")))
    if not workflow_files:
        return [f"no workflow files found under {workflow_root}"]

    for path in workflow_files:
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            match = USES_PATTERN.match(line)
            if not match:
                continue

            reference = match.group(1).strip("'\"")
            if reference.startswith("./"):
                local_path = PurePosixPath(reference[2:])
                if "@" in reference or ".." in local_path.parts:
                    errors.append(f"{path}:{line_number}: local reference must stay within the repository: {reference}")
                continue

            if reference.startswith(".github/"):
                errors.append(f"{path}:{line_number}: local references must use the ./... form: {reference}")
                continue

            if not REMOTE_ACTION_PATTERN.fullmatch(reference):
                errors.append(
                    f"{path}:{line_number}: uses reference must end in a verified 40-character commit SHA: {reference}"
                )
                continue

            action, sha = reference.rsplit("@", 1)
            action = action.lower()
            if action in artifact_pins and sha.lower() not in artifact_pins[action]:
                errors.append(
                    f"{path}:{line_number}: artifact action commit is not in the reviewed upstream pin catalog: {reference}"
                )

    return errors


def main() -> int:
    workflow_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".github/workflows")
    errors = check_workflows(workflow_root)
    if errors:
        for error in errors:
            print(f"::error::{error}", file=sys.stderr)
        return 1

    print(f"Workflow pin verification passed: {workflow_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
