import { AppState } from '../types';

export interface Quest {
    id: string;
    label: string;
    points: number;
    completed: boolean;
    category: 'Security' | 'Privacy' | 'Community';
}

export const getQuests = (state: AppState): Quest[] => {
    return [
        { id: 'wallet_setup', label: 'Initialize Wallet', points: 10, completed: true, category: 'Security' },
        { id: 'backup_verified', label: 'Verify Master Backup', points: 40, completed: state.walletConfig?.backupVerified ?? false, category: 'Security' },
        { id: 'biometric_active', label: 'Enable Biometric Gate', points: 20, completed: state.security?.biometricUnlock ?? false, category: 'Security' },
        { id: 'node', label: 'Connect Local Node', points: 30, completed: !!(state.lnBackend?.endpoint || state.activeCitadel?.sharedRpcEndpoint), category: 'Security' },
        { id: 'silent_pay', label: 'Execute Silent Payment', points: 25, completed: (state.utxos ?? []).some(u => u.address.startsWith('sp1')), category: 'Privacy' },
        { id: 'taproot_audit', label: 'Taproot Asset Audit', points: 15, completed: !!state.walletConfig?.taprootAddress, category: 'Privacy' },
        { id: 'citadel', label: 'Join a Citadel', points: 20, completed: !!state.activeCitadel, category: 'Community' },
        { id: 'tor', label: 'Enable Tor Routing', points: 20, completed: state.isTorEnabled ?? false, category: 'Privacy' },
        { id: 'consolidation', label: 'Sovereign Consolidation', points: 50, completed: !!(state.assets && state.assets.length > 0 && state.assets.every(a => a.symbol === 'BTC' || a.balance === 0)), category: 'Security' },
        { id: 'l2_expansion', label: 'L2 Expansion: B2/Botanix/Mezo+', points: 30, completed: (state.assets ?? []).some(a => ['B2', 'Botanix', 'Mezo', 'Alpen', 'Zulu', 'Bison', 'Hemi', 'Nubit', 'Lorenzo', 'Citrea', 'Babylon', 'Merlin', 'Bitlayer'].includes(a.layer)), category: 'Security' },
    ];
};

export const calculateSovereigntyScore = (state: AppState): number => {
    const quests = getQuests(state);
    const currentXP = quests.reduce((acc, q) => q.completed ? acc + q.points : acc, 0);
    const totalXP = quests.reduce((acc, q) => acc + q.points, 0);
    return currentXP / totalXP;
};
