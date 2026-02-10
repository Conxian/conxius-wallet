
import React, { useState, useContext, useEffect } from 'react';
import { ArrowRight, Info, AlertCircle, CheckCircle2, Loader2, Link, TrendingUp, ShieldCheck, Zap, Globe, Search, RefreshCw, ExternalLink } from 'lucide-react';
import { AppContext } from '../context';
import { estimateFees, FeeEstimation } from '../services/FeeEstimator';
import { NttService, BRIDGE_STAGES } from '../services/ntt';

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

  // New state for the "in-progress" view
  const [isBridgeInProgress, setIsBridgeInProgress] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  // Fee Estimation Effect
  useEffect(() => {
    if (step === 2) {
      setIsEstimatingFees(true);
      estimateFees(sourceLayer, targetLayer, autoSwap)
        .then(setFeeEstimation)
        .finally(() => setIsEstimatingFees(false));
    }
  }, [step, sourceLayer, targetLayer, autoSwap]);

  // Real-time bridge progress tracking
  useEffect(() => {
    if (isBridgeInProgress && txHash) {
      const pollProgress = async () => {
        const stage = await NttService.trackProgress(txHash);
        setCurrentStage(stage);
      };

      const interval = setInterval(pollProgress, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isBridgeInProgress, txHash]);

  const handleBridge = async () => {
    if (!context) return;
    setIsBridging(true);

    try {
        // Map UI Source Layer to Wormhole Chain
        let chainName = sourceLayer;
        if (sourceLayer === 'Mainnet') chainName = 'Bitcoin';
        
        const signer = context.getWormholeSigner(chainName);

        const hash = await NttService.executeBridge(
          amount,
          sourceLayer,
          targetLayer,
          autoSwap,
          signer,
          context.state.network,
          feeEstimation?.gasAbstractionSwapFee
        );

        if (!hash) {
          context.notify('error', 'Bridge execution failed (Gas Swap or Enclave error).');
          setIsBridging(false);
          return;
        }

        setTxHash(hash);

        // Simulate API call and then start the progress view
        setTimeout(() => {
          setIsBridging(false);
          setIsBridgeInProgress(true); // Start the new in-progress view
          setStep(4); // Move to a new step that shows the progress
          context.notify('info', 'Bridge process initiated. You can track the progress here.');
        }, 1500);
    } catch (e: any) {
        context.notify('error', e.message || 'Bridge Failed');
        setIsBridging(false);
    }
  };

  const handleTrack = async () => {
    if (!txHash) {
        context?.notify('warning', 'Please enter a Transaction Hash');
        return;
    }
    setIsTracking(true);
    try {
        const data = await NttService.getTrackingDetails(txHash);
        if (data) {
            setTrackingData(data);
            context?.notify('success', 'Wormhole Attestation Found');
        } else {
            setTrackingData(null);
            context?.notify('info', 'No attestation found for this tx hash yet.');
        }
    } catch (e) {
        context?.notify('error', 'Wormhole API Unreachable. Retrying via Tor...');
    } finally {
        setIsTracking(false);
    }
  };

  const resetBridge = () => {
    setStep(1);
    setAmount('');
    setTxHash('');
    setIsBridgeInProgress(false);
    setCurrentStage(0);
    setFeeEstimation(null);
  };

  // New render function for the "in-progress" view
  const renderBridgeProgress = () => {
    const isComplete = currentStage === BRIDGE_STAGES.length - 1;
    return (
      <div className="space-y-8 animate-in zoom-in">
        <div className="text-center space-y-4">
          <div className={`w-20 h-20 ${isComplete ? 'bg-green-600/10 border-green-500/20 text-green-500' : 'bg-orange-600/10 border-orange-500/20 text-orange-500'} border rounded-full flex items-center justify-center mx-auto`}>
            {isComplete ? <CheckCircle2 size={40} /> : <Loader2 size={40} className="animate-spin" />}
          </div>
          <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
            {isComplete ? 'Transfer Complete' : 'Transfer in Progress'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto italic leading-relaxed">Estimated Time Remaining: {isComplete ? 'Done' : `${(BRIDGE_STAGES.length - 1 - currentStage) * 5} seconds`}</p>
        </div>

        <div className="space-y-6">
          {BRIDGE_STAGES.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${index <= currentStage ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                {index < currentStage ? <CheckCircle2 size={16} /> : <Loader2 size={16} className={index === currentStage && !isComplete ? 'animate-spin' : ''} />}
              </div>
              <div>
                <p className={`font-bold ${index <= currentStage ? 'text-white' : 'text-zinc-500'}`}>{stage.text}</p>
                <p className="text-xs text-zinc-500 italic">{stage.userMessage}</p>
              </div>
            </div>
          ))}
        </div>

        {isComplete && (
            <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-[2rem] space-y-4 text-center">
                <p className="text-xs text-zinc-400">Your transfer of {amount} BTC from {sourceLayer} to {targetLayer} is complete.</p>
                <a href="#" className="text-orange-500 hover:text-orange-400 text-xs font-bold inline-flex items-center gap-2">
                    View on Explorer <ExternalLink size={14} />
                </a>
            </div>
        )}

        <button type="button" onClick={resetBridge} className="w-full py-4 text-zinc-600 hover:text-zinc-400 text-[10px] font-black uppercase tracking-widest transition-all">
          New Transfer
        </button>
      </div>
    );
  };


  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="text-center">
        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Interlayer Bridge</h2>
        <p className="text-zinc-500 text-sm">Cross-chain execution and native sovereign pegs.</p>
      </div>

      <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-900 mx-auto max-w-xs">
         <button onClick={() => setBridgeType('NTT')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bridgeType === 'NTT' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-600'}`}>Wormhole NTT</button>
         <button onClick={() => setBridgeType('Native Peg')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${bridgeType === 'Native Peg' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-600'}`}>Native Peg</button>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl relative overflow-hidden">
        
        {step === 1 && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600">Source</label>
                <select value={sourceLayer} onChange={e => setSourceLayer(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none" aria-label="Source Layer" title="Source Layer">
                  <option>Mainnet</option>
                  <option>Stacks</option>
                  <option>Rootstock</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-600">Destination</label>
                <select value={targetLayer} onChange={e => setTargetLayer(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-zinc-200 focus:outline-none" aria-label="Target Layer" title="Target Layer">
                  <option>Stacks</option>
                  <option>Mainnet</option>
                  <option>Liquid</option>
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
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">NTT Execution</h3>
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
                    <span className="text-zinc-200">{targetLayer === 'Stacks' ? 'sBTC (Nakamoto)' : 'LBTC (Elements)'}</span>
                </div>
             </div>

             <button type="button" onClick={() => context?.notify('info', 'Secure Enclave: Peg-in PSBT Generated.')} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest">Execute Native Peg</button>
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
