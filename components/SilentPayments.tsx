
import React, { useState, useContext, useCallback } from 'react';
import { Shield, Eye, EyeOff, Copy, QrCode, Send, RefreshCw, Loader2, Info, CheckCircle2, Search, ExternalLink, Ghost, Wallet, AlertTriangle, KeyRound } from 'lucide-react';
import { AppContext } from '../context';
import { deriveSilentPaymentKeys, encodeSilentPaymentAddress } from '../services/silent-payments';
import { decryptSeed } from '../services/seed';
import { Buffer } from 'buffer';

const SilentPayments: React.FC = () => {
  const context = useContext(AppContext);
  const [showAddress, setShowAddress] = useState(false);
  const [spAddress, setSpAddress] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [amount, setAmount] = useState('');
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const handleUnlock = useCallback(async () => {
    if (!context?.state.walletConfig?.seedVault && !context?.state.walletConfig?.mnemonicVault) {
      setPinError('No wallet vault found.');
      return;
    }
    setIsDecrypting(true);
    setPinError(null);
    let seedBytes: Uint8Array | null = null;
    try {
      const vault = context.state.walletConfig.seedVault || context.state.walletConfig.mnemonicVault!;
      seedBytes = await decryptSeed(vault, pin);
      const seedBuffer = Buffer.from(seedBytes);
      const keys = deriveSilentPaymentKeys(seedBuffer);
      const addr = encodeSilentPaymentAddress(keys.scanPub, keys.spendPub);
      setSpAddress(addr);
      setIsUnlocked(true);
      setPin('');
      // Memory Hardening: Wipe key material
      seedBuffer.fill(0);
      keys.scanKey.fill(0);
      keys.spendKey.fill(0);
    } catch {
      setPinError('Invalid Enclave PIN. Please try again.');
    } finally {
      if (seedBytes) seedBytes.fill(0);
      setIsDecrypting(false);
    }
  }, [context, pin]);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
        setIsScanning(false);
        // Mock finding a payment
        setScanResults([{
            id: 'sp-tx-01',
            amount: 50000,
            date: 'Just now',
            status: 'Confirmed'
        }]);
        context?.notify('success', 'Silent Payment Discovered', 'Privacy Enclave Alert');
    }, 3000);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] p-8 shadow-2xl space-y-10 animate-in slide-in-from-bottom-4 duration-500">
      {/* Experimental Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
        <div>
          <p className="text-xs font-bold text-amber-200">EXPERIMENTAL — BIP-352 Sending Logic Incomplete</p>
          <p className="text-[10px] text-zinc-500 mt-1">Address derivation uses your real vault seed. Sending is not yet functional — UTXO scanning and output tweaking are placeholders.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-zinc-900 pb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-zinc-100 flex items-center gap-3 italic uppercase">
            <Ghost className="text-purple-500" />
            Silent Payments (BIP-352)
          </h2>
          <p className="text-zinc-500 text-sm italic mt-2">
             Privacy-preserving Bitcoin transfers without address reuse.
          </p>
        </div>
        <div className={`${isUnlocked ? 'bg-purple-500/10 border-purple-500/20' : 'bg-zinc-900/50 border-zinc-800'} border px-6 py-4 rounded-2xl flex items-center gap-4`}>
            {isUnlocked ? <Shield className="text-purple-500" size={24} /> : <KeyRound className="text-zinc-600" size={24} />}
            <div>
                <p className="text-[10px] font-black uppercase text-zinc-500">Enclave Status</p>
                <p className="text-sm font-bold text-zinc-200">{isUnlocked ? 'Keys Derived' : 'Locked'}</p>
            </div>
        </div>
      </div>

      {/* PIN Unlock Gate */}
      {!isUnlocked && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-6 max-w-md mx-auto">
          <div className="text-center space-y-2">
            <KeyRound className="mx-auto text-purple-500" size={32} />
            <h3 className="text-lg font-bold text-zinc-200">Unlock Silent Payment Keys</h3>
            <p className="text-xs text-zinc-500">Enter your Enclave PIN to derive BIP-352 keys from your vault seed.</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && pin.length > 0) handleUnlock(); }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              placeholder="Enclave PIN"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 font-mono text-sm text-zinc-200 focus:outline-none focus:border-purple-500/50 text-center tracking-[0.5em]"
            />
            {pinError && (
              <p className="text-xs text-red-400 text-center">{pinError}</p>
            )}
            <button
              onClick={handleUnlock}
              disabled={isDecrypting || pin.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all"
            >
              {isDecrypting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              {isDecrypting ? 'Decrypting Vault...' : 'Derive SP Keys'}
            </button>
          </div>
        </div>
      )}

      {isUnlocked && <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Receiving Section */}
        <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-6">
                <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                    <QrCode size={20} className="text-purple-500" />
                    Your Static Address
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    Share this address with anyone. Each payment they send will arrive at a **unique, one-time Taproot output** that only your enclave can discover.
                </p>

                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 break-all font-mono text-xs text-zinc-400 relative group">
                    {showAddress ? (spAddress || 'sp1q...') : 'sp1q••••••••••••••••••••••••••••••••••••'}
                    <div className="absolute top-2 right-2 flex gap-2">
                        <button onClick={() => setShowAddress(!showAddress)} className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white">
                            {showAddress ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white">
                            <Copy size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex justify-center py-4">
                    <div className="bg-white p-4 rounded-3xl w-40 h-40 flex items-center justify-center">
                        <QrCode size={120} className="text-zinc-950" />
                    </div>
                </div>
            </div>

            <div className="bg-purple-900/10 border border-purple-500/20 rounded-3xl p-6 flex items-start gap-4">
                <Info size={20} className="text-purple-500 shrink-0 mt-1" />
                <div className="space-y-1">
                    <h4 className="text-xs font-bold text-purple-200 uppercase tracking-widest">How it works</h4>
                    <p className="text-[10px] text-zinc-500 italic leading-relaxed">
                        Silent payments use Diffie-Hellman key exchange between your scanning key and the sender's UTXOs. This eliminates "address clustering" and breaks common chain analysis heuristics.
                    </p>
                </div>
            </div>
        </div>

        {/* Sending & Activity Section */}
        <div className="space-y-8">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-6">
                <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                    <Send size={20} className="text-orange-500" />
                    Private Send
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600">Recipient SP Address</label>
                        <input
                            type="text"
                            value={sendTo}
                            onChange={(e) => setSendTo(e.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            placeholder="sp1q..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 font-mono text-xs text-zinc-200 focus:outline-none focus:border-purple-500/50"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600">Amount (Sats)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 font-mono text-xl font-bold text-zinc-100 focus:outline-none focus:border-orange-500/50"
                        />
                    </div>
                    <button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all">
                        <Ghost size={16} /> Send Privately
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                        <Search size={14} /> Discovery Logs
                    </h3>
                    <button onClick={handleScan} disabled={isScanning} className="text-[9px] font-black uppercase text-purple-500 hover:text-purple-400 flex items-center gap-2">
                        {isScanning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Scan for payments
                    </button>
                </div>

                <div className="space-y-2">
                    {scanResults.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-3xl opacity-30 italic text-xs">
                            No silent payments discovered in local scan range.
                        </div>
                    ) : (
                        scanResults.map((res) => (
                            <div key={res.id} className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center group hover:border-purple-500/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 border border-purple-500/20">
                                        <Wallet size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-zinc-200">{res.amount.toLocaleString()} sats</p>
                                        <p className="text-[10px] text-zinc-600">{res.date} • {res.status}</p>
                                    </div>
                                </div>
                                <ExternalLink size={14} className="text-zinc-700 group-hover:text-zinc-400" />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>}
    </div>
  );
};

export default SilentPayments;
