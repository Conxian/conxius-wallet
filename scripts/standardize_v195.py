import os

VERSION = "1.9.5"
ROOT_DIR = "."

def main():
    print(f"Standardizing to {VERSION}...")
    for root, dirs, files in os.walk(ROOT_DIR):
        if '.git' in dirs:
            dirs.remove('.git')
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if 'dist' in dirs:
            dirs.remove('dist')

        for file in files:
            if file == "pnpm-lock.yaml":
                continue

            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Broad replace for version strings
                new_content = content.replace("1.9.2", VERSION)

                if content != new_content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated {path}")
            except (UnicodeDecodeError, PermissionError):
                continue

if __name__ == "__main__":
    main()
