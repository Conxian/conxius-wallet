
export type OpsPersona = 'brics' | 'unbanked' | 'nomad' | 'retail' | 'business';

export interface OpsWalletConfig {
  type: OpsPersona;
  name: string;
  description: string;
  minSigners: number;
  totalSigners: number;
  features: string[];
  defaults: {
    payjoin: boolean;
    tor: boolean;
    backup: 'cloud' | 'local' | 'multisig';
  };
}

export const PERSONA_CONFIGS: Record<OpsPersona, OpsWalletConfig> = {
  brics: {
    type: 'brics',
    name: 'BRICS+ Bridge',
    description: 'Optimized for P2P settlement and censorship resistance. Ideal for navigating sanctioned corridors.',
    minSigners: 1,
    totalSigners: 1,
    features: ['P2P Aggregation (AliPay/Mir)', 'Stablecoin Swaps (USDT-TRC20 Native Bridge)', 'Tor Default'],
    defaults: {
      payjoin: false, // P2P focus
      tor: true,
      backup: 'local', // Avoid western cloud
    },
  },
  unbanked: {
    type: 'unbanked',
    name: 'Sovereign Retail',
    description: 'High-trust, low-fee setup for daily use without banking infrastructure.',
    minSigners: 1,
    totalSigners: 1,
    features: ['Lightning Priority', 'Cash-out Points Map', 'Offline Signing'],
    defaults: {
      payjoin: true,
      tor: false,
      backup: 'cloud', // Encrypted GDrive/WhatsApp backup
    },
  },
  nomad: {
    type: 'nomad',
    name: 'Digital Nomad',
    description: 'Portable, privacy-first setup for jurisdictional arbitrage.',
    minSigners: 2,
    totalSigners: 3,
    features: ['2-of-3 Multi-Sig (Device+Cloud+Key)', 'Kill Switch', 'Hidden Volumes'],
    defaults: {
      payjoin: true,
      tor: true,
      backup: 'multisig',
    },
  },
  business: {
    type: 'business',
    name: 'Corporate Citadel',
    description: 'Standard Ops Wallet for SMEs. Treasury management and payroll efficiency.',
    minSigners: 2,
    totalSigners: 3,
    features: ['2-of-3 Multi-Sig', 'PayJoin Auto-Batching', 'Payroll Streaming'],
    defaults: {
      payjoin: true,
      tor: false,
      backup: 'multisig',
    },
  },
  retail: {
    type: 'retail',
    name: 'Personal Vault',
    description: 'Simple, secure self-custody for savings.',
    minSigners: 1,
    totalSigners: 1,
    features: ['Simple UI', 'Fiat Value View', 'Yield Earn'],
    defaults: {
      payjoin: false,
      tor: false,
      backup: 'cloud',
    },
  },
};

import { saveToEnclave } from './enclave-storage';

export class GovernanceService {
  async getRecommendedConfig(persona: OpsPersona): Promise<OpsWalletConfig> {
    // In a production environment, this resolves via the Conxian Gateway
    return PERSONA_CONFIGS[persona];
  }

  async initializeOpsWallet(config: OpsWalletConfig): Promise<string> {
    console.log(`Initializing Sovereign Ops Wallet: ${config.name}`);

    // TEE-backed persistence via Secure Enclave
    const randomValue = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    const walletId = `ops_${randomValue.toString(36)}`;

    await saveToEnclave(`wallet_config_${walletId}`, JSON.stringify({
        ...config,
        initializedAt: Date.now(),
        id: walletId
    }));

    return walletId;
  }
}
