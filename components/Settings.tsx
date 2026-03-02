import React, { useState, useContext } from 'react';
import { Settings as SettingsIcon, Globe, Moon, Sun, DollarSign, Bell, Shield, Info, Database, Eye, Crown, Zap, CheckCircle2, RotateCcw, Languages, MapPin, Lock, Briefcase, Bot, Cpu, Link } from 'lucide-react';
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
        <p className="text-zinc-500 text-sm font-medium">Manage your sovereign environment and enclave persistence.</p>
      </header>

      <div className="flex bg-zinc-900/50 p-1.5 rounded-[2rem] border border-zinc-800 mb-8 sticky top-4 z-50 backdrop-blur-md">
        {[
          { id: 'general', icon: Globe, label: 'Environment' },
          { id: 'security', icon: Shield, label: 'Enclave' },
          { id: 'nodes', icon: Database, label: 'Protocols' },
          { id: 'ai', icon: Bot, label: 'AI Hook (BYOS)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon size={14} />
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-10">
        {activeTab === 'general' && (
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="p-8 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Globe size={16} className="text-orange-500" /> Network & Regional
              </h3>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                    App Mode
                  </label>
                  <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-2xl">
                    {[
                      { id: 'sovereign', label: 'Production' },
                      { id: 'simulation', label: 'Shop Demo' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => appContext.setMode(opt.id as any)}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          mode === opt.id ? 'bg-green-600 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                    Active Network
                  </label>
                  <select
                    value={network}
                    onChange={(e) => appContext.setNetwork(e.target.value as Network)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-600/50"
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
           <section className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
              <div className="p-8 border-b border-zinc-800 bg-zinc-900/20">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                  <Shield size={16} className="text-orange-500" /> Enclave Persistence
                </h3>
              </div>
              <div className="p-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-zinc-600">Auto-Lock (Min)</label>
                       <input
                         type="number"
                         value={appContext.state.security?.autoLockMinutes ?? 5}
                         onChange={e => appContext.setSecurity({ autoLockMinutes: parseInt(e.target.value) })}
                         className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-zinc-600">Duress PIN</label>
                       <input
                         type="password"
                         value={appContext.state.security?.duressPin ?? ''}
                         onChange={e => appContext.setSecurity({ duressPin: e.target.value })}
                         className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none"
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
          <section className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="p-8 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Bot size={20} className="text-orange-500" />
                 <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-100">AI Hook (BYOS)</h3>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">Bring Your Own Service</p>
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
                        ? 'bg-orange-600 border-orange-500 text-white shadow-xl'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'
                    }`}
                   >
                     {p}
                   </button>
                ))}
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-600 ml-1">API Key (Enclave-Encrypted)</label>
                    <div className="relative">
                       <input
                         type="password"
                         value={aiConfig?.apiKey || ''}
                         onChange={e => handleAiUpdate('apiKey', e.target.value)}
                         placeholder="sk-..."
                         className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-12 py-5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-orange-500/50"
                       />
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={18} />
                    </div>
                 </div>

                 {aiConfig?.provider === 'Custom' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2">
                       <label className="text-[10px] font-black uppercase text-zinc-600 ml-1">Custom Endpoint Hook</label>
                       <div className="relative">
                          <input
                            value={aiConfig?.endpoint || ''}
                            onChange={e => handleAiUpdate('endpoint', e.target.value)}
                            placeholder="https://your-sovereign-ai.local/v1/chat"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-12 py-5 text-sm font-mono text-zinc-200 focus:outline-none focus:border-orange-500/50"
                          />
                          <Link className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" size={18} />
                       </div>
                       <p className="text-[10px] text-zinc-500 italic px-2">Supports OpenAI-compatible chat completion endpoints.</p>
                    </div>
                 )}
              </div>

              <div className="bg-orange-500/5 border border-orange-500/10 p-6 rounded-[2rem] flex gap-4">
                 <Shield className="text-orange-500 shrink-0" size={20} />
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
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-12 text-center space-y-6">
                 <Database size={48} className="text-orange-600 mx-auto" />
                 <h3 className="text-xl font-black italic uppercase tracking-tighter">Protocol Sovereignty</h3>
                 <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                    Custom node configurations and RPC overrides are managed in the specialized Node & Protocols terminal.
                 </p>
                 <button className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
                    Open Protocol Terminal
                 </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
