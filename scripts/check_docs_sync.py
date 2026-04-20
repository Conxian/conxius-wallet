import os
import re

def check_version_drift(directory, expected_version="v1.9.2"):
    drift_found = False
    for root, dirs, files in os.walk(directory):
        if "node_modules" in dirs: dirs.remove("node_modules")
        if ".git" in dirs: dirs.remove(".git")
        for file in files:
            if file.endswith(".md"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Check for version strings like v1.5.0 or v1.4.0
                    versions = re.findall(r'v1\.[0-5]\.[0-9]', content)
                    if versions and any(v != expected_version for v in versions):
                        print(f"[DRIFT] {path} contains legacy versions: {set(versions)}")
                        drift_found = True
    return drift_found

if __name__ == "__main__":
    print("Checking for documentation version drift...")
    if not check_version_drift("."):
        print("Success: All documentation is aligned to v1.9.2.")
    else:
        print("Warning: Version drift detected in some files.")
