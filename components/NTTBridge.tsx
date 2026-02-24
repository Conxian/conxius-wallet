import React, { useState, useContext, useEffect } from 'react';
import { BitcoinLayer } from '../types';
import { ArrowRight, Info, AlertCircle, CheckCircle2, Loader2, Link, TrendingUp, ShieldCheck, Zap, Globe, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { AppContext } from '../context';
import { estimateFees, FeeEstimation } from '../services/FeeEstimator';
import { NttService, BRIDGE_STAGES, getRecommendedBridgeProtocol } from '../services/ntt';
import { fetchBtcUtxos, broadcastBtcTx, fetchSbtcWalletAddress, monitorSbtcPegIn, fetchNativePegAddress } from '../services/protocol';
import { buildSbtcPegInPsbt, buildNativePegPsbt } from '../services/psbt';

const NTTBridge: React.FC = () => {
  const context = useContext(AppContext);
  const [bridgeType, setBridgeType] = useState<'NTT' | 'Native Peg'>('NTT');
  const [step, setStep] = useState(1);
  const [sourceLayer, setSourceLayer] = useState('Mainnet');
  const [targetLayer, setTargetLayer] = useState('Stacks');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [isBridging, setIsBridging] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [feeEstimation, setFeeEstimation] = useState<FeeEstimation | null>(null);
  const [isEstimatingFees, setIsEstimatingFees] = useState(false);
  const [autoSwap, setAutoSwap] = useState(true);
  const [isBridgeInProgress, setIsBridgeInProgress] = useState(false);

  useEffect(() => {
    if (!context) return;
    if (sourceLayer && targetLayer) {
        const recommended = getRecommendedBridgeProtocol(sourceLayer, targetLayer);
        if (recommended === 'Native') {
            setBridgeType('Native Peg');
        } else {
            setBridgeType('NTT');
        }
    }
  }, [sourceLayer, targetLayer, context]);

  useEffect(() => {
    if (step === 2 && sourceLayer && targetLayer) {
      setIsEstimatingFees(true);
      estimateFees(sourceLayer, targetLayer, autoSwap)
        .then(setFeeEstimation)
        .catch(console.error)
        .finally(() => setIsEstimatingFees(false));
    }
  }, [step, sourceLayer, targetLayer, autoSwap]);

  useEffect(() => {
    if (isBridgeInProgress && txHash && bridgeType === 'NTT') {
        const interval = setInterval(async () => {
            const progress = await NttService.trackProgress(txHash);
            if (progress === 2) {
                setIsBridgeInProgress(false);
                setStep(4);
            }
        }, 10000);
      return () => clearInterval(interval);
    }
  }, [isBridgeInProgress, txHash, bridgeType]);

  const handleBridge = async () => {
    if (!context) return;
    setIsBridging(true);

    try {
        if (bridgeType === 'Native Peg') {
            await handleNativePeg();
        } else {
            await handleWormholeBridge();
        }
    } catch (e: any) {
        context.notify('error', e.message || 'Bridge Failed');
        setIsBridging(false);
    }
  };

  const handleNativePeg = async () => {
      if (!context) return;
      const amountSats = Math.floor(parseFloat(amount) * 100000000);
      const utxos = await fetchBtcUtxos(context.state.walletConfig?.masterAddress || '', context.state.network);
      
      try {
          const pegInAddress = await fetchNativePegAddress(targetLayer as BitcoinLayer, context.state.network);

          let opReturnData: string | undefined;
          if (targetLayer === 'Stacks') {
              opReturnData = context.state.walletConfig?.stacksAddress;
          } else if (targetLayer === 'BOB') {
              opReturnData = context.state.walletConfig?.masterAddress;
          }

          // 1. Build PSBT
          const psbtBase64 = buildNativePegPsbt({
              utxos,
              amountSats,
              changeAddress: context.state.walletConfig?.masterAddress || '',
              feeRate: 20,
              network: context.state.network,
              pegInAddress,
              opReturnData
          });

          // 2. Request Signature
          const signResult = await context.authorizeSignature({
              type: 'transaction',
              layer: 'Mainnet',
              payload: { psbt: psbtBase64, network: context.state.network },
              description: `Native Peg-in to ${targetLayer}`
          });

          if (signResult && signResult.broadcastReadyHex) {
              const txid = await broadcastBtcTx(signResult.broadcastReadyHex, context.state.network);
              setTxHash(txid);
              setIsBridgeInProgress(true);
              setStep(4);
              context.notify('success', `Native Peg Broadcasted: ${txid.substring(0, 8)}...`);
          }
      } catch (e: any) {
          context.notify('error', `Native Peg Failed: ${e.message}`);
      } finally {
          setIsBridging(false);
      }
  };

  const handleWormholeBridge = async () => {
      if (!context) return;
      const signer = context.getWormholeSigner(sourceLayer);
      const txid = await NttService.executeBridge(
          amount,
          sourceLayer,
          targetLayer,
          autoSwap,
          signer,
          context.state.network,
          feeEstimation?.destinationNetworkFee
      );
      if (txid) {
          setTxHash(txid);
          setIsBridgeInProgress(true);
          setStep(4);
      }
      setIsBridging(false);
  };

  const handleTrack = async () => {
     if (!txHash) return;
     setIsTracking(true);
     try {
        const data = await NttService.getTrackingDetails([txHash]);
        if (data && data[0]) setTrackingData(data[0]);
     } finally {
        setIsTracking(false);
     }
  };

  const resetBridge = () => {
    setStep(1);
    setAmount('');
    setTxHash('');
    setTrackingData(null);
    setIsBridgeInProgress(false);
    setIsBridging(false);
  };

  const renderBridgeProgress = () => (
    <div className="space-y-12 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-orange-600/10 border-2 border-orange-500/20 rounded-full flex items-center justify-center mx-auto relative">
                <div className="absolute inset-0 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                <TrendingUp size={48} className="text-orange-500" />
            </div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">Transfer in Transit</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto italic">Your assets are being etched across layers. Stay sovereign.</p>
        </div>

        <div className="space-y-6">
            {BRIDGE_STAGES.map((s, i) => (
                <div key={s.id} className="relative flex gap-6 group">
                    <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${step === 4 ? 'bg-green-500 border-green-400' : 'bg-zinc-900 border-zinc-800 group-hover:border-orange-500/50'}`}>
                            {step === 4 ? <CheckCircle2 size={20} className="text-white" /> : <span className="text-[10px] font-bold text-zinc-500">{i + 1}</span>}
                        </div>
                        {i < BRIDGE_STAGES.length - 1 && <div className="w-0.5 h-12 bg-zinc-800 my-1" />}
                    </div>
                    <div className="pt-1 flex-1">
                        <h4 className={`text-xs font-black uppercase tracking-widest ${step === 4 ? 'text-green-500' : 'text-zinc-300'}`}>{s.text}</h4>
                        <p className="text-[11px] text-zinc-500 italic leading-relaxed mt-1">{s.userMessage}</p>
                    </div>
                </div>
            ))}
        </div>

        <div className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 space-y-4 shadow-inner">
            <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-600">
                <span>Transaction Hash</span>
                <button onClick={() => window.open(`https://mempool.space/tx/${txHash}`, '_blank')} className="text-orange-500 flex items-center gap-1 hover:text-orange-400 transition-colors">
                    View <ExternalLink size={10} />
                </button>
            </div>
            <p className="font-mono text-[10px] text-zinc-300 break-all bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">{txHash}</p>
            <p className="text-center text-[10px] text-zinc-500 italic mt-2">Closing this view will not interrupt your transfer.</p>
        </div>

        <button onClick={resetBridge} className="w-full py-4 text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase tracking-widest transition-all">Dismiss & Return Home</button>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-600/10 border border-orange-500/20 rounded-full">
                <Globe size={14} className="text-orange-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Cross-Layer Settlement</span>
            </div>
            <h2 className="text-6xl font-black italic uppercase tracking-tighter text-white leading-[0.9]">
                Sovereign<br />
                <span className="text-orange-500">Transceiver</span>
            </h2>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setBridgeType('NTT')} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${bridgeType === 'NTT' ? 'bg-white text-black shadow-xl scale-105' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}>Standard NTT</button>
            <button onClick={() => setBridgeType('Native Peg')} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${bridgeType === 'Native Peg' ? 'bg-orange-600 text-white shadow-xl scale-105' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}>Native Peg-in</button>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
        
        {step === 1 && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600">Source</label>
                <select value={sourceLayer} onChange={e => setSourceLayer(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none" aria-label="Source Layer" title="Source Layer">
                  <option>Mainnet</option>
                  <option>Liquid</option>
                  <option>Stacks</option>
                  <option>Rootstock</option>
                  <option>BOB</option>
                  <option>B2</option>
                  <option>Botanix</option>
                  <option>Mezo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600">Destination</label>
                <select value={targetLayer} onChange={e => setTargetLayer(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none" aria-label="Target Layer" title="Target Layer">
                  <option>Stacks</option>
                  <option>Liquid</option>
                  <option>Rootstock</option>
                  <option>BOB</option>
                  <option>B2</option>
                  <option>Botanix</option>
                  <option>Mezo</option>
                  <option>Ethereum</option>
                  <option>Solana</option>
                  <option>Arbitrum</option>
                  <option>Base</option>
                </select>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Amount to Transfer</span>
                </div>
                <div className="flex items-center gap-4">
                    <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="bg-transparent text-4xl font-black text-white focus:outline-none w-full font-mono tracking-tighter" />
                    <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 flex items-center gap-2">
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-black text-white">₿</div>
                        <span className="font-bold text-zinc-300">BTC</span>
                    </div>
                </div>
            </div>

            <button type="button" onClick={() => setStep(2)} disabled={!amount} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-3xl text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Review Protocol Wrap</h3>
            <div className="bg-zinc-950 rounded-[2rem] divide-y divide-zinc-900 border border-zinc-900 overflow-hidden">
                <div className="p-5 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-600">Asset</span>
                    <span className="text-xs font-mono font-bold text-zinc-100">{amount} BTC</span>
                </div>
                <div className="p-5 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-600">Route</span>
                    <span className="text-xs font-mono font-bold text-zinc-100">{sourceLayer} → {targetLayer}</span>
                </div>
                {isEstimatingFees ? (
                    <div className="p-5 text-center">
                        <Loader2 size={16} className="animate-spin mx-auto text-zinc-500" />
                    </div>
                ) : feeEstimation && (
                    <>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-zinc-600">Wormhole Fee</span>
                            <span className="text-xs font-mono font-bold text-zinc-100">{feeEstimation.wormholeBridgeFee.toFixed(5)} BTC</span>
                        </div>
                         <div className="p-5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-zinc-600">Gas on {targetLayer}</span>
                            <span className="text-xs font-mono font-bold text-zinc-100">{feeEstimation.destinationNetworkFee.toFixed(5)} BTC</span>
                        </div>
                    </>
                )}
                <div className="p-5 flex justify-between items-center bg-zinc-900/50">
                    <span className="text-[10px] font-black uppercase text-zinc-600">Total Estimated Cost</span>
                    <span className="text-sm font-mono font-black text-orange-500">{feeEstimation ? `~${feeEstimation.totalFee.toFixed(5)} BTC` : '...'}</span>
                </div>
            </div>

            <div className="p-6 bg-zinc-950 rounded-2xl border border-zinc-900 flex items-center justify-between">
                <div>
                    <h4 className="text-xs font-bold text-white mb-1">Gas Abstraction</h4>
                    <p className="text-[11px] text-zinc-500">Auto-swap BTC to cover gas on {targetLayer}.</p>
                </div>
                <button
                    onClick={() => setAutoSwap(!autoSwap)}
                    className={`w-12 h-6 rounded-full flex items-center transition-colors ${autoSwap ? 'bg-orange-600 justify-end' : 'bg-zinc-800 justify-start'}`}
                    aria-label="Toggle Gas Abstraction"
                    title="Toggle Gas Abstraction"
                >
                    <span className="w-5 h-5 bg-white rounded-full block mx-0.5" />
                </button>
            </div>

            <div className="flex gap-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-zinc-800">Back</button>
                <button type="button" onClick={handleBridge} disabled={isBridging || isEstimatingFees} className="flex-[2] bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                    {isBridging ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Confirm & Bridge
                </button>
            </div>
          </div>
        )}

        {step === 4 && renderBridgeProgress()}


        {step === 3 && bridgeType === 'NTT' && (
          <div className="space-y-8 animate-in zoom-in">
             <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-orange-600/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto text-orange-500">
                    <Globe size={40} className="animate-pulse" />
                </div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Bridge Execution</h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto italic leading-relaxed">Paste a bridge transaction hash to monitor Wormhole guardian attestations.</p>
             </div>

             <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-600 ml-1">Live Transaction Hash</label>
                    <div className="relative">
                        <input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="0x... or bc1q..." className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-5 pr-12 font-mono text-xs text-zinc-200 focus:outline-none" />
                        <button type="button" onClick={handleTrack} className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-400" aria-label="Track" title="Track">
                            {isTracking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        </button>
                    </div>
                </div>

                {trackingData && (
                    <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-zinc-600">Guardian Status</span>
                            <span className="text-[10px] font-bold text-green-500 uppercase px-2 py-0.5 bg-green-500/10 rounded">{trackingData.status || 'In Progress'}</span>
                        </div>
                        <div className="space-y-1">
                            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                                <div className="w-1/3 h-full bg-orange-500" />
                            </div>
                            <p className="text-[9px] text-zinc-600 italic">Confirmed by {trackingData.signatures ?? 'n/a'}/19 Guardians</p>
                        </div>
                    </div>
                )}

                <button type="button" onClick={resetBridge} className="w-full py-4 text-zinc-600 hover:text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all">New Transfer</button>
             </div>
          </div>
        )}

        {step === 3 && bridgeType === 'Native Peg' && (
           <div className="space-y-8 animate-in slide-in-from-bottom-4">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-green-600/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-500">
                    <ShieldCheck size={40} />
                </div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Native Peg Construction</h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto italic leading-relaxed">Your peg-in transaction is being prepared in the Secure Enclave.</p>
             </div>

             <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-600">
                    <span>Target Network</span>
                    <span className="text-zinc-200">{targetLayer}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-600">
                    <span>Protocol</span>
                    <span className="text-zinc-200">{targetLayer === 'Stacks' ? 'sBTC (Nakamoto)' : targetLayer === 'Liquid' ? 'LBTC (Elements)' : targetLayer === 'Rootstock' ? 'PowPeg' : targetLayer === 'BOB' ? 'BOB Gateway' : targetLayer === 'B2' ? 'B2 Bridge' : targetLayer === 'Botanix' ? 'Spiderchain' : targetLayer === 'Mezo' ? 'tBTC Bridge' : 'Native Peg'}</span>
                </div>
             </div>

             <button type="button" onClick={handleNativePeg} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest">Execute Native Peg</button>
             <button type="button" onClick={() => setStep(1)} className="w-full py-2 text-zinc-600 text-[10px] font-black uppercase tracking-widest">Cancel</button>
           </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-zinc-800 flex gap-4 group">
            <ShieldCheck size={24} className="text-orange-500 group-hover:scale-110 transition-transform" />
            <div>
                <h4 className="text-xs font-black uppercase text-zinc-200 mb-1">Guardian Network</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed italic">Immutable validation provided by 19 independent security nodes including Figment, Chorus One, and Everstake.</p>
            </div>
        </div>
        <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-zinc-800 flex gap-4 group">
            <Zap size={24} className="text-yellow-500 group-hover:scale-110 transition-transform" />
            <div>
                <h4 className="text-xs font-black uppercase text-zinc-200 mb-1">Native Finality</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed italic">NTT skips rehypothecation. Your BTC is locked or burned, ensuring 1:1 parity without pool slippage.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NTTBridge;
