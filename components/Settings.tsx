import React, { useState, useContext } from 'react';
import { Settings as SettingsIcon, Globe, Moon, Sun, DollarSign, Bell, Shield, Info, Database, Eye, Crown, Zap, CheckCircle2, RotateCcw, Languages, MapPin, Lock, Briefcase, Bot, Cpu, Link, Share2 } from 'lucide-react';
import { AppContext } from '../context';
import { Language } from '../services/i18n';
import { Network } from '../types';

const Settings: React.FC = () => {
  const appContext = useContext(AppContext);
  const [currency, setCurrency] = useState('USD');
  const [activeTab, setActiveTab] = useState('general');

  if (!appContext) return null;
  const { mode, network, theme, language, aiConfig } = appContext.state;

  const languages: { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'sw', name: 'Swahili' },
    { code: 'zh', name: 'Mandarin' }
  ];
  const currencies = ['USD', 'EUR', 'GBP', 'ZAR', 'BTC', 'SATS'];

  const handleAiUpdate = (field: string, value: string) => {
      appContext.setAiConfig({
          ...(aiConfig || { provider: 'Gemini' }),
          [field]: value
      } as any);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
      <header className="space-y-2">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">System Configuration</h2>
        <p className="text-brand-earth text-sm font-medium">Manage your sovereign environment and enclave persistence.</p>
      </header>

      <div className="flex bg-off-white/50 p-1.5 rounded-[2rem] border border-border mb-8 sticky top-4 z-50 backdrop-blur-md">
        {[
          { id: 'general', icon: Globe, label: 'Environment' },
          { id: 'security', icon: Shield, label: 'Enclave' },
          { id: 'nodes', icon: Database, label: 'Protocols' },
          { id: 'ai', icon: Bot, label: 'AI Hook (BYOS)' },
          { id: 'nwc', icon: Share2, label: 'Wallet Connect' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-accent-earth text-white shadow-lg' : 'text-brand-earth hover:text-brand-deep'
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-10">
        {activeTab === 'general' && (
          <section className="bg-off-white/40 border border-border rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="p-8 border-b border-border bg-off-white/20 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                <Globe size={16} className="text-accent-earth" /> Network & Regional
              </h3>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-brand-earth flex items-center gap-2">
                    App Mode
                  </label>
                  <div className="flex bg-white border border-border p-1 rounded-2xl">
                    {[
                      { id: 'sovereign', label: 'Production' },
                      { id: 'simulation', label: 'Shop Demo' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => appContext.setMode(opt.id as any)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          mode === opt.id ? 'bg-green-600 text-white shadow-lg' : 'text-brand-earth hover:text-brand-earth'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-brand-earth flex items-center gap-2">
                    Active Network
                  </label>
                  <select
                    value={network}
                    onChange={(e) => appContext.setNetwork(e.target.value as Network)}
                    className="w-full bg-white border border-border rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-600/50"
                  >
                    <option value="mainnet">Mainnet (Production)</option>
                    <option value="testnet">Testnet (Public)</option>
                    <option value="regtest">Regtest (Local)</option>
                    <option value="devnet">Devnet (Experimental)</option>
                  </select>
                </div>
            </div>
          </section>
        )}

        {activeTab === 'security' && (
           <section className="bg-off-white/40 border border-border rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
              <div className="p-8 border-b border-border bg-off-white/20">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                  <Shield size={16} className="text-accent-earth" /> Enclave Persistence
                </h3>
              </div>
              <div className="p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-brand-earth">Auto-Lock (Min)</label>
                       <input
                         type="number"
                         value={appContext.state.security?.autoLockMinutes ?? 5}
                         onChange={e => appContext.setSecurity({ autoLockMinutes: parseInt(e.target.value) })}
                         className="w-full bg-white border border-border rounded-2xl px-5 py-4 text-sm focus:outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-brand-earth">Duress PIN</label>
                       <input
                         type="password"
                         value={appContext.state.security?.duressPin ?? ''}
                         onChange={e => appContext.setSecurity({ duressPin: e.target.value })}
                         className="w-full bg-white border border-border rounded-2xl px-5 py-4 text-sm focus:outline-none"
                         placeholder="Decoy wallet trigger"
                       />
                    </div>
                 </div>
                 <button onClick={appContext.resetEnclave} className="w-full py-4 bg-red-600/10 border border-red-500/20 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
                    Wipe Sovereign Enclave (Purge All Keys)
                 </button>
              </div>
           </section>
        )}

        {activeTab === 'ai' && (
          <section className="bg-off-white/40 border border-border rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="p-8 border-b border-border bg-off-white/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Bot size={20} className="text-accent-earth" />
                 <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-deep">AI Hook (BYOS)</h3>
                    <p className="text-[9px] text-brand-earth font-bold uppercase mt-0.5">Bring Your Own Service</p>
                 </div>
              </div>
              <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                 <Shield size={10} className="text-green-500" />
                 <span className="text-[8px] text-green-500 font-black uppercase tracking-widest italic">Sovereign-Audit Active</span>
              </div>
            </div>

            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Gemini', 'OpenAI', 'Anthropic', 'Custom'].map(p => (
                   <button
                    key={p}
                    onClick={() => handleAiUpdate('provider', p)}
                    className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                      (aiConfig?.provider || 'Gemini') === p
                        ? 'bg-accent-earth border-orange-500 text-white shadow-xl'
                        : 'bg-white border-border text-brand-earth hover:border-brand-earth'
                    }`}
                   >
                     {p}
                   </button>
                ))}
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-brand-earth ml-1">API Key (Enclave-Encrypted)</label>
                    <div className="relative">
                       <input
                         type="password"
                         value={aiConfig?.apiKey || ''}
                         onChange={e => handleAiUpdate('apiKey', e.target.value)}
                         placeholder="sk-XXXX"
                         className="w-full bg-white border border-border rounded-2xl px-12 py-5 text-sm font-mono text-brand-deep focus:outline-none focus:border-orange-500/50"
                       />
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-earth" size={18} />
                    </div>
                 </div>

                 {aiConfig?.provider === 'Custom' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                       <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Custom Endpoint Hook</label>
                       <div className="relative">
                          <input
                            value={aiConfig?.endpoint || ''}
                            onChange={e => handleAiUpdate('endpoint', e.target.value)}
                            placeholder="https://your-sovereign-ai.local/v1/chat"
                            className="w-full bg-white border border-border rounded-2xl px-12 py-5 text-sm font-mono text-brand-deep focus:outline-none focus:border-orange-500/50"
                          />
                          <Link className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-earth" size={18} />
                       </div>
                       <p className="text-[10px] text-brand-earth italic px-2">Supports OpenAI-compatible chat completion endpoints.</p>
                    </div>
                 )}
              </div>

              <div className="bg-orange-500/5 border border-orange-500/10 p-6 rounded-[2rem] flex gap-4">
                 <Shield className="text-accent-earth shrink-0" size={20} />
                 <p className="text-[10px] text-orange-200/70 leading-relaxed italic">
                    <span className="font-black text-orange-400 uppercase mr-1">Privacy Notice:</span>
                    Even with BYOS, all prompts are passed through the Conxius Sovereign Audit layer. Sensitive identifiers (addresses, keys, mnemonics) are redacted locally before transmission.
                 </p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'nodes' && (
           <div className="animate-in slide-in-from-bottom-4">
              {/* This tab is now handled in NodeSettings.tsx, but we can link it or embed parts here if needed */}
              <div className="bg-off-white/40 border border-border rounded-[3rem] p-12 text-center space-y-6">
                 <Database size={48} className="text-orange-600 mx-auto" />
                 <h3 className="text-xl font-black italic uppercase tracking-tighter">Protocol Sovereignty</h3>
                 <p className="text-xs text-brand-earth max-w-sm mx-auto leading-relaxed">
                    Custom node configurations and RPC overrides are managed in the specialized Node & Protocols terminal.
                 </p>
                 <button className="bg-accent-earth text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
                    Open Protocol Terminal
                 </button>
              </div>
           </div>
        )}
        {activeTab === 'nwc' && (
           <section className="bg-off-white/40 border border-border rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
              <div className="p-8 border-b border-border bg-off-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Share2 size={20} className="text-accent-earth" />
                   <div>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-deep">Nostr Wallet Connect (NIP-47)</h3>
                      <p className="text-[9px] text-brand-earth font-bold uppercase mt-0.5">Control your wallet from external apps</p>
                   </div>
                </div>
                <div className="flex bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                   <span className="text-[8px] text-green-500 font-black uppercase tracking-widest">Encrypted Hub</span>
                </div>
              </div>
              <div className="p-8 space-y-8">
                 <div className="bg-white border border-border rounded-3xl p-6">
                    <p className="text-xs text-brand-earth mb-4 italic">No active connections. Scan an NWC QR code to link an app.</p>
                    <button className="w-full py-4 bg-accent-earth text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
                       Pair New Application
                    </button>
                 </div>
                 <div className="bg-off-white/20 border border-border/50 p-6 rounded-[2rem]">
                    <h4 className="text-[9px] font-black uppercase text-brand-earth mb-4 tracking-widest">Active Permissions</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center p-4 bg-white/50 rounded-2xl border border-border">
                          <div>
                             <p className="text-xs font-bold text-brand-deep">Damus Integration</p>
                             <p className="text-[9px] text-brand-earth uppercase">get_balance, pay_invoice</p>
                          </div>
                          <button className="text-[9px] font-black text-red-500 uppercase hover:underline">Revoke</button>
                       </div>
                    </div>
                 </div>
              </div>
           </section>
        )}
      </div>
    </div>
  );
};

export default Settings;
