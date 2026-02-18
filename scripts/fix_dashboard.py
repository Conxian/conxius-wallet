import sys

with open('components/Dashboard.tsx', 'r') as f:
    content = f.read()

search_text = """  const [receiveLayer, setReceiveLayer] = useState<BitcoinLayer>('Mainnet');

  if (!appContext) return null;
  const { mode, network, assets, privacyMode, walletConfig, language } = appContext.state;"""

replace_text = """  const [receiveLayer, setReceiveLayer] = useState<BitcoinLayer>('Mainnet');

  const { mode, network, assets, privacyMode, walletConfig, language } = appContext?.state || {
    mode: 'simulation',
    network: 'mainnet',
    assets: [],
    privacyMode: false,
    walletConfig: null,
    language: 'en'
  };"""

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    # Also need to remove the early return if there is another one or just make sure it's not returning null too early
    # Wait, the above replacement already removes 'if (!appContext) return null;'

    # We also need to add 'if (!appContext) return null;' at the end of hooks
    # Let's find where the hooks end.
    # The hooks in this component seem to end around line 134 (getBip21Uri is after hooks)

    hook_end_search = "  const t = (key: string) => getTranslation(language, key);"
    hook_end_replace = "  if (!appContext) return null;\n\n  const t = (key: string) => getTranslation(language, key);"

    if hook_end_search in new_content:
        new_content = new_content.replace(hook_end_search, hook_end_replace)
        with open('components/Dashboard.tsx', 'w') as f:
            f.write(new_content)
        print("Successfully fixed Dashboard.tsx")
    else:
        print("Could not find hook end marker")
else:
    print("Could not find search text")
