import React, { useState, useContext, useCallback, useEffect } from 'react';
import { Shield, Users, Network, Lock, MessageSquare, Award, Plus, ChevronRight, Share2, Sparkles, Terminal, Search, Hammer, X, Loader2, Bot, Layers, RefreshCw } from 'lucide-react';
import { AppContext } from '../context';
import { fetchMultiSigBalances, MultiSigQuorum } from '../services/multisig';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Elite';
  category: 'Core' | 'UI/UX' | 'Security';
  status: 'Open' | 'Claimed';
}

interface Citadel {
  name: string;
  motto: string;
  alignmentScore: number;
  treasuryBalance: number;
  membersCount: number;
  pool: {
    totalStacked: number;
    yieldApy: number;
  };
}

const MOCK_CITADEL: Citadel = {
  name: "The Sovereign Citadel",
  motto: "Vires in Numeris, Libertas in Enclave",
  alignmentScore: 98.4,
  treasuryBalance: 0.042,
  membersCount: 1240,
  pool: {
    totalStacked: 4500000,
    yieldApy: 8.5
  }
};

const CitadelManager: React.FC = () => {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('pool');
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [bountyAudit, setBountyAudit] = useState<string>('');
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0.042);
  const [isSyncing, setIsSyncing] = useState(false);

  const CITADEL_QUORUM: MultiSigQuorum = {
      name: 'Citadel Treasury',
      m: 2,
      n: 3,
      publicKeys: [
          '02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
          '02d3346d0554045431668600c870404040404040404040404040404040404040',
          '02f4446d0554045431668600c870404040404040404040404040404040404040'
      ],
      network: 'mainnet'
  };

  const syncTreasury = useCallback(async () => {
      setIsSyncing(true);
      try {
          const assets = await fetchMultiSigBalances(CITADEL_QUORUM);
          if (assets.length > 0) {
              setTreasuryBalance(assets[0].balance);
          }
      } catch (e) {
          console.error("Failed to sync treasury", e);
      } finally {
          setIsSyncing(false);
      }
  }, []);

  useEffect(() => {
      syncTreasury();
  }, [syncTreasury]);

  const bounties: Bounty[] = [
    {
      id: 'b1',
      title: 'Optimize Enclave Key Derivation',
      description: 'Reduce latency of BIP-32 path derivation in the Web Worker by 15%.',
      reward: '0.005 BTC',
      difficulty: 'Elite',
      category: 'Core',
      status: 'Open'
    },
    {
      id: 'b2',
      title: 'Dark Mode Contrast Audit',
      description: 'Ensure all UI components meet WCAG AA standards in OLED dark mode.',
      reward: '250,000 Sats',
      difficulty: 'Beginner',
      category: 'UI/UX',
      status: 'Open'
    }
  ];

  const auditBounty = (bounty: Bounty) => {
    setSelectedBounty(bounty);
    setIsAuditing(true);

    // Simulate auditing process
    setTimeout(() => {
      setBountyAudit(`// SOVEREIGN SENTINEL AUDIT REPORT
// Target: ${bounty.title}
// Difficulty: ${bounty.difficulty}

ANALYSIS:
- Security Level: High (Enclave Isolated)
- Performance Impact: Low
- Sustainability: Tier 1

RECOMMENDATION:
1. Implement zero-leak memory buffers.
2. Verify against BIP-32 test vectors.
3. Deploy to Staging Enclave.

STATUS: AUDIT PASSED. READY FOR IMPLEMENTATION.`);
      setIsAuditing(false);
    }, 2000);
  };

  const handleClaim = () => {
    // In a real app, this would initiate a contract or work channel
    alert('Work channel initialized. Your node is now tracking this bounty.');
    setSelectedBounty(null);
  };

  const tabs = [
    { id: 'pool', label: 'Stacking Pool', icon: Layers },
    { id: 'treasury', label: 'Treasury', icon: Shield },
    { id: 'governance', label: 'Governance', icon: Users },
    { id: 'bounties', label: 'Bounties', icon: Sparkles },
    { id: 'members', label: 'Members', icon: Users }
  ];

  return (
    <div className="p-8 space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-zinc-100 flex items-center gap-3">
            <Shield className="text-purple-500" size={36} />
            {MOCK_CITADEL.name}
          </h2>
          <p className="text-zinc-500 text-sm italic">"{MOCK_CITADEL.motto}"</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4">
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Ecosystem Alignment</p>
              <p className="text-xl font-bold text-purple-100 font-mono">{MOCK_CITADEL.alignmentScore}%</p>
           </div>
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-6 py-4">
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Members</p>
              <p className="text-xl font-bold text-zinc-100 font-mono">{MOCK_CITADEL.membersCount}</p>
           </div>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-fit">
         {tabs.map((tab) => (
            <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                     ? 'bg-purple-600 text-white shadow-lg' 
                     : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
               }`}
            >
               <tab.icon size={14} />
               {tab.label}
            </button>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         <div className="lg:col-span-8 space-y-10">
            
            {activeTab === 'pool' && (
               <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-10 relative overflow-hidden group shadow-2xl">
                     <div className="relative z-10 flex flex-col gap-8">
                        <div>
                           <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-4">Batched Stacking Protocol (PoX-4)</p>
                           <h3 className="text-5xl font-bold text-zinc-100 font-mono tracking-tighter mb-2">
                              {MOCK_CITADEL.pool.totalStacked.toLocaleString()} <span className="text-lg text-zinc-500">STX Pooled</span>
                           </h3>
                        </div>
                        <button className="w-full md:w-64 px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 active:scale-[0.98]">
                           <Plus size={16} /> Delegate STX
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {activeTab === 'bounties' && (
               <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                  <div className="grid grid-cols-1 gap-4">
                     {bounties.map((bounty) => (
                        <div key={bounty.id} className={`p-8 bg-zinc-950 border border-zinc-900 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-orange-500/30 transition-all ${selectedBounty?.id === bounty.id ? 'border-orange-500/50 ring-1 ring-orange-500/20' : ''}`}>
                           <div className="flex items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all ${bounty.status === 'Open' ? 'text-green-500' : 'text-zinc-700'}`}>
                                 {bounty.category === 'Core' ? <Terminal size={24} /> : bounty.category === 'UI/UX' ? <Sparkles size={24} /> : <Lock size={24} />}
                              </div>
                              <div>
                                 <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest bg-zinc-900 px-2 py-0.5 rounded">v1.2.0 Enhancement</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                       bounty.difficulty === 'Elite' ? 'text-red-500 border-red-500/20' : 
                                       bounty.difficulty === 'Intermediate' ? 'text-orange-500 border-orange-500/20' : 
                                       'text-green-500 border-green-500/20'
                                    }`}>{bounty.difficulty}</span>
                                    {bounty.status === 'Claimed' && <span className="text-[9px] font-black uppercase text-zinc-100 bg-orange-600 px-2 py-0.5 rounded">Claimed</span>}
                                 </div>
                                 <h4 className="text-lg font-bold text-zinc-100 mt-1">{bounty.title}</h4>
                                 <p className="text-xs text-zinc-500 mt-1">{bounty.description}</p>
                              </div>
                           </div>
                           <div className="flex items-center gap-6 w-full md:w-auto justify-between border-t md:border-t-0 pt-4 md:pt-0">
                              <div className="text-right">
                                 <p className="text-[10px] font-black uppercase text-zinc-600">Reward</p>
                                 <p className="text-lg font-mono font-bold text-orange-500">{bounty.reward}</p>
                              </div>
                              <button 
                                 disabled={bounty.status === 'Claimed'}
                                 onClick={() => auditBounty(bounty)}
                                 className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-800 flex items-center gap-2"
                              >
                                 <Search size={14} /> Audit & Claim
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
                  
                  {selectedBounty && (
                     <div className="bg-zinc-900/40 border border-orange-500/30 rounded-[3rem] p-10 space-y-8 animate-in zoom-in duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                           <Award size={200} />
                        </div>
                        <div className="relative z-10 space-y-6">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                                    <Hammer size={24} />
                                 </div>
                                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Bounty Protocol Audit</h3>
                              </div>
                              <button onClick={() => setSelectedBounty(null)} className="p-2 text-zinc-600 hover:text-white transition-colors"><X size={24} /></button>
                           </div>

                           <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-8 min-h-[300px] relative">
                              {isAuditing ? (
                                 <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                                    <Loader2 className="animate-spin text-orange-500" size={32} />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 animate-pulse">Sovereign Sentinel Auditing Codebase...</p>
                                 </div>
                              ) : (
                                 <div className="prose prose-invert max-w-none text-xs leading-relaxed text-zinc-400 font-mono whitespace-pre-wrap selection:bg-orange-500/40">
                                    {bountyAudit}
                                 </div>
                              )}
                           </div>
                           
                           {!isAuditing && (
                              <div className="flex gap-4">
                                 <button onClick={handleClaim} className="flex-1 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-orange-600/20 active:scale-[0.98]">
                                    Initialize Work Channel
                                 </button>
                                 <button className="px-6 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-zinc-800">
                                    <MessageSquare size={16} />
                                 </button>
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>
            )}

            {(activeTab === 'treasury' || activeTab === 'governance' || activeTab === 'members') && (
               <div className="p-20 text-center opacity-30 italic">Module synchronized with Citadel mesh.</div>
            )}
         </div>

         <div className="lg:col-span-4 space-y-8">
            <div className="bg-purple-600 border border-purple-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-2xl">
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Network size={100} />
               </div>
               <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xl font-black italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                        <Share2 size={20} /> Shared Hub
                    </h4>
                    <button
                        onClick={syncTreasury}
                        disabled={isSyncing}
                        className="p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                     <p className="text-[9px] font-black uppercase opacity-70 mb-1">Treasury (Multi-Sig)</p>
                     <p className="text-lg font-mono font-bold">{treasuryBalance.toFixed(8)} BTC</p>
                  </div>
                  <p className="text-xs font-medium leading-relaxed opacity-80">
                     "Architects set the vision. Initiates follow the path. Together we out-compete the legacy system."
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default CitadelManager;
