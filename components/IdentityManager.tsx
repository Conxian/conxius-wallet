import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Copy,
  Plus,
  Fingerprint,
  Radio,
  Loader2,
  CheckCircle2,
  Zap,
  Bot,
  Lock,
  Globe,
  Database,
  Cloud
} from 'lucide-react';
import { IdentityService } from '../services/identity';
import { generateNostrKeypair } from '../services/nostr';
import { getDIDInsight } from '../services/gemini';
import { DIDProfile } from '../types';
import { Web5Service } from '../services/web5';

const INITIAL_DID: DIDProfile = {
  did: 'did:pkh:btc:mainnet:1Satoshi...',
  alias: 'Sovereign User',
  bio: 'Anchored in the Bitcoin Timechain.',
  verified: false,
  linkedAddress: 'bc1q...',
  socials: {}
};

const IdentityManager: React.FC = () => {
  const [profile, setProfile] = useState<DIDProfile>(INITIAL_DID);
  const [web5Did, setWeb5Did] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nostrKeys, setNostrKeys] = useState<any>(null);
  const [isGeneratingNostr, setIsGeneratingNostr] = useState(false);
  const [insight, setInsight] = useState<string>("Initializing identity audit...");
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [dwnStatus, setDwnStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    const loadIdentity = async () => {
        try {
            const idService = new IdentityService();
            const identity = await idService.getDid();
            
            if (identity.web5Did) {
                setWeb5Did(identity.web5Did);
                setDwnStatus('connected');

                // Try to load profile from DWN
                try {
                    const web5Service = Web5Service.getInstance();
                    const records = await web5Service.getRecords('https://schema.org/Person');
                    if (records && records.length > 0) {
                        setProfile(records[0]);
                    } else {
                        setProfile(prev => ({
                            ...prev,
                            did: identity.did,
                            linkedAddress: identity.address,
                            verified: true
                        }));
                    }
                } catch (err) {
                    console.error("DWN Profile load failed", err);
                }
            } else {
                setProfile(prev => ({
                    ...prev,
                    did: identity.did,
                    linkedAddress: identity.address,
                    verified: true
                }));
            }
            
            // Check cache for insight
            const cacheKey = `did_insight_${identity.did}`;
            const cachedInsight = localStorage.getItem(cacheKey);
            
            if (cachedInsight) {
                setInsight(cachedInsight);
            } else {
                setIsLoadingInsight(true);
                try {
                    const res = await getDIDInsight(identity.did);
                    const insightStr = res || "Insight unavailable.";
                    setInsight(insightStr);
                    localStorage.setItem(cacheKey, insightStr);
                } catch (err) {
                    console.error("Insight fetch failed", err);
                } finally {
                    setIsLoadingInsight(false);
                }
            }
        } catch (e) {
            console.error("Failed to load identity", e);
        }
    };
    loadIdentity();
  }, []);

  const handleConnectWeb5 = async () => {
      setDwnStatus('connecting');
      try {
          const web5Service = Web5Service.getInstance();
          const { did } = await web5Service.connect();
          setWeb5Did(did);
          setDwnStatus('connected');

          // Store profile in DWN if not already there
          const records = await web5Service.getRecords('https://schema.org/Person');
          if (records.length === 0) {
              await web5Service.createRecord(profile, 'https://schema.org/Person');
          }
      } catch (err) {
          console.error("Web5 connection failed", err);
          setDwnStatus('disconnected');
      }
  };

  const handleGenerateNostr = async () => {
     setIsGeneratingNostr(true);
     try {
        const keys = await generateNostrKeypair();
        setNostrKeys(keys);
     } finally {
        setIsGeneratingNostr(false);
     }
  };

  const handleLnLogin = async () => {
      const lnurl = prompt("Enter LNURL-Auth string for testing:");
      if (!lnurl) return;
      
      try {
          const idService = new IdentityService();
          await idService.loginWithLightning(lnurl);
          alert("Lightning Login Successful!");
      } catch (e) {
          alert("Login Failed: " + (e as Error).message);
      }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-100">Identity Enclave</h2>
          <p className="text-zinc-500 text-sm italic">Verification through Proof-of-Work and Web5 Decentralization.</p>
        </div>
        <div className="flex gap-4">
            <button
                onClick={handleConnectWeb5}
                disabled={dwnStatus === 'connected' || dwnStatus === 'connecting'}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
            >
                {dwnStatus === 'connecting' ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}
                {dwnStatus === 'connected' ? 'Web5 Active' : 'Initialize Web5'}
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-orange-600/20 active:scale-95">
                <Plus size={18} /> Link Account
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3.5rem] p-1 shadow-2xl overflow-hidden group">
             <div className="bg-zinc-950 rounded-[3.4rem] p-10 space-y-10 relative overflow-hidden text-center">
                <div className="w-24 h-24 rounded-[2rem] border-4 border-orange-500/20 p-1 bg-zinc-900 shadow-2xl mx-auto relative">
                   <img src={profile.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sovereign'} alt="Avatar" className="w-full h-full rounded-[1.8rem] object-cover" />
                   {dwnStatus === 'connected' && (
                       <div className="absolute -bottom-2 -right-2 bg-blue-600 p-1.5 rounded-full border-4 border-zinc-950">
                           <Cloud size={12} className="text-white" />
                       </div>
                   )}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-zinc-100 flex items-center justify-center gap-2">
                      {profile.alias} <ShieldCheck size={20} className="text-blue-500" />
                   </h3>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 mt-2">Verified Peer Root</p>
                </div>
                <div className="space-y-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between text-left">
                       <div>
                          <p className="text-[9px] font-black text-zinc-600 uppercase">Primary BTC DID</p>
                          <p className="text-[10px] font-mono text-zinc-400 truncate w-32">{profile.did}</p>
                       </div>
                       <button onClick={() => navigator.clipboard.writeText(profile.did)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-700">
                          <Copy size={14} />
                       </button>
                    </div>

                    {web5Did && (
                        <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between text-left animate-in fade-in slide-in-from-bottom-2">
                           <div>
                              <p className="text-[9px] font-black text-blue-400 uppercase">Web5 DHT DID</p>
                              <p className="text-[10px] font-mono text-blue-200 truncate w-32">{web5Did}</p>
                           </div>
                           <button onClick={() => navigator.clipboard.writeText(web5Did)} className="p-2 hover:bg-blue-500/20 rounded-lg text-blue-400">
                              <Copy size={14} />
                           </button>
                        </div>
                    )}
                </div>
             </div>
           </div>

           {dwnStatus === 'connected' && (
               <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-8 space-y-4">
                   <div className="flex items-center gap-2 text-blue-400">
                       <Database size={16} />
                       <h3 className="text-xs font-black uppercase tracking-widest">DWN Node Info</h3>
                   </div>
                   <div className="space-y-2">
                       <div className="flex justify-between text-[10px]">
                           <span className="text-zinc-500 uppercase font-black">Storage Mode</span>
                           <span className="text-zinc-300 font-bold">Decentralized</span>
                       </div>
                       <div className="flex justify-between text-[10px]">
                           <span className="text-zinc-500 uppercase font-black">Sync Status</span>
                           <span className="text-green-500 font-bold">Real-time</span>
                       </div>
                   </div>
               </div>
           )}
        </div>

        <div className="lg:col-span-8 space-y-10">
           {/* Real Nostr Module */}
           <div className="bg-purple-600/10 border border-purple-500/20 rounded-[3rem] p-10 space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                 <Radio size={140} className="text-purple-500" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                 <div className="space-y-3">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-purple-200">Nostr Transport Layer</h3>
                    <p className="text-xs text-zinc-400 max-w-md leading-relaxed italic">Enable encrypted multi-sig coordination and decentralized profile metadata via relays.</p>
                 </div>
                 {nostrKeys ? (
                    <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-full border border-green-500/20 text-[10px] font-black uppercase">
                       <CheckCircle2 size={12} /> Transport Active
                    </div>
                 ) : (
                    <button 
                       onClick={handleGenerateNostr}
                       disabled={isGeneratingNostr}
                       className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-purple-600/30 flex items-center gap-2"
                    >
                       {isGeneratingNostr ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                       Initialize Mesh Keys
                    </button>
                 )}
              </div>

              {nostrKeys && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-3xl space-y-2">
                       <p className="text-[9px] font-black uppercase text-zinc-600">Public Key (npub)</p>
                       <p className="text-[10px] font-mono text-zinc-300 break-all bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">{nostrKeys.npub}</p>
                    </div>
                    <div className="p-6 bg-zinc-950 border border-zinc-900 rounded-3xl space-y-2">
                       <p className="text-[9px] font-black uppercase text-zinc-600">Private Enclave Key (nsec)</p>
                       <p className="text-[10px] font-mono text-zinc-500 blur-md hover:blur-0 cursor-pointer break-all bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 transition-all">{nostrKeys.nsec}</p>
                    </div>
                 </div>
              )}
           </div>

           <div className="bg-zinc-900/20 border border-zinc-800 rounded-[3rem] p-10 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-500/20 p-2 rounded-xl">
                    <Zap size={20} className="text-blue-500" />
                 </div>
                 <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Identity Audit</h3>
              </div>
              <div className="bg-zinc-950 p-8 rounded-[2rem] border border-zinc-900 relative">
                 <div className="absolute top-0 right-0 p-8 opacity-[0.02]"><Bot size={120} /></div>
                 {isLoadingInsight ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-4 text-zinc-700">
                       <Loader2 className="animate-spin" size={32} />
                       <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Satoshi AI auditing DID path...</p>
                    </div>
                 ) : (
                    <p className="text-xs font-mono text-zinc-400 leading-relaxed italic whitespace-pre-wrap">{insight}</p>
                 )}
              </div>
           </div>
           
           {/* Sovereign Backup & Features */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-orange-600/10 border border-orange-500/20 rounded-[2.5rem] p-8 space-y-4">
                   <h3 className="text-xs font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
                       <Lock size={14} /> Sovereign Backup
                   </h3>
                   <p className="text-[10px] text-zinc-400 leading-relaxed">
                       Your keys are protected by the Secure Enclave. {dwnStatus === 'connected' ? 'Your identity metadata is synced to Web5 DWNs.' : 'Sync with Web5 for decentralized metadata backup.'}
                   </p>
               </div>
               
               <button onClick={handleLnLogin} className="bg-yellow-500/10 border border-yellow-500/20 rounded-[2.5rem] p-8 space-y-4 text-left hover:bg-yellow-500/20 transition-all group">
                   <h3 className="text-xs font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2">
                       <Zap size={14} /> Test Lightning Login
                   </h3>
                   <p className="text-[10px] text-zinc-400 leading-relaxed group-hover:text-zinc-300">
                       Authenticate with L402/LNURL services using your Enclave keys. Passwordless.
                   </p>
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default IdentityManager;
