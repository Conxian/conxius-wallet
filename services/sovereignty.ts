import { AppState } from '../types';

/**
 * Sovereignty Score Engine (v1.1)
 * Calculates the user's level of financial self-sovereignty.
 */

export interface Quest {
    id: string;
    label: string;
    category: 'Security' | 'Privacy' | 'Network' | 'Governance';
    points: number;
    completed: boolean;
}

export const calculateSovereigntyScore = (state: AppState): number => {
    let score = 0;

    // 1. Hardware Security (40 pts)
    if (state.walletConfig?.type === 'single' && state.walletConfig.seedVault) score += 30;
    if (state.walletConfig?.type === 'multisig') score += 40;

    // 2. Network Sovereignty (30 pts)
    if (state.rpcStrategy === 'Sovereign-First') score += 30;
    else if (state.rpcStrategy === 'Mixed') score += 15;

    // 3. Privacy Health (30 pts)
    if (state.isTorEnabled) score += 15;
    if (state.privacyMode) score += 15;

    return Math.min(score, 100);
};

export const getQuests = (state: AppState): Quest[] => {
    return [
        {
            id: 'backup_verified',
            label: 'Verify Backup Mnemonic',
            category: 'Security',
            points: 20,
            completed: !!state.walletConfig?.backupVerified
        },
        {
            id: 'sovereign_rpc',
            label: 'Connect Custom Node',
            category: 'Network',
            points: 30,
            completed: state.rpcStrategy === 'Sovereign-First'
        },
        {
            id: 'tor_active',
            label: 'Enable Tor Routing',
            category: 'Privacy',
            points: 15,
            completed: !!state.isTorEnabled
        },
        {
            id: 'privacy_mode',
            label: 'Enable Privacy Mode',
            category: 'Privacy',
            points: 15,
            completed: !!state.privacyMode
        },
        {
            id: 'biometric_lock',
            label: 'Enable Biometric Lock',
            category: 'Security',
            points: 20,
            completed: !!state.security?.biometricUnlock
        },
        {
            id: 'multisig_upgrade',
            label: 'Upgrade to Multisig',
            category: 'Security',
            points: 40,
            completed: state.walletConfig?.type === 'multisig'
        },
        {
            id: 'citadel_joined',
            label: 'Join a Sovereign Citadel',
            category: 'Governance',
            points: 25,
            completed: !!state.activeCitadel
        },
        {
            id: 'node_synced',
            label: 'Fully Sync Local Node',
            category: 'Network',
            points: 30,
            completed: state.nodeSyncProgress === 100
        }
    ];
};
