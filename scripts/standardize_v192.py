import os
import re

ALIGNMENT_DATE = "2026-04-18"
VERSION = "1.9.2"

FILES_TO_UPDATE = [
    "README.md",
    "AGENTS.md",
    "CHANGELOG.md",
    "Business_State.md",
    "PRD.md",
    "docs/business/PRD.md",
    "docs/CSF_MAINNET_READINESS_GATE.md",
    "docs/protocols/IMPLEMENTATION_REGISTRY.md",
    "docs/operations/SAB_WALLET_MAP.md",
    "docs/operations/ACTION_INDEX.md",
    "SECURITY.md",
    "lib-conxian-core/CHANGELOG.md",
    "lib-conxian-core/docs/AUDIT_LIB_CONXIAN_CORE.md"
]

def update_content(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - Not found")
        return

    with open(filepath, 'r') as f:
        content = f.read()

    # Standardize dates
    new_content = re.sub(r'Last Updated: \d{4}-\d{2}-\d{2}', f'Last Updated: {ALIGNMENT_DATE}', content)
    new_content = re.sub(r'Updated: [A-Z][a-z]+ \d{1,2}, \d{4}', f'Updated: April 18, 2026', new_content)
    new_content = re.sub(r'As of: \d{4}-\d{2}-\d{2}', f'As of: {ALIGNMENT_DATE}', new_content)
    new_content = re.sub(r'Last Audit Date: \d{4}-\d{2}-\d{2}', f'Last Audit Date: {ALIGNMENT_DATE}', new_content)
    new_content = re.sub(r'2026-04-12', f'{ALIGNMENT_DATE}', new_content)
    new_content = re.sub(r'2026-03-12', f'{ALIGNMENT_DATE}', new_content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes needed for {filepath}")

for fp in FILES_TO_UPDATE:
    update_content(fp)
