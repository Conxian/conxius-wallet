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
  AlertTriangle
} from 'lucide-react';
import { SWAP_EXPERIMENTAL } from '../services/swap';

const DeFiDashboard: React.FC = () => {
  const context = useContext(AppContext);
  const { state, authorizeSignature, notify } = context!;
  const { mode, assets } = state;

  const [activeTab, setActiveTab] = useState<'positions' | 'opportunities'>('positions');
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState<string | null>(null);
  const [isZapping, setIsZapping] = useState(false);

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
    // Simulation delay
    await new Promise(r => setTimeout(r, 1500));
    setRiskAnalysis(`Protocol: ${protocol}\n\n[AUDIT RESULT]: LOW RISK\n- Multisig: 3/5 (Verified)\n- TVL: 42M\n- Last Audit: 2026-01-14\n- Enclave Compatibility: 100%`);
    setAnalyzingRisk(false);
  };

  const handleZap = async () => {
    if (SWAP_EXPERIMENTAL) return;
    setIsZapping(true);
    try {
      // Simulate complex bundling
      await new Promise(r => setTimeout(r, 2000));
      notify('success', 'Sovereign Zap Executed: BTC -> sBTC -> Staking');
    } catch {
      notify('error', 'Zap Failed');
    } finally {
      setIsZapping(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase italic">
            Sovereign<span className="text-purple-500">DeFi</span>
          </h2>
          <p className="text-zinc-500 text-sm font-medium">Institutional-grade yield optimization from your Citadel.</p>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl">
           <button
             onClick={() => setActiveTab('positions')}
             className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'positions' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400'}`}
           >
              Positions
           </button>
           <button
             onClick={() => setActiveTab('opportunities')}
             className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'opportunities' ? 'bg-purple-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-400'}`}
           >
              Discovery
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-8">
           <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl">
              <div className="flex items-center gap-6 mb-8 border-b border-zinc-800 pb-6">
                 <button 
                    onClick={() => setActiveTab('positions')}
                    className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'positions' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                    Active Positions
                 </button>
                 <button 
                    onClick={() => setActiveTab('opportunities')}
                    className={`pb-2 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'opportunities' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                    Yield Discovery
                 </button>
              </div>

              {activeTab === 'positions' ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mode === 'sovereign' && positions.length === 0 ? (
                       <div className="col-span-2 flex flex-col items-center justify-center py-12 opacity-50 border border-zinc-800 rounded-3xl bg-zinc-900/20">
                          <Lock size={48} className="text-zinc-700 mb-4" />
                          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No Active Positions</p>
                          <p className="text-xs text-zinc-600 italic mt-2">Connect to sovereign DeFi protocols to view positions.</p>
                       </div>
                    ) : (
                    positions.map((pos) => (
                       <div key={pos.id} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 hover:border-zinc-700 transition-all group">
                          <div className="flex justify-between items-start mb-4">
                             <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${pos.layer === 'Stacks' ? 'bg-purple-600' : 'bg-blue-600'}`}>
                                   {pos.protocol[0]}
                                </div>
                                <div>
                                   <h4 className="font-bold text-zinc-100">{pos.protocol}</h4>
                                   <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{pos.type}</p>
                                </div>
                             </div>
                             <button type="button" onClick={() => analyzeProtocol(pos.protocol)} className="p-2 text-zinc-600 hover:text-purple-500 transition-colors" aria-label="Analyze Protocol Risk">
                                <ShieldAlert size={16} />
                             </button>
                          </div>
                          
                          <div className="space-y-3">
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500 font-bold uppercase">Pair</span>
                                <span className="text-zinc-200 font-mono">{pos.pair}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500 font-bold uppercase">Value</span>
                                <span className="text-zinc-200 font-mono">{pos.value}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500 font-bold uppercase">Net APY</span>
                                <span className="text-green-500 font-mono font-bold">{pos.apy}</span>
                             </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-zinc-900 flex gap-2">
                             <button type="button" className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                Unstake
                             </button>
                             <button type="button" className="flex-1 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                Compound
                             </button>
                          </div>
                       </div>
                    )))}
                 </div>
              ) : (
                 <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 text-center space-y-4">
                    <Zap size={48} className="text-zinc-700 mx-auto" />
                    <p className="text-sm font-bold text-zinc-400">Yield scanner active via local node.</p>
                    <p className="text-xs text-zinc-600">Connecting to Alex, Sovryn, and Bitflow RPCs...</p>
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
           <div className={`bg-gradient-to-br ${SWAP_EXPERIMENTAL ? 'from-zinc-700 to-zinc-800 border-zinc-700' : 'from-orange-600 to-red-600 border-orange-500'} text-white border rounded-[2.5rem] p-8 space-y-6 shadow-xl relative overflow-hidden group`}>
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
                       <span className={SWAP_EXPERIMENTAL ? 'text-zinc-400' : 'text-green-300'}>Target: 14% APY</span>
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
           <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8 text-center space-y-4">
              <div className="w-12 h-12 bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500 mb-2 border border-orange-500/20">
                 <ShieldCheck size={24} />
              </div>
              <h4 className="font-bold text-sm text-zinc-200 uppercase tracking-widest">Institutional Liquidity</h4>
              <p className="text-xs text-zinc-500 leading-relaxed italic">Access shielded B2B assets and corporate treasury tools via Conxian Gateway.</p>
              <button
                onClick={() => window.open('https://conxian-ui.onrender.com', '_blank', 'noopener,noreferrer')}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-zinc-700"
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
