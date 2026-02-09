import React, { useState, useContext } from 'react';
import { Settings as SettingsIcon, Globe, Moon, Sun, DollarSign, Bell, Shield, Info, Database, Eye, Crown, Zap, CheckCircle2, RotateCcw, Languages, MapPin, Lock, Briefcase } from 'lucide-react';
import { AppContext } from '../context';
import { Language } from '../services/i18n';
import { Network } from '../types';

const Settings: React.FC = () => {
  const appContext = useContext(AppContext);
  const [currency, setCurrency] = useState('USD');
  const [activeTab, setActiveTab] = useState('general');

  if (!appContext) return null;
  const { mode, network, theme, language } = appContext.state;

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

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
      <header className="space-y-2">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">System Configuration</h2>
        <p className="text-zinc-500 text-sm font-medium">Manage your sovereign environment and enclave persistence.</p>
      </header>

      <div className="space-y-10">
        {/* Localization */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/20">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Globe size={16} className="text-amber-500" /> Regional & Display
            </h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <DollarSign size={12} /> Base Currency
              </label>
              <div className="grid grid-cols-3 gap-2">
                 {currencies.map(c => (
                   <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`py-3 rounded-xl text-[10px] font-black transition-all border ${currency === c ? 'bg-amber-600 border-amber-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                   >
                     {c}
                   </button>
                 ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <Languages size={12} /> Interface Language
              </label>
              <div className="flex flex-wrap gap-2">
                 {languages.map(u => (
                   <button 
                    key={u.code}
                    onClick={() => appContext.setLanguage(u.code)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${language === u.code ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                   >
                     {u.name}
                   </button>
                 ))}
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <MapPin size={12} /> Region Logic
              </label>
              <p className="text-[10px] text-zinc-500 italic leading-relaxed">
                 Adjusts fee estimators and gateway priority based on local chain density. Currently optimized for <strong>Global Relay</strong>.
              </p>
            </div>
          </div>
        </section>

        {/* System Persistence */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/20">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <RotateCcw size={16} className="text-red-500" /> Final Protocol Reset
            </h3>
          </div>
          <div className="p-8 flex items-center justify-between">
            <div className="max-w-md">
              <p className="font-bold text-zinc-200">Purge Sovereign State</p>
              <p className="text-xs text-zinc-500 mt-1">Wipes all keys, BIP-39 entropy, and cached ledger data. Action is terminal.</p>
            </div>
            <button onClick={appContext.resetEnclave} className="px-8 py-3 bg-red-600/10 border border-red-500/20 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
              Execute Purge
            </button>
          </div>
        </section>

        {/* Advanced */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/20">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Lock size={16} className="text-green-600" /> Advanced Controls
            </h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                Shop Mode (DEMO)
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
              <p className="text-[10px] text-zinc-500 italic">Demo restricts core features to marketplace simulations.</p>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                Network Selection
              </label>
              <select 
                value={network}
                onChange={(e) => appContext.setNetwork(e.target.value as Network)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-600/50"
                aria-label="Network Selection"
                title="Network Selection"
              >
                <option value="mainnet">Mainnet (Production)</option>
                <option value="testnet">Testnet (Public)</option>
                <option value="regtest">Regtest (Local)</option>
                <option value="devnet">Devnet (Experimental)</option>
              </select>
              <p className="text-[10px] text-zinc-500 italic">Applies to BTC, Stacks, Liquid, and Rootstock endpoints.</p>
            </div>

            {/* Financial Bridges */}
            <div className="space-y-4 md:col-span-2 border-t border-zinc-800 pt-6 mt-2">
               <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                 <Briefcase size={12} /> Financial Bridges (South Africa)
               </label>
               <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-100">Connect VALR Account</span>
                    <p className="text-[10px] text-zinc-500 italic mt-1">Direct link for ZAR/BTC bridge via VALR Pay (Licensed FSP).</p>
                  </div>
                  <button className="px-6 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                     Connect
                  </button>
               </div>
            </div>

            {/* Corporate Profile (Sovereign Entity) */}
            <div className="space-y-4 md:col-span-2 border-t border-zinc-800 pt-6 mt-2">
               <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                 <Briefcase size={12} /> Corporate Entity (Encrypted)
               </label>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="password" placeholder="Legal Entity Name" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" className="bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3 text-sm focus:outline-none" />
                  <input type="password" placeholder="Tax / VAT ID (Optional)" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" className="bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3 text-sm focus:outline-none" />
                  <input type="password" placeholder="Registered Address" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" className="md:col-span-2 bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-3 text-sm focus:outline-none" />
               </div>
               <p className="text-[10px] text-zinc-500 italic">These details are signed by your DID and included in PayJoin invoices.</p>
            </div>
            
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                Security Controls
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-600">Auto-Lock (minutes)</span>
                  <input 
                    type="number" 
                    min={1}
                    value={appContext.state.security?.autoLockMinutes ?? 5}
                    onChange={(e) => appContext.setSecurity({ autoLockMinutes: Math.max(1, parseInt(e.target.value || '1')) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none"
                    aria-label="Auto Lock Minutes"
                    title="Auto Lock Minutes"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-zinc-600">Duress PIN (optional)</span>
                  <input 
                    type="password"
                    value={appContext.state.security?.duressPin ?? ''}
                    onChange={(e) => appContext.setSecurity({ duressPin: e.target.value })}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none"
                    aria-label="Duress PIN"
                    title="Duress PIN"
                    placeholder="Enter duress PIN"
                  />
                  <p className="text-[10px] text-zinc-500 italic mt-1">Unlock with duress PIN loads a decoy wallet.</p>
                </div>
                <div className="md:col-span-2 flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-600">Biometric Gate</span>
                    <p className="text-[10px] text-zinc-500 italic mt-1">Require device authentication before PIN entry.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => appContext.setSecurity({ biometricUnlock: !(appContext.state.security?.biometricUnlock ?? false) })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${(appContext.state.security?.biometricUnlock ?? false) ? 'bg-amber-600' : 'bg-zinc-800'}`}
                    aria-label="Toggle Biometric Gate"
                    title="Toggle Biometric Gate"
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${(appContext.state.security?.biometricUnlock ?? false) ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-zinc-800 pt-6">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                Gemini AI API Key
              </label>
              <input
                type="password"
                value={appContext.state.geminiApiKey ?? ''}
                onChange={(e) => appContext.setGeminiApiKey(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                aria-label="Gemini AI API Key"
                title="Gemini AI API Key"
                placeholder="Enter Gemini API Key"
              />
              <p className="text-[10px] text-zinc-500 italic mt-1">Enclave-encrypted. Required for Satoshi AI, Labs Explorer, and DeFi Audits.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
