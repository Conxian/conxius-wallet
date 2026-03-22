import React, { useContext, useState, useMemo, useEffect } from 'react';
import { Shield, CheckCircle2, ArrowRight, Zap, Crown, Star, Medal, AlertTriangle } from 'lucide-react';
import { AppContext } from '../context';
import { getSecurityLevelNative } from "../services/enclave-storage";
import { checkDeviceIntegrity } from "../services/device-integrity";
import { calculatePrivacyScore } from '../services/privacy';
import { getQuests } from "../services/sovereignty";
import BackupAuditModal from './BackupAuditModal';

const SovereigntyMeter: React.FC = () => {
  const context = useContext(AppContext);
  const [nativeSecurity, setNativeSecurity] = useState<{ level: string; isStrongBox: boolean } | null>(null);
  const [integrity, setIntegrity] = useState<any>(null);

  useEffect(() => {
    getSecurityLevelNative().then(setNativeSecurity);
    checkDeviceIntegrity().then(setIntegrity);
  }, []);

  const [showBackupAudit, setShowBackupAudit] = useState(false);

  const state = context?.state;
  const isHotWallet = state?.walletConfig?.type === 'hot';

  const privacyResult = useMemo(() => {
    if (!state) return { score: 0, breakdown: { network: 0, scriptTypes: 0, utxoHealth: 0 }, recommendations: [] };
    return calculatePrivacyScore(state);
  }, [state]);

  const ACTIVE_QUESTS = state ? getQuests(state) : [];

  const currentXP = ACTIVE_QUESTS.reduce((acc, q) => q.completed ? acc + q.points : acc, 0);
  const totalXP = ACTIVE_QUESTS.reduce((acc, q) => acc + q.points, 0);
  const level = Math.floor(currentXP / 25) + 1;
  
  let rankName = 'Initiate';
  if (level > 2) rankName = 'Citadel Guard';
  if (level > 4) rankName = 'Sovereign';

  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgradePass = async () => {
    if (isUpgrading) return;
    setIsUpgrading(true);
    context?.notify('info', 'Verifying Sovereign Credentials...');
    await new Promise(r => setTimeout(r, 1500));
    if (currentXP < totalXP * 0.5) {
        context?.notify('error', 'Insufficient XP for Tier Upgrade. Complete more quests.');
    } else {
        context?.notify('success', `Pass Upgraded to ${rankName}. Metadata synced to Enclave.`);
    }
    setIsUpgrading(false);
  };

  return (
    <div className="bg-off-white/40 border border-border rounded-[2rem] p-6 space-y-6 shadow-xl relative overflow-hidden group">
      <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl rounded-full transition-all ${isHotWallet ? 'bg-orange-500/5' : 'bg-green-500/10'}`} />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white border border-orange-500/30 rounded-2xl flex items-center justify-center shadow-inner group-hover:border-orange-500/50 transition-all">
             {rankName === 'Sovereign' ? <Crown className="text-accent-earth fill-current" size={24} /> : <Medal className="text-accent-earth" size={24} />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-brand-deep flex items-center gap-2">
              Pass Tier: {rankName}
            </h3>
            <p className="text-[10px] text-brand-earth font-bold uppercase tracking-widest">NFT Evolution Rank</p>
          </div>
        </div>
        <div className="text-right">
           <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-black">LVL {level}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
           <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase text-brand-earth tracking-widest">Sovereignty Score</span>
              <span className="text-[10px] font-mono font-bold text-accent-earth">{totalXP > 0 ? Math.round((currentXP/totalXP)*100) : 0}%</span>
           </div>
           <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-border p-0.5">
              <div
                className="h-full bg-linear-to-r from-orange-600 to-yellow-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(249,115,22,0.4)]"
                style={{ width: `${totalXP > 0 ? (currentXP / totalXP) * 100 : 0}%` }}
              />
           </div>
        </div>

        <div className="space-y-2">
           <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase text-brand-earth tracking-widest">Privacy Score</span>
              <span className="text-[10px] font-mono font-bold text-emerald-500">{privacyResult.score}%</span>
           </div>
           <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-border p-0.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: `${privacyResult.score}%` }}
              />
           </div>
        </div>
      </div>

      {isHotWallet && (
         <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl flex items-start gap-3">
            <AlertTriangle size={16} className="text-accent-earth shrink-0 mt-0.5" />
            <div>
               <p className="text-[10px] font-bold text-orange-200">Sovereignty Risk: Hot Wallet</p>
               <p className="text-[9px] text-orange-200/70 leading-relaxed">
                  Your keys are in the browser. Connect hardware or join a Citadel to upgrade security.
               </p>
            </div>
         </div>
      )}

      <div className="space-y-3">
      {nativeSecurity && (
         <div className="bg-white/50 border border-border p-3 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
               <span className="text-[10px] font-black uppercase text-brand-earth tracking-widest flex items-center gap-1.5">
                  <Shield size={10} className={nativeSecurity.level !== "SOFTWARE" ? "text-accent-earth" : "text-brand-earth"} />
                  Hardware Security
               </span>
               <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${nativeSecurity.isStrongBox ? "bg-orange-500/20 text-accent-earth" : "bg-border text-brand-earth"}`}>
                  {nativeSecurity.level}
               </span>
            </div>
            {integrity && (
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-brand-earth tracking-widest flex items-center gap-1.5">
                     <CheckCircle2 size={10} className={integrity.isSecure ? "text-emerald-500" : "text-red-500"} />
                     Device Integrity
                  </span>
                  <span className={`text-[9px] font-bold ${integrity.isSecure ? "text-emerald-500" : "text-red-500"}`}>
                     {integrity.isSecure ? "PASSED" : "FAILED"}
                  </span>
               </div>
            )}
         </div>
      )}
        <p className="text-[10px] font-black uppercase text-brand-earth tracking-widest border-b border-border pb-2">Active Quests</p>
        {ACTIVE_QUESTS.filter(q => !q.completed).slice(0, 3).map((quest) => (
          <div
            key={quest.id}
            onClick={() => {
               if (quest.id === 'backup_verified') setShowBackupAudit(true);
            }}
            className="flex items-center justify-between group cursor-pointer p-3 hover:bg-border/50 rounded-xl transition-all border border-transparent hover:border-border"
          >
            <div className="flex items-center gap-3">
              <Star size={14} className="text-brand-earth group-hover:text-accent-earth transition-colors" />
              <div>
                <span className="text-xs text-brand-deep block">{quest.label}</span>
                <span className="text-[8px] font-black uppercase text-brand-earth">{quest.category}</span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-accent-earth/60 group-hover:text-accent-earth">+{quest.points} XP</span>
          </div>
        ))}
        {ACTIVE_QUESTS.length > 0 && ACTIVE_QUESTS.every(q => q.completed) && (
           <p className="text-center text-[10px] text-green-500 font-bold py-2">All Quests Complete. Max Sovereignty.</p>
        )}
      </div>

      <button 
        onClick={handleUpgradePass}
        disabled={isUpgrading}
        className="w-full py-3 bg-border hover:bg-accent-earth text-brand-earth hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
      >
        {isUpgrading ? <Zap size={14} className="animate-spin" /> : <ArrowRight size={14} />}
        {isUpgrading ? 'Minting Pass...' : 'Upgrade My Pass'}
      </button>

      {showBackupAudit && <BackupAuditModal onClose={() => setShowBackupAudit(false)} />}
    </div>
  );
};

export default SovereigntyMeter;
