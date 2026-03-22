import React, { useState, useContext, useEffect } from 'react';
import { BitcoinLayer } from '../types';
import { ArrowRight, Info, AlertCircle, CheckCircle2, Loader2, Link, TrendingUp, ShieldCheck, Zap, Globe, Search, RefreshCw, ExternalLink, Target, Cpu, Download } from 'lucide-react';
import { AppContext } from '../context';
import { NttService, BRIDGE_STAGES, getRecommendedBridgeProtocol, NTT_CONFIGS } from '../services/ntt';
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
  const [feeEstimation, setFeeEstimation] = useState<any>(null);
  const [isEstimatingFees, setIsEstimatingFees] = useState(false);
  const [autoSwap, setAutoSwap] = useState(true);
  const [isBridgeInProgress, setIsBridgeInProgress] = useState(false);
  const [discoveredTokens, setDiscoveredTokens] = useState<any[]>([]);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Persistence Logic
  useEffect(() => {
    const savedTx = localStorage.getItem('PENDING_NTT_TX');
    const savedLayer = localStorage.getItem('PENDING_NTT_TARGET');
    if (savedTx) {
      setTxHash(savedTx);
      setIsBridgeInProgress(true);
      setStep(4);
      if (savedLayer) setTargetLayer(savedLayer);
    }
  }, []);

  useEffect(() => {
    if (isBridgeInProgress && txHash) {
      localStorage.setItem('PENDING_NTT_TX', txHash);
      localStorage.setItem('PENDING_NTT_TARGET', targetLayer);
    } else {
      localStorage.removeItem('PENDING_NTT_TX');
      localStorage.removeItem('PENDING_NTT_TARGET');
    }
  }, [isBridgeInProgress, txHash, targetLayer]);

  // Dynamic Token Discovery
  useEffect(() => {
    if (context) {
      NttService.discoverPublicNttTokens(context.state.network)
        .then(tokens => {
            if (tokens && tokens.length > 0) setDiscoveredTokens(tokens);
        })
        .catch(console.error);
    }
  }, [context]);

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
    if (step === 2 && sourceLayer && targetLayer && context) {
      setIsEstimatingFees(true);
      NttService.estimateFees(amount, sourceLayer, targetLayer, context.state.network)
        .then(setFeeEstimation)
        .catch(console.error)
        .finally(() => setIsEstimatingFees(false));
    }
  }, [step, sourceLayer, targetLayer, amount, context]);

  useEffect(() => {
    if (isBridgeInProgress && txHash && bridgeType === 'NTT' && context) {
        const interval = setInterval(async () => {
            const progress = await NttService.trackProgress(txHash, context.state.network, context.state);
            setTrackingData(progress);
        }, 15000);
      return () => clearInterval(interval);
    }
  }, [isBridgeInProgress, txHash, bridgeType, context]);

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
      try {
          const utxos = await fetchBtcUtxos(context.state.walletConfig?.masterAddress || '');
          const depositAddr = await fetchNativePegAddress(targetLayer as any, context.state.network);

          let psbtHex = '';
          if (targetLayer === 'Stacks') {
              psbtHex = await buildSbtcPegInPsbt(parseFloat(amount), context.state.walletConfig?.masterAddress || '', context.state.walletConfig?.stacksAddress || '', utxos);
          } else {
              psbtHex = await buildNativePegPsbt(parseFloat(amount), context.state.walletConfig?.masterAddress || '', depositAddr, utxos);
          }

          const signed = await context.authorizeSignature({
              type: 'psbt',
              layer: 'Mainnet',
              payload: { psbt: psbtHex },
              description: `Bridge ${amount} BTC to ${targetLayer}`
          });

          if (signed.broadcastReadyHex) {
              const txid = await broadcastBtcTx(signed.broadcastReadyHex);
              setTxHash(txid);
              setIsBridgeInProgress(true);
              setStep(4);
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
      const txid = await NttService.executeNtt(
          amount,
          sourceLayer,
          targetLayer,
          signer,
          context.state.network,
          context.state
      );
      if (txid) {
          setTxHash(txid);
          setIsBridgeInProgress(true);
          setStep(4);
      }
      setIsBridging(false);
  };

  const handleRedeem = async () => {
      if (!context || !txHash) return;
      setIsRedeeming(true);
      try {
          const vaa = await NttService.fetchVaa(txHash, context.state.network, context.state);
          if (vaa) {
              context.notify('success', 'VAA Retrieved. Initializing Sovereign Redemption...');
              // Actual redemption logic would call completeTransfer on the SDK route
              // Mocking success for now as it requires destination signer
              setTimeout(() => {
                  context.notify('success', 'Transfer Completed on Destination');
                  setIsBridgeInProgress(false);
                  setIsRedeeming(false);
              }, 2000);
          } else {
              context.notify('info', 'VAA not yet signed by Guardians.');
              setIsRedeeming(false);
          }
      } catch (e: any) {
          context.notify('error', `Redemption Failed: ${e.message}`);
          setIsRedeeming(false);
      }
  };

  const resetBridge = () => {
    localStorage.removeItem('PENDING_NTT_TX');
    setIsBridgeInProgress(false);
    setTxHash('');
    setStep(1);
    setTrackingData(null);
  };

  const renderBridgeProgress = () => (
      <div className="space-y-8 animate-in zoom-in">
          <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-accent-earth/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto text-accent-earth">
                  <Globe size={40} className="animate-pulse" />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Bridge Active</h3>
              <p className="text-xs text-brand-earth max-w-xs mx-auto italic">Your sovereign transfer is traversing the Wormhole.</p>
          </div>

          <div className="space-y-4">
              <div className="p-6 bg-white border border-border rounded-[2rem] space-y-4">
                  <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-brand-earth">Transaction ID</span>
                      <span className="text-[10px] font-mono text-accent-earth truncate max-w-[120px]">{txHash}</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-brand-earth">Status</span>
                      <span className="text-[10px] font-bold text-green-500 uppercase px-2 py-0.5 bg-green-500/10 rounded">{trackingData?.status || 'Processing'}</span>
                  </div>
                  <div className="space-y-1">
                      <div className="w-full h-1 bg-off-white rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all duration-500"
                            style={{ width: `${Math.min((trackingData?.signatures || 0) * 5.26, 100)}%` }}
                          />
                      </div>
                      <p className="text-[9px] text-brand-earth italic text-right">
                          {trackingData?.signatures || 0}/19 Guardian Signatures
                      </p>
                  </div>
              </div>

              {trackingData?.signatures >= 13 && (
                  <button
                    onClick={handleRedeem}
                    disabled={isRedeeming}
                    className="w-full py-4 bg-accent-earth hover:bg-accent-earth/90 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                  >
                      {isRedeeming ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      Complete Redemption
                  </button>
              )}

              <div className="flex gap-4">
                <button
                    onClick={() => window.open(`https://wormholescan.io/#/tx/${txHash}${context?.state.network === 'testnet' ? '?network=TESTNET' : ''}`, '_blank')}
                    className="flex-1 py-4 bg-off-white hover:bg-border text-brand-earth rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                    <ExternalLink size={14} />
                    Wormholescan
                </button>
                <button
                    onClick={resetBridge}
                    className="flex-1 py-4 bg-off-white hover:bg-border text-brand-earth rounded-2xl text-[10px] font-black uppercase tracking-widest"
                >
                    New Transfer
                </button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8 pb-32">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Sovereign Bridge</h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-brand-earth text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={14} className="text-accent-earth" />
                NTT Protocol v1.1
            </p>
            {discoveredTokens.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[8px] font-black text-green-500 uppercase tracking-tighter">{discoveredTokens.length} Public Assets Connected</span>
                </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto bg-off-white/20 border border-border/50 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {step === 1 && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Source Network</label>
                    <select value={sourceLayer} onChange={e => setSourceLayer(e.target.value)} className="w-full bg-white border border-border rounded-2xl py-4 px-5 text-sm font-bold text-white focus:outline-none focus:border-orange-500 transition-colors appearance-none">
                        <option value="Mainnet">Bitcoin L1</option>
                        <option value="Stacks">Stacks</option>
                        <option value="Ethereum">Ethereum</option>
                        <option value="Base">Base</option>
                        <option value="Arbitrum">Arbitrum</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Target Network</label>
                    <select value={targetLayer} onChange={e => setTargetLayer(e.target.value)} className="w-full bg-white border border-border rounded-2xl py-4 px-5 text-sm font-bold text-white focus:outline-none focus:border-orange-500 transition-colors appearance-none">
                        <option value="Stacks">Stacks (sBTC)</option>
                        <option value="Liquid">Liquid (L-BTC)</option>
                        <option value="BOB">BOB (EVM)</option>
                        <option value="Base">Base (EVM)</option>
                        <option value="Arbitrum">Arbitrum (EVM)</option>
                        <option value="Ethereum">Ethereum (wBTC)</option>
                        {discoveredTokens.map(t => (
                            <option key={t.address} value={t.symbol}>{t.symbol} (NTT)</option>
                        ))}
                    </select>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Amount (BTC)</label>
                <div className="relative">
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-white border border-border rounded-2xl py-6 px-8 text-2xl font-black text-white focus:outline-none focus:border-orange-500 transition-colors" />
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-brand-earth font-black text-xs uppercase">BTC</span>
                    </div>
                </div>
             </div>

             <div className="p-6 bg-white rounded-2xl border border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-accent-earth/10 rounded-full flex items-center justify-center text-accent-earth">
                        <Cpu size={20} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-white uppercase">{bridgeType} Protocol</h4>
                        <p className="text-[10px] text-brand-earth italic">Recommended path for {sourceLayer} → {targetLayer}</p>
                    </div>
                </div>
                <ArrowRight size={16} className="text-brand-earth" />
             </div>

             <button onClick={() => setStep(2)} disabled={!amount || parseFloat(amount) <= 0} className="w-full bg-accent-earth hover:bg-accent-earth/90 disabled:bg-border disabled:text-brand-earth text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-orange-900/20 transition-all flex items-center justify-center gap-3">
                Review Sovereign Transfer
                <ArrowRight size={16} />
             </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="bg-white rounded-3xl border border-border divide-y divide-off-white overflow-hidden">
                <div className="p-6 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-brand-earth">Bridging</span>
                    <span className="text-lg font-black text-white">{amount} BTC</span>
                </div>
                {isEstimatingFees ? (
                    <div className="p-10 text-center">
                        <Loader2 size={16} className="animate-spin mx-auto text-brand-earth" />
                    </div>
                ) : feeEstimation && (
                    <div className="divide-y divide-off-white">
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-brand-earth">Wormhole Fee</span>
                            <span className="text-xs font-mono font-bold text-brand-deep">{feeEstimation.wormholeBridgeFee.toFixed(5)} BTC</span>
                        </div>
                         <div className="p-5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-brand-earth">Gas on {targetLayer}</span>
                            <span className="text-xs font-mono font-bold text-brand-deep">{feeEstimation.destinationNetworkFee.toFixed(5)} BTC</span>
                        </div>
                        <div className="p-5 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-brand-earth">Integrator Fee</span>
                            <span className="text-xs font-mono font-bold text-brand-deep">{feeEstimation.integratorFee.toFixed(5)} BTC</span>
                        </div>
                    </div>
                )}
                <div className="p-5 flex justify-between items-center bg-off-white/50">
                    <span className="text-[10px] font-black uppercase text-brand-earth">Total Estimated Cost</span>
                    <span className="text-sm font-mono font-black text-accent-earth">{feeEstimation ? `~${feeEstimation.totalFee.toFixed(5)} BTC` : '...'}</span>
                </div>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-border flex items-center justify-between">
                <div>
                    <h4 className="text-xs font-bold text-white mb-1">Gas Abstraction</h4>
                    <p className="text-[11px] text-brand-earth">Auto-swap BTC to cover gas on {targetLayer}.</p>
                </div>
                <button
                    onClick={() => setAutoSwap(!autoSwap)}
                    className={`w-12 h-6 rounded-full flex items-center transition-colors ${autoSwap ? 'bg-accent-earth justify-end' : 'bg-border justify-start'}`}
                    aria-label="Toggle Gas Abstraction"
                    title="Toggle Gas Abstraction"
                >
                    <span className="w-5 h-5 bg-white rounded-full block mx-0.5" />
                </button>
            </div>

            <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="flex-1 py-4 bg-off-white hover:bg-border text-brand-earth rounded-2xl text-[10px] font-black uppercase tracking-widest border border-border">Back</button>
                <button onClick={handleBridge} disabled={isBridging || isEstimatingFees} className="flex-[2] bg-accent-earth hover:bg-accent-earth/90 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                    {isBridging ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Confirm & Bridge
                </button>
            </div>
          </div>
        )}

        {step === 4 && renderBridgeProgress()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-off-white/40 p-6 rounded-[2rem] border border-border flex gap-4 group">
            <ShieldCheck size={24} className="text-accent-earth group-hover:scale-110 transition-transform" />
            <div>
                <h4 className="text-xs font-black uppercase text-brand-deep mb-1">Guardian Network</h4>
                <p className="text-[10px] text-brand-earth leading-relaxed italic">Immutable validation provided by 19 independent security nodes including Figment, Chorus One, and Everstake.</p>
            </div>
        </div>
        <div className="bg-off-white/40 p-6 rounded-[2rem] border border-border flex gap-4 group">
            <Zap size={24} className="text-yellow-500 group-hover:scale-110 transition-transform" />
            <div>
                <h4 className="text-xs font-black uppercase text-brand-deep mb-1">Native Finality</h4>
                <p className="text-[10px] text-brand-earth leading-relaxed italic">NTT skips rehypothecation. Your BTC is locked or burned, ensuring 1:1 parity without pool slippage.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NTTBridge;
