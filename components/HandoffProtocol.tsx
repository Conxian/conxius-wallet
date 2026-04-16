import React, { useState } from 'react';
import { Share2, Smartphone, Monitor, ChevronRight, CheckCircle2, ShieldCheck, Zap, ArrowRight, QrCode, Terminal, Lock } from 'lucide-react';
import { generateRandomString } from '../services/random';

const HandoffProtocol: React.FC = () => {
  const [activeStage, setActiveStage] = useState(0);
  const [handoffType, setHandoffType] = useState<'mobile-to-desktop' | 'desktop-to-mobile'>('mobile-to-desktop');
  
  const generateMockWallet = () => {
    return ["tb1q", generateRandomString(8), "xp9"].join("");
  };

  const stages = [
    { title: 'Secure Pairing', description: 'Establishing encrypted peer-to-peer session via Nostr (NIP-46).', icon: Share2 },
    { title: 'Enclave Authorization', description: 'Requesting permission to share view-only pubkeys.', icon: Lock },
    { title: 'Citadel Linked', description: 'Desktop interface is now bridged to your mobile enclave.', icon: CheckCircle2 },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-32">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-deep italic uppercase flex items-center gap-3">
             <Share2 className="text-accent-earth" />
             Sovereign Handoff
          </h2>
          <p className="text-brand-earth text-sm italic">P2P Encrypted Session Bridging between Mobile Enclave and Desktop Citadel.</p>
        </div>
        <div className="flex bg-off-white p-1.5 rounded-2xl border border-border shadow-inner">
           <button
            onClick={() => setHandoffType('mobile-to-desktop')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${handoffType === 'mobile-to-desktop' ? 'bg-white text-brand-deep shadow-lg' : 'text-brand-earth hover:text-brand-deep'}`}
           >
              Mobile to Desktop
           </button>
           <button
            onClick={() => setHandoffType('desktop-to-mobile')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${handoffType === 'desktop-to-mobile' ? 'bg-white text-brand-deep shadow-lg' : 'text-brand-earth hover:text-brand-deep'}`}
           >
              Desktop to Mobile
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Connection Visualization */}
        <div className="lg:col-span-7 space-y-8">
           <div className="bg-off-white/40 border border-border rounded-[3rem] p-12 relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between relative z-10">
                 <div className={`p-8 rounded-[2rem] border-2 transition-all ${handoffType === 'mobile-to-desktop' ? 'bg-white border-orange-500/50 shadow-2xl scale-110' : 'bg-off-white border-border opacity-50'}`}>
                    <Smartphone size={48} className={handoffType === 'mobile-to-desktop' ? 'text-accent-earth' : 'text-brand-earth'} />
                    <p className="text-[10px] font-black uppercase mt-4 text-center">Mobile</p>
                 </div>

                 <div className="flex-1 flex flex-col items-center gap-2 px-6">
                    <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent relative">
                       <div className="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-3 bg-accent-earth rounded-full shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-pulse" style={{ left: handoffType === 'mobile-to-desktop' ? 'calc(0% + (stage * 50%))' : 'calc(100% - (stage * 50%))' }} />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-accent-earth animate-pulse">Session Encrypted</span>
                 </div>

                 <div className={`p-8 rounded-[2rem] border-2 transition-all ${handoffType === 'desktop-to-mobile' ? 'bg-white border-orange-500/50 shadow-2xl scale-110' : 'bg-off-white border-border opacity-50'}`}>
                    <Monitor size={48} className={handoffType === 'desktop-to-mobile' ? 'text-accent-earth' : 'text-brand-earth'} />
                    <p className="text-[10px] font-black uppercase mt-4 text-center">Desktop</p>
                 </div>
              </div>

              {/* NFC / QR Pairing Logic (Mock) */}
              <div className="mt-12 bg-white/60 border border-border p-10 rounded-[2.5rem] flex flex-col items-center text-center space-y-6">
                 <div className="w-48 h-48 bg-white border-4 border-border rounded-3xl p-4 flex items-center justify-center shadow-inner group hover:border-orange-500/30 transition-all cursor-pointer">
                    <QrCode size={120} className="text-brand-deep group-hover:scale-105 transition-transform" />
                 </div>
                 <div className="space-y-2">
                    <h4 className="text-sm font-black uppercase italic tracking-widest text-brand-deep">Scan to Link</h4>
                    <p className="text-[10px] text-brand-earth max-w-[240px] mx-auto leading-relaxed">
                       Scan this QR from your other device to establish an ephemeral NOSTR-relay session.
                    </p>
                 </div>
                 <div className="flex gap-3">
                    <div className="bg-ivory border border-border px-4 py-2 rounded-xl flex items-center gap-3">
                       <span className="text-[10px] font-mono text-brand-earth">{generateMockWallet()}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stages.map((stage, i) => (
                 <div key={i} className={`p-6 rounded-[2rem] border transition-all ${activeStage >= i ? 'bg-white border-orange-500/20 shadow-xl' : 'bg-off-white/40 border-border opacity-60'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${activeStage >= i ? 'bg-orange-500/10 text-accent-earth' : 'bg-border text-brand-earth'}`}>
                       <stage.icon size={18} />
                    </div>
                    <h5 className="text-[10px] font-black uppercase mb-1">{stage.title}</h5>
                    <p className="text-[9px] text-brand-earth leading-tight italic">{stage.description}</p>
                 </div>
              ))}
           </div>
        </div>

        {/* Action Controls */}
        <div className="lg:col-span-5 space-y-8">
           <div className="bg-brand-deep p-10 rounded-[3rem] text-ivory space-y-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                 <ShieldCheck size={120} />
              </div>

              <div className="relative z-10 space-y-6">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">Security Posture</h3>
                 <div className="space-y-4">
                    {[
                       { label: 'E2E Encryption', status: 'AES-GCM-256' },
                       { label: 'Relay Privacy', status: 'Tor Enabled' },
                       { label: 'Key Isolation', status: 'Enclave-Only' }
                    ].map((item, i) => (
                       <div key={i} className="flex justify-between items-center border-b border-white/10 pb-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{item.label}</span>
                          <span className="text-[10px] font-mono text-accent-earth">{item.status}</span>
                       </div>
                    ))}
                 </div>

                 <button 
                  onClick={() => setActiveStage(prev => (prev + 1) % 3)}
                  className="w-full bg-white hover:bg-ivory text-brand-deep py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
                 >
                    {activeStage === 2 ? 'Session Active' : 'Authorize Next Step'}
                    <ArrowRight size={16} />
                 </button>
              </div>
           </div>

           <div className="bg-off-white/40 border border-border rounded-[3rem] p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3">
                 <Terminal size={18} className="text-brand-earth" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-brand-earth">Session Logs</span>
              </div>
              <div className="font-mono text-[9px] text-brand-earth space-y-2 bg-white/50 p-6 rounded-2xl border border-border min-h-[140px]">
                 <p className="text-green-600">&gt; Relaying via wss://relay.conxian.io</p>
                 <p>&gt; Handshaking: X3DH Key Exchange...</p>
                 <p>&gt; Identity Verified: 0x{generateRandomString(16)}...</p>
                 <p className="animate-pulse">&gt; Monitoring session heartbeat...</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default HandoffProtocol;
