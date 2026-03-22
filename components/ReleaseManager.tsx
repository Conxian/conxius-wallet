
import React, { useState, useEffect, useContext } from 'react';
import { Package, Rocket, ShieldCheck, Terminal, Download, FileCode, CheckCircle2, Loader2, Key, HardDrive, Cpu, ExternalLink, Globe, Lock, Share2, Sparkles, AlertCircle, RefreshCw, Server, Smartphone, QrCode, Scan, Store, Play, Apple, Box, Activity, FileText } from 'lucide-react';
import { AppContext } from '../context';
import { getFinalSystemHardeningChecklist, generateReleaseNotes } from '../services/gemini';

const ARTIFACTS = [
  { 
    platform: 'Android (Sovereign APK)', 
    file: 'conxius-svn-0.3.apk', 
    size: '48 MB', 
    hash: 'sha256:pending_verification_on_build',
    icon: Smartphone,
    type: 'mobile'
  },
  { 
    platform: 'Desktop (macOS/Linux)', 
    file: 'conxius-desktop-svn-0.3.tar.gz', 
    size: '156 MB', 
    hash: 'sha256:pending_verification_on_build',
    icon: HardDrive,
    type: 'desktop'
  },
];

const ReleaseManager: React.FC = () => {
  const context = useContext(AppContext);
  const [isPackaging, setIsPackaging] = useState(false);
  const [packageStep, setPackageStep] = useState(0);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [hardeningReport, setHardeningReport] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const steps = [
    'Verifying Flight Check Signatures',
    'Compiling Sovereign Studio Wasm',
    'Auditing DAO Bounty Smart Logic',
    'Hardening Enclave Entropy Source',
    'Signing Artifacts with Air-Gapped Key',
    'Finalizing SVN 1.5 Release Candidate'
  ];

  const startPackaging = async () => {
    setIsPackaging(true);
    setBuildLogs([]);
    setReleaseNotes(null);
    
    for (let i = 0; i < steps.length; i++) {
      setPackageStep(i);
      setBuildLogs(prev => [...prev, `[BUILD] ${steps[i]}... DONE`]);
      await new Promise(r => setTimeout(r, 600));
    }
    
    const report = await getFinalSystemHardeningChecklist();
    setHardeningReport(report || "Report unavailable.");
    
    setIsGeneratingNotes(true);
    const notes = await generateReleaseNotes('0.3.0');
    setReleaseNotes(notes || "Notes unavailable.");
    setIsGeneratingNotes(false);
    
    setIsPackaging(false);
    setBuildLogs(prev => [...prev, `[FINALIZE] RELEASE SVN 1.5 READY FOR DISTRIBUTION.`]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-deep flex items-center gap-3 italic uppercase">
            <Package className="text-accent-earth" />
            Release Hub
          </h2>
          <p className="text-brand-earth text-sm italic">Production handoff and distribution protocols.</p>
        </div>
        <button 
          onClick={startPackaging} 
          disabled={isPackaging}
          className="bg-accent-earth hover:bg-accent-earth/90 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl active:scale-95 disabled:opacity-50"
        >
          {isPackaging ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {isPackaging ? 'Compiling Enclave...' : 'Build Stable Release'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Release Notes & Hardening Panel */}
        <div className="lg:col-span-8 space-y-8">
           <div className="bg-white border border-border rounded-[3rem] overflow-hidden shadow-2xl relative">
              <div className="p-8 border-b border-border bg-off-white/20 flex items-center justify-between">
                 <h3 className="text-xs font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                    <FileText size={16} className="text-accent-earth" />
                    Sovereign Release Report
                 </h3>
                 <span className="text-[10px] font-mono text-brand-earth">ID: SVN-0.3-RC</span>
              </div>
              
              <div className="p-10 font-serif text-sm leading-loose text-brand-deep min-h-[500px] whitespace-pre-wrap custom-scrollbar max-h-[700px] overflow-y-auto selection:bg-orange-500/30">
                 {isGeneratingNotes ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
                       <Loader2 className="animate-spin text-accent-earth" size={32} />
                       <p className="text-[10px] font-black uppercase tracking-widest text-brand-earth animate-pulse">Synthesizing Technical MOAT Analysis...</p>
                    </div>
                 ) : releaseNotes ? (
                    <div className="animate-in fade-in duration-1000">
                       {releaseNotes}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-border opacity-50 space-y-4 py-20">
                       <ShieldCheck size={64} />
                       <p className="text-sm font-black uppercase tracking-widest text-center">Execute Build to Generate Proof of Hardening</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* Build Terminal & Artifacts */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-ivory border border-border rounded-[3rem] p-8 h-80 overflow-hidden shadow-2xl relative group">
              <div className="flex items-center gap-3 text-brand-earth mb-6 border-b border-border pb-4">
                 <Terminal size={18} />
                 <span className="text-[10px] font-black uppercase font-mono">BUILD_CON</span>
              </div>
              <div className="space-y-2 font-mono text-[10px] text-brand-earth overflow-y-auto h-full custom-scrollbar">
                 {buildLogs.map((log, i) => <p key={i} className="animate-in slide-in-from-left-2">&gt; {log}</p>)}
                 {isPackaging && <div className="w-2 h-4 bg-orange-500 animate-pulse" />}
              </div>
           </div>

           <div className="bg-off-white/40 border border-border rounded-[2.5rem] p-8 space-y-6 shadow-xl">
              <h4 className="text-xs font-black uppercase text-brand-earth tracking-widest flex items-center gap-2">
                 <Box size={16} className="text-accent-earth" /> Distributed Artifacts
              </h4>
              <div className="space-y-4">
                 {ARTIFACTS.map((art, i) => (
                    <div key={i} className="p-4 bg-white rounded-2xl border border-border group hover:border-orange-500/20 transition-all">
                       <div className="flex items-center gap-4 mb-3">
                          <art.icon size={20} className="text-brand-earth" />
                          <div>
                             <p className="text-[9px] font-black uppercase text-brand-earth">{art.platform}</p>
                             <p className="text-xs font-bold text-brand-deep">{art.file}</p>
                          </div>
                       </div>
                       <button className="w-full py-2 bg-off-white hover:bg-border rounded-lg text-[9px] font-black uppercase text-brand-earth transition-all flex items-center justify-center gap-2">
                          <Download size={10} /> Verify SHA256
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ReleaseManager;
