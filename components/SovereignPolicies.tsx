import React, { useState, useContext, useEffect } from 'react';
import { Shield, Clock, Heart, Users, ChevronRight, Info, Loader2, Sparkles, AlertTriangle, BookOpen, Fingerprint } from 'lucide-react';
import { AppContext } from '../context';
import { SpendingPolicy, DEFAULT_POLICIES, humanizeRule } from '../services/smart-wallet';
import { auditSpendingPolicy } from '../services/ai';

const SovereignPolicies: React.FC = () => {
  const appContext = useContext(AppContext);
  const [policies, setPolicies] = useState<SpendingPolicy[]>(DEFAULT_POLICIES);
  const [selectedPolicy, setSelectedPolicy] = useState<SpendingPolicy | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);

  const togglePolicy = (id: string) => {
      setPolicies(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const runAudit = async (policy: SpendingPolicy) => {
      setIsAuditing(true);
      setAuditReport(null);
      try {
          const report = await auditSpendingPolicy(policy);
          setAuditReport(report);
      } catch (e) {
          setAuditReport("Audit connection lost. Re-synchronizing local heuristics.");
      } finally {
          setIsAuditing(false);
      }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 pb-32">
      <header className="space-y-2">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white flex items-center gap-4">
            <Fingerprint className="text-orange-500" size={32} />
            Smart Sovereignty
        </h2>
        <p className="text-zinc-500 text-sm font-medium">Define complex spending rules and inheritance protocols using Miniscript.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-6">
           {policies.map(policy => (
              <div
                key={policy.id}
                onClick={() => setSelectedPolicy(policy)}
                className={`bg-zinc-900/40 border ${selectedPolicy?.id === policy.id ? 'border-orange-500/50 shadow-2xl shadow-orange-600/10' : 'border-zinc-800'} rounded-[3rem] p-8 cursor-pointer transition-all hover:border-zinc-700 group relative overflow-hidden`}
              >
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-6">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${policy.isActive ? 'bg-orange-600 shadow-xl' : 'bg-zinc-950 border border-zinc-800 text-zinc-600'}`}>
                          {policy.type === 'TimeLock' && <Clock size={24} />}
                          {policy.type === 'Inheritance' && <Heart size={24} />}
                          {policy.type === 'Threshold' && <Users size={24} />}
                          {policy.type === 'SocialRecovery' && <Shield size={24} />}
                       </div>
                       <div>
                          <h4 className="font-bold text-lg text-zinc-100 uppercase tracking-tighter italic">{policy.name}</h4>
                          <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{policy.type} Protocol</p>
                       </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); togglePolicy(policy.id); }}
                        className={`relative w-14 h-7 rounded-full transition-colors ${policy.isActive ? 'bg-green-600' : 'bg-zinc-800'}`}
                    >
                       <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${policy.isActive ? 'left-8' : 'left-1'}`} />
                    </button>
                 </div>

                 <div className="mt-8 space-y-4 relative z-10">
                    <p className="text-xs text-zinc-400 leading-relaxed italic">"{policy.description}"</p>
                    <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl font-mono text-[10px] text-zinc-500 flex items-center justify-between">
                       <span className="truncate w-64">{humanizeRule(policy.rules)}</span>
                       <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                 </div>
              </div>
           ))}

           <div className="bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[3rem] p-12 text-center group hover:border-zinc-700 transition-all cursor-pointer">
              <Shield className="mx-auto mb-4 text-zinc-700 group-hover:text-orange-500 transition-colors" size={32} />
              <h4 className="font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-400">Initialize Custom Descriptor</h4>
              <p className="text-[10px] text-zinc-500 mt-2 italic">Forge a new spending policy for high-value cold storage.</p>
           </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
           {selectedPolicy ? (
              <div className="bg-orange-600 border border-orange-500 rounded-[3.5rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-orange-600/30 animate-in slide-in-from-right-4">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <BookOpen size={140} />
                 </div>
                 <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-3">
                       <Sparkles size={24} className="text-white animate-pulse" />
                       <h3 className="text-xl font-black italic uppercase tracking-tighter">Policy Auditor</h3>
                    </div>

                    <div className="bg-zinc-950/20 backdrop-blur-md rounded-[2rem] p-8 border border-white/10 min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
                       {isAuditing ? (
                          <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                             <Loader2 className="animate-spin" size={32} />
                             <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Satoshi AI auditing policy...</p>
                          </div>
                       ) : auditReport ? (
                          <div className="text-xs font-mono leading-relaxed whitespace-pre-wrap">{auditReport}</div>
                       ) : (
                          <div className="text-center py-20 space-y-4">
                             <AlertTriangle size={32} className="mx-auto opacity-30" />
                             <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Audit Required Before Deployment</p>
                          </div>
                       )}
                    </div>

                    <button
                       onClick={() => runAudit(selectedPolicy)}
                       disabled={isAuditing}
                       className="w-full bg-white text-orange-600 font-black py-5 rounded-[2rem] text-xs uppercase tracking-widest hover:bg-zinc-100 transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95"
                    >
                       {isAuditing ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                       Execute Sovereign Audit
                    </button>
                 </div>
              </div>
           ) : (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3.5rem] p-16 text-center space-y-6 select-none animate-in fade-in">
                 <Shield size={64} className="mx-auto text-zinc-800" />
                 <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Protocol Selection Required</h3>
                 <p className="text-[10px] text-zinc-600 leading-relaxed italic">Select a spending policy to view technical specifications and risk assessments from Satoshi AI.</p>
              </div>
           )}

           <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
              <h4 className="font-bold text-xs text-zinc-400 flex items-center gap-2 uppercase tracking-widest">
                 <Info size={16} className="text-blue-500" />
                 Miniscript 101
              </h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                 Miniscript is a language for writing (a subset of) Bitcoin Scripts in a structured way, enabling analysis, composition, generic signing and more.
                 <br/><br/>
                 Conxius uses it to ensure your smart wallet is mathematically sound and verifiable by Satoshi AI before keys are locked.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SovereignPolicies;
