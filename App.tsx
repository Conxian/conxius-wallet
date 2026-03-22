import React, { useState, useEffect, Suspense, useRef } from 'react';
import {
  Shield,
  Lock,
  FlaskConical,
  Loader2,
  QrCode,
  Copy,
  X,
  ShieldCheck,
  CheckCircle2,
  Network
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import SatoshiAIChat from './components/SatoshiAIChat';
import SystemDiagnostics from './components/SystemDiagnostics';
import Studio from './components/Studio';
import Marketplace from './components/Marketplace';
import Web3Browser from './components/Web3Browser';
import MobileMenu from './components/MobileMenu';
import PaymentPortal from './components/PaymentPortal';
import CitadelManager from './components/CitadelManager';
import UTXOManager from './components/UTXOManager';
import SilentPayments from './components/SilentPayments';
import DeFiDashboard from './components/DeFiDashboard';
import RewardsHub from './components/RewardsHub';
import LabsExplorer from './components/LabsExplorer';
import GovernancePortal from './components/GovernancePortal';
import ReserveSystem from './components/ReserveSystem';
import Benchmarking from './components/Benchmarking';
import Documentation from './components/Documentation';
import InvestorDashboard from './components/InvestorDashboard';
import ReleaseManager from './components/ReleaseManager';
import HandoffProtocol from './components/HandoffProtocol';
import StackingManager from './components/StackingManager';
import NTTBridge from './components/NTTBridge';
import IdentityManager from './components/IdentityManager';
import NodeSettings from './components/NodeSettings';
import PrivacyEnclave from './components/PrivacyEnclave';
import Security from './components/Security';
import SovereignPolicies from './components/SovereignPolicies';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import LockScreen from './components/LockScreen';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import SignLoginMessageModal from './components/SignLoginMessageModal';
import { AppContext } from './context';
import { WalletConfig, BitcoinLayer, AppState } from './types';
import { SignRequest } from './services/signer';
import { getTranslation } from './services/i18n';
import { getEnclaveBlob, persistState, removeEnclaveBlob, STORAGE_KEY } from './services/enclave-storage';
import { notificationService } from './services/notifications';

const BOOT_SEQUENCE = [
  { icon: Shield, text: 'Hardening Enclave...' },
  { icon: Lock, text: 'Mounting Secure Storage...' },
  { icon: FlaskConical, text: 'Initializing Sovereign AI...' },
];

const App: React.FC = () => {
  const [bootStep, setBootStep] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState<any>({
    mode: 'simulation',
    network: 'testnet',
    isMainnetLive: false,
    language: 'en',
    sovereigntyScore: 70,
    assets: [],
    security: { biometricUnlock: false },
    aiConfig: { provider: 'Gemini' }
  });
  const [enclaveChecked, setEnclaveChecked] = useState(false);
  const [enclaveExists, setEnclaveExists] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [lockError, setLockError] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [pendingSignRequest, setPendingSignRequest] = useState<any>(null);

  const currentPinRef = useRef<string | null>(null);

  useEffect(() => {
    const checkEnclave = async () => {
      const exists = !!(await getEnclaveBlob(STORAGE_KEY));
      setEnclaveExists(exists);
      setEnclaveChecked(true);
      if (!exists) setIsLocked(false);
    };
    checkEnclave();

    let step = 0;
    const interval = setInterval(() => {
      if (step < BOOT_SEQUENCE.length - 1) {
        step++;
        setBootStep(step);
      } else {
        clearInterval(interval);
        setTimeout(() => setIsBooting(false), 800);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  const handleUnlock = async (pin: string) => {
    const blob = await getEnclaveBlob(STORAGE_KEY);
    if (blob) {
      currentPinRef.current = pin;
      setState(JSON.parse(blob));
      setIsLocked(false);
      setLockError(false);
    } else {
      setLockError(true);
    }
  };

  const lockWallet = () => {
    setIsLocked(true);
    currentPinRef.current = null;
  };

  const setPrivacyMode = (mode: boolean) => setState((prev: any) => ({ ...prev, privacyMode: mode }));
  const updateFees = (fees: any) => setState((prev: any) => ({ ...prev, fees }));
  const toggleGateway = () => setState((prev: any) => ({ ...prev, gatewayActive: !prev.gatewayActive }));
  const setMainnetLive = (live: boolean) => setState((prev: any) => ({ ...prev, isMainnetLive: live }));
  const updateAssets = (assets: any) => setState((prev: any) => ({ ...prev, assets }));
  const setLanguage = (language: any) => setState((prev: any) => ({ ...prev, language }));
  const setNetwork = (network: any) => setState((prev: any) => ({ ...prev, network }));
  const setMode = (mode: any) => setState((prev: any) => ({ ...prev, mode }));
  const setLnBackend = (backend: any) => setState((prev: any) => ({ ...prev, lnBackend: backend }));
  const setSecurity = (security: any) => setState((prev: any) => ({ ...prev, security: { ...prev.security, ...security } }));
  const setAiConfig = (config: any) => setState((prev: any) => ({ ...prev, aiConfig: config }));
  const setCustomNodes = (nodes: any) => setState((prev: any) => ({ ...prev, customNodes: nodes }));
  const setRpcStrategy = (strategy: any) => setState((prev: any) => ({ ...prev, rpcStrategy: strategy }));
  const getWormholeSigner = () => null;

  const notifyUser = (type: any, message: string) => {
    const id = Date.now().toString();
    setToasts((prev: any) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => setToasts((prev: any) => prev.filter((t: any) => t.id !== id));

  const authorizeSignature = async (request: SignRequest) => {
    return new Promise<any>((resolve) => {
      setPendingSignRequest({ request, resolve });
    });
  };

  const setWalletConfig = async (config: WalletConfig, pin?: string) => {
     const initialAssets = [
       { id: '1', name: 'Bitcoin', symbol: 'BTC', balance: 0.42, valueUsd: 28500, change: 2.4, layer: 'Mainnet' },
       { id: '2', name: 'Stacks', symbol: 'STX', balance: 1250, valueUsd: 1800, change: -1.2, layer: 'Stacks' },
       { id: '3', name: 'Liquid BTC', symbol: 'L-BTC', balance: 0.05, valueUsd: 3400, change: 0.5, layer: 'Liquid' }
     ];

     const effectiveMode = config.backupVerified ? 'sovereign' : 'simulation';
     const newPin = pin || currentPinRef.current;
     if (newPin) currentPinRef.current = newPin;
     
     const newState = { 
        ...state, 
        mode: effectiveMode,
        walletConfig: config,
        assets: initialAssets,
        sovereigntyScore: config.backupVerified ? 100 : 70
     };
     
     setState(newState);
     
     if (newPin) {
        persistState(newState, newPin).then(() => {
            setEnclaveExists(true);
        });
     }
  };

  const claimBounty = (id: string) => setState((prev: any) => ({
    ...prev,
    bounties: prev.bounties.map((b: any) => b.id === id ? { ...b, status: 'Claimed', claimedBy: 'LocalEnclave' } : b)
  }));

  const resetEnclave = () => {
    if (confirm("Purge Enclave? Terminal state wipe.")) {
      removeEnclaveBlob(STORAGE_KEY);
      setEnclaveExists(false);
      window.location.reload();
    }
  };

  const t = (key: string) => getTranslation(state.language, key);

  const getPayloadMessage = (payload: unknown): string => {
    if (typeof payload === 'string') return payload;
    if (payload && typeof (payload as { message?: string }).message === 'string') return (payload as { message: string }).message;
    return JSON.stringify(payload);
  };

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
      case 'policies': return <SovereignPolicies />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  if (isBooting) {
    const CurrentIcon = BOOT_SEQUENCE[bootStep].icon;
    return (
      <div className="fixed inset-0 bg-ivory flex flex-col items-center justify-center z-[1000] p-6 text-center font-mono">
        <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-10 border border-off-white shadow-sm relative overflow-hidden">
          <FlaskConical size={48} className="text-accent-earth fill-current relative z-10" />
        </div>
        <div className="space-y-6 max-w-md w-full">
           <CurrentIcon size={24} className="animate-pulse text-accent-earth mx-auto" />
           <h1 className="text-3xl font-black tracking-tighter text-brand-deep uppercase italic">
              Conxian<span className="text-accent-earth">-Labs</span>
           </h1>
           <div className="h-1 w-full bg-off-white rounded-full overflow-hidden">
              {(() => {
                const pct = Math.round(((bootStep + 1) / BOOT_SEQUENCE.length) * 100);
                const quant = Math.min(100, Math.max(0, Math.round(pct / 5) * 5));
                return <div className={`h-full bg-accent-earth transition-all duration-500 progress-${quant}`} />;
              })()}
           </div>
           <p className="text-[10px] font-bold text-brand-earth uppercase tracking-widest animate-pulse">
              {BOOT_SEQUENCE[bootStep].text}
           </p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ state, setPrivacyMode, updateFees, toggleGateway, setMainnetLive, setWalletConfig, updateAssets, claimBounty, resetEnclave, setLanguage, notify: notifyUser, authorizeSignature, lockWallet, setNetwork, setMode, setLnBackend, setSecurity, setAiConfig, setCustomNodes, setRpcStrategy, getWormholeSigner }}>
      <div className={`flex bg-ivory text-brand-deep min-h-screen selection:bg-accent-earth/30 overflow-hidden`}>
        <div className="hidden md:block">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <main className="flex-1 overflow-y-auto relative pb-24 md:pb-0 custom-scrollbar">
          <div className="h-16 border-b border-border bg-white/80 backdrop-blur-md flex items-center justify-between px-6 md:px-8 sticky top-0 z-50">
            <div className="flex items-center gap-3">
               <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-border md:hidden">
                 <img src="/conxius-logo.svg" alt="Conxius" className="w-full h-full object-cover" />
               </div>
               <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                 state.isMainnetLive 
                   ? 'bg-brand-deep text-white border-brand-deep'
                   : state.mode === 'sovereign'
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-accent-earth/10 text-accent-earth border-accent-earth/30'
               }`}>
                 {state.isMainnetLive ? t('status.stable') : state.mode === 'sovereign' ? t('status.sovereign') : t('status.simulation')}
               </span>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-black text-brand-earth uppercase tracking-widest">Sovereignty</p>
                  <p className="text-xs font-mono font-bold text-accent-earth">{state.sovereigntyScore}/100</p>
               </div>
               <div className="w-8 h-8 rounded-lg bg-accent-earth cursor-pointer hover:scale-105 transition-transform flex items-center justify-center shadow-sm" onClick={lockWallet} title="Lock Enclave">
                  <Lock size={14} className="text-white" />
               </div>
            </div>
          </div>
          {state.network !== 'mainnet' && (
            <div className="px-6 md:px-8 py-2 bg-accent-earth/5 border-b border-accent-earth/20 text-accent-earth text-[10px] font-black uppercase tracking-widest sticky top-16 z-40">
              Warning: Non-Mainnet Environment • {state.network.toUpperCase()}
            </div>
          )}
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary key={activeTab} scope={activeTab}>
              <Suspense fallback={
                <div className="flex items-center justify-center py-32">
                  <Loader2 size={24} className="animate-spin text-accent-earth" />
                </div>
              }>
                {renderContent()}
              </Suspense>
            </ErrorBoundary>
          </div>
          {activeTab !== 'menu' && <SatoshiAIChat />}

          {pendingSignRequest && (
            <SignLoginMessageModal
                message={getPayloadMessage(pendingSignRequest.request.payload)}
                onConfirm={() => pendingSignRequest.resolve(true)}
                onCancel={() => pendingSignRequest.resolve(false)}
            />
          )}
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </main>
      </div>
    </AppContext.Provider>
  );
};

export default App;
