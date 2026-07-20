import React, { useState, useContext } from 'react';
import { QrCode, Copy, Info, Zap, ChevronRight, Lock, Ghost, Eye, EyeOff } from 'lucide-react';
import { AppContext } from '../context';
import { Capacitor } from '@capacitor/core';
import type { SilentPaymentNetwork } from '../types';

const SilentPayments: React.FC = () => {
  const appContext = useContext(AppContext);
  const { network } = appContext?.state || {};
  const silentPaymentScan = appContext?.state.silentPaymentScan;
  const silentPaymentUtxos = appContext?.state.silentPaymentUtxos || [];

  const [showKeys, setShowKeys] = useState(false);
  const [startHeight, setStartHeight] = useState('');
  const [endHeight, setEndHeight] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  const configuredNetwork = network as string | undefined;
  const nativeNetwork: SilentPaymentNetwork | null = configuredNetwork && ['mainnet', 'testnet', 'signet', 'regtest'].includes(configuredNetwork)
    ? configuredNetwork as SilentPaymentNetwork
    : null;

  const startScan = async () => {
    if (!appContext || !nativeNetwork) {
      setScanError('UNSUPPORTED_PLATFORM');
      return;
    }
    const end = Number(endHeight);
    const start = startHeight === '' ? undefined : Number(startHeight);
    if (!Number.isSafeInteger(end) || end < 0 || (start !== undefined && (!Number.isSafeInteger(start) || start < 0 || start > end))) {
      setScanError('INVALID_REQUEST');
      return;
    }
    setScanError(null);
    try {
      await appContext.scanSilentPayments({ network: nativeNetwork, startHeight: start, endHeight: end });
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'INTERNAL');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 pb-32">
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 bg-accent-earth/10 text-accent-earth px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-orange-500/20">
          <Ghost size={14} /> BIP-352 Protocol
        </div>
        <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white">Silent Payments</h2>
        <p className="text-brand-earth text-sm font-medium max-w-xl mx-auto">Absolute privacy by default. Receive Bitcoin at a static address without ever linking transactions on-chain.</p>
      </header>

      <div className="bg-off-white/40 border border-border rounded-[3.5rem] p-10 space-y-10 relative overflow-hidden group">
         <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent-earth/5 rounded-full blur-[100px]" />

         <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
                <h3 className="font-black italic uppercase tracking-widest text-brand-earth text-xs flex items-center gap-3">
                    <Zap size={16} className="text-accent-earth" />
                    Sovereign Payment Code
                </h3>
                <span className="text-[10px] font-bold text-accent-earth bg-accent-earth/10 px-3 py-1 rounded-full uppercase tracking-widest">Native-only</span>
            </div>

            <div className="bg-white border border-border p-8 rounded-[2.5rem] space-y-6">
                <div className="flex flex-col items-center gap-6">
                    <div className="bg-white p-4 rounded-3xl shadow-2xl relative group">
                        <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center backdrop-blur-sm cursor-pointer">
                            <QrCode size={48} className="text-orange-600" />
                        </div>
                        <div className="w-48 h-48 bg-white flex items-center justify-center text-brand-deep">
                           <QrCode size={120} />
                        </div>
                    </div>

                    <div className="w-full space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-black text-brand-earth uppercase tracking-widest">Static Address</span>
                            <button
                                onClick={() => appContext?.notify('info', 'Address derivation is not available yet')}
                                className="text-accent-earth hover:text-orange-400 transition-colors"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        <div className="bg-off-white border border-border p-6 rounded-2xl break-all font-mono text-[11px] text-brand-earth leading-relaxed shadow-inner">
                            Address derivation is unavailable until the native BIP-352 address codec is implemented.
                        </div>
                    </div>
                </div>
            </div>
         </div>

         <div className="space-y-6 relative z-10">
            <button
                onClick={() => setShowKeys(!showKeys)}
                className="w-full flex items-center justify-between p-6 rounded-2xl bg-white border border-border hover:border-brand-earth transition-all group"
            >
                <div className="flex items-center gap-4">
                    <Lock size={18} className="text-brand-earth group-hover:text-accent-earth transition-colors" />
                    <span className="text-xs font-black uppercase tracking-widest text-brand-earth">Technical Key Decomposition</span>
                </div>
                {showKeys ? <EyeOff size={18} className="text-brand-earth" /> : <Eye size={18} className="text-brand-earth" />}
            </button>

            {showKeys && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4">
                    <div className="bg-white border border-border p-6 rounded-2xl space-y-3">
                        <p className="text-[9px] font-black text-brand-earth uppercase tracking-widest">Scan Public Key</p>
                        <p className="text-[10px] text-brand-earth break-all">Unavailable until native address derivation is implemented.</p>
                    </div>
                    <div className="bg-white border border-border p-6 rounded-2xl space-y-3">
                        <p className="text-[9px] font-black text-brand-earth uppercase tracking-widest">Spend Public Key</p>
                        <p className="text-[10px] text-brand-earth break-all">Unavailable until native address derivation is implemented.</p>
                    </div>
                </div>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-600/5 border border-blue-500/10 p-8 rounded-[2.5rem] space-y-4">
            <h4 className="font-bold text-xs text-blue-500 flex items-center gap-2 uppercase tracking-widest">
                <Info size={16} />
                How it works
            </h4>
            <p className="text-[10px] text-brand-earth leading-relaxed italic">
                Silent Payments use Diffie-Hellman key exchange between a sender's input keys and your Scan Key to derive a one-time Taproot address.
                <br/><br/>
                Unlike reusable addresses, this address is only detectable by you, ensuring that no outside observer can link multiple payments to your identity.
            </p>
        </div>

        <div className="bg-off-white/40 border border-border p-8 rounded-[2.5rem] flex flex-col justify-between">
            <div className="space-y-2">
                <h4 className="text-sm font-black text-brand-deep italic uppercase tracking-tighter">Sovereign Automation</h4>
                <p className="text-[10px] text-brand-earth leading-relaxed italic">Native Android scans use the unlocked StrongBox-backed wallet and persist only public UTXO metadata. Web scanning is unsupported.</p>
            </div>
            <div className="mt-6 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <input value={startHeight} onChange={event => setStartHeight(event.target.value)} placeholder="Resume" inputMode="numeric" className="rounded-xl border border-border px-3 py-2 text-xs" />
                    <input value={endHeight} onChange={event => setEndHeight(event.target.value)} placeholder="End height" inputMode="numeric" className="rounded-xl border border-border px-3 py-2 text-xs" />
                </div>
                <button onClick={startScan} disabled={silentPaymentScan?.status === 'scanning'} className="flex items-center gap-2 text-accent-earth text-[10px] font-black uppercase tracking-widest hover:gap-4 transition-all disabled:opacity-50">
                    {silentPaymentScan?.status === 'scanning' ? 'Scanning native source…' : 'Scan native range'} <ChevronRight size={14} />
                </button>
                <p className="text-[10px] text-brand-earth">Stored public UTXOs: {silentPaymentUtxos.length}</p>
                {scanError && <p className="text-[10px] text-red-600">{scanError}</p>}
                {!Capacitor.isNativePlatform() && <p className="text-[10px] text-brand-earth">UNSUPPORTED_PLATFORM: scanning requires the Android native plugin.</p>}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SilentPayments;
