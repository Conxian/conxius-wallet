import sys

with open('components/PaymentPortal.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip_next = False
for i, line in enumerate(lines):
    if skip_next:
        skip_next = False
        continue

    # Check for duplicate estimateFees import
    if 'import { estimateFees, FeeEstimation } from "../services/FeeEstimator";' in line:
        if any('import { estimateFees, FeeEstimation }' in l for l in new_lines):
            continue

    # Check for duplicate useEffect with updateFees
    if 'const updateFees = async () => {' in line:
        # If we already have one, skip this block
        if any('const updateFees = async () => {' in l for l in new_lines):
            # Skip until the end of this useEffect
            j = i
            brace_count = 0
            while j < len(lines):
                brace_count += lines[j].count('{')
                brace_count -= lines[j].count('}')
                if brace_count == 0 and '}, [amount, method, recipient' in lines[j]:
                    break
                j += 1
            # We found the end of the block. We need to skip up to j.
            # But wait, this is tricky. Let's just use a simpler check.
            pass

    new_lines.append(line)

# Actually, let's just use a more surgical approach.
content = "".join(lines)
import_str = 'import { estimateFees, FeeEstimation } from "../services/FeeEstimator";\n'
if content.count(import_str) > 1:
    content = content.replace(import_str, "", content.count(import_str) - 1)

# For the useEffect, it's harder to replace exact counts of blocks.
# I'll just look for the pattern and keep only the first one.
import re
pattern = r'\n\s+useEffect\(\(\) => \{\n\s+const updateFees = async \(\) => \{.*?\}, \[amount, method, recipient, context\?\.state\.network\]\);'
matches = list(re.finditer(pattern, content, re.DOTALL))
if len(matches) > 1:
    # Keep the first one, remove others
    for match in reversed(matches[1:]):
        content = content[:match.start()] + content[match.end():]

# Check for UI duplicates
ui_pattern = r'\{feeEstimation && \(.*?\}\)\}'
ui_matches = list(re.finditer(ui_pattern, content, re.DOTALL))
if len(ui_matches) > 1:
    for match in reversed(ui_matches[1:]):
        content = content[:match.start()] + content[match.end():]

with open('components/PaymentPortal.tsx', 'w') as f:
    f.write(content)
