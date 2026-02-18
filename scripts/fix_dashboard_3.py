import sys

with open('components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Replace appContext.updateAssets with appContext?.updateAssets etc.
content = content.replace('appContext.updateAssets', 'appContext?.updateAssets')
content = content.replace("appContext.notify('success'", "appContext?.notify('success'")
content = content.replace("appContext.notify('error'", "appContext?.notify('error'")

with open('components/Dashboard.tsx', 'w') as f:
    f.write(content)
