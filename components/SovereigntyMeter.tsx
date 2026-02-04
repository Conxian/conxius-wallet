
import React, { useContext } from 'react';
import { Shield, CheckCircle2, Circle, Trophy, ArrowRight, Zap, Crown, Star, Medal, AlertTriangle, Castle } from 'lucide-react';
import { AppContext } from '../context';

interface Quest {
  id: string;
  label: string;
  points: number;
  completed: boolean;
  category: 'Security' | 'Privacy' | 'Yield' | 'Community';
}

const SovereigntyMeter: React.FC = () => {
  const context = useContext(AppContext);
  const isHotWallet = context?.state.walletConfig?.type === 'hot';

  // Dynamic quests based on wallet state
  const MOCK_QUESTS: Quest[] = [
    { id: 'wallet_setup', label: 'Initialize Wallet', points: 10, completed: true, category: 'Security' },
    { id: 'backup_verified', label: 'Verify Master Backup', points: 40, completed: context?.state.walletConfig?.backupVerified ?? false, category: 'Security' },
    { id: 'biometric_active', label: 'Enable Biometric Gate', points: 20, completed: context?.state.security?.biometricUnlock ?? false, category: 'Security' },
    { id: 'node', label: 'Connect Local Node', points: 30, completed: (context?.state.sovereigntyScore ?? 0) > 80, category: 'Security' },
    { id: 'silent_pay', label: 'Execute Silent Payment', points: 25, completed: false, category: 'Privacy' },
    { id: 'taproot_audit', label: 'Taproot Asset Audit', points: 15, completed: true, category: 'Privacy' },
    { id: 'citadel', label: 'Join a Citadel', points: 20, completed: !!context?.state.activeCitadel, category: 'Community' },
    { id: 'tor', label: 'Enable Tor Routing', points: 20, completed: context?.state.isTorActive ?? false, category: 'Privacy' },
    { id: 'fee_opt', label: 'Optimize Network Fees', points: 15, completed: false, category: 'Security' },
  ];

  const currentXP = MOCK_QUESTS.reduce((acc, q) => q.completed ? acc + q.points : acc, 0);
  const totalXP = MOCK_QUESTS.reduce((acc, q) => acc + q.points, 0);
  const level = Math.floor(currentXP / 25) + 1;
  
  let rankName = 'Initiate';
  if (level > 2) rankName = 'Citadel Guard';
  if (level > 4) rankName = 'Sovereign';

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2rem] p-6 space-y-6 shadow-xl relative overflow-hidden group">
      <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full transition-all ${isHotWallet ? 'bg-orange-500/5' : 'bg-green-500/10'}`} />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-zinc-950 border border-orange-500/30 rounded-2xl flex items-center justify-center shadow-inner group-hover:border-orange-500/50 transition-all">
             {rankName === 'Sovereign' ? <Crown className="text-orange-500 fill-current" size={24} /> : <Medal className="text-orange-500" size={24} />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              Pass Tier: {rankName}
            </h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">NFT Evolution Rank</p>
          </div>
        </div>
        <div className="text-right">
           <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-black">LVL {level}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
           <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Sovereignty Score</span>
              <span className="text-[10px] font-mono font-bold text-orange-500">{Math.round((currentXP/totalXP)*100)}%</span>
           </div>
           <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-orange-600 to-yellow-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                style={{ width: `${(currentXP / totalXP) * 100}%` }}
              />
           </div>
        </div>

        <div className="space-y-2">
           <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Privacy Score</span>
              <span className="text-[10px] font-mono font-bold text-emerald-500">65%</span>
           </div>
           <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900 p-0.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: `65%` }}
              />
           </div>
        </div>
      </div>

      {/* Warning for Hot Wallets */}
      {isHotWallet && (
         <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl flex items-start gap-3">
            <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <div>
               <p className="text-[10px] font-bold text-orange-200">Sovereignty Risk: Hot Wallet</p>
               <p className="text-[9px] text-orange-200/70 leading-relaxed">
                  Your keys are in the browser. Connect hardware or join a Citadel to upgrade security.
               </p>
            </div>
         </div>
      )}

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest border-b border-zinc-900 pb-2">Active Quests</p>
        {MOCK_QUESTS.filter(q => !q.completed).slice(0, 3).map((quest) => (
          <div key={quest.id} className="flex items-center justify-between group cursor-pointer p-3 hover:bg-zinc-800/50 rounded-xl transition-all border border-transparent hover:border-zinc-800">
            <div className="flex items-center gap-3">
              <Star size={14} className="text-zinc-700 group-hover:text-orange-500 transition-colors" />
              <div>
                <span className="text-xs text-zinc-300 block">{quest.label}</span>
                <span className="text-[8px] font-black uppercase text-zinc-600">{quest.category}</span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-orange-500/60 group-hover:text-orange-500">+{quest.points} XP</span>
          </div>
        ))}
        {MOCK_QUESTS.every(q => q.completed) && (
           <p className="text-center text-[10px] text-green-500 font-bold py-2">All Quests Complete. Max Sovereignty.</p>
        )}
      </div>

      <button className="w-full py-3 bg-zinc-800 hover:bg-orange-600 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95">
        Upgrade My Pass <ArrowRight size={14} />
      </button>
    </div>
  );
};

export default SovereigntyMeter;
