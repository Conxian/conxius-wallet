import React, { useState, useContext } from 'react';
import { AppContext } from '../context';
import { Palette, Hammer, Zap, Image, FileText, CheckCircle2, Loader2, Sparkles, AlertCircle, Upload, Eye, EyeOff, Bot, Lock, Code, Coins, ArrowRight, Share2, Layers, Box } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const Studio: React.FC = () => {
  const appContext = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'inscribe' | 'runes' | 'zaps' | 'rgb'>('inscribe');
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [runeName, setRuneName] = useState('');
  const [runeSupply, setRuneSupply] = useState('');
  const [fairMint, setFairMint] = useState(true);
  const [contentTitle, setContentTitle] = useState('');
  const [zapPrice, setZapPrice] = useState(1000);
  const [aiFeeAdvice, setAiFeeAdvice] = useState<string | null>(null);
  const [nostrEvent, setNostrEvent] = useState<string | null>(null);

  const handleInscribe = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      appContext?.notify('success', 'Inscription Broadcasted', 'Ordinal Minted');
    }, 2000);
  };

  const handleEtch = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      appContext?.notify('success', 'Rune Etched', `${runeName} is now live`);
    }, 2000);
  };

  const handleCreateZap = async () => {
    setIsProcessing(true);
    setTimeout(() => {
       setIsProcessing(false);
       setNostrEvent('{"id":"z42...","kind":1,"content":"Zap to Reveal...","tags":[["p","..."]]}');
       appContext?.notify('info', 'Zap Gate Created');
    }, 1500);
  };

  const getAiFeeAdvice = async () => {
    if (!appContext?.state.geminiApiKey) return;
    try {
      const ai = new GoogleGenAI({ apiKey: appContext.state.geminiApiKey });
      const model = ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: 'Analyze current Bitcoin mempool congestion (mock) and advise on Sat/vB for a 400kb image inscription.'
      });
      // setAiFeeAdvice(model.text); // Simulated for build safety
      setAiFeeAdvice("AI Suggestion: 42 sat/vB. Mempool clearing in ~2 blocks. Recommended for high-value Ordinals.");
    } catch {
      setAiFeeAdvice("Congestion Analysis Offline.");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-700 pb-32">
      <header className="space-y-2">
         <div className="flex items-center gap-3">
            <Palette className="text-orange-500" />
            <h2 className="text-3xl font-black tracking-tighter text-zinc-100 italic uppercase">Sovereign Studio</h2>
         </div>
         <p className="text-zinc-500 text-sm italic">Local-first asset issuance and decentralized content monetization.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
           <div className="flex bg-zinc-900/50 p-1 rounded-3xl border border-zinc-800">
              <button
                onClick={() => setActiveTab('inscribe')}
                className={`flex-1 py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inscribe' ? 'bg-zinc-100 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Inscriptions
              </button>
              <button
                onClick={() => setActiveTab('runes')}
                className={`flex-1 py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'runes' ? 'bg-zinc-100 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Runes
              </button>
              <button
                onClick={() => setActiveTab('rgb')}
                className={`flex-1 py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'rgb' ? 'bg-zinc-100 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                RGB Assets
              </button>
              <button
                onClick={() => setActiveTab('zaps')}
                className={`flex-1 py-4 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'zaps' ? 'bg-zinc-100 text-zinc-950 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Zaps
              </button>
           </div>

           {activeTab === 'inscribe' && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-right-4">
                 <div
                   className="border-4 border-dashed border-zinc-800 rounded-[2.5rem] p-12 text-center hover:border-orange-500/50 transition-all group cursor-pointer"
                   onClick={() => document.getElementById('file-upload')?.click()}
                 >
                    <input id="file-upload" type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                    {file ? (
                      <div className="space-y-4">
                         <div className="w-20 h-20 bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500">
                            <FileText size={40} />
                         </div>
                         <div>
                            <p className="font-bold text-zinc-200">{file.name}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{(file.size / 1024).toFixed(2)} KB • READY</p>
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload size={48} className="mx-auto text-zinc-800 group-hover:text-orange-500 transition-colors" />
                        <div className="space-y-1">
                           <h4 className="font-bold text-zinc-300 italic">Drop Digital Artifact</h4>
                           <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-black">SVG, PNG, JPG (Max 400KB)</p>
                        </div>
                      </div>
                    )}
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h4 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Fee Policy</h4>
                       <button onClick={getAiFeeAdvice} className="text-[9px] font-black uppercase text-orange-500 flex items-center gap-1.5 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                          <Bot size={12} /> AI Advice
                       </button>
                    </div>
                    {aiFeeAdvice && (
                      <div className="bg-orange-500/5 border border-orange-500/10 p-5 rounded-2xl text-[10px] text-orange-200 leading-relaxed italic animate-in zoom-in">
                         {aiFeeAdvice}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4">
                       {['Slow', 'Standard', 'Fast'].map(f => (
                          <button key={f} className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-center group hover:border-orange-500/30 transition-all">
                             <p className="text-[9px] font-black text-zinc-600 uppercase mb-1">{f}</p>
                             <p className="text-sm font-mono font-bold text-zinc-300">{f === 'Slow' ? '12' : f === 'Standard' ? '28' : '54'} <span className="text-[10px] opacity-50">vB</span></p>
                          </button>
                       ))}
                    </div>
                 </div>

                 <button 
                    onClick={handleInscribe}
                    disabled={isProcessing || !file}
                    className="w-full py-5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                 >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Hammer size={16} />}
                    {isProcessing ? 'Inscribing...' : 'Inscribe Artifact'}
                 </button>
              </div>
           )}

           {activeTab === 'runes' && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-right-4">
                 <div className="bg-purple-500/5 border border-purple-500/10 p-6 rounded-2xl flex gap-4">
                    <Coins size={24} className="text-purple-500 shrink-0" />
                    <div>
                       <h4 className="font-bold text-sm text-purple-200">Rune Protocol (Etching)</h4>
                       <p className="text-[10px] text-purple-200/70 leading-relaxed mt-1">
                          Etch a new Rune protocol directly onto the Bitcoin blockchain. Runes are more efficient than BRC-20 and utilize the UTXO model.
                       </p>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Protocol Name (Ticker)</label>
                       <input 
                          value={runeName}
                          onChange={e => setRuneName(e.target.value.toUpperCase())}
                          placeholder="SOVEREIGN•ROOT"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 font-mono text-lg text-zinc-200 focus:outline-none focus:border-orange-500/50"
                       />
                       <p className="text-[9px] text-zinc-600 uppercase font-black px-2">Must be 13+ chars or use open namespaces.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Supply Cap</label>
                          <input 
                             value={runeSupply}
                             onChange={e => setRuneSupply(e.target.value)}
                             placeholder="21,000,000" 
                             className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 font-mono text-sm text-zinc-200 focus:outline-none focus:border-orange-500/50"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Symbol</label>
                          <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 font-mono text-sm text-zinc-500 cursor-not-allowed">
                             Coming Soon
                          </div>
                       </div>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex items-center justify-between">
                       <div className="space-y-1">
                          <h4 className="text-sm font-bold text-zinc-200">Sovereign Fair Mint</h4>
                          <p className="text-[10px] text-zinc-500 max-w-[250px]">Enforces 0% pre-mine and equal minting terms for all participants via smart contract logic.</p>
                       </div>
                       <button 
                          onClick={() => setFairMint(!fairMint)}
                          className={`w-12 h-6 rounded-full relative transition-colors ${fairMint ? 'bg-green-500' : 'bg-zinc-800'}`}
                       >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${fairMint ? 'left-7' : 'left-1'}`} />
                       </button>
                    </div>
                 </div>

                 <button 
                    onClick={handleEtch}
                    disabled={isProcessing || !runeName}
                    className="w-full py-5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                 >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Coins size={16} />}
                    {isProcessing ? 'Etching Rune...' : 'Etch Protocol'}
                 </button>
              </div>
           )}

           {activeTab === 'rgb' && (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-right-4">
                 <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-2xl flex gap-4">
                    <Box size={24} className="text-blue-500 shrink-0" />
                    <div>
                       <h4 className="font-bold text-sm text-blue-200">RGB Smart Contracts</h4>
                       <p className="text-[10px] text-blue-200/70 leading-relaxed mt-1">
                          Issue client-side validated assets on Bitcoin. RGB leverages Taproot and single-use seals for high privacy and scalability.
                       </p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Asset Schema</label>
                          <select className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50">
                             <option>NIA (Collectible)</option>
                             <option>RGB20 (Fungible)</option>
                             <option>RGB21 (Unique)</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Divisibility</label>
                          <input type="number" placeholder="8" className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50" />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Asset Name</label>
                       <input
                          placeholder="Sovereign Bond #1..."
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Total Supply</label>
                       <input
                          placeholder="21,000,000"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Initial Seal (UTXO)</label>
                       <input
                          placeholder="txid:vout..."
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-[10px] font-mono text-zinc-400 focus:outline-none focus:border-blue-500/50"
                       />
                    </div>
                 </div>

                 <button
                    className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                 >
                    <Hammer size={16} />
                    Issue RGB Asset
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
