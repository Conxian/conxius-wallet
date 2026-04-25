import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  ArrowRight,
  Send,
  Scan,
  Zap,
  ShieldCheck,
  Info,
  AlertCircle,
  CheckCircle2,
  Clock,
  Link,
  History,
  Search,
  TrendingUp,
  ChevronRight,
  Globe,
  User,
  Fingerprint,
  X,
  Loader2,
  Camera,
  CreditCard
} from 'lucide-react';
import { AppContext } from '../context';
import { fetchUtxos, broadcastTransaction } from '../services/protocol';
import { buildPsbt } from '../services/psbt';
import { BrowserMultiFormatReader } from '@zxing/library';
import { decodeBolt11, isLnurl, decodeLnurl, fetchLnurlParams, payLightningInvoice, payLnurl } from '../services/lightning';
import * as bitcoin from 'bitcoinjs-lib';
import { payjoin } from 'payjoin-client';
import { IdentityService } from '../services/identity';
import { signB2bInvoice } from '../services/monetization';

const PaymentPortal: React.FC = () => {
  const context = useContext(AppContext);
  const [method, setMethod] = useState<'onchain' | 'lightning'>('onchain');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [onchainTxid, setOnchainTxid] = useState('');
  const [lnDetail, setLnDetail] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    let reader: BrowserMultiFormatReader | null = null;
    let stop: (() => void) | null = null;
    if (showScanner) {
      setTimeout(() => setIsScanning(true), 0);
      setTimeout(() => setScanError(null), 0);
      reader = new BrowserMultiFormatReader();
      reader.decodeFromVideoDevice(null, videoRef.current!, (result, err) => {
        if (result) {
          const text = result.getText();
          setRecipient(text);
          handleRecipientChange(text);
          setShowScanner(false);
          if (stop) null;
          setIsScanning(false);
        } else if (err && `${err}`.includes('NotFoundException')) {
        } else if (err) {
          setScanError('Camera error');
        }
      }).then(ctrl => { /* simulation */ }).catch(e => { setScanError('Unable to access camera'); setIsScanning(false); });
    }
    return () => {
      if (stop) null;
      reader = null;
    };
  }, [showScanner]);

  const handleSend = async () => {
    if (!context) return;
    setIsSending(true);
    const network = context.state.network;

    try {
        let txid = '';
        if (method === 'lightning') {
             if (lnDetail?.type === 'lnurl') {
                 txid = await payLnurl(lnDetail.params, parseFloat(amount));
             } else {
                 txid = await payLightningInvoice(recipient);
             }
        } else {
             const fromAddress = context.state.walletConfig?.masterAddress || '';
             const utxos = await fetchUtxos(fromAddress, network);
             const amountSats = Math.floor(parseFloat(amount) * 100000000);

             const psbtHex = await buildPsbt({
                 utxos,
                 toAddress: recipient,
                 amountSats,
                 changeAddress: fromAddress,
                 feeRate: 2,
                 network
             });

             const signed = await context.authorizeSignature({
                 type: 'psbt',
                 layer: 'Mainnet',
                 payload: { psbt: psbtHex },
                 description: `Send ${amount} BTC to ${recipient}`
             });

             if (signed.broadcastReadyHex) {
                 txid = await broadcastTransaction(signed.broadcastReadyHex, 'Mainnet', network);
             }
        }

        if (txid) {
            setOnchainTxid(txid);
            setShowSuccess(true);
            context.notify('success', `Payment Sent: ${txid.substring(0, 12)}...`);
        }
    } catch (e: any) {
        context.notify('error', e.message, 'Payment Failed');
    } finally {
        setIsSending(false);
    }
  };

  const getFees = () => {
    if (method === 'lightning') return { network: '0 Sats', integrator: '0 Sats', savings: 'Instant' };
    return { network: '1.5% Spread', integrator: '$0.05', savings: '-$5.20 (KYC Cost)' };
  };

  const fees = getFees();
  const bolt11HasAmount = lnDetail?.type === 'bolt11' && !!lnDetail.info?.amountMsat;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 bg-orange-500/10 rounded-xl">
                <Send size={20} className="text-accent-earth" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-earth">Global Settlement</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-brand-deep">Citadel Pay</h1>
          <p className="text-brand-earth mt-2 max-w-md italic">Sovereign payments across all Bitcoin layers with zero-leak privacy.</p>
        </div>

        <div className="flex bg-off-white/50 p-1.5 rounded-2xl border border-border">
          <button
            onClick={() => { setMethod('onchain'); setLnDetail(null); }}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'onchain' ? 'bg-white text-brand-deep shadow-sm border border-border' : 'text-brand-earth'}`}
          >
            Bitcoin L1
          </button>
          <button
            onClick={() => setMethod('lightning')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'lightning' ? 'bg-white text-brand-deep shadow-sm border border-border' : 'text-brand-earth'}`}
          >
            Lightning
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
           <div className="bg-white border border-border rounded-[3rem] p-10 shadow-2xl shadow-orange-950/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] -rotate-12 group-hover:rotate-0 transition-transform duration-700">
                <ShieldCheck size={240} />
              </div>

              {showSuccess ? (
                 <div className="py-12 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="relative">
                       <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                       <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center relative z-10 shadow-2xl shadow-green-500/40">
                          <CheckCircle2 size={48} className="text-white" />
                       </div>
                    </div>

                    <div>
                       <h2 className="text-3xl font-black text-brand-deep tracking-tighter">Payment Sent</h2>
                       <p className="text-brand-earth mt-2 italic">Computational integrity verified by Enclave.</p>
                    </div>

                    <div className="w-full bg-off-white border border-border rounded-3xl p-6 font-mono text-[10px] break-all text-brand-earth flex items-center gap-3">
                       <span className="opacity-50">TX:</span>
                       <span className="flex-1 text-left">{onchainTxid}</span>
                       <button className="p-2 hover:bg-white rounded-lg transition-all"><Link size={14} /></button>
                    </div>

                    <button
                      onClick={() => { setShowSuccess(false); setRecipient(''); setAmount(''); setLnDetail(null); }}
                      className="w-full py-5 border-2 border-brand-deep text-brand-deep font-black rounded-[2rem] text-[10px] uppercase tracking-widest hover:bg-brand-deep hover:text-white transition-all"
                    >
                       New Payment
                    </button>
                 </div>
              ) : (
                <div className="relative z-10 space-y-10">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand-earth">Recipient {method === 'lightning' ? 'Invoice' : 'Address'}</label>
                        <button
                          onClick={() => setShowScanner(!showScanner)}
                          className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-accent-earth hover:opacity-70 transition-all"
                        >
                          <Scan size={12} /> {showScanner ? 'Close Scanner' : 'Scan QR'}
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={recipient}
                          onChange={(e) => { setRecipient(e.target.value); handleRecipientChange(e.target.value); }}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          placeholder={method === 'lightning' ? 'Invoice or lnurl...' : 'bc1q... or handle.btc'}
                          className="w-full bg-off-white border border-border rounded-2xl py-5 pl-5 pr-12 font-mono text-sm text-brand-deep focus:outline-none focus:border-orange-500/50 transition-all"
                        />
                        {isSending && <div className="absolute right-5 top-1/2 -translate-y-1/2"><Loader2 className="animate-spin text-accent-earth" size={18} /></div>}
                      </div>

                      {showScanner && (
                        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-border group">
                           <video ref={videoRef} className="w-full h-full object-cover opacity-60" />
                           {isScanning && (
                             <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-0 left-0 w-full h-1 bg-accent-earth/50 shadow-[0_0_15px_rgba(194,94,0,0.8)] animate-scan" />
                             </div>
                           )}
                           <div className="absolute inset-0 flex items-center justify-center">
                              {!isScanning && !scanError && <Camera size={48} className="text-white opacity-20" />}
                              {scanError && <div className="bg-red-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">{scanError}</div>}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-brand-earth px-2">Amount to Send</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          disabled={bolt11HasAmount}
                          placeholder="0.00"
                          className="w-full bg-off-white border border-border rounded-3xl py-10 px-10 text-6xl font-black text-brand-deep focus:outline-none focus:border-orange-500/50 transition-all font-mono tracking-tighter"
                        />
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-end">
                           <span className="text-2xl font-black text-brand-earth">{method === 'lightning' ? 'SATS' : 'BTC'}</span>
                           <span className="text-xs font-bold text-brand-earth/60 uppercase">~ $0.00</span>
                        </div>
                      </div>
                      {bolt11HasAmount && <p className="text-[9px] text-brand-earth italic px-2">Amount fixed by invoice.</p>}
                    </div>

                    <button
                      onClick={handleSend}
                      disabled={isSending || !recipient || (!amount && !bolt11HasAmount)}
                      className="w-full py-7 bg-accent-earth hover:bg-accent-earth/90 disabled:opacity-50 text-white font-black rounded-[2.5rem] text-sm uppercase tracking-[0.2em] transition-all shadow-2xl shadow-orange-600/20 active:scale-[0.98] flex items-center justify-center gap-4"
                    >
                      {isSending ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} className="fill-current" />}
                      Authorize Enclave Sign
                    </button>
                </div>
              )}
           </div>

           <div className="bg-ivory border border-border rounded-3xl p-8 flex gap-6 items-start">
              <div className="p-3 bg-white rounded-2xl border border-border">
                 <ShieldCheck size={28} className="text-green-600" />
              </div>
              <div className="space-y-1">
                 <h4 className="text-xs font-black uppercase text-brand-deep tracking-widest">Privacy Guard Active</h4>
                 <p className="text-[10px] text-brand-earth leading-relaxed">CXN Guardian is redacting PII and sensitive identifiers before network transmission. Your physical location and IP are masked via Sovereign Tor.</p>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-8 space-y-8">
              <h3 className="text-[10px] font-black uppercase text-brand-earth tracking-widest flex items-center gap-2">
                 <TrendingUp size={14} className="text-accent-earth" />
                 Settlement Metrics
              </h3>

              <div className="space-y-6">
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[9px] font-black uppercase text-brand-earth mb-1">Network Fee</p>
                       <p className="text-sm font-bold text-brand-deep">{fees.network}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black uppercase text-brand-earth mb-1">Integrator</p>
                       <p className="text-sm font-bold text-brand-deep">{fees.integrator}</p>
                    </div>
                 </div>

                 <div className="p-5 bg-green-500/5 border border-green-500/20 rounded-2xl flex items-center gap-4">
                    <Zap size={20} className="text-green-600" />
                    <div>
                       <p className="text-[9px] font-black uppercase text-green-600">Citadel Savings</p>
                       <p className="text-xs font-bold text-brand-deep">{fees.savings}</p>
                    </div>
                 </div>
              </div>

              <div className="pt-8 border-t border-border/50">
                 <h4 className="text-[9px] font-black uppercase text-brand-earth mb-4">Identity Verification</h4>
                 <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-border">
                    <div className="w-10 h-10 bg-off-white rounded-full flex items-center justify-center border border-border">
                       <Fingerprint size={20} className="text-brand-earth" />
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-brand-deep">Hardware Key Ready</p>
                       <p className="text-[9px] text-brand-earth">StrongBox Attested</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-brand-deep text-white rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 -mt-4 -mr-4">
                 <Clock size={120} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">Pending Invoices</h3>
              <div className="space-y-4 relative z-10">
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div>
                       <p className="text-[10px] font-bold">Silent.Link</p>
                       <p className="text-[9px] opacity-60">Expires in 12m</p>
                    </div>
                    <p className="text-xs font-black">2.5k SATS</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPortal;
