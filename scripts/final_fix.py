import os
import re

def fix_random(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace (globalThis.crypto as any).getRandomValues(...) with
    # // @ts-ignore
    # globalThis.crypto.getRandomValues(...)
    new_content = re.sub(
        r'\(globalThis\.crypto as any\)\.getRandomValues\((.*?)\)',
        r'// @ts-ignore\n        globalThis.crypto.getRandomValues(\1)',
        content
    )

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed random in {filepath}")

files = ["services/boltz.ts", "services/crypto.worker.ts", "services/worker-manager.ts", "tests/worker-manager.mock.ts"]
for f in files:
    fix_random(f)
