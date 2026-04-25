import React, { useState, useContext } from 'react';
import { AppContext } from '../context';
import {
  Rocket,
  FlaskConical,
  Terminal,
  ArrowRight,
  Sparkles,
  Shield,
  Cpu,
  Code2,
  Loader2,
  Search,
  ExternalLink,
  Hammer,
  Zap,
  Award,
  ShieldCheck,
  Microscope,
  Globe, Binary, CheckCircle2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const UPCOMING_PROJECTS = [
  { id: "bitvm", name: "BitVM Verifier", status: "M6 READY", desc: "On-device ZK-STARK verification for optimistic rollups on Bitcoin.", icon: Binary, color: "text-green-500" },
  { id: 'gateway', name: 'Conxian Gateway', status: 'LIVE', desc: 'Sovereign B2B portal for institutional DeFi and shielded assets.', icon: Globe, Binary, CheckCircle2, color: 'text-accent-earth' },
  { id: 'guard', name: 'Conxius Guard', status: 'Incubating', desc: 'Hardware-level entropy monitoring for mobile devices.', icon: Shield, color: 'text-blue-500' },
  { id: 'mesh', name: 'Sovereign Mesh V2', status: 'Alpha', desc: 'Peer-to-peer mempool sharing via encrypted local tunnels.', icon: Cpu, color: 'text-purple-500' },
  { id: 'relay', name: 'Conxius Relay', status: 'Concept', desc: 'Universal Nostr-to-Bitcoin settlement engine.', icon: Code2, color: 'text-emerald-500' },
];

const LabsExplorer: React.FC = () => {
  const [bitVmProof, setBitVmProof] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);

  const appContext = useContext(AppContext);
  const [activeSubTab, setActiveSubTab] = useState<'incubator' | 'forge'>('incubator');
  const [blueprint, setBlueprint] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);


  const handleVerify = async () => {
    const { verifyBitVmProof } = await import("@/services/bitvm");
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await verifyBitVmProof(bitVmProof);
      setVerificationResult(res);
    } finally {
      setIsVerifying(false);
    }
  };

  const getProjectBlueprint = async (project: string) => {
    setIsGenerating(true);
    setActiveProject(project);
    try {
      const apiKey = appContext?.state.aiConfig?.apiKey;
      if (!apiKey) throw new Error("API Key not configured");
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `Synthesize a technical blueprint for: ${project} within the Conxius Sovereign Ecosystem. Focus on B2B expansion, TEE integration, and Bitcoin-native security.`
      });
      setBlueprint(result.text ?? null);
    } catch (e) {
      setBlueprint("Error synthesizing blueprint. Ensure your Gemini API key is active in Settings.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="bg-accent-earth p-2 rounded-xl shadow-xl shadow-orange-600/20"><Rocket className="text-white" size={24} /></div>
             <h2 className="text-3xl font-black tracking-tighter uppercase italic">Conxian<span className="text-accent-earth">Labs</span></h2>
          </div>
          <p className="text-brand-earth text-sm font-medium">Researching the future of institutional digital sovereignty.</p>
        </div>
        
        <div className="flex bg-off-white border border-border p-1 rounded-2xl self-start md:self-auto">
           <button 
            onClick={() => setActiveSubTab('incubator')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'incubator' ? 'bg-accent-earth text-white' : 'text-brand-earth hover:text-brand-deep'}`}
           >
              Product Incubator
           </button>
           <button 
            onClick={() => setActiveSubTab('forge')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'forge' ? 'bg-accent-earth text-white' : 'text-brand-earth hover:text-brand-deep'}`}
           >
              Sovereign Forge
           </button>
        </div>
      </header>

      {activeSubTab === 'incubator' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-8 space-y-6 shadow-2xl">
               <h3 className="text-sm font-black uppercase text-brand-earth tracking-widest">Active R&D Slots</h3>
               <div className="space-y-4">
                  {UPCOMING_PROJECTS.map((project) => (
                     <button 
                      key={project.id}
                      onClick={() => getProjectBlueprint(project.name)}
                      className={`w-full p-6 bg-white border rounded-3xl text-left transition-all group ${
                        activeProject === project.name ? 'border-orange-500/50 bg-orange-500/5' : 'border-border hover:border-border'
                      }`}
                     >
                        <div className="flex items-center justify-between mb-4">
                           <div className={`p-2 rounded-xl bg-off-white border border-border ${project.color}`}>
                              <project.icon size={20} />
                           </div>
                           <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-off-white text-brand-earth rounded-full">{project.status}</span>
                        </div>
                        <h4 className="font-bold text-brand-deep mb-1">{project.name}</h4>
                        <p className="text-[10px] text-brand-earth leading-relaxed italic">{project.desc}</p>
                     </button>
                  ))}
               </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
             <div className="bg-ivory border border-border rounded-[2.5rem] min-h-[600px] flex flex-col overflow-hidden relative group">
                <div className="p-6 border-b border-border bg-off-white/20 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <Terminal size={18} className="text-accent-earth" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-brand-earth">Research Terminal</h3>
                   </div>
                   {isGenerating && <Loader2 className="animate-spin text-accent-earth" size={14} />}
                </div>
                
                <div className="flex-1 p-10 font-mono text-xs text-brand-earth leading-relaxed overflow-y-auto custom-scrollbar">

                   {activeProject === "BitVM Verifier" ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                         <div className="bg-green-600/10 border border-green-500/20 p-6 rounded-2xl">
                            <h4 className="text-green-500 font-black uppercase text-[10px] tracking-widest mb-2">STARK Proof Input</h4>
                            <textarea
                               value={bitVmProof}
                               onChange={(e) => setBitVmProof(e.target.value)}
                               placeholder="0x... (256+ character ZK-STARK proof)"
                               className="w-full h-32 bg-ivory border border-border rounded-xl p-4 text-brand-deep font-mono text-[10px] focus:border-green-500/50 outline-none transition-all"
                            />
                         </div>
                         <button
                            onClick={handleVerify}
                            disabled={isVerifying || !bitVmProof}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-border text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-600/10"
                         >
                            {isVerifying ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                            Verify STARK Proof on TEE
                         </button>
                         {verificationResult !== null && (
                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${verificationResult ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"}`}>
                               {verificationResult ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                               <span className="font-black uppercase tracking-widest text-[10px]">
                                  {verificationResult ? "Proof Verified: Computational Integrity Guaranteed" : "Verification Failed: Proof Corrupted or Invalid"}
                                </span>
                            </div>
                         )}
                      </div>
                   ) : isGenerating ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                         <Loader2 className="animate-spin text-accent-earth" size={32} />
                         <p className="uppercase tracking-widest animate-pulse">Synthesizing Blueprint...</p>
                      </div>
                   ) : blueprint ? (
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                         <div className="mb-8 p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl text-accent-earth flex items-center gap-3">
                            <Microscope size={18} />
                            <span className="font-black uppercase tracking-widest">Audit: {activeProject}</span>
                         </div>
                         <div className="whitespace-pre-wrap">{blueprint}</div>
                      </div>
                   ) : (
                      <div className="flex flex-col items-center justify-center h-full text-brand-earth opacity-50 select-none">
                         <Search size={48} className="mb-4" />
                         <p className="text-sm uppercase tracking-[0.3em] font-black text-center">Select an R&D Slot to Audit</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-7 space-y-8">
              <div className="bg-gradient-to-br from-off-white to-orange-950/20 border border-orange-500/20 rounded-[3rem] p-10 relative overflow-hidden group shadow-2xl">
                 <div className="absolute top-0 right-0 p-12 opacity-5">
                    <Hammer size={240} />
                 </div>
                 <div className="relative z-10 space-y-8">
                    <div className="flex justify-between items-start">
                       <div>
                          <h3 className="text-3xl font-black tracking-tighter text-brand-deep">The Forge</h3>
                          <p className="text-sm text-brand-earth italic">Evolve your Sovereign Pass with verifiable proof-of-work.</p>
                       </div>
                       <div className="w-16 h-16 bg-accent-earth rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-orange-600/40">
                          <Zap size={32} className="text-white fill-current" />
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="bg-white/80 border border-border p-6 rounded-3xl hover:border-orange-500/30 transition-all cursor-pointer group">
                          <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                <Award size={20} />
                             </div>
                             <span className="text-[10px] font-black uppercase text-brand-earth">Socket Trait</span>
                          </div>
                          <h4 className="text-sm font-bold text-brand-deep">Genesis Node Uptime</h4>
                          <p className="text-[10px] text-brand-earth mt-1 italic">+420 Multiplier | Verified On-Chain</p>
                          <div className="mt-4 w-full h-1 bg-off-white rounded-full overflow-hidden">
                             <div className="w-full h-full bg-blue-500" />
                          </div>
                       </div>
                       <div className="bg-white/80 border border-border p-6 rounded-3xl hover:border-orange-500/30 transition-all cursor-pointer group">
                          <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-orange-500/10 rounded-xl text-accent-earth">
                                <Zap size={20} />
                             </div>
                             <span className="text-[10px] font-black uppercase text-brand-earth">Socket Trait</span>
                          </div>
                          <h4 className="text-sm font-bold text-brand-deep">NTT Bridge Master</h4>
                          <p className="text-[10px] text-brand-earth mt-1 italic">Locked at 0k Volume | Level 2</p>
                          <div className="mt-4 w-full h-1 bg-off-white rounded-full overflow-hidden">
                             <div className="w-3/4 h-full bg-orange-500" />
                          </div>
                       </div>
                    </div>

                    <button className="w-full py-5 bg-accent-earth hover:bg-accent-earth/90 text-white font-black rounded-3xl text-sm uppercase tracking-widest shadow-2xl shadow-orange-600/20 transition-all active:scale-[0.98]">
                       Cast Sovereign Evolution
                    </button>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-5 space-y-6">
              <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-8 space-y-6">
                 <h3 className="text-xs font-black uppercase text-brand-earth tracking-widest flex items-center gap-2">
                    <ShieldCheck size={16} className="text-green-500" />
                    Evolution Requirements
                 </h3>
                 <div className="space-y-4">
                    {[
                       { label: 'Local Node Uptime', val: '92%', status: 'active' },
                       { label: 'NTT Liquidity Support', val: '0.042 BTC', status: 'pending' },
                       { label: 'Nostr Identity Age', val: '142 Days', status: 'active' },
                    ].map((req, i) => (
                       <div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-border">
                          <div>
                             <p className="text-[9px] font-black uppercase text-brand-earth">{req.label}</p>
                             <p className="text-xs font-bold text-brand-deep">{req.val}</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${req.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-border'}`} />
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default LabsExplorer;
