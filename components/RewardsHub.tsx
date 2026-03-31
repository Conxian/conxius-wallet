
import React, { useState, useEffect, useContext } from 'react';
import { TrendingUp, ShieldCheck, Zap, Coins, ArrowRight, Wallet, Sparkles, PieChart, Info, DollarSign, Heart, BarChart3, Loader2, FlaskConical, Terminal, Activity, Network, Database } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { AppContext } from '../context';

const MOCK_LEDGER = [
  { id: 'tx-1', type: 'Bridge Fee', amount: '0.0000021 BTC', time: '2m ago', status: 'Verified' },
  { id: 'tx-2', type: 'Swap Reward', amount: '0.0000008 BTC', time: '14m ago', status: 'Verified' },
  { id: 'tx-3', type: 'Node Support', amount: '0.0000102 BTC', time: '1h ago', status: 'Verified' },
  { id: 'tx-4', type: 'L2 Gas Rebate', amount: '0.0000045 BTC', time: '3h ago', status: 'Verified' },
  { id: 'tx-5', type: 'Data Lease (AI)', amount: '0.0000015 BTC', time: '5h ago', status: 'Pending' },
];

const RewardsHub: React.FC = () => {
  const appContext = useContext(AppContext);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [ledger, setLedger] = useState(MOCK_LEDGER);

  const accumulatedFees = appContext?.state.integratorFeesAccumulated || 0;
  const dataEarnings = appContext?.state.dataSharing.totalEarned || 0;

  const runSovereignAudit = async () => {
    setIsAuditing(true);
    try {
      const apiKey = appContext?.state.aiConfig?.apiKey;
      if (!apiKey) throw new Error("API Key not configured");
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Perform an economic audit for a Conxius Wallet user. Explain how the 0.05% integrator fee supports Conxian-Labs R&D. Compare this to CEX spreads (1-2%). Highlight that this fee builds a whole ecosystem of sovereign tools. Use technical institutional tone.",
      });
      setAuditReport(result.text || "Audit unavailable.");
    } catch (e) {
      setAuditReport("Audit engine offline. Your contributions are currently securing the mesh.");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-brand-deep">Labs Rewards Hub</h2>
          <p className="text-brand-earth text-sm">Quantifying value distribution in the sovereign ecosystem.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-2xl">
           <DollarSign size={14} className="text-green-500" />
           <span className="text-[10px] font-black uppercase text-brand-earth tracking-widest">Net Efficiency Gain: +$1,120.45</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-10">
          <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-10 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
              <PieChart size={200} />
            </div>
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase text-brand-earth tracking-[0.2em] mb-2">Aggregate Gain</p>
                  <h3 className="text-5xl font-bold text-brand-deep font-mono tracking-tighter">$1,240.85</h3>
                  <p className="text-xs text-green-500 font-bold mt-2 flex items-center gap-1">
                     <TrendingUp size={12} /> +12.4% vs. Legacy CEX
                  </p>
                </div>
                
                <div className="space-y-4">
                   <div className="flex justify-between text-xs border-b border-border pb-2">
                      <span className="text-brand-earth">Protocol Stacking</span>
                      <span className="text-brand-deep font-bold">$980.20</span>
                   </div>
                   <div className="flex justify-between text-xs border-b border-border pb-2">
                      <span className="text-brand-earth">L2 Fee Savings</span>
                      <span className="text-brand-deep font-bold">$260.65</span>
                   </div>
                   <div className="flex justify-between text-xs border-b border-border pb-2">
                      <span className="text-purple-500 flex items-center gap-2"><Database size={10} /> Data Dividends</span>
                      <span className="text-purple-400 font-bold">{(dataEarnings * 65000).toFixed(2)} USD</span>
                   </div>
                </div>
              </div>

              <div className="bg-white/50 rounded-3xl p-8 border border-border flex flex-col justify-between">
                 <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase text-brand-earth tracking-widest flex items-center gap-2">
                       <FlaskConical size={14} className="text-accent-earth" /> Labs R&D Support
                    </h4>
                    <p className="text-3xl font-bold text-accent-earth font-mono">{accumulatedFees.toFixed(6)} <span className="text-xs">BTC</span></p>
                    <p className="text-[10px] text-brand-earth leading-relaxed italic">
                      Verified by the Conxius Treasury multisig. Funding local-first privacy infrastructure.
                    </p>
                 </div>
                 <div className="pt-6">
                    <div className="w-full h-1 bg-off-white rounded-full mb-2 overflow-hidden">
                       <div className="w-[15%] h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                    </div>
                    <p className="text-[8px] text-brand-earth font-black uppercase">Treasury Contribution Level: Active</p>
                 </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-border bg-off-white/20 flex items-center justify-between">
                 <h3 className="text-xs font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                    <Terminal size={16} /> Verifiable Labs Ledger
                 </h3>
                 <div className="flex items-center gap-2">
                    <Activity size={12} className="text-green-500 animate-pulse" />
                    <span className="text-[9px] font-black text-brand-earth uppercase tracking-tighter">Chain Sync OK</span>
                 </div>
              </div>
              <div className="divide-y divide-off-white">
                 {ledger.map((item) => (
                    <div key={item.id} className="p-6 flex items-center justify-between group hover:bg-off-white/10 transition-all">
                       <div className="flex items-center gap-5">
                          <div className={`w-10 h-10 rounded-xl bg-off-white border border-border flex items-center justify-center ${item.type.includes('Data') ? 'text-purple-500' : 'text-brand-earth'}`}>
                             {item.type.includes('Data') ? <Database size={18} /> : <Coins size={18} />}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-brand-deep">{item.type}</p>
                             <p className="text-[10px] text-brand-earth font-mono italic">{item.time}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-sm font-mono font-bold text-accent-earth">+{item.amount}</p>
                          <span className="text-[8px] font-black bg-green-500/10 text-green-500 px-2 py-0.5 rounded uppercase tracking-widest border border-green-500/10">{item.status}</span>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
           <div className="bg-accent-earth border border-orange-500 rounded-[2.5rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-orange-600/30">
            <div className="absolute -bottom-8 -right-8 opacity-20 group-hover:scale-110 transition-transform">
              <Sparkles size={160} />
            </div>
            <h4 className="text-2xl font-black tracking-tighter mb-2 italic">Sovereign Discovery</h4>
            <p className="text-sm opacity-90 mb-8 italic">Your contributions fuel the next generation of Bitcoin L2 tooling.</p>
            <button
              onClick={runSovereignAudit}
              disabled={isAuditing}
              className="w-full bg-white text-orange-600 font-black py-4 rounded-3xl text-xs uppercase tracking-widest hover:bg-white transition-all shadow-2xl flex items-center justify-center gap-2"
            >
              {isAuditing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {isAuditing ? 'Generating Report...' : 'Audit R&D Roadmap'}
            </button>
          </div>

          {auditReport && (
            <div className="bg-white border border-border rounded-[2.5rem] p-8 animate-in zoom-in duration-300">
               <div className="flex items-center gap-2 mb-4 text-accent-earth">
                  <Info size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Economic Audit v1.0</span>
               </div>
               <p className="text-xs text-brand-earth leading-relaxed font-serif whitespace-pre-wrap italic">
                  {auditReport}
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RewardsHub;
