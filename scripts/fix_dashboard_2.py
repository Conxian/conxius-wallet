import sys

with open('components/Dashboard.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'if (!appContext) return null;' not in line:
        new_lines.append(line)

# Find the main return (usually starts with '  return (')
for i, line in enumerate(new_lines):
    if '  return (' in line:
        new_lines.insert(i, '  if (!appContext) return null;\n\n')
        break

with open('components/Dashboard.tsx', 'w') as f:
    f.writelines(new_lines)
