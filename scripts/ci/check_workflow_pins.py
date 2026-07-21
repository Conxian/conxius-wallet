#!/usr/bin/env python3
"""Fail closed when a repository workflow references a mutable action ref."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from pathlib import PurePosixPath


USES_PATTERN = re.compile(r"^\s*uses:\s*([^\s#]+)")
REMOTE_ACTION_PATTERN = re.compile(r"^[^\s/@]+/[^\s@]+@[0-9a-fA-F]{40}$")


def check_workflows(workflow_root: Path) -> list[str]:
    errors: list[str] = []
    workflow_files = sorted((*workflow_root.rglob("*.yml"), *workflow_root.rglob("*.yaml")))
    if not workflow_files:
        return [f"no workflow files found under {workflow_root}"]

    for path in workflow_files:
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            match = USES_PATTERN.match(line)
            if not match:
                continue

            reference = match.group(1)
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
