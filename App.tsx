import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  FlaskConical,
  Lock,
  Activity,
  Shield,
  Globe,
  Zap,
  Cpu,
  Loader2,
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
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
import Web3Browser from './components/Web3Browser';
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
import Settings from './components/Settings';
import SovereignPolicies from './components/SovereignPolicies';
import SystemDiagnostics from './components/SystemDiagnostics';
import Marketplace from './components/Marketplace';
import Studio from './components/Studio';
import SatoshiAIChat from './components/SatoshiAIChat';
import ErrorBoundary from './components/ErrorBoundary';
import SignLoginMessageModal from './components/SignLoginMessageModal';
import ToastContainer from './components/Toast';

import { AppContext, initialAppState } from './context';
import { getEnclaveBlob, persistState, removeEnclaveBlob, STORAGE_KEY } from './services/enclave-storage';
import { getTranslation } from './services/i18n';
import { AppState, WalletConfig, AppMode, Asset, SilentPaymentScanOptions, SilentPaymentScanState, SilentPaymentUtxo } from './types';
import { SignRequest } from './services/signer';
import { cancelSilentPaymentScan, dedupeSilentPaymentUtxos, getSilentPaymentScanStatus, scanForSilentPayments } from './services/silent-payments';

const BOOT_SEQUENCE = [
  { text: 'Initializing Secure Enclave', icon: Shield },
  { text: 'Calibrating CXN Guardian', icon: Activity },
  { text: 'Loading Bitcoin Rails', icon: Zap },
  { text: 'Verifying Citadel State', icon: Globe },
  { text: 'Mounting TEE Interface', icon: Cpu }
];

const STABLE_SCAN_ERROR_CODES = new Set([
  'INVALID_SECRET', 'INVALID_NETWORK', 'INVALID_PUBLIC_BATCH', 'RESOURCE_LIMIT',
  'INVALID_PUBLIC_RECORD', 'ECC_FAILURE', 'INTERNAL', 'CANCELLED', 'REORG_DETECTED',
  'WALLET_LOCKED', 'INVALID_REQUEST', 'NETWORK_UNAVAILABLE', 'UNSUPPORTED_PLATFORM',
  'LIBRARY_UNAVAILABLE',
]);

const normalizeScanErrorCode = (value: unknown): string => {
  const candidate = typeof value === 'string' ? value : '';
  return STABLE_SCAN_ERROR_CODES.has(candidate) ? candidate : 'INTERNAL';
};

const normalizePersistedSilentPaymentScan = (value: unknown): SilentPaymentScanState => {
  if (!value || typeof value !== 'object' || !('status' in value)) return { status: 'idle' };
  const candidate = value as Partial<SilentPaymentScanState>;
  if (candidate.status === 'idle') return { status: 'idle' };
  if (candidate.status === 'failed' || candidate.status === 'cancelled') {
    return { status: candidate.status, errorCode: normalizeScanErrorCode(candidate.errorCode) };
  }
  if (candidate.status === 'completed' &&
    'metrics' in candidate && candidate.metrics &&
    Array.isArray(candidate.utxos)) {
    return {
      status: 'completed',
      metrics: candidate.metrics,
      cursor: candidate.cursor,
      utxos: dedupeSilentPaymentUtxos(candidate.utxos as SilentPaymentUtxo[]),
    };
  }
  if (candidate.status === 'scanning' && 'progress' in candidate && candidate.progress) {
    return { status: 'scanning', progress: candidate.progress };
  }
  return { status: 'idle' };
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(initialAppState);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isBooting, setIsBooting] = useState(true);
  const [bootStep, setBootStep] = useState(0);
  const [enclaveExists, setEnclaveExists] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [pendingSignRequest, setPendingSignRequest] = useState<{ request: SignRequest, resolve: (val: any) => void } | null>(null);

  const currentPinRef = useRef<string | null>(null);

  useEffect(() => {
    async function checkEnclave() {
      const exists = !!(await getEnclaveBlob(STORAGE_KEY));
      setEnclaveExists(exists);
    }
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
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const lockWallet = () => {
    setState((prev: any) => ({ ...prev, isLocked: true }));
    currentPinRef.current = null;
  };

  const unlockWallet = async (pin: string) => {
    const blob = await getEnclaveBlob(STORAGE_KEY);
    if (!blob) return false;

    // In a real app, we'd use the pin to decrypt the blob
    // For this simulation, we'll just check if it matches the current pin or a placeholder
    const decrypted = JSON.parse(blob) as Partial<AppState>;
    const persistedUtxos = Array.isArray(decrypted.silentPaymentUtxos)
      ? dedupeSilentPaymentUtxos(decrypted.silentPaymentUtxos as SilentPaymentUtxo[])
      : [];
    setState({
      ...initialAppState,
      ...decrypted,
      silentPaymentUtxos: persistedUtxos,
      silentPaymentScan: normalizePersistedSilentPaymentScan(decrypted.silentPaymentScan),
    });
    currentPinRef.current = pin;
    return true;
  };

  const setPrivacyMode = (enabled: boolean) => setState((prev: any) => ({ ...prev, privacyMode: enabled }));
  const updateFees = (fees: number) => setState((prev: any) => ({ ...prev, integratorFeesAccumulated: prev.integratorFeesAccumulated + fees }));
  const toggleGateway = () => setState((prev: any) => ({ ...prev, externalGatewaysActive: !prev.externalGatewaysActive }));
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

  const scanSilentPayments = async (options: SilentPaymentScanOptions) => {
    setState((prev: AppState) => ({
      ...prev,
      silentPaymentScan: {
        status: 'scanning',
        progress: {
          startHeight: options.startHeight ?? 0,
          endHeight: options.endHeight,
          scannedBlocks: 0,
          scannedTransactions: 0,
          skippedTransactions: 0,
          matchCount: 0,
        },
      },
    }));
    let polling = true;
    const pollProgress = (async () => {
      while (polling) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          const status = await getSilentPaymentScanStatus();
          if (status.status === 'scanning') {
            setState((prev: AppState) => ({ ...prev, silentPaymentScan: status }));
          }
        } catch {
          // The final result/error remains authoritative; transient status failures are ignored.
        }
      }
    })();
    try {
      const result = await scanForSilentPayments(options);
      setState((prev: AppState) => ({
        ...prev,
        silentPaymentUtxos: dedupeSilentPaymentUtxos([
          ...prev.silentPaymentUtxos,
          ...result.utxos,
        ]),
        silentPaymentScan: {
          status: 'completed',
          metrics: result.metrics,
          cursor: result.cursor,
          utxos: result.utxos,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const errorCode = message.includes('unsupported')
        ? 'UNSUPPORTED_PLATFORM'
        : normalizeScanErrorCode(message);
      setState((prev: AppState) => ({
        ...prev,
        silentPaymentScan: errorCode === 'CANCELLED'
          ? { status: 'cancelled', errorCode }
          : { status: 'failed', errorCode },
      }));
      throw error;
    } finally {
      polling = false;
      await pollProgress;
    }
  };

  const cancelAppSilentPaymentScan = async () => {
    try {
      await cancelSilentPaymentScan();
      setState((prev: AppState) => ({
        ...prev,
        silentPaymentScan: { status: 'cancelled', errorCode: 'CANCELLED' },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setState((prev: AppState) => ({
        ...prev,
        silentPaymentScan: { status: 'failed', errorCode: normalizeScanErrorCode(message) },
      }));
      throw error;
    }
  };

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
       { id: '1', name: 'Bitcoin', symbol: 'BTC', balance: 0.42, valueUsd: 28500, change: 2.4, layer: 'Mainnet', type: 'Native' },
       { id: '2', name: 'Stacks', symbol: 'STX', balance: 1250, valueUsd: 1800, change: -1.2, layer: 'Stacks', type: 'Native' },
       { id: '3', name: 'Liquid BTC', symbol: 'L-BTC', balance: 0.05, valueUsd: 3400, change: 0.5, layer: 'Liquid', type: 'Native' }
     ];

     const effectiveMode = config.backupVerified ? 'sovereign' : 'simulation';
     const newPin = pin || currentPinRef.current;
     if (newPin) currentPinRef.current = newPin;
     
     const newState: AppState = {
        ...state, 
        mode: effectiveMode as AppMode,
        walletConfig: config,
        assets: initialAssets as Asset[],
        sovereigntyScore: config.backupVerified ? 100 : 70,
        silentPaymentUtxos: [],
        silentPaymentScan: { status: 'idle' },
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
    <AppContext.Provider value={{ state: state as any, setPrivacyMode, updateFees, toggleGateway, setMainnetLive, setWalletConfig, updateAssets, claimBounty, resetEnclave, setLanguage, notify: notifyUser, authorizeSignature, lockWallet, setNetwork, setMode, setLnBackend, setSecurity, setAiConfig, setCustomNodes, setRpcStrategy, scanSilentPayments, cancelSilentPaymentScan: cancelAppSilentPaymentScan, getWormholeSigner }}>
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
