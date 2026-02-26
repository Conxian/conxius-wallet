
import React, { useState, useEffect, useContext, useRef } from 'react';
import { Send, CreditCard, Zap, Globe, Smartphone, QrCode, ArrowRight, ShieldCheck, Loader2, CheckCircle2, Search, User, TrendingDown, Info, Sparkles, ShieldAlert, X, DollarSign } from 'lucide-react';
import { AppContext } from '../context';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { isLnurl, decodeLnurl, fetchLnurlParams, decodeBolt11 } from '../services/lightning';
import { getLightningBackend } from '../services/lightning-backend';
import { fetchBtcUtxos, broadcastBtcTx } from '../services/protocol';
import { getRecommendedFees } from '../services/fees';
import { buildPsbt } from '../services/psbt';
import { parseBip21 } from '../services/bip21';
import { Network } from '../types';
import { estimateFees, FeeEstimation } from "../services/FeeEstimator";
import { sanitizeError } from '../services/network';

const PaymentPortal: React.FC = () => {
  const context = useContext(AppContext);
  const [method, setMethod] = useState<'lightning' | 'onchain' | 'onramp'>('lightning');
  const [recipient, setRecipient] = useState('');
  const [feeEstimation, setFeeEstimation] = useState<FeeEstimation | null>(null);
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSmartRouting, setIsSmartRouting] = useState(true);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lnDetail, setLnDetail] = useState<any | null>(null);
  const [generatedInvoice, setGeneratedInvoice] = useState<string | null>(null);
  const [onchainTxid, setOnchainTxid] = useState<string | null>(null);
  const [onchainError, setOnchainError] = useState<string | null>(null);
  const [breezBalance, setBreezBalance] = useState<number | null>(null);

  useEffect(() => {
     // Poll for cached balance if Breez is active
     if (context?.state.lnBackend?.type === 'Breez' || context?.state.lnBackend?.type === 'Greenlight') {
         const check = async () => {
             try {
                const { getBreezInfo } = await import('../services/breez');
                const info = await getBreezInfo();
                setBreezBalance(info.maxPayableMsat / 1000); // sats
             } catch {}
         };
         check();
     }
  }, [context?.state.lnBackend]);

  useEffect(() => {
    const updateFees = async () => {
      if (amount && (method === "onchain" || recipient.includes(".btc"))) {
        const est = await estimateFees(context?.state.network || "mainnet", "mainnet", amount);
        setFeeEstimation(est);
      } else {
        setFeeEstimation(null);
      }
    };
    updateFees();
  }, [amount, method, recipient, context?.state.network]);

  const handleSend = async () => {
    // ... (existing Onchain Logic) ...
    if (method === 'onchain') {
      setIsSending(true);
      setShowSuccess(false);
      setOnchainTxid(null);
      setOnchainError(null);
      try {
        const network = (context?.state.network ?? 'mainnet') as Network;
        const fromAddress = context?.state.walletConfig?.masterAddress;
        if (!fromAddress) throw new Error('Wallet not configured');

        const parsed = parseBip21(recipient);
        const toAddress = parsed.address;
        const btcAmount = parsed.amount ?? Number(amount || '0');
        if (!toAddress) throw new Error('Invalid recipient');
        if (!Number.isFinite(btcAmount) || btcAmount <= 0) throw new Error('Invalid amount');

        // Check for PayJoin
        let payJoinResult: any = null;
        const { PayJoinService } = await import('../services/payjoin');
        const pjService = new PayJoinService(network);
        if (pjService.hasPayJoin(recipient)) {
             try {
                 context?.notify('info', 'Negotiating PayJoin privacy transaction...');
                 
                 // 1. Build Original PSBT (Simulated for brevity, typically uses same buildPsbt logic)
                 const utxos = await fetchBtcUtxos(fromAddress, network);
                 const amountSats = Math.floor(btcAmount * 100000000);
                 const base = network === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/testnet';
                 const fees = await getRecommendedFees(base);
                 
                 const originalPsbtObject = buildPsbt({
                    utxos, toAddress, amountSats, changeAddress: fromAddress, feeRate: fees.halfHourFee || 10, rbf: true, network
                 });
                 // Determine if we need to convert base64 back to Psbt object or if service takes hex/base64
                 // The service expects bitcoin.Psbt. Importing bitcoinjs-lib here dynamically or assuming it's available.
                 const bitcoin = await import('bitcoinjs-lib');
                 const originalPsbt = bitcoin.Psbt.fromBase64(originalPsbtObject as string);

                 // 2. Execute PayJoin
                 const result = await pjService.sendPayJoin(recipient, originalPsbt, async (psbtToSign) => {
                      // Callback to sign the PayJoin PSBT
                      const signed = await context?.authorizeSignature({
                          type: 'transaction',
                          layer: 'Mainnet',
                          payload: { psbt: psbtToSign.toBase64(), network },
                          description: 'Sign PayJoin Transaction'
                      });
                      if (!signed?.psbtBase64) throw new Error('User declined Sign or signing failed');
                      // Reconstruct PSBT from base64 string returned by authorizeSignature
                      return bitcoin.Psbt.fromBase64(signed.psbtBase64);
                 });
                 payJoinResult = result;
             } catch (e) {
                 console.warn("PayJoin failed, falling back to standard tx", e);
             }
        }

        if (payJoinResult) {
             const txid = await broadcastBtcTx(payJoinResult.txHex, network);
             setOnchainTxid(txid);
             setShowSuccess(true);
             context?.notify('success', `Privacy PayJoin Broadcasted: ${txid.substring(0, 12)}...`);
             setRecipient('');
             setAmount('');
             return;
        }

        // Standard Logic Fallback
        const amountSats = Math.floor(btcAmount * 100000000);
        const utxos = await fetchBtcUtxos(fromAddress, network);
        if (!utxos.length) throw new Error('No spendable UTXOs');

        const base =
          network === 'mainnet'
            ? 'https://mempool.space'
            : network === 'testnet'
              ? 'https://mempool.space/testnet'
              : network === 'regtest'
                ? 'http://127.0.0.1:3002'
                : 'https://mempool.space/signet';
        const fees = await getRecommendedFees(base);
        const feeRate = fees.halfHourFee || 8;

        const psbt = buildPsbt({
          utxos,
          toAddress,
          amountSats,
          changeAddress: fromAddress,
          feeRate,
          rbf: true,
          network
        });
        const signed = await context?.authorizeSignature({
          type: 'transaction',
          layer: 'Mainnet',
          payload: { psbt, network },
          description: 'Sign PSBT'
        });
        const rawHex = signed?.broadcastReadyHex;
        if (!rawHex) throw new Error('Signing failed');
        const txid = await broadcastBtcTx(rawHex, network);
        setOnchainTxid(txid);
        setShowSuccess(true);
        context?.notify('success', `Broadcasted: ${txid.substring(0, 12)}...`);
        setRecipient('');
        setAmount('');
      } catch (e: any) {
        const msg = sanitizeError(e, 'On-chain send failed');
        setOnchainError(msg);
        context?.notify('error', msg);
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (method === 'lightning') {
      setIsSending(true);
      setShowSuccess(false);
      try {
        const backend = getLightningBackend(context?.state.lnBackend);
        if (!backend.configured) throw new Error('Lightning backend not configured');
        
        // Smart Check: Balance
        if (breezBalance !== null) {
            const sats = Math.floor(Number(amount || '0') * 100000000);
            if (sats > breezBalance) {
                throw new Error(`Insufficient Lightning Liquidity (Max: ${breezBalance} sats)`);
            }
        }

        if (lnDetail?.type === 'lnurl') {
          const sats = Math.floor(Number(amount || '0') * 100000000);
          if (!Number.isFinite(sats) || sats <= 0) throw new Error('Invalid amount');
          await backend.lnurlPay(lnDetail.params.callback, sats * 1000);
        } else if (lnDetail?.type === 'bolt11') {
          await backend.payInvoice(recipient);
        } else {
          throw new Error('Enter a BOLT11 invoice or LNURL');
        }

        setShowSuccess(true);
        setRecipient('');
        setAmount('');
      } catch (e: any) {
        context?.notify('error', sanitizeError(e, 'Lightning send failed'));
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (method === 'onramp') {
      setIsSending(true);
      
      const apiKey = import.meta.env.VITE_TRANSAK_API_KEY || '';
      const environment = (context?.state.network === 'mainnet' && context?.state.isMainnetLive) ? 'PRODUCTION' : 'STAGING';
      const baseUrl = environment === 'PRODUCTION' ? 'https://global.transak.com' : 'https://global-stg.transak.com';
      const walletAddress = context?.state.walletConfig?.masterAddress;

      if (!walletAddress) {
          context?.notify('error', 'Wallet address not found.');
          setIsSending(false);
          return;
      }

      const params = new URLSearchParams({
          apiKey,
          cryptoCurrencyCode: 'BTC',
          walletAddress,
          disableWalletAddressForm: 'true',
          redirectURL: window.location.href,
          themeColor: 'F97316' // Orange-500
      });

      const url = `${baseUrl}?${params.toString()}`;
      
      // Give UI a moment to show loading state before redirect
      setTimeout(() => {
          window.open(url, '_blank');
          context?.notify('info', 'Redirecting to Transak Gateway...');
          setIsSending(false);
          setShowSuccess(true); // Optimistically show success state in UI
          
          setTimeout(() => {
            setShowSuccess(false);
            setRecipient('');
            setAmount('');
          }, 3000);
      }, 1000);
      
      return;
    }

    // Fallback if method is unknown (should not happen)
    setIsSending(false);
  };


  const handleOnrampInitiate = () => {
    if (!context?.state.externalGatewaysActive) {
      setShowPrivacyWarning(true);
    } else {
      handleSend(); // Simulate GPay Flow
    }
  };

  const confirmGateway = () => {
    context?.toggleGateway(true);
    setShowPrivacyWarning(false);
    handleSend();
  };

  const getFees = () => {
    if (method === 'lightning') return { network: '0.00000001 BTC', integrator: '$0.00', savings: '$12.40' };
    if (method === 'onchain') return { network: '0.00012 BTC', integrator: '$0.00', savings: '$0.00' };
    return { network: '1.5% Spread', integrator: '$0.05', savings: '-$5.20 (KYC Cost)' };
  };

  const fees = getFees();
  const bolt11HasAmount = lnDetail?.type === 'bolt11' && !!lnDetail.info?.amountMsat;

  useEffect(() => {
    let reader: BrowserMultiFormatReader | null = null;
    let stop: (() => void) | null = null;
    if (showScanner) {
      setIsScanning(true);
      setScanError(null);
      reader = new BrowserMultiFormatReader();
      reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) {
          const text = result.getText();
          setRecipient(text);
          handleRecipientChange(text);
          setShowScanner(false);
          if (stop) stop();
          setIsScanning(false);
        } else if (err && `${err}`.includes('NotFoundException')) {
        } else if (err) {
          setScanError('Camera error');
        }
      }).then(ctrl => { stop = () => ctrl.stop(); }).catch(e => { setScanError('Unable to access camera'); setIsScanning(false); });
    }
    return () => {
      if (stop) stop();
      reader = null;
    };
  }, [showScanner]);

  const handleRecipientChange = async (text: string) => {
    if (method !== 'lightning') return;
    try {
      if (isLnurl(text)) {
        const url = decodeLnurl(text);
        const params = await fetchLnurlParams(url);
        setLnDetail({ type: 'lnurl', params });
      } else {
        const info = decodeBolt11(text);
        setLnDetail({ type: 'bolt11', info });
      }
    } catch (e) {
      setLnDetail({ type: 'error' });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold mb-1 tracking-tight">Sovereign Payments</h2>
          <p className="text-zinc-500 text-sm">Automated pathfinding for maximum cost efficiency.</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-2xl">
           <TrendingDown size={14} className="text-green-500" />
           <span className="text-[10px] font-black uppercase text-zinc-400">Total Saved: $154.50</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
            <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 overflow-hidden">
              <button type="button" onClick={() => setMethod('lightning')} title="Lightning" className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'lightning' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-600 hover:text-zinc-400'}`}><Zap size={14} /> Lightning</button>
              <button type="button" onClick={() => setMethod('onchain')} title="On-chain" className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'onchain' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-600 hover:text-zinc-400'}`}><Globe size={14} /> On-chain</button>
              <button type="button" onClick={() => setMethod('onramp')} title="Fiat On-ramp" className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'onramp' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-600 hover:text-zinc-400'}`}><Smartphone size={14} /> Fiat</button>
            </div>

            {/* Balance Display */}
            {method === 'lightning' && breezBalance !== null && (
               <div className="flex justify-end px-2">
                  <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                     Available Liquidity: <span className="text-orange-500 font-mono">{(breezBalance).toLocaleString()} sats</span>
                  </p>
               </div>
            )}

            <div className="space-y-6">
              {method !== 'onramp' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 flex justify-between">Recipient <button type="button" onClick={() => setShowScanner(true)} className="text-orange-500 hover:text-orange-400 flex items-center gap-1 font-black" aria-label="Scan QR" title="Scan QR"><QrCode size={12} /> Scan QR</button></label>
                    <div className="relative">
                      <input type="text" value={recipient} onChange={(e) => { setRecipient(e.target.value); handleRecipientChange(e.target.value); }} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" placeholder={method === 'lightning' ? 'Invoice or lnurl...' : 'bc1q... or handle.btc'} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-5 pl-5 pr-12 font-mono text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 transition-all" />
                      <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700" size={18} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 ml-1">Amount (BTC)</label>
                    <div className="relative">
                      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" placeholder="0.00" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-6 px-6 text-4xl font-black text-zinc-100 focus:outline-none focus:border-orange-500/50 transition-all font-mono tracking-tighter" />
                    </div>
                  </div>
                  {method === 'lightning' && (
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={async () => {
                        try {
                          const backend = getLightningBackend(context?.state.lnBackend);
                          const sats = Math.floor(parseFloat(amount || '0') * 100000000);
                          const inv = await backend.createInvoice(sats, 'Conxius');
                          setGeneratedInvoice(inv.invoice);
                        } catch {
                          setGeneratedInvoice(null);
                        }
                      }} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-black uppercase" aria-label="Generate Invoice">Generate Invoice</button>
                      {generatedInvoice && (
                        <button type="button" onClick={() => navigator.clipboard.writeText(generatedInvoice!)} className="px-4 py-2 bg-zinc-800 text-zinc-200 rounded-xl text-[10px] font-black uppercase" aria-label="Copy Invoice">Copy Invoice</button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-zinc-950/50 border border-zinc-900 rounded-[2rem] p-8 text-center space-y-6">
                     <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-2xl">
                        <CreditCard className="text-zinc-950" size={32} />
                     </div>
                     <div>
                        <h4 className="text-xl font-bold text-zinc-100">Transak Gateway</h4>
                        <p className="text-xs text-zinc-500 mt-1 italic leading-relaxed">Powered by Transak. Fast BTC on-ramping via card or bank transfer.</p>
                     </div>
                     <div className="relative">
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" placeholder="0.00" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-5 px-6 text-2xl font-black text-white focus:outline-none text-center" />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-700 uppercase">USD</span>
                     </div>
                  </div>
                </div>
              )}

              <div className="bg-zinc-950/80 border border-zinc-900 rounded-2xl p-6 space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Sparkles size={14} className="text-orange-500" />
                       <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Protocol Optimizer</span>
                    </div>
                    <button type="button" onClick={() => setIsSmartRouting(!isSmartRouting)} className={`w-10 h-5 rounded-full transition-colors relative ${isSmartRouting ? 'bg-orange-600' : 'bg-zinc-800'}`} aria-label="Toggle Smart Routing" title="Toggle Smart Routing">
                       <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all ${isSmartRouting ? 'left-5.5' : 'left-0.5'}`} />
                    </button>
                 </div>
                 <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-black tracking-widest text-zinc-600">
                    <div className="space-y-1">
                       <p>Est. Network Fee</p>
                       <p className="text-zinc-300 font-mono">{fees.network}</p>
                    </div>
                    <div className="space-y-1 text-right">
                       <p className={method === 'onramp' ? 'text-orange-500' : 'text-green-500'}>{method === 'onramp' ? 'Privacy Loss' : 'Cost Saving'}</p>
                       <p className={`${method === 'onramp' ? 'text-orange-500' : 'text-green-500'} font-mono`}>{fees.savings}</p>
                    </div>
                 </div>
              </div>


        {feeEstimation && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
               <span className="text-[10px] uppercase font-black text-zinc-500">Gas Efficiency</span>
               <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                 feeEstimation.efficiencyRating === 'optimal' ? 'bg-emerald-500/20 text-emerald-500' :
                 feeEstimation.efficiencyRating === 'high' ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'
               }`}>
                 <TrendingDown size={10} /> {feeEstimation.efficiencyRating}
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[8px] uppercase text-zinc-600 font-bold">Network Fee</p>
                  <p className="text-xs font-mono text-zinc-300">{feeEstimation.totalFee.toFixed(8)} BTC</p>
               </div>
               <div className="text-right">
                  <p className="text-[8px] uppercase text-zinc-600 font-bold">Abstracted Saving</p>
                  <p className="text-xs font-mono text-emerald-500">~0.00001 BTC</p>
               </div>
            </div>
          </div>
        )}
              <button type="button"
                onClick={method === 'onramp' ? handleOnrampInitiate : handleSend}
                disabled={isSending || (method !== 'onramp' && !recipient) || (method === 'lightning' ? (!amount && !bolt11HasAmount) : (method !== 'onramp' && method !== 'onchain' && !amount)) || (method === 'onchain' && !amount && !parseBip21(recipient).amount) || showSuccess}
                className={`w-full font-black py-5 rounded-[2rem] text-xs uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 ${
                  showSuccess ? 'bg-green-600 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                }`}
                aria-label="Execute Transfer"
                title="Execute Transfer"
              >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : showSuccess ? <CheckCircle2 size={20} /> : <Send size={20} />}
                {isSending ? 'Routing...' : showSuccess ? 'Success' : method === 'onramp' ? 'Buy via Transak' : 'Execute Transfer'}
              </button>
              {method === 'onchain' && onchainError && (
                <div className="text-[10px] text-red-500 font-black uppercase tracking-widest">{onchainError}</div>
              )}
              {method === 'onchain' && onchainTxid && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                  <p className="text-[10px] uppercase font-black text-zinc-500">Broadcast Result</p>
                  <p className="text-xs font-mono text-zinc-300 break-all">{onchainTxid}</p>
                </div>
              )}
              {method === 'lightning' && lnDetail && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
                  {lnDetail.type === 'lnurl' && (
                    <div className="text-[10px] uppercase font-black text-zinc-500 space-y-2">
                      <p>LNURL Detected</p>
                      <p className="text-zinc-300">Min: {(lnDetail.params.minSendable/1000).toLocaleString()} sats • Max: {(lnDetail.params.maxSendable/1000).toLocaleString()} sats</p>
                      <p className="text-zinc-400">Callback: {lnDetail.params.callback}</p>
                      <button type="button" onClick={async () => {
                        try {
                          const backend = getLightningBackend(context?.state.lnBackend);
                          const sats = Math.floor(parseFloat(amount || '0') * 100000000);
                          await backend.lnurlPay(lnDetail.params.callback, sats * 1000);
                          setShowSuccess(true);
                        } catch {
                          setShowPrivacyWarning(true);
                        }
                }} className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase" aria-label="Pay LNURL" title="Pay LNURL">Pay LNURL</button>
                    </div>
                  )}
                  {lnDetail.type === 'bolt11' && lnDetail.info && (
                    <div className="text-[10px] uppercase font-black text-zinc-500 space-y-2">
                      <p>BOLT11 Invoice</p>
                      <p className="text-zinc-300">Amount: {lnDetail.info.amountMsat ? Math.floor(lnDetail.info.amountMsat/1000).toLocaleString() : 'n/a'} sats</p>
                      <p className="text-zinc-400">Payee: {lnDetail.info.payee || 'unknown'}</p>
                    </div>
                  )}
                  {lnDetail.type === 'error' && <p className="text-[10px] text-red-500">Lightning decode failed</p>}
                </div>
              )}
        {method === 'lightning' && generatedInvoice && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
            <p className="text-[10px] uppercase font-black text-zinc-500">Generated Invoice</p>
            <p className="text-xs font-mono text-zinc-300 break-all">{generatedInvoice}</p>
          </div>
        )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl">
            <h3 className="text-[10px] font-black mb-6 flex items-center gap-2 uppercase tracking-[0.2em] text-zinc-600">Recent Contacts</h3>
            <div className="space-y-3">
              {[
                { name: 'Alice (D.i.D)', address: 'did:btc:alice...123', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=alice' },
                { name: 'Bob (BNS)', address: 'bob.btc', avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=bob' },
              ].map((contact, i) => (
                <button type="button" key={i} onClick={() => {setRecipient(contact.address); setMethod('lightning');}} className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-950/50 border border-zinc-900 hover:border-orange-500/30 transition-all group" aria-label={`Select contact ${contact.name}`} title={`Select contact ${contact.name}`}>
                  <div className="flex items-center gap-3 text-left">
                    <img src={contact.avatar} alt={contact.name} className="w-10 h-10 rounded-xl border border-zinc-800 shadow-inner" />
                    <div>
                      <p className="text-xs font-bold text-zinc-200">{contact.name}</p>
                      <p className="text-[10px] font-mono text-zinc-600 truncate w-32">{contact.address}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-zinc-800 group-hover:text-orange-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-orange-500/5 border border-orange-500/10 rounded-[2rem] p-8 space-y-4">
             <div className="flex items-center gap-3">
                <div className="bg-orange-500/20 p-2 rounded-lg"><Info className="text-orange-500" size={18} /></div>
                <h4 className="font-bold text-xs uppercase tracking-widest text-zinc-200">Enclave Privacy Notice</h4>
             </div>
             <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                {method === 'onramp' 
                  ? "Integrating with Transak sends your PII and financial metadata to their centralized servers for KYC/FICA compliance."
                  : "Sending via Lightning or Rootstock maintains end-to-end encryption and Tor-level network obfuscation."}
             </p>
             {method !== 'onramp' && (
               <button type="button" className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[8px] font-black uppercase text-zinc-500 tracking-widest transition-all" aria-label="Invite Friend to Enclave" title="Invite Friend to Enclave">Invite Friend to Enclave</button>
             )}
          </div>
        </div>
      </div>

      {/* Sovereign Warning Modal */}
      {showPrivacyWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[3rem] p-10 space-y-8 relative shadow-[0_0_100px_rgba(249,115,22,0.1)]">
              <button type="button" onClick={() => setShowPrivacyWarning(false)} className="absolute top-8 right-8 text-zinc-700 hover:text-zinc-300 transition-colors" aria-label="Close Modal" title="Close Modal">
                <X size={24} />
              </button>
              <div className="text-center space-y-4">
                 <div className="w-20 h-20 bg-orange-600/10 border border-orange-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-orange-500 shadow-inner">
                    <ShieldAlert size={40} />
                 </div>
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Sovereignty Risk Detected</h3>
                 <p className="text-xs text-zinc-400 leading-relaxed italic">
                    By enabling the **Transak Gateway**, you are bridging your sovereign enclave to the legacy financial system.
                 </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Privacy Penalty: -15 Points</span>
                 </div>
                 <p className="text-[10px] text-zinc-600 italic">
                    Transak will act as the Merchant of Record. You are entering a regulated financial flow.
                 </p>
              </div>

              <div className="flex flex-col gap-3">
                 <button type="button"
                  onClick={confirmGateway}
                  className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-2xl"
                 >
                    I Accept the Trade-off
                 </button>
                 <button type="button"
                  onClick={() => setShowPrivacyWarning(false)}
                  className="w-full py-4 text-zinc-600 hover:text-zinc-300 font-black text-[10px] uppercase tracking-widest transition-all"
                 >
                    Stay Native Only
                 </button>
              </div>
           </div>
        </div>
      )}
      {showScanner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[3rem] p-8 space-y-6 relative shadow-2xl">
            <button type="button" onClick={() => setShowScanner(false)} className="absolute top-6 right-6 text-zinc-700 hover:text-zinc-300 transition-colors" aria-label="Close Scanner" title="Close Scanner">
              <X size={24} />
            </button>
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500"><QrCode size={32} /></div>
              <h3 className="text-xl font-black uppercase tracking-widest text-zinc-200">Scan Code</h3>
              {scanError && <p className="text-[10px] text-red-500">{scanError}</p>}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <video ref={videoRef} className="w-full rounded-xl" autoPlay muted playsInline />
            </div>
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{isScanning ? 'Scanning...' : 'Ready'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentPortal;
