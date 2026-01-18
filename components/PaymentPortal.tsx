
import React, { useState, useEffect, useContext } from 'react';
import { Send, CreditCard, Zap, Globe, Smartphone, QrCode, ArrowRight, ShieldCheck, Loader2, CheckCircle2, Search, User, TrendingDown, Info, Sparkles, ShieldAlert, X, DollarSign } from 'lucide-react';
import { AppContext } from '../context';

const PaymentPortal: React.FC = () => {
  const context = useContext(AppContext);
  const [method, setMethod] = useState<'lightning' | 'onchain' | 'onramp'>('lightning');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSmartRouting, setIsSmartRouting] = useState(true);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setRecipient('');
        setAmount('');
      }, 3000);
    }, 2000);
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
              <button onClick={() => setMethod('lightning')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'lightning' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-600 hover:text-zinc-400'}`}><Zap size={14} /> Lightning</button>
              <button onClick={() => setMethod('onchain')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'onchain' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-600 hover:text-zinc-400'}`}><Globe size={14} /> On-chain</button>
              <button onClick={() => setMethod('onramp')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${method === 'onramp' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-600 hover:text-zinc-400'}`}><Smartphone size={14} /> Fiat</button>
            </div>

            <div className="space-y-6">
              {method !== 'onramp' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 flex justify-between">Recipient <button className="text-orange-500 hover:text-orange-400 flex items-center gap-1 font-black"><QrCode size={12} /> Scan QR</button></label>
                    <div className="relative">
                      <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={method === 'lightning' ? 'Invoice or lnurl...' : 'bc1q... or handle.btc'} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-5 pl-5 pr-12 font-mono text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50 transition-all" />
                      <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700" size={18} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 ml-1">Amount (BTC)</label>
                    <div className="relative">
                      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-6 px-6 text-4xl font-black text-zinc-100 focus:outline-none focus:border-orange-500/50 transition-all font-mono tracking-tighter" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-zinc-950/50 border border-zinc-900 rounded-[2rem] p-8 text-center space-y-6">
                     <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-2xl">
                        <CreditCard className="text-zinc-950" size={32} />
                     </div>
                     <div>
                        <h4 className="text-xl font-bold text-zinc-100">Google Pay Gateway</h4>
                        <p className="text-xs text-zinc-500 mt-1 italic leading-relaxed">Fast BTC on-ramping via your linked accounts. Note: Breaks Tor-Routing privacy.</p>
                     </div>
                     <div className="relative">
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-5 px-6 text-2xl font-black text-white focus:outline-none text-center" />
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
                    <button onClick={() => setIsSmartRouting(!isSmartRouting)} className={`w-10 h-5 rounded-full transition-colors relative ${isSmartRouting ? 'bg-orange-600' : 'bg-zinc-800'}`}>
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

              <button 
                onClick={method === 'onramp' ? handleOnrampInitiate : handleSend}
                disabled={isSending || !amount || (method !== 'onramp' && !recipient) || showSuccess}
                className={`w-full font-black py-5 rounded-[2rem] text-xs uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 ${
                  showSuccess ? 'bg-green-600 text-white' : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/30'
                }`}
              >
                {isSending ? <Loader2 size={20} className="animate-spin" /> : showSuccess ? <CheckCircle2 size={20} /> : <Send size={20} />}
                {isSending ? 'Routing...' : showSuccess ? 'Success' : method === 'onramp' ? 'Buy via Google Pay' : 'Execute Transfer'}
              </button>
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
                <button key={i} onClick={() => {setRecipient(contact.address); setMethod('lightning');}} className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-950/50 border border-zinc-900 hover:border-orange-500/30 transition-all group">
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
                  ? "Integrating with Google Pay sends your PII and financial metadata to Google's centralized servers. This action is recorded off-chain."
                  : "Sending via Lightning or Rootstock maintains end-to-end encryption and Tor-level network obfuscation."}
             </p>
             {method !== 'onramp' && (
               <button className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[8px] font-black uppercase text-zinc-500 tracking-widest transition-all">Invite Friend to Enclave</button>
             )}
          </div>
        </div>
      </div>

      {/* Sovereign Warning Modal */}
      {showPrivacyWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[3rem] p-10 space-y-8 relative shadow-[0_0_100px_rgba(249,115,22,0.1)]">
              <button onClick={() => setShowPrivacyWarning(false)} className="absolute top-8 right-8 text-zinc-700 hover:text-zinc-300 transition-colors">
                <X size={24} />
              </button>
              <div className="text-center space-y-4">
                 <div className="w-20 h-20 bg-orange-600/10 border border-orange-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-orange-500 shadow-inner">
                    <ShieldAlert size={40} />
                 </div>
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Sovereignty Risk Detected</h3>
                 <p className="text-xs text-zinc-400 leading-relaxed italic">
                    By enabling the **Google Pay Gateway**, you are bridging your sovereign enclave to the legacy financial system. 
                 </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Privacy Penalty: -15 Points</span>
                 </div>
                 <p className="text-[10px] text-zinc-600 italic">
                    Google will receive your wallet metadata, transaction amounts, and IP signature during the checkout process.
                 </p>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                  onClick={confirmGateway}
                  className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-black py-5 rounded-[2rem] text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-2xl"
                 >
                    I Accept the Trade-off
                 </button>
                 <button 
                  onClick={() => setShowPrivacyWarning(false)}
                  className="w-full py-4 text-zinc-600 hover:text-zinc-300 font-black text-[10px] uppercase tracking-widest transition-all"
                 >
                    Stay Native Only
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PaymentPortal;
