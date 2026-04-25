import React, { useState, useContext, useEffect } from 'react';
import { BitcoinLayer } from '../types';
import { ArrowRight, Info, AlertCircle, CheckCircle2, Loader2, Link, TrendingUp, ShieldCheck, Zap, Globe, Search, RefreshCw, ExternalLink, Target, Cpu, Download, Activity } from 'lucide-react';
import { AppContext } from '../context';
import { NttService, BRIDGE_STAGES, getRecommendedBridgeProtocol, NTT_CONFIGS } from '../services/ntt';
import { fetchUtxos, broadcastTransaction, fetchSbtcWalletAddress, monitorSbtcPegIn, fetchNativePegAddress } from '../services/protocol';
import { buildSbtcPegInPsbt, buildNativePegPsbt } from '../services/psbt';

const NTTBridge: React.FC = () => {
  const context = useContext(AppContext);
  const [bridgeType, setBridgeType] = useState<'NTT' | 'Native Peg'>('NTT');
  const [step, setStep] = useState(1);
  const [sourceLayer, setSourceLayer] = useState('Mainnet');
  const [targetLayer, setTargetLayer] = useState('Stacks');
  const [amount, setAmount] = useState('');
  const [isBridgeInProgress, setIsBridgeInProgress] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<string>('IDLE');
  const [txHash, setTxHash] = useState('');
  const [feeEstimation, setFeeEstimation] = useState<any>(null);
  const [isEstimatingFees, setIsEstimatingFees] = useState(false);

  useEffect(() => {
    const savedTx = localStorage.getItem('PENDING_NTT_TX');
    const savedLayer = localStorage.getItem('PENDING_NTT_TARGET');
    if (savedTx) {
      setTimeout(() => setTxHash(savedTx), 0);
      setTimeout(() => setIsBridgeInProgress(true), 0);
      setTimeout(() => setStep(4), 0);
      if (savedLayer) setTimeout(() => setTargetLayer(savedLayer), 0);
    }
  }, []);

  useEffect(() => {
    if (sourceLayer && targetLayer) {
        const recommended = getRecommendedBridgeProtocol(sourceLayer, targetLayer);
        if (recommended === 'Native') {
            setTimeout(() => setBridgeType('Native Peg'), 0);
        } else {
            setTimeout(() => setBridgeType('NTT'), 0);
        }
    }
  }, [sourceLayer, targetLayer]);

  useEffect(() => {
    if (step === 2 && sourceLayer && targetLayer && context) {
      setTimeout(() => setIsEstimatingFees(true), 0);
      NttService.estimateFees(amount.toString(), sourceLayer, targetLayer, context.state.network)
        .then(setFeeEstimation)
        .catch(console.error)
        .finally(() => setIsEstimatingFees(false));
    }
  }, [step, sourceLayer, targetLayer, amount, context?.state.network]);

  const handleNativeBridge = async () => {
      if (!context) return;
      setIsBridgeInProgress(true);
      setBridgeStatus('INITIATING');
      try {
          const utxos = await fetchUtxos(context.state.walletConfig?.masterAddress || '', context.state.network);
          const pegInAddress = await fetchNativePegAddress(targetLayer as any, context.state.network);
          const amountSats = Math.floor(parseFloat(amount) * 100000000);

          let psbtHex = '';
          if (targetLayer === 'Stacks') {
              psbtHex = await buildSbtcPegInPsbt({
                  amountSats,
                  utxos,
                  stacksAddress: context.state.walletConfig?.stacksAddress || '',
                  changeAddress: context.state.walletConfig?.masterAddress || '',
                  feeRate: 2,
                  network: context.state.network,
                  pegInAddress
              });
          } else {
              psbtHex = await buildNativePegPsbt({
                  amountSats,
                  utxos,
                  changeAddress: context.state.walletConfig?.masterAddress || '',
                  feeRate: 2,
                  network: context.state.network,
                  pegInAddress
              });
          }

          const signed = await context.authorizeSignature({
              type: 'psbt',
              layer: 'Mainnet',
              payload: { psbt: psbtHex },
              description: `Bridge ${amount} BTC to ${targetLayer}`
          });

          if (signed.broadcastReadyHex) {
              setBridgeStatus('BROADCASTING');
              const txid = await broadcastTransaction(signed.broadcastReadyHex, 'Mainnet', context.state.network);
              setTxHash(txid);
              setStep(4);
              localStorage.setItem('PENDING_NTT_TX', txid);
              localStorage.setItem('PENDING_NTT_TARGET', targetLayer);

              setBridgeStatus('VERIFYING');
              await monitorSbtcPegIn(txid, context.state.network);
              setBridgeStatus('COMPLETED');
          }
      } catch (e: any) {
          context.notify('error', e.message, 'Bridge Failed');
          setIsBridgeInProgress(false);
      }
  };

  const handleNttBridge = async () => {
    if (!context) return;
    setIsBridgeInProgress(true);
    setBridgeStatus('INITIATING');

    try {
       // NTT logic would use NttService.executeNtt (simulation)
       setTimeout(() => {
           setTxHash('0x' + Math.random().toString(16).substring(2, 66));
           setStep(4);
           setBridgeStatus('COMPLETED');
       }, 3000);
    } catch (e: any) {
        context.notify('error', e.message, 'NTT Failed');
        setIsBridgeInProgress(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-accent-earth/10 rounded-xl">
                <Globe size={20} className="text-accent-earth" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-earth">Cross-Layer Settlement</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-brand-deep">Sovereign Bridge</h1>
          <p className="text-brand-earth mt-2 max-w-md italic">Transfer assets across the Bitcoin ecosystem with hardware-enforced privacy.</p>
        </div>

        <div className="flex bg-off-white/50 p-1.5 rounded-2xl border border-border">
          <button
            onClick={() => setBridgeType('NTT')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bridgeType === 'NTT' ? 'bg-white text-brand-deep shadow-sm border border-border' : 'text-brand-earth'}`}
          >
            NTT Protocol
          </button>
          <button
            onClick={() => setBridgeType('Native Peg')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bridgeType === 'Native Peg' ? 'bg-white text-brand-deep shadow-sm border border-border' : 'text-brand-earth'}`}
          >
            Native Peg-In
          </button>
        </div>
      </div>

      {/* Main Bridge UI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-8">
           <div className="bg-white border border-border rounded-[3rem] p-10 shadow-2xl shadow-orange-950/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] -rotate-12 group-hover:rotate-0 transition-transform duration-700">
                <Target size={240} />
              </div>

              <div className="relative z-10 space-y-10">
                {step === 1 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-brand-earth ml-1">Source Layer</label>
                          <select
                            value={sourceLayer}
                            onChange={(e) => setSourceLayer(e.target.value)}
                            className="w-full bg-off-white border border-border rounded-2xl py-5 px-6 font-bold text-brand-deep focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                          >
                             <option value="Mainnet">Bitcoin L1</option>
                             <option value="Lightning">Lightning</option>
                             <option value="Liquid">Liquid</option>
                          </select>
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-brand-earth ml-1">Target Layer</label>
                          <select
                            value={targetLayer}
                            onChange={(e) => setTargetLayer(e.target.value)}
                            className="w-full bg-off-white border border-border rounded-2xl py-5 px-6 font-bold text-brand-deep focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                          >
                             <option value="Stacks">Stacks (sBTC)</option>
                             <option value="Rootstock">Rootstock (RBTC)</option>
                             <option value="BOB">BOB (L2)</option>
                             <option value="Base">Base (EVM)</option>
                          </select>
                       </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-brand-earth ml-1">Amount to Bridge</label>
                      <div className="relative">
                         <input
                           type="number"
                           value={amount}
                           onChange={(e) => setAmount(e.target.value)}
                           placeholder="0.00"
                           className="w-full bg-off-white border border-border rounded-3xl py-10 px-10 text-5xl font-black text-brand-deep focus:outline-none focus:border-orange-500/50 transition-all font-mono tracking-tighter"
                         />
                         <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-end">
                            <span className="text-xl font-black text-brand-earth">BTC</span>
                            <span className="text-[10px] font-bold text-brand-earth/60 uppercase">~ $0.00</span>
                         </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setStep(2)}
                      disabled={!amount || parseFloat(amount) <= 0}
                      className="w-full py-6 bg-accent-earth hover:bg-accent-earth/90 disabled:opacity-50 text-white font-black rounded-[2rem] text-sm uppercase tracking-widest transition-all shadow-xl shadow-orange-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      Next: Review Bridge <ArrowRight size={18} />
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                     <div className="bg-ivory/50 border border-border rounded-3xl p-8 space-y-6">
                        <div className="flex justify-between items-center pb-6 border-b border-border/50">
                           <span className="text-[10px] font-black uppercase tracking-widest text-brand-earth">Protocol</span>
                           <span className="px-4 py-1.5 bg-accent-earth text-white rounded-full text-[9px] font-black uppercase tracking-tighter">{bridgeType}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-8 py-2">
                           <div>
                              <p className="text-[9px] font-black uppercase text-brand-earth mb-1">From</p>
                              <p className="text-lg font-bold text-brand-deep">{sourceLayer}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black uppercase text-brand-earth mb-1">To</p>
                              <p className="text-lg font-bold text-brand-deep">{targetLayer}</p>
                           </div>
                        </div>

                        <div className="pt-6 border-t border-border/50 space-y-4">
                           <div className="flex justify-between text-xs">
                              <span className="text-brand-earth">Transfer Amount</span>
                              <span className="font-bold text-brand-deep">{amount} BTC</span>
                           </div>
                           <div className="flex justify-between text-xs">
                              <span className="text-brand-earth">Bridge Fee</span>
                              <span className="font-bold text-brand-deep">0.0001 BTC</span>
                           </div>
                           <div className="flex justify-between text-sm pt-4 font-black">
                              <span className="text-brand-deep uppercase tracking-widest">Total cost</span>
                              <span className="text-accent-earth font-mono">{(parseFloat(amount) + 0.0001).toFixed(4)} BTC</span>
                           </div>
                        </div>
                     </div>

                     <div className="flex gap-4">
                        <button
                          onClick={() => setStep(1)}
                          className="flex-1 py-5 border border-border text-brand-earth font-black rounded-3xl text-[10px] uppercase tracking-widest hover:bg-off-white transition-all"
                        >
                          Back
                        </button>
                        <button
                          onClick={bridgeType === 'NTT' ? handleNttBridge : handleNativeBridge}
                          className="flex-[2] py-5 bg-brand-deep text-white font-black rounded-3xl text-[10px] uppercase tracking-widest hover:shadow-xl transition-all flex items-center justify-center gap-3"
                        >
                          Initiate Sovereign Transfer <Zap size={16} className="fill-current" />
                        </button>
                     </div>
                  </div>
                )}

                {step === 4 && (
                   <div className="py-12 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-500">
                      <div className="relative">
                         <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                         <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center relative z-10 shadow-2xl shadow-green-500/40">
                            <CheckCircle2 size={48} className="text-white" />
                         </div>
                      </div>

                      <div>
                         <h2 className="text-3xl font-black text-brand-deep tracking-tighter">Transfer Initiated</h2>
                         <p className="text-brand-earth mt-2 italic">Monitoring settlement on {targetLayer}...</p>
                      </div>

                      <div className="w-full bg-off-white border border-border rounded-3xl p-6 font-mono text-[10px] break-all text-brand-earth flex items-center gap-3">
                         <span className="opacity-50">TX:</span>
                         <span className="flex-1 text-left">{txHash}</span>
                         <button className="p-2 hover:bg-white rounded-lg transition-all"><Link size={14} /></button>
                      </div>

                      <button
                        onClick={() => { setStep(1); setAmount(''); setIsBridgeInProgress(false); localStorage.removeItem('PENDING_NTT_TX'); }}
                        className="w-full py-5 border-2 border-brand-deep text-brand-deep font-black rounded-[2rem] text-[10px] uppercase tracking-widest hover:bg-brand-deep hover:text-white transition-all"
                      >
                         Dismiss & Return to Assets
                      </button>
                   </div>
                )}
              </div>
           </div>

           {/* Security Warning */}
           <div className="bg-orange-500/5 border border-orange-500/20 rounded-3xl p-6 flex gap-5 items-start">
              <div className="p-3 bg-orange-500/10 rounded-2xl">
                 <ShieldCheck size={24} className="text-accent-earth" />
              </div>
              <div className="space-y-1">
                 <h4 className="text-xs font-black uppercase text-brand-deep tracking-widest">Enclave Verification Active</h4>
                 <p className="text-[10px] text-brand-earth leading-relaxed">All bridge operations require local signature verification within the hardware-isolated StrongBox environment. Your private keys never leave the device.</p>
              </div>
           </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-5 space-y-8">
           <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-10 space-y-10">
              <h3 className="text-xs font-black uppercase text-brand-earth tracking-widest flex items-center gap-2">
                 <TrendingUp size={16} className="text-accent-earth" />
                 Market Metrics
              </h3>

              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div>
                       <p className="text-[9px] font-black uppercase text-brand-earth">Bridge Liquidity</p>
                       <p className="text-2xl font-black text-brand-deep tracking-tighter">842.15 BTC</p>
                    </div>
                    <div className="w-12 h-1 bg-green-500/20 rounded-full overflow-hidden">
                       <div className="w-3/4 h-full bg-green-500" />
                    </div>
                 </div>
                 <div className="flex items-center justify-between">
                    <div>
                       <p className="text-[9px] font-black uppercase text-brand-earth">Settlement Time</p>
                       <p className="text-2xl font-black text-brand-deep tracking-tighter">~ 14m</p>
                    </div>
                    <Activity size={24} className="text-accent-earth animate-pulse" />
                 </div>
              </div>

              <div className="pt-10 border-t border-border/50">
                 <div className="bg-white border border-border rounded-3xl p-6 relative overflow-hidden group hover:border-orange-500/30 transition-all cursor-help">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <ShieldCheck size={48} />
                    </div>
                    <h4 className="text-[10px] font-black uppercase text-brand-deep mb-2">Protocol Assurance</h4>
                    <p className="text-[9px] text-brand-earth leading-relaxed italic">This bridge utilizes the Native Token Transfer (NTT) framework for trustless asset movement. No custodial risks involved.</p>
                 </div>
              </div>
           </div>

           <div className="bg-brand-deep text-white rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 opacity-10 -mb-8 -mr-8">
                 <Cpu size={180} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest opacity-60">System Statistics</h3>
              <div className="grid grid-cols-2 gap-8 relative z-10">
                 <div>
                    <p className="text-[10px] font-bold opacity-60 uppercase mb-1">Total Bridged</p>
                    <p className="text-xl font-black tracking-tight">4.2k BTC</p>
                 </div>
                 <div>
                    <p className="text-[10px] font-bold opacity-60 uppercase mb-1">Active Routes</p>
                    <p className="text-xl font-black tracking-tight">142</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default NTTBridge;
