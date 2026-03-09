import os
import re
from datetime import datetime

# Files to check, as per AGENTS.md
files_to_check = [
    ("docs/archive/PROJECT_CONTEXT.md", r"Last Updated: (.*)"),
    ("docs/business/PRD.md", r"Last Updated: (.*)"),
    ("docs/operations/ROADMAP.md", r"Last Updated: (.*)"),
    ("docs/protocols/IMPLEMENTATION_REGISTRY.md", r"Last Updated: (.*)"),
]

latest_timestamp = None
latest_file = None

# Find the most recently updated file
for file_path, _ in files_to_check:
    if os.path.exists(file_path):
        timestamp = os.path.getmtime(file_path)
        if latest_timestamp is None or timestamp > latest_timestamp:
            latest_timestamp = timestamp
            latest_file = file_path

if latest_file is None:
    print("Could not find any of the documentation files to check.")
    exit(1)

# Check all other files against the latest one
all_synced = True
for file_path, _ in files_to_check:
    if file_path != latest_file:
        if not os.path.exists(file_path) or os.path.getmtime(file_path) < latest_timestamp:
            print(f"Warning: {file_path} may be out of sync with {latest_file}.")
            all_synced = False

if all_synced:
    print("All documentation files appear to be in sync.")
