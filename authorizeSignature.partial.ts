  const authorizeSignature = async (request: SignRequest): Promise<SignResult> => {
    const pin = currentPinRef.current;
    const seedVault = state.walletConfig?.seedVault;
    if (!pin || !seedVault) {
      throw new Error('Master Seed missing from session vault.');
    }

    // Hardening: Explicit confirmation for message signing (BIP-322 / Login)
    if (request.type === 'message') {
        const confirmed = await new Promise<boolean>((resolve) => {
            setPendingSignRequest({
                request,
                resolve: (val) => resolve(val)
            });
        });
        setPendingSignRequest(null);
        if (!confirmed) throw new Error('Signature request declined by user.');
    }

    // Check if running on Android/iOS native runtime
    const isNative = (window as any).Capacitor?.isNativePlatform();

    if (isNative) {
       try {
          return await requestEnclaveSignature(request, seedVault, undefined);
       } catch (e: any) {
          console.warn("Session Native Cache Miss/Expired, falling back to explicit PIN", e);
          return await requestEnclaveSignature(request, seedVault, pin);
       }
    } else {
       const seed = await decryptSeed(seedVault, pin);
       try {
         return await requestEnclaveSignature(request, seed);
       } finally {
         seed.fill(0);
       }
    }
  };
