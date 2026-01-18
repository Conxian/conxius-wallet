
import React, { useState, useContext } from 'react';
import { Settings as SettingsIcon, Globe, Moon, Sun, DollarSign, Bell, Shield, Info, Database, Eye, Crown, Zap, CheckCircle2, RotateCcw, Languages, MapPin } from 'lucide-react';
import { AppContext } from '../context';
import { Language } from '../services/i18n';

const Settings: React.FC = () => {
  const appContext = useContext(AppContext);
  const [currency, setCurrency] = useState('USD');
  const [unit, setUnit] = useState('BTC');

  if (!appContext) return null;
  const { language } = appContext.state;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <header className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center">
              <SettingsIcon className="text-zinc-400" size={24} />
            </div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic">Enclave Config</h2>
          </div>
          <p className="text-zinc-500 text-sm italic">Localize your sovereign experience and refine node parameters.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        
        {/* Localization Matrix */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/20">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Languages size={16} className="text-orange-500" /> Localization & Region
            </h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <Globe size={12} /> Interface Language
              </label>
              <select 
                value={language}
                onChange={(e) => appContext.setLanguage(e.target.value as Language)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              >
                <option value="en">English (Global)</option>
                <option value="es">Spanish (LatAm)</option>
                <option value="de">German (DACH)</option>
                <option value="zh">Chinese (Simplified)</option>
                <option value="cypher">Cypherpunk (Standard)</option>
              </select>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <DollarSign size={12} /> Valuation Fiat
              </label>
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm focus:outline-none"
              >
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
                <option value="BRL">Brazilian Real (R$)</option>
                <option value="JPY">Japanese Yen (¥)</option>
              </select>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <Zap size={12} /> Native Unit
              </label>
              <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-2xl">
                 {['BTC', 'SATS', 'BITS'].map(u => (
                   <button 
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${unit === u ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
                   >
                     {u}
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
      </div>
    </div>
  );
};

export default Settings;
