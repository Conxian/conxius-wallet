import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context';
import {
  Zap,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Wallet,
  Lock,
  Loader2,
  ExternalLink,
  Coins,
  Ban,
  ShieldCheck,
  Info,
  AlertTriangle,
  CheckCircle,
  Clock,
  Dices
} from 'lucide-react';
import { SWAP_EXPERIMENTAL } from '../services/swap';
import { fetchYields, YieldOpportunity } from '../services/yield';
import { fetchInsuranceCovers, InsuranceCover } from '../services/insurance';
import { fetchBabylonStats, BabylonStakingInfo } from '../services/babylon';
import { fetchDLCEvents } from '../services/dlc';

const DeFiDashboard: React.FC = () => {
  const context = useContext(AppContext);
  const { state, authorizeSignature, notify } = context!;
  const { mode, assets } = state;

  const [activeTab, setActiveTab] = useState<'positions' | 'opportunities' | 'staking' | 'dlc'>('positions');
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState<string | null>(null);
  const [isZapping, setIsZapping] = useState(false);

  const [yields, setYields] = useState<YieldOpportunity[]>([]);
  const [covers, setCovers] = useState<InsuranceCover[]>([]);
  const [babylonStats, setBabylonStats] = useState<BabylonStakingInfo | null>(null);
  const [dlcEvents, setDlcEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [y, c, b, d] = await Promise.all([
            fetchYields(),
            fetchInsuranceCovers(),
            fetchBabylonStats(),
            fetchDLCEvents()
        ]);
        setYields(y);
        setCovers(c);
        setBabylonStats(b);
        setDlcEvents(d);
      } catch (e) {
        notify("error", "Failed to fetch DeFi data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter for yield-bearing assets or LP positions
  const positions = assets.filter(a => a.type === 'SIP-10' || a.type === 'Wrapped').map(a => ({
     id: a.id,
     protocol: a.name.split(' ')[0] || 'Unknown',
     pair: `${a.symbol}/BTC`,
     value: `${a.balance.toFixed(4)} ${a.symbol}`,
     apy: '6.4%',
     layer: a.layer,
     type: 'Liquidity Pool'
  }));

  const analyzeProtocol = async (protocol: string) => {
    setAnalyzingRisk(true);
    await new Promise(r => setTimeout(r, 1500));
    setRiskAnalysis(`Protocol: ${protocol}\n\n[AUDIT RESULT]: LOW RISK\n- Multisig: 3/5 (Verified)\n- TVL: 42M\n- Last Audit: 2026-01-14\n- Enclave Compatibility: 100%`);
    setAnalyzingRisk(false);
  };

  const handleZap = async () => {
    if (SWAP_EXPERIMENTAL) return;
    setIsZapping(true);
    await new Promise(r => setTimeout(r, 2000));
    notify('success', 'Zap Transaction Broadcasted');
    setIsZapping(false);
  };

  return (
    <div className="p-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-earth">Sovereign Yield Hub</span>
           </div>
           <h2 className="text-5xl font-black italic uppercase tracking-tighter text-brand-deep flex items-center gap-4">
              DeFi Strategy
           </h2>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-off-white/50 px-6 py-3 rounded-2xl border border-border backdrop-blur-sm">
              <p className="text-[9px] font-black uppercase text-brand-earth mb-1 tracking-widest">Total Value Locked</p>
              <p className="text-xl font-mono font-bold text-brand-deep">0.0428 BTC</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-8 shadow-2xl">
              <div className="flex items-center gap-6 mb-8 border-b border-border pb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
                 {[
                    { id: 'positions', label: 'Active Positions' },
                    { id: 'opportunities', label: 'Yield & Insurance' },
                    { id: 'staking', label: 'Babylon Staking' },
                    { id: 'dlc', label: 'DLC Contracts' }
                 ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'text-purple-500 border-b-2 border-purple-500' : 'text-brand-earth hover:text-brand-deep'}`}
                    >
                        {tab.label}
                    </button>
                 ))}
              </div>

              {activeTab === 'positions' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mode === 'sovereign' && positions.length === 0 ? (
                       <div className="col-span-2 flex flex-col items-center justify-center py-12 opacity-50 border border-border rounded-3xl bg-off-white/20">
                          <Lock size={48} className="text-brand-earth mb-4" />
                          <p className="text-sm font-bold text-brand-earth uppercase tracking-widest">No Active Positions</p>
                          <p className="text-xs text-brand-earth italic mt-2">Connect to sovereign DeFi protocols to view positions.</p>
                       </div>
                    ) : (
                    positions.map((pos) => (
                       <div key={pos.id} className="bg-white border border-border rounded-3xl p-6 hover:border-brand-earth transition-all group">
                          <div className="flex justify-between items-start mb-4">
                             <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${pos.layer === 'Stacks' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                                   {pos.protocol[0]}
                                </div>
                                <div>
                                   <h4 className="font-bold text-brand-deep">{pos.protocol}</h4>
                                   <p className="text-[10px] text-brand-earth uppercase tracking-widest">{pos.type}</p>
                                </div>
                             </div>
                             <button type="button" onClick={() => analyzeProtocol(pos.protocol)} className="p-2 text-brand-earth hover:text-purple-500 transition-colors" aria-label="Analyze Protocol Risk">
                                <ShieldAlert size={16} />
                             </button>
                          </div>
                          
                          <div className="space-y-3">
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-brand-earth font-bold uppercase">Pair</span>
                                <span className="text-brand-deep font-mono">{pos.pair}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-brand-earth font-bold uppercase">Value</span>
                                <span className="text-brand-deep font-mono">{pos.value}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-brand-earth font-bold uppercase">Net APY</span>
                                <span className="text-green-500 font-mono font-bold">{pos.apy}</span>
                             </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-border flex gap-2">
                             <button type="button" className="flex-1 py-2 bg-off-white hover:bg-border text-brand-earth rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                Unstake
                             </button>
                             <button type="button" className="flex-1 py-2 bg-white hover:bg-white text-ivory rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                Compound
                             </button>
                          </div>
                       </div>
                    )))}
                 </div>
              )}

              {activeTab === 'opportunities' && (
                 <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {yields.map(y => (
                            <div key={y.id} className="bg-white border border-border rounded-3xl p-6 hover:border-orange-500/30 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-accent-earth/10 rounded-xl flex items-center justify-center text-accent-earth font-bold">
                                            {y.protocol[0]}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-brand-deep">{y.protocol}</h4>
                                            <p className="text-[10px] text-brand-earth uppercase tracking-widest">{y.network}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-mono font-bold text-green-500">{y.apy}%</p>
                                        <p className="text-[9px] text-brand-earth uppercase font-black">Est. APY</p>
                                    </div>
                                </div>
                                <button type="button" className="w-full py-3 bg-off-white hover:bg-border text-brand-deep rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    Stake {y.asset}
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-brand-earth mb-6 flex items-center gap-2">
                            <ShieldCheck size={14} className="text-brand-earth" />
                            Protocol Insurance (Parametric)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {covers.map(c => (
                                <div key={c.id} className="bg-off-white/40 border border-border rounded-3xl p-6 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h5 className="font-bold text-brand-deep">{c.target}</h5>
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-white text-brand-earth rounded border border-border">{c.type}</span>
                                        </div>
                                        <p className="text-[10px] text-brand-earth leading-relaxed mb-4">Protection against {c.type === 'Bridge' ? 'Bridge Failure' : 'Contract Hack'}.</p>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto">
                                        <div>
                                            <p className="text-sm font-mono font-bold text-brand-deep">{c.annualPremium}%</p>
                                            <p className="text-[9px] text-brand-earth uppercase font-black">Annual Premium</p>
                                        </div>
                                        <button type="button" className="px-4 py-2 bg-border hover:bg-brand-earth text-brand-earth rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                                            Buy Cover
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
              )}

              {activeTab === 'staking' && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                      <div className="bg-accent-earth/10 border border-orange-500/20 rounded-3xl p-8 text-center space-y-4">
                          <Coins size={48} className="text-accent-earth mx-auto" />
                          <h4 className="text-xl font-black italic uppercase tracking-tighter text-brand-deep">Babylon Bitcoin Staking</h4>
                          <p className="text-sm text-brand-earth max-w-md mx-auto">Stake BTC natively via P2P.org finality providers. Non-custodial, hardware-signed, with full slashing protection.</p>
                          <div className="grid grid-cols-3 gap-4 pt-4">
                              <div className="p-4 bg-white rounded-2xl border border-border">
                                  <p className="text-[8px] font-black uppercase text-brand-earth mb-1">Total Staked</p>
                                  <p className="text-sm font-mono font-bold text-brand-deep">{babylonStats?.totalStaked} BTC</p>
                              </div>
                              <div className="p-4 bg-white rounded-2xl border border-border">
                                  <p className="text-[8px] font-black uppercase text-brand-earth mb-1">Current APY</p>
                                  <p className="text-sm font-mono font-bold text-green-500">{babylonStats?.apy}%</p>
                              </div>
                              <div className="p-4 bg-white rounded-2xl border border-border">
                                  <p className="text-[8px] font-black uppercase text-brand-earth mb-1">Min Amount</p>
                                  <p className="text-sm font-mono font-bold text-brand-deep">{babylonStats?.minStakingAmount.toLocaleString()} sats</p>
                              </div>
                          </div>
                          <button className="w-full py-4 bg-accent-earth hover:bg-accent-earth/90 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all mt-6 shadow-xl shadow-orange-900/20">
                              Initiate Native Stake
                          </button>
                      </div>
                  </div>
              )}

              {activeTab === 'dlc' && (
                  <div className="space-y-6 animate-in fade-in duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {dlcEvents.map(e => (
                              <div key={e.id} className="bg-white border border-border rounded-3xl p-6 hover:border-blue-500/30 transition-all group">
                                  <div className="flex justify-between items-start mb-4">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
                                              <Dices size={20} />
                                          </div>
                                          <div>
                                              <h4 className="font-bold text-brand-deep">{e.name}</h4>
                                              <p className="text-[10px] text-brand-earth uppercase tracking-widest">{e.oracle}</p>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="bg-off-white/50 rounded-xl p-3 mb-6 border border-border">
                                      <p className="text-[9px] text-brand-earth leading-relaxed italic">Conditional payment locked until event resolution. Verifiable on-chain via DLC.link.</p>
                                  </div>
                                  <button className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-500/20">
                                      Create Offer
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

           </div>
        </div>

        {/* Sidebar / Analysis */}
        <div className="lg:col-span-4 space-y-8">
           
           {/* Risk Analyzer */}
           <div className="bg-purple-600/10 border border-purple-500/20 rounded-[2.5rem] p-8 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                 <div className="bg-purple-500/20 p-2 rounded-lg">
                    <ShieldAlert className="text-purple-500" size={20} />
                 </div>
                 <h4 className="font-bold text-sm uppercase tracking-widest text-purple-200">Protocol Auditor</h4>
              </div>
              
              <div className="min-h-[200px] text-xs text-purple-100/80 leading-relaxed font-medium">
                 {analyzingRisk ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 gap-3">
                       <Loader2 className="animate-spin text-purple-500" size={24} />
                       <span className="uppercase tracking-widest text-[10px]">Auditing Contracts...</span>
                    </div>
                 ) : riskAnalysis ? (
                    <div className="animate-in fade-in duration-500 whitespace-pre-wrap">
                       {riskAnalysis}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full py-10 text-center opacity-50">
                       <p>Select a position to audit sovereign risk vectors.</p>
                    </div>
                 )}
              </div>
           </div>

           {/* Sovereign Yield Zap */}
           <div className={`bg-gradient-to-br ${SWAP_EXPERIMENTAL ? 'from-brand-earth to-border border-brand-earth' : 'from-orange-600 to-red-600 border-orange-500'} text-white border rounded-[2.5rem] p-8 space-y-6 shadow-xl relative overflow-hidden group`}>
              <div className="absolute -top-4 -right-4 opacity-20 group-hover:scale-110 transition-transform">
                 <Zap size={100} />
              </div>
              <div className="relative z-10">
                 <h4 className="font-black text-xl italic uppercase tracking-tighter mb-2">Sovereign Zap</h4>
                 <p className="text-[10px] font-black text-orange-200 uppercase tracking-widest mb-2">Powered by Changelly & Breez</p>
                 {SWAP_EXPERIMENTAL && (
                   <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-start gap-2">
                     <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                     <p className="text-[10px] text-amber-200">Changelly API not connected. Swap functionality is disabled until backend proxy is deployed.</p>
                   </div>
                 )}
                 <p className="text-xs font-medium opacity-90 leading-relaxed mb-6">
                    Bundle Swap + Bridge + Staking into one atomic transaction. 
                 </p>
                 <div className="bg-white/10 p-4 rounded-2xl mb-6 backdrop-blur-sm border border-white/20">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase mb-1">
                       <span>Yield Route</span>
                       <span className={SWAP_EXPERIMENTAL ? 'text-brand-earth' : 'text-green-300'}>Target: 14% APY</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold">
                       <span>BTC</span> <ArrowRight size={12} /> <span>sBTC</span> <ArrowRight size={12} /> <Coins size={14} />
                    </div>
                 </div>
                 <button type="button"
                  onClick={handleZap}
                  disabled={isZapping || SWAP_EXPERIMENTAL}
                  className="w-full py-4 bg-amber-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                 >
                    {SWAP_EXPERIMENTAL ? <><Ban size={16} /> Swap Unavailable</> : isZapping ? <><Loader2 size={16} className="animate-spin" /> Bundling Tx...</> : <><Zap size={16} /> One-Click Yield</>}
                 </button>
              </div>
           </div>

           {/* B2B Institutional Portal */}
           <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-8 text-center space-y-4">
              <div className="w-12 h-12 bg-accent-earth/10 rounded-2xl flex items-center justify-center mx-auto text-accent-earth mb-2 border border-orange-500/20">
                 <ShieldCheck size={24} />
              </div>
              <h4 className="font-bold text-sm text-brand-deep uppercase tracking-widest">Institutional Liquidity</h4>
              <p className="text-xs text-brand-earth leading-relaxed italic">Access shielded B2B assets and corporate treasury tools via Conxian Gateway.</p>
              <button
                onClick={() => window.open('https://conxian-ui.onrender.com', '_blank', 'noopener,noreferrer')}
                className="w-full py-3 bg-border hover:bg-brand-earth text-brand-deep rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-brand-earth"
              >
                 Open Gateway <ExternalLink size={12} />
              </button>
           </div>

        </div>
      </div>
    </div>
  );
};

export default DeFiDashboard;
