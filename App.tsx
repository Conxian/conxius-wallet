
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import NTTBridge from './components/NTTBridge';
import IdentityManager from './components/IdentityManager';
import StackingManager from './components/StackingManager';
import PaymentPortal from './components/PaymentPortal';
import NodeSettings from './components/NodeSettings';
import PrivacyEnclave from './components/PrivacyEnclave';
import Security from './components/Security';
import Settings from './components/Settings';
import SatoshiAIChat from './components/SatoshiAIChat';
import RewardsHub from './components/RewardsHub';
import Benchmarking from './components/Benchmarking';
import InvestorDashboard from './components/InvestorDashboard';
import ReleaseManager from './components/ReleaseManager';
import HandoffProtocol from './components/HandoffProtocol';
import LabsExplorer from './components/LabsExplorer';
import GovernancePortal from './components/GovernancePortal';
import ReserveSystem from './components/ReserveSystem';
import Documentation from './components/Documentation';
import MobileMenu from './components/MobileMenu';
import DeFiDashboard from './components/DeFiDashboard';
import CitadelManager from './components/CitadelManager';
import Onboarding from './components/Onboarding';
import UTXOManager from './components/UTXOManager';
import SilentPayments from './components/SilentPayments';
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import SystemDiagnostics from './components/SystemDiagnostics';
import Web3Browser from './components/Web3Browser';
import LockScreen from './components/LockScreen';
import ToastContainer, { ToastMessage, ToastType } from './components/Toast';
import { Shield as ShieldIcon, Loader2, Zap, FlaskConical, ShieldCheck, Lock, Terminal, Cpu, CheckCircle2, RotateCcw, Database } from 'lucide-react';
import './styles/progress.css';
import { AppState, WalletConfig, Asset, Bounty, AppMode, Network, LnBackendConfig } from './types';
import { AppContext } from './context';
import { MOCK_ASSETS } from './constants';
import { Language, getTranslation } from './services/i18n';
import { encryptState, decryptState, isLegacyBlob } from './services/storage';
import { encryptSeed } from './services/seed';
import * as bip39 from 'bip39';
import { decryptSeed } from './services/seed';
import { requestEnclaveSignature, SignRequest, SignResult } from './services/signer';
import { clearEnclaveBiometricSession, getEnclaveBlob, hasEnclaveBlob, removeEnclaveBlob, setEnclaveBlob, SecureEnclave } from './services/enclave-storage';
import { notificationService } from './services/notifications';
import { setGeminiApiKey as setGeminiServiceKey } from './services/gemini';

const STORAGE_KEY = 'conxius_enclave_v3_encrypted';

const INITIAL_BOUNTIES: Bounty[] = [
  { id: 'B-402', title: 'Implement BitVM Fraud Proofs', description: 'Port the L2 verification logic to the Conxius Enclave.', reward: '0.042 BTC', category: 'Core', status: 'Open', difficulty: 'Elite', expiry: 'Dec 12' },
  { id: 'B-403', title: 'Local-First Indexer Opt', description: 'Reduce memory footprint of the UTXO indexer by 30%.', reward: '25,000 STX', category: 'Security', status: 'Open', difficulty: 'Intermediate', expiry: 'Jan 05' },
  { id: 'B-404', title: 'Nostr Identity Themes', description: 'Design 5 new pixel-art themes for Sovereign Passes.', reward: '500,000 SATS', category: 'UI/UX', status: 'Open', difficulty: 'Beginner', expiry: 'Nov 30' },
];

const DEFAULT_STATE: AppState & { language: Language } = {
  version: '0.3.0',
  mode: 'sovereign',
  network: 'mainnet',
  language: 'en',
  privacyMode: false,
  nodeSyncProgress: 100,
  integratorFeesAccumulated: 0.00042,
  sovereigntyScore: 100,
  isTorActive: true,
  deploymentReadiness: 100,
  externalGatewaysActive: false,
  isMainnetLive: false,
  walletConfig: undefined,
  assets: [], // Default to empty, load mocks only if explicit simulation
  bounties: INITIAL_BOUNTIES,
  dataSharing: {
    enabled: false,
    aiCapBoostActive: false,
    minAskPrice: 50,
    totalEarned: 0
  },
  security: {
    autoLockMinutes: 5
  },
  geminiApiKey: undefined
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [bootStep, setBootStep] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [state, setState] = useState<AppState & { language: Language }>(DEFAULT_STATE);
  
  // Security & UX State
  const [isLocked, setIsLocked] = useState(false);
  const [lockError, setLockError] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [enclaveChecked, setEnclaveChecked] = useState(false);
  const [enclaveExists, setEnclaveExists] = useState(false);
  const currentPinRef = useRef<string | null>(null);

  // Auto-lock timer
  useEffect(() => {
    let timer: any;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      const minutes = state.security?.autoLockMinutes ?? 5;
      timer = setTimeout(() => {
        clearEnclaveBiometricSession();
        setIsLocked(true);
        notify('warning', 'Session expired for your security.', 'Vault Auto-Locked');
      }, minutes * 60 * 1000);
    };
    ['mousemove','mousedown','keypress','touchstart'].forEach(evt => window.addEventListener(evt, resetTimer));
    resetTimer();
    return () => {
      ['mousemove','mousedown','keypress','touchstart'].forEach(evt => window.removeEventListener(evt, resetTimer));
      if (timer) clearTimeout(timer);
    };
  }, [state.security?.autoLockMinutes]);

  // Persistence Logic
  useEffect(() => {
    notificationService.requestPermissions();
    hasEnclaveBlob(STORAGE_KEY)
      .then(exists => {
        setEnclaveExists(exists);
        if (exists) setIsLocked(true);
      })
      .finally(() => setEnclaveChecked(true));
  }, []);

  const sanitizeStateForPersistence = (s: any) => {
    const next: any = { ...s };
    if (next.walletConfig) {
      next.walletConfig = { ...next.walletConfig };
      delete next.walletConfig.mnemonic;
      delete next.walletConfig.passphrase;
    }
    if (next.lnBackend && next.lnBackend.type && next.lnBackend.type !== 'None' && next.lnBackend.type !== 'LND') {
      next.lnBackend = { type: 'None' };
    }
    return next;
  };

  const persistState = async (newState: any, pin: string) => {
    try {
      const encrypted = await encryptState(sanitizeStateForPersistence(newState), pin);
      await setEnclaveBlob(STORAGE_KEY, encrypted, { requireBiometric: !!newState.security?.biometricUnlock });
    } catch (e) {
      const msg = typeof (e as any)?.message === 'string' ? (e as any).message : '';
      if (msg.toLowerCase().includes('auth required')) {
        notify('warning', 'Re-authenticate to keep state in biometric vault');
      } else {
        notify('error', 'Encryption Failed: State not saved');
      }
    }
  };

  useEffect(() => {
    setGeminiServiceKey(state.geminiApiKey || '');
  }, [state.geminiApiKey]);

  useEffect(() => {
    if (state.walletConfig && currentPinRef.current) {
      // Debounce saving or simple save for now
      const timeout = setTimeout(() => {
         persistState(state, currentPinRef.current!);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [state]);

  useEffect(() => {
  }, [activeTab]);

  const BOOT_SEQUENCE = [
    { text: "BIP-322 Verification...", icon: Lock },
    { text: "Tor V3 Tunnel Stable...", icon: ShieldIcon },
    { text: "BIP-84 Roots Loaded...", icon: Cpu },
    { text: "Sovereignty Confirmed.", icon: CheckCircle2 }
  ];

  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      if (step < BOOT_SEQUENCE.length - 1) {
        step++;
        setBootStep(step);
      } else {
        clearInterval(interval);
        setTimeout(() => setIsBooting(false), 800);
      }
    }, 350);
    return () => clearInterval(interval);
  }, []);

  const notify = async (type: ToastType, message: string, title?: string) => {
    const defaultTitle = type === 'error' ? 'Security Alert' : type === 'success' ? 'Operation Success' : 'Wallet Update';
    const event = await notificationService.notify({
      category: (type === 'error' || type === 'warning') ? 'SECURITY' : 'SYSTEM',
      type,
      title: title || defaultTitle,
      message
    });

    setToasts(prev => [...prev, { id: event.id, type: event.type, message: event.message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== event.id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleUnlock = async (pin: string) => {
    try {
      const saved = await getEnclaveBlob(STORAGE_KEY, { requireBiometric: !!state.security?.biometricUnlock });
      if (!saved) return;
      if (state.security?.duressPin && pin === state.security.duressPin) {
        // Duress Mode: Immediately wipe the persistent enclave data and revert to decoy state.
        await removeEnclaveBlob(STORAGE_KEY);
        setState({ ...DEFAULT_STATE, assets: [], walletConfig: undefined });
        currentPinRef.current = null;
        setEnclaveExists(false);
        setIsLocked(false);
        setLockError(false);
        notify('warning', 'Duress mode activated. Vault purged.');
        return;
      }
      const decryptedState = await decryptState(saved, pin);
      const nextState: any = { ...DEFAULT_STATE, ...decryptedState };
      if (nextState.walletConfig) {
        const walletConfig: any = { ...nextState.walletConfig };

        // Migration/Upgrade: Ensure seedVault and mnemonicVault exist
        if (typeof walletConfig.mnemonic === 'string') {
          const seedBytes = await bip39.mnemonicToSeed(walletConfig.mnemonic, walletConfig.passphrase || undefined);
          if (!walletConfig.seedVault) {
            walletConfig.seedVault = await encryptSeed(new Uint8Array(seedBytes), pin);
          }
          if (!walletConfig.mnemonicVault) {
            walletConfig.mnemonicVault = await encryptSeed(new TextEncoder().encode(walletConfig.mnemonic), pin);
          }
        }

        delete walletConfig.mnemonic;
        delete walletConfig.passphrase;
        nextState.walletConfig = walletConfig;
      }
      if (nextState.lnBackend && nextState.lnBackend.type && nextState.lnBackend.type !== 'None' && nextState.lnBackend.type !== 'LND') {
        nextState.lnBackend = { type: 'None' };
      }
      setState(nextState);
      currentPinRef.current = pin;
      setEnclaveExists(true);
      setIsLocked(false);
      setLockError(false);
      
      // Migration: If legacy blob detected, re-encrypt immediately to harden
      if (isLegacyBlob(saved)) {
         persistState(nextState, pin);
         notify('success', 'Vault Upgraded to V2 Security');
      }
      
      // Phase 3: Optimize Session - Unlock Cache
      if ((window as any).Capacitor?.isNativePlatform() && nextState.walletConfig?.seedVault) {
          SecureEnclave.unlockSession({ 
              vault: nextState.walletConfig.seedVault, 
              pin 
          }).catch(e => console.warn("Failed to unlock enclave session cache:", e));
      }

      notify('success', 'Enclave Decrypted Successfully');
    } catch (e) {
      setLockError(true);
      const msg = typeof (e as any)?.message === 'string' ? (e as any).message : '';
      if (msg.toLowerCase().includes('auth required')) {
        notify('error', 'Biometric authentication required');
      } else {
        notify('error', 'Decryption Failed: Invalid PIN');
      }
    }
  };

  const setPrivacyMode = (val: boolean) => setState(prev => ({ ...prev, privacyMode: val }));
  const toggleGateway = (val: boolean) => setState(prev => ({ ...prev, externalGatewaysActive: val }));
  const setMainnetLive = (val: boolean) => setState(prev => ({ ...prev, isMainnetLive: val }));
  const updateFees = (val: number) => setState(prev => ({ ...prev, integratorFeesAccumulated: prev.integratorFeesAccumulated + val }));
  const updateAssets = (assets: Asset[]) => setState(prev => ({ ...prev, assets }));
  const setLanguage = (language: Language) => setState(prev => ({ ...prev, language }));
  const setNetwork = (network: Network) => setState(prev => ({ ...prev, network }));
  const setMode = (mode: AppMode) => setState(prev => ({ 
    ...prev, 
    mode,
    assets: mode === 'simulation' ? MOCK_ASSETS : []
  }));
  const setLnBackend = (cfg: LnBackendConfig) => setState(prev => ({ ...prev, lnBackend: cfg }));
  const setSecurity = (s: Partial<AppState['security']>) => setState(prev => ({ ...prev, security: { ...prev.security, ...s } as any }));
  const setGeminiApiKey = (key: string) => setState(prev => ({ ...prev, geminiApiKey: key }));
  const lockWallet = () => {
     currentPinRef.current = null;
     clearEnclaveBiometricSession();
     setIsLocked(true);
  };

  const authorizeSignature = async (request: SignRequest): Promise<SignResult> => {
    const pin = currentPinRef.current;
    const seedVault = state.walletConfig?.seedVault;
    if (!pin || !seedVault) {
      throw new Error('Master Seed missing from session vault.');
    }
    
    // Check if running on Android/iOS native runtime
    // @ts-ignore - Vite defines this globally usually or we check window
    const isNative = (window as any).Capacitor?.isNativePlatform();

    if (isNative) {
       // Phase 3: Fast Path (Session Cache)
       // We try to pass undefined PIN first if we believe session is active. 
       // Currently requestEnclaveSignature handles "undefined" pin by calling signNative without PIN.
       // SecureEnclavePlugin.java checks cache if PIN is null.
       
       // Note: We still pass vault string because the plugin needs salt/IV from it to verify/decrypt.
       try {
          return await requestEnclaveSignature(request, seedVault, undefined); 
       } catch (e: any) {
          // If session expired (Native cache cleared), fallback to explicit PIN (Slow Path)
          console.warn("Session Native Cache Miss/Expired, falling back to explicit PIN", e);
          return await requestEnclaveSignature(request, seedVault, pin);
       }
    } else {
       // Web Fallback: Decrypt in JS memory
       const seed = await decryptSeed(seedVault, pin);
       try {
         return await requestEnclaveSignature(request, seed);
       } finally {
         seed.fill(0);
       }
    }
  };
  
  const setWalletConfig = (config: WalletConfig & { mode?: AppMode }, pin?: string) => {
     const effectiveMode: AppMode = config.mode ?? 'sovereign';
     const initialAssets = effectiveMode === 'sovereign' ? [] : MOCK_ASSETS;
     if (pin) currentPinRef.current = pin;
     setState(prev => ({ 
        ...prev, 
        mode: effectiveMode,
        walletConfig: config,
        assets: initialAssets,
        sovereigntyScore: config.backupVerified ? 100 : 70
     }));
  };

  const claimBounty = (id: string) => setState(prev => ({
    ...prev,
    bounties: prev.bounties.map(b => b.id === id ? { ...b, status: 'Claimed', claimedBy: 'LocalEnclave' } : b)
  }));

  const resetEnclave = () => {
    if (confirm("Purge Enclave? Terminal state wipe.")) {
      removeEnclaveBlob(STORAGE_KEY);
      setEnclaveExists(false);
      window.location.reload();
    }
  };

  const t = (key: string) => getTranslation(state.language, key);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'diagnostics': return <SystemDiagnostics />;
      case 'studio': return <Studio />;
      case 'bazaar': return <Marketplace />;
      case 'browser': return <Web3Browser />;
      case 'menu': return <MobileMenu setActiveTab={setActiveTab} activeTab={activeTab} />;
      case 'payments': return <PaymentPortal />;
      case 'citadel': return <CitadelManager />;
      case 'utxos': return <div className="p-8"><UTXOManager /></div>;
      case 'silent-payments': return <div className="p-8"><SilentPayments /></div>;
      case 'defi': return <DeFiDashboard />;
      case 'rewards': return <RewardsHub />;
      case 'labs': return <LabsExplorer />;
      case 'governance': return <GovernancePortal />;
      case 'reserves': return <ReserveSystem />;
      case 'benchmark': return <Benchmarking />;
      case 'docs': return <Documentation />;
      case 'investor': return <InvestorDashboard />;
      case 'handoff': return <ReleaseManager />;
      case 'deploy': return <HandoffProtocol />;
      case 'stacking': return <StackingManager />;
      case 'bridge': return <NTTBridge />;
      case 'identity': return <IdentityManager />;
      case 'nodes': return <NodeSettings />;
      case 'privacy': return <PrivacyEnclave />;
      case 'security': return <Security />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  if (isBooting) {
    const CurrentIcon = BOOT_SEQUENCE[bootStep].icon;
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center z-[1000] p-6 text-center font-mono">
        <div className="w-24 h-24 bg-zinc-900 rounded-[2.5rem] flex items-center justify-center mb-10 border border-zinc-800 shadow-2xl relative overflow-hidden">
          <FlaskConical size={48} className="text-orange-500 fill-current relative z-10" />
        </div>
        <div className="space-y-6 max-w-md w-full">
           <CurrentIcon size={24} className="animate-pulse text-orange-500 mx-auto" />
           <h1 className="text-3xl font-black tracking-tighter text-zinc-100 uppercase italic">
              Conxius<span className="text-orange-500">Labs</span>
           </h1>
           <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              {(() => {
                const pct = Math.round(((bootStep + 1) / BOOT_SEQUENCE.length) * 100);
                const quant = Math.min(100, Math.max(0, Math.round(pct / 5) * 5));
                return <div className={`h-full bg-orange-500 transition-all duration-500 progress-${quant}`} />;
              })()}
           </div>
           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
              {BOOT_SEQUENCE[bootStep].text}
           </p>
        </div>
      </div>
    );
  }

  // Lock Screen Intercept
  if (isLocked) {
    return (
      <>
        <LockScreen
          onUnlock={handleUnlock}
          isError={lockError}
          requireBiometric={state.security?.biometricUnlock ?? false}
          onResetWallet={resetEnclave}
        />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </>
    );
  }

  if (!enclaveChecked) {
    return (
      <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Checking Vault</p>
          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!state.walletConfig) {
    if (enclaveExists) {
      return (
        <LockScreen
          onUnlock={handleUnlock}
          isError={lockError}
          requireBiometric={state.security?.biometricUnlock ?? false}
          onResetWallet={resetEnclave}
        />
      );
    }
    return (
      <AppContext.Provider value={{ state, setPrivacyMode, updateFees, toggleGateway, setMainnetLive, setWalletConfig, updateAssets, claimBounty, resetEnclave, setLanguage, notify, authorizeSignature, lockWallet, setNetwork, setMode, setLnBackend, setSecurity, setGeminiApiKey }}>
        <Onboarding onComplete={(config, pin) => { if (config) setWalletConfig(config as any, pin); }} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={{ state, setPrivacyMode, updateFees, toggleGateway, setMainnetLive, setWalletConfig, updateAssets, claimBounty, resetEnclave, setLanguage, notify, authorizeSignature, lockWallet, setNetwork, setMode, setLnBackend, setSecurity, setGeminiApiKey }}>
      <div className={`flex bg-[var(--bg)] text-[var(--text)] min-h-screen selection:bg-[rgba(247,147,26,0.35)] overflow-hidden`}>
        <div className="hidden md:block">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <main className="flex-1 overflow-y-auto relative pb-24 md:pb-0 custom-scrollbar">
          <div className="h-16 border-b border-[var(--border)] bg-[var(--surface-1)]/80 backdrop-blur-md flex items-center justify-between px-6 md:px-8 sticky top-0 z-50">
            <div className="flex items-center gap-3">
               <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-[var(--border)] md:hidden">
                 <img src="/conxius-logo.svg" alt="Conxius" className="w-full h-full object-cover" />
               </div>
               <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                 state.isMainnetLive 
                   ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]' 
                   : state.mode === 'sovereign'
                    ? 'bg-[rgba(34,197,94,0.12)] text-[var(--success)] border-[rgba(34,197,94,0.35)]'
                    : 'bg-[rgba(251,191,36,0.12)] text-[var(--accent-2)] border-[rgba(251,191,36,0.35)]'
               }`}>
                 {state.isMainnetLive ? t('status.stable') : state.mode === 'sovereign' ? t('status.sovereign') : t('status.simulation')}
               </span>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-black text-[var(--muted)] uppercase tracking-widest">Sovereignty</p>
                  <p className="text-xs font-mono font-bold text-[var(--accent-2)]">{state.sovereigntyScore}/100</p>
               </div>
               <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--success)] to-[var(--accent-2)] cursor-pointer hover:scale-105 transition-transform" onClick={lockWallet} title="Lock Enclave">
                  <Lock size={14} className="text-white mx-auto mt-2" />
               </div>
            </div>
          </div>
          {state.network !== 'mainnet' && (
            <div className="px-6 md:px-8 py-2 bg-amber-600/10 border-b border-amber-600/30 text-amber-600 text-[10px] font-black uppercase tracking-widest sticky top-16 z-40">
              Warning: Non-Mainnet Environment • {state.network.toUpperCase()}
            </div>
          )}
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
          {activeTab !== 'menu' && <SatoshiAIChat />}
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </main>
      </div>
    </AppContext.Provider>
  );
};

export default App;
