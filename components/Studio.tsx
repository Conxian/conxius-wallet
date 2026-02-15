import React, { useState } from 'react';
import {
  Hammer,
  Layers,
  Zap,
  Code,
  Lock,
  Share2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu
} from 'lucide-react';
import { useContext } from 'react';
import { AppContext } from '../context';
import { issueRgbAsset } from '../services/rgb';

const Studio: React.FC = () => {
  const appContext = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'ordinals' | 'runes' | 'rgb' | 'zaps'>('ordinals');
  const [isProcessing, setIsProcessing] = useState(false);

  // Nostr Zap State
  const [contentTitle, setContentTitle] = useState('');
  const [zapPrice, setZapPrice] = useState(1000);
  const [nostrEvent, setNostrEvent] = useState<string | null>(null);

  // RGB State
  const [rgbName, setRgbName] = useState('');
  const [rgbSymbol, setRgbSymbol] = useState('');
  const [rgbSupply, setRgbSupply] = useState('21000000');
  const [rgbSchema, setRgbSchema] = useState<'NIA' | 'RGB20' | 'RGB21'>('RGB20');
  const [rgbPrecision, setRgbPrecision] = useState(8);
  const [rgbSeal, setRgbSeal] = useState('');

  const handleCreateZap = async () => {
    setIsProcessing(true);
    // Simulate encryption & event creation
    setTimeout(() => {
      setNostrEvent('nve1...7v8p9q');
      setIsProcessing(false);
      appContext!.notify('success', 'Zap Gate Created');
    }, 2000);
  };

  const handleIssueRgb = async () => {
    if (!rgbName || !rgbSymbol || !rgbSeal) {
        appContext!.notify('error', 'Please fill all RGB fields');
        return;
    }
    setIsProcessing(true);
    try {
        await issueRgbAsset(
            rgbName,
            rgbSymbol,
            parseInt(rgbSupply),
            rgbPrecision,
            rgbSchema,
            rgbSeal
        );
        appContext!.notify('success', `RGB Asset ${rgbSymbol} Issued!`);
        // Reset form
        setRgbName('');
        setRgbSymbol('');
        setRgbSeal('');
    } catch (e: any) {
        appContext!.notify('error', e.message || 'RGB Issuance Failed');
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
           <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <Hammer size={14} className="text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Creator Hub</span>
           </div>
           <h2 className="text-5xl lg:text-7xl font-black italic uppercase tracking-tighter text-white">Asset Studio</h2>
        </div>

        <div className="flex bg-zinc-900/50 p-1.5 rounded-3xl border border-zinc-800 backdrop-blur-xl">
           {(['ordinals', 'runes', 'rgb', 'zaps'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-black shadow-xl scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {tab}
              </button>
           ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-8">

           {activeTab === 'ordinals' && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-10 shadow-2xl animate-in slide-in-from-left-4">
                 <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <h3 className="text-2xl font-black italic uppercase tracking-tight text-zinc-100">Inscribe Data</h3>
                       <p className="text-xs text-zinc-500 leading-relaxed">
                          Directly inscribe images, text, or HTML into the Bitcoin blockchain. Conxius uses Taproot to minimize fees and maximize sovereignty.
                       </p>
                       <div className="border-2 border-dashed border-zinc-800 rounded-3xl p-12 text-center hover:border-zinc-700 transition-all group cursor-pointer">
                          <Layers size={48} className="mx-auto mb-4 text-zinc-700 group-hover:text-blue-500 transition-colors" />
                          <p className="text-xs font-bold text-zinc-500">Drop file to Inscribe</p>
                       </div>
                    </div>
                    <div className="bg-zinc-950 rounded-[2.5rem] border border-zinc-900 p-8 space-y-6">
                       <h4 className="font-bold text-sm text-zinc-400">Inscription Params</h4>
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-600 uppercase ml-2">Postage (Sats)</label>
                             <input placeholder="546" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-zinc-600 uppercase ml-2">Fee Rate (sat/vB)</label>
                             <div className="flex gap-2">
                                {[1, 12, 45].map(rate => (
                                   <button key={rate} className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-bold text-zinc-500 hover:border-zinc-600">{rate}</button>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
                 <button className="w-full py-6 bg-white hover:bg-zinc-200 text-black font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]">
                    <Hammer size={18} />
                    Inscribe to Taproot
                 </button>
              </div>
           )}

           {activeTab === 'runes' && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-left-4">
                 <div className="flex items-center gap-4 bg-zinc-950 p-6 rounded-3xl border border-zinc-900">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500"><Layers size={24} /></div>
                    <div>
                       <h4 className="font-bold text-zinc-200">Etch a New Rune</h4>
                       <p className="text-[10px] text-zinc-500">Create a highly-efficient fungible token using the Runes protocol.</p>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Rune Name</label>
                       <input placeholder="SOVEREIGN•TOKEN" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Symbol</label>
                       <input placeholder="ᛤ" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Premine Amount</label>
                    <input placeholder="1,000,000" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50" />
                 </div>

                 <button className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]">
                    <Hammer size={16} />
                    Etch Rune
                 </button>
              </div>
           )}

           {activeTab === 'rgb' && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-left-4">
                 <div className="flex items-center gap-4 bg-zinc-950 p-6 rounded-3xl border border-zinc-900">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500"><Cpu size={24} /></div>
                    <div>
                       <h4 className="font-bold text-zinc-200">Issue RGB Asset</h4>
                       <p className="text-[10px] text-zinc-500">Client-side validated assets with absolute privacy and scalability.</p>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Asset Schema</label>
                          <select
                            value={rgbSchema}
                            onChange={e => setRgbSchema(e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                          >
                             <option value="NIA">NIA (Collectible)</option>
                             <option value="RGB20">RGB20 (Fungible)</option>
                             <option value="RGB21">RGB21 (Unique)</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Divisibility</label>
                          <input
                            type="number"
                            value={rgbPrecision}
                            onChange={e => setRgbPrecision(parseInt(e.target.value))}
                            placeholder="8"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                          />
                       </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Asset Name</label>
                            <input
                                value={rgbName}
                                onChange={e => setRgbName(e.target.value)}
                                placeholder="Sovereign Bond #1..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Asset Symbol</label>
                            <input
                                value={rgbSymbol}
                                onChange={e => setRgbSymbol(e.target.value)}
                                placeholder="SBOND"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Total Supply</label>
                       <input
                          value={rgbSupply}
                          onChange={e => setRgbSupply(e.target.value)}
                          placeholder="21,000,000"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Initial Seal (UTXO)</label>
                       <input
                          value={rgbSeal}
                          onChange={e => setRgbSeal(e.target.value)}
                          placeholder="txid:vout..."
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-[10px] font-mono text-zinc-400 focus:outline-none focus:border-blue-500/50"
                       />
                    </div>
                 </div>

                 <button
                    onClick={handleIssueRgb}
                    disabled={isProcessing}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                 >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Hammer size={16} />}
                    {isProcessing ? 'Contracting...' : 'Issue RGB Asset'}
                 </button>
              </div>
           )}

           {activeTab === 'zaps' && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-left-4">
                 <div className="bg-orange-500/5 border border-orange-500/10 p-6 rounded-2xl flex gap-4">
                    <Zap size={24} className="text-orange-500 shrink-0" />
                    <div>
                       <h4 className="font-bold text-sm text-orange-200">Zap to Reveal</h4>
                       <p className="text-[10px] text-orange-200/70 leading-relaxed mt-1">
                          Monetize content directly on Nostr. Files are locally encrypted and the key is released only upon Lightning payment confirmation.
                       </p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Content Title</label>
                       <input 
                          value={contentTitle}
                          onChange={e => setContentTitle(e.target.value)}
                          placeholder="Exclusive Alpha Report #42..." 
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50"
                       />
                    </div>
                    
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Unlock Price (Sats)</label>
                       <div className="relative">
                          <input 
                             type="number"
                             value={zapPrice}
                             onChange={e => setZapPrice(parseInt(e.target.value))}
                             className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 font-mono text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50"
                          />
                          <Zap className="absolute right-6 top-1/2 -translate-y-1/2 text-orange-500" size={16} />
                       </div>
                    </div>

                    <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center hover:border-zinc-700 transition-all">
                       <Lock size={32} className="mx-auto mb-2 text-zinc-700" />
                       <p className="text-xs text-zinc-500">Drag & Drop file to Encrypt</p>
                    </div>
                 </div>

                 {nostrEvent ? (
                    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-900 animate-in zoom-in">
                       <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black uppercase text-green-500">Event Ready</span>
                          <button className="text-zinc-500 hover:text-white"><Share2 size={16} /></button>
                       </div>
                       <p className="text-[10px] font-mono text-zinc-600 break-all bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                          {nostrEvent}
                       </p>
                       <button className="w-full mt-4 py-3 bg-purple-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all">
                          Broadcast to Relays
                       </button>
                    </div>
                 ) : (
                    <button 
                       onClick={handleCreateZap}
                       disabled={isProcessing}
                       className="w-full py-5 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                       {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Code size={16} />}
                       {isProcessing ? 'Encrypting & Signing...' : 'Generate Zap Gate'}
                    </button>
                 )}
              </div>
           )}

        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-4 space-y-8">
           
           <div className="bg-orange-600 border border-orange-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-2xl shadow-orange-600/30">
              <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
                 <Layers size={100} />
              </div>
              <div className="relative z-10">
                 <h4 className="text-xl font-black italic uppercase tracking-tighter mb-4">Creator Sovereignty</h4>
                 <p className="text-xs font-medium leading-relaxed opacity-90 mb-6">
                    By inscribing directly from your node, you bypass platforms like Gamma or Unisat. You own the provenance, the UTXO, and the keys.
                 </p>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-bold opacity-80">
                       <CheckCircle2 size={14} /> No Platform Fees
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold opacity-80">
                       <CheckCircle2 size={14} /> Censorship Resistant
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold opacity-80">
                       <CheckCircle2 size={14} /> Parent/Child Provenance
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
              <h4 className="font-bold text-sm text-zinc-400 flex items-center gap-2">
                 <AlertCircle size={18} className="text-yellow-500" />
                 Studio Stats
              </h4>
              <div className="space-y-4">
                 <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                    <span className="text-[10px] font-black uppercase text-zinc-600">Total Inscribed</span>
                    <span className="text-xs font-bold text-zinc-200">142 items</span>
                 </div>
                 <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                    <span className="text-[10px] font-black uppercase text-zinc-600">Total Fees Saved</span>
                    <span className="text-xs font-mono font-bold text-green-500">0.012 BTC</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-600">Rune Tickers</span>
                    <span className="text-xs font-bold text-zinc-200">2 Active</span>
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default Studio;
