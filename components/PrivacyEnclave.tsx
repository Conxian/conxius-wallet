import React, { useState, useContext, useMemo } from 'react';
import { Shield, ShieldAlert, Ghost, Cpu, Network, Bot, Share2, ArrowRight, Zap, Info } from 'lucide-react';
import { AppContext } from '../context';
import { calculatePrivacyScore } from '../services/privacy';

const PrivacyEnclave: React.FC = () => {
  const appContext = useContext(AppContext);
  const [isDataUnionActive, setIsDataUnionActive] = useState(appContext?.state.dataSharing.enabled ?? false);
  const [askPrice, setAskPrice] = useState(appContext?.state.dataSharing.minAskPrice ?? 100);
  const [localOnly, setLocalOnly] = useState(true);
  const [nostrMetadata, setNostrMetadata] = useState(true);
  const [torEnabled, setTorEnabled] = useState(appContext?.state.isTorActive ?? false);

  const privacyResult = useMemo(() => {
    if (!appContext?.state) return { score: 0, recommendations: [] };
    return calculatePrivacyScore(appContext.state);
  }, [appContext?.state]);

  const toggleDataUnion = () => {
    const newState = !isDataUnionActive;
    setIsDataUnionActive(newState);
    // Persist if needed
  };

  return (
    <div className="p-8 space-y-10 max-w-5xl mx-auto pb-32">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-500 border border-purple-500/20 shadow-lg shadow-purple-500/10">
              <Shield size={28} />
           </div>
           <div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Privacy Enclave</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Zero-Knowledge Sovereignty Management</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800 rounded-[2.5rem] p-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-10">
              <Network size={120} className="text-purple-500" />
           </div>
           
           <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                 <h3 className="text-xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                    <Network size={24} className="text-purple-500" />
                    Sovereign Data Union
                 </h3>
                 <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    Negotiate your own terms. Lease anonymized wallet metadata to AI researchers directly from your node. 
                    <span className="block mt-2 text-purple-400">
                       • You hold the data (Local Storage). <br/>
                       • You set the price (Sats/Query). <br/>
                       • You keep 95% of revenue.
                    </span>
                 </p>
                 
                 <div className="flex items-center gap-4 pt-2">
                    <button 
                      onClick={toggleDataUnion}
                      aria-label="Toggle sovereign data union"
                      className={`relative w-14 h-7 rounded-full transition-colors ${isDataUnionActive ? 'bg-purple-600' : 'bg-zinc-800'}`}
                    >
                       <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${isDataUnionActive ? 'left-8' : 'left-1'}`} />
                    </button>
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                       {isDataUnionActive ? 'Broadcasting Offer' : 'Union Inactive'}
                    </span>
                 </div>
              </div>

              <div className="bg-zinc-950/80 rounded-3xl p-6 border border-zinc-900 space-y-4 backdrop-blur-sm">
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Incentive Status</span>
                    {isDataUnionActive ? (
                       <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded border border-green-500/20 uppercase">2x AI Caps Active</span>
                    ) : (
                       <span className="text-[10px] font-bold text-zinc-600 uppercase">Standard</span>
                    )}
                 </div>
                 
                 <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 block">Min. Ask Price (Negotiable)</label>
                    <div className="flex items-center gap-4">
                       <input 
                          type="range" 
                          min="10" 
                          max="500" 
                          value={askPrice} 
                          onChange={(e) => setAskPrice(parseInt(e.target.value))}
                          disabled={!isDataUnionActive}
                          className="flex-1 accent-purple-500"
                       />
                       <span className="text-lg font-mono font-bold text-white">{askPrice} <span className="text-xs text-zinc-500">SATS</span></span>
                    </div>
                 </div>
                 
                 <p className="text-[9px] text-zinc-600 italic border-t border-zinc-900 pt-3">
                    *Conxius Labs takes a 5% protocol fee for facilitating the P2P handshake. Data is never stored on our servers.
                 </p>
              </div>
           </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-8">
            <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Cpu size={16} />
              Hardware & Storage
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-bold text-zinc-200">Local-Only Key Generation</p>
                  <p className="text-xs text-zinc-500 max-w-[240px]">Keys are generated in the browser's secure enclave and never touch our servers.</p>
                </div>
                <button 
                  onClick={() => setLocalOnly(!localOnly)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${localOnly ? 'bg-orange-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${localOnly ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-bold text-zinc-200">Nostr Metadata Storage</p>
                  <p className="text-xs text-zinc-500 max-w-[240px]">Store your wallet profile and D.i.D info on decentralized Nostr relays instead of databases.</p>
                </div>
                <button 
                  onClick={() => setNostrMetadata(!nostrMetadata)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${nostrMetadata ? 'bg-orange-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${nostrMetadata ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-8">
            <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Ghost size={16} />
              Network Identity
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-bold text-zinc-200">Always Route through Tor</p>
                  <p className="text-xs text-zinc-500 max-w-[240px]">Obfuscate your IP address for all RPC and API calls.</p>
                </div>
                <button 
                  onClick={() => {
                    const next = !torEnabled;
                    setTorEnabled(next);
                    appContext?.toggleGateway(next);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${torEnabled ? 'bg-orange-600' : 'bg-zinc-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${torEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-900 text-xs text-zinc-500">
                <ShieldAlert size={18} className="text-yellow-600 shrink-0" />
                <p>Public mempool listeners can still deanonymize transactions via timing analysis. Use <strong>CoinJoin</strong> for maximum L1 privacy.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-500/20 p-2 rounded-lg">
                <Bot className="text-orange-500" size={18} />
              </div>
              <h4 className="font-bold text-xs uppercase tracking-widest text-orange-500">Satoshi AI: Privacy Audit</h4>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Privacy Score</span>
                <span className={`text-lg font-bold ${privacyResult.score > 80 ? 'text-green-500' : 'text-orange-500'}`}>{privacyResult.score}/100</span>
              </div>
              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-green-500 rounded-full transition-all duration-1000"
                  style={{ width: `${privacyResult.score}%` }}
                />
              </div>
              <div className="space-y-2">
                {privacyResult.recommendations.length > 0 ? (
                  privacyResult.recommendations.map((rec, i) => (
                    <p key={i} className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                      <Info size={10} className="mt-0.5 text-orange-500 shrink-0" />
                      {rec}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 leading-relaxed italic">
                    "Excellent work. Your digital sovereignty is currently high. Continue utilizing local-only key generation and Tor routing."
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl p-8 space-y-4">
            <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-2">
              <Share2 size={16} className="text-blue-500" />
              Zero-Knowledge Proofs
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We are working on integrating <strong>ZK-Rollup</strong> metadata. Soon, you'll be able to prove you own a specific amount of BTC or a D.i.D credential without revealing your actual addresses.
            </p>
            <button className="w-full py-2 bg-zinc-800 rounded-xl text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:bg-zinc-700 transition-colors">
              Request Early Access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyEnclave;
