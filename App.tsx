
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
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import SystemDiagnostics from './components/SystemDiagnostics';
import LockScreen from './components/LockScreen';
import ToastContainer, { ToastMessage, ToastType } from './components/Toast';
import { Shield, Loader2, Zap, FlaskConical, ShieldCheck, Lock, Terminal, Cpu, CheckCircle2, RotateCcw, Database } from 'lucide-react';
import { AppState, WalletConfig, Asset, Bounty, AppMode } from './types';
import { AppContext } from './context';
import { MOCK_ASSETS } from './constants';
import { Language, getTranslation } from './services/i18n';
import { encryptState, decryptState } from './services/storage';

const STORAGE_KEY = 'conxius_enclave_v3_encrypted';

const INITIAL_BOUNTIES: Bounty[] = [
  { id: 'B-402', title: 'Implement BitVM Fraud Proofs', description: 'Port the L2 verification logic to the Conxius Enclave.', reward: '0.042 BTC', category: 'Core', status: 'Open', difficulty: 'Elite', expiry: 'Dec 12' },
  { id: 'B-403', title: 'Local-First Indexer Opt', description: 'Reduce memory footprint of the UTXO indexer by 30%.', reward: '25,000 STX', category: 'Security', status: 'Open', difficulty: 'Intermediate', expiry: 'Jan 05' },
  { id: 'B-404', title: 'Nostr Identity Themes', description: 'Design 5 new pixel-art themes for Sovereign Passes.', reward: '500,000 SATS', category: 'UI/UX', status: 'Open', difficulty: 'Beginner', expiry: 'Nov 30' },
];

const DEFAULT_STATE: AppState & { language: Language } = {
  version: '1.3.0',
  mode: 'simulation',
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
  }
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
  const currentPinRef = useRef<string | null>(null);

  // Persistence Logic
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setIsLocked(true); // Enclave found, lock immediately
    }
  }, []);

  const persistState = async (newState: any, pin: string) => {
    try {
      const encrypted = await encryptState(newState, pin);
      localStorage.setItem(STORAGE_KEY, encrypted);
    } catch (e) {
      notify('error', 'Encryption Failed: State not saved');
    }
  };

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
    console.log(activeTab);
  }, [activeTab]);

  const BOOT_SEQUENCE = [
    { text: "BIP-322 Verification...", icon: Lock },
    { text: "Tor V3 Tunnel Stable...", icon:  Shield },
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

  const notify = (type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleUnlock = async (pin: string) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const decryptedState = await decryptState(saved, pin);
      setState({ ...DEFAULT_STATE, ...decryptedState });
      currentPinRef.current = pin;
      setIsLocked(false);
      setLockError(false);
      notify('success', 'Enclave Decrypted Successfully');
    } catch (e) {
      setLockError(true);
      notify('error', 'Decryption Failed: Invalid PIN');
    }
  };

  const setPrivacyMode = (val: boolean) => setState(prev => ({ ...prev, privacyMode: val }));
  const toggleGateway = (val: boolean) => setState(prev => ({ ...prev, externalGatewaysActive: val }));
  const setMainnetLive = (val: boolean) => setState(prev => ({ ...prev, isMainnetLive: val }));
  const updateFees = (val: number) => setState(prev => ({ ...prev, integratorFeesAccumulated: prev.integratorFeesAccumulated + val }));
  const updateAssets = (assets: Asset[]) => setState(prev => ({ ...prev, assets }));
  const setLanguage = (language: Language) => setState(prev => ({ ...prev, language }));
  const lockWallet = () => {
     currentPinRef.current = null;
     setIsLocked(true);
  };
  
  const setWalletConfig = (config: WalletConfig & { mode: AppMode }, pin?: string) => {
     const initialAssets = config.mode === 'sovereign' ? [] : MOCK_ASSETS;
     if (pin) currentPinRef.current = pin;
     setState(prev => ({ 
        ...prev, 
        mode: config.mode,
        walletConfig: config,
        assets: initialAssets,
     }));
  };

  const claimBounty = (id: string) => setState(prev => ({
    ...prev,
    bounties: prev.bounties.map(b => b.id === id ? { ...b, status: 'Claimed', claimedBy: 'LocalEnclave' } : b)
  }));

  const resetEnclave = () => {
    if (confirm("Purge Enclave? Terminal state wipe.")) {
      localStorage.removeItem(STORAGE_KEY);
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
      case 'menu': return <MobileMenu setActiveTab={setActiveTab} activeTab={activeTab} />;
      case 'payments': return <PaymentPortal />;
      case 'citadel': return <CitadelManager />;
      case 'utxos': return <div className="p-8"><UTXOManager /></div>;
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
              <div 
                className="h-full bg-orange-500 transition-all duration-500" 
                style={{ width: `${((bootStep + 1) / BOOT_SEQUENCE.length) * 100}%` }} 
              />
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
    return <LockScreen onUnlock={handleUnlock} isError={lockError} />;
  }

  if (!state.walletConfig) {
    return (
      <AppContext.Provider value={{ state, setPrivacyMode, updateFees, toggleGateway, setMainnetLive, setWalletConfig, updateAssets, claimBounty, resetEnclave, setLanguage, notify, lockWallet }}>
        <Onboarding onComplete={(config, pin) => { if (config) setWalletConfig(config as any, pin); }} />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={{ state, setPrivacyMode, updateFees, toggleGateway, setMainnetLive, setWalletConfig, updateAssets, claimBounty, resetEnclave, setLanguage, notify, lockWallet }}>
      <div className={`flex bg-zinc-950 text-zinc-100 min-h-screen selection:bg-orange-500/30 overflow-hidden`}>
        <div className="hidden md:block">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <main className="flex-1 overflow-y-auto relative pb-24 md:pb-0 custom-scrollbar">
          <div className="h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-6 md:px-8 sticky top-0 z-50">
            <div className="flex items-center gap-3">
               <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                 state.isMainnetLive 
                   ? 'bg-zinc-100 text-zinc-950 border-zinc-100' 
                   : state.mode === 'sovereign'
                     ? 'bg-green-500/10 text-green-500 border-green-500/20'
                     : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
               }`}>
                 {state.isMainnetLive ? t('status.stable') : state.mode === 'sovereign' ? t('status.sovereign') : t('status.simulation')}
               </span>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Sovereignty</p>
                  <p className="text-xs font-mono font-bold text-orange-500">{state.sovereigntyScore}/100</p>
               </div>
               <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-yellow-500 cursor-pointer hover:scale-105 transition-transform" onClick={lockWallet} title="Lock Enclave">
                  <Lock size={14} className="text-white mx-auto mt-2" />
               </div>
            </div>
          </div>
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
