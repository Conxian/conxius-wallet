import React, { useState, useEffect, useContext } from 'react';
import { Shield, Eye, EyeOff, QrCode, Copy, RefreshCcw, Info, Zap, ChevronRight, Lock, Ghost } from 'lucide-react';
import { AppContext } from '../context';
import { deriveSilentPaymentKeys, encodeSilentPaymentAddress } from '../services/silent-payments';
import { Buffer } from 'buffer';

const SilentPayments: React.FC = () => {
  const appContext = useContext(AppContext);
  const { walletConfig, network } = appContext?.state || {};

  const [showKeys, setShowKeys] = useState(false);
  const [silentAddress, setSilentAddress] = useState<string>('');
  const [scanPub, setScanPub] = useState<string>('');
  const [spendPub, setSpendPub] = useState<string>('');

  useEffect(() => {
    if (walletConfig?.mnemonicVault || walletConfig?.masterAddress) {
        // In a real app, this would use a secure decrypted seed from the enclave
        const mockSeed = Buffer.alloc(64).fill(0xac);
        const keys = deriveSilentPaymentKeys(mockSeed);
        const addr = encodeSilentPaymentAddress(keys.scanPub, keys.spendPub, network === 'testnet' ? 'testnet' : 'mainnet');

        // Wrap in timeout to avoid synchronous setState in effect warning
        setTimeout(() => {
            setSilentAddress(addr);
            setScanPub(keys.scanPub.toString('hex'));
            setSpendPub(keys.spendPub.toString('hex'));
        }, 0);
    }
  }, [walletConfig, network]);

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
                <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
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
                                onClick={() => { navigator.clipboard.writeText(silentAddress); appContext?.notify('info', 'Silent Address Copied'); }}
                                className="text-accent-earth hover:text-orange-400 transition-colors"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                        <div className="bg-off-white border border-border p-6 rounded-2xl break-all font-mono text-[11px] text-brand-earth leading-relaxed shadow-inner">
                            {silentAddress || 'Generating Sovereign Payload...'}
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
                        <p className="text-[10px] font-mono text-brand-earth break-all">{scanPub}</p>
                    </div>
                    <div className="bg-white border border-border p-6 rounded-2xl space-y-3">
                        <p className="text-[9px] font-black text-brand-earth uppercase tracking-widest">Spend Public Key</p>
                        <p className="text-[10px] font-mono text-brand-earth break-all">{spendPub}</p>
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
                <p className="text-[10px] text-brand-earth leading-relaxed italic">Your enclave automatically scans every block for payments matching your keys.</p>
            </div>
            <button className="mt-6 flex items-center gap-2 text-accent-earth text-[10px] font-black uppercase tracking-widest hover:gap-4 transition-all">
                View Scanned Transactions <ChevronRight size={14} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default SilentPayments;
