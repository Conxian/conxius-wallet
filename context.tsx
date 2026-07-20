
import { createContext } from 'react';
import { AppState, WalletConfig, Asset, Network, AppMode, LnBackendConfig, SilentPaymentScanOptions } from './types';
import { Language } from './services/i18n';
import { ToastType } from './components/Toast';
import { SignRequest, SignResult } from './services/signer';

export const AppContext = createContext<{
  state: AppState & { language: Language };
  setPrivacyMode: (val: boolean) => void;
  updateFees: (val: number) => void;
  toggleGateway: (val: boolean) => void;
  setMainnetLive: (val: boolean) => void;
  setWalletConfig: (config: WalletConfig) => void;
  updateAssets: (assets: Asset[]) => void;
  claimBounty: (bountyId: string) => void;
  resetEnclave: () => void;
  setLanguage: (lang: Language) => void;
  notify: (type: ToastType, message: string, title?: string) => void;
  authorizeSignature: (request: SignRequest) => Promise<SignResult>;
  lockWallet: () => void;
  setNetwork: (network: Network) => void;
  setMode: (mode: AppMode) => void;
  setLnBackend: (cfg: LnBackendConfig) => void;
  setSecurity: (s: Partial<AppState['security']>) => void;
  setAiConfig: (config: AppState["aiConfig"]) => void;
  setCustomNodes: (nodes: AppState["customNodes"]) => void;
  setRpcStrategy: (strategy: AppState["rpcStrategy"]) => void;
  scanSilentPayments: (options: SilentPaymentScanOptions) => Promise<void>;
  cancelSilentPaymentScan: () => Promise<void>;
  getWormholeSigner: (chain: any) => any; // Typed as any to avoid circular deps in context, or import types
} | null>(null);

export const initialAppState: AppState = {
  version: '1.9.5',
  mode: 'sovereign',
  network: 'mainnet',
  privacyMode: true,
  nodeSyncProgress: 0,
  integratorFeesAccumulated: 0,
  sovereigntyScore: 0,
  isTorActive: false,
  deploymentReadiness: 0,
  externalGatewaysActive: false,
  rpcStrategy: 'Sovereign-First',
  isMainnetLive: true,
  assets: [],
  bounties: [],
  dataSharing: {
    enabled: false,
    aiCapBoostActive: false,
    minAskPrice: 0.0001,
    totalEarned: 0
  },
  utxos: [],
  silentPaymentUtxos: [],
  silentPaymentScan: { status: 'idle' },
  isTorEnabled: false,
  theme: "light",
  language: "en"
};
