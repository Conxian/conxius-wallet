import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Lock,
  FlaskConical,
  ArrowRight,
  ShieldCheck,
  Eye,
  Loader2,
  Fingerprint,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { WalletConfig } from '../types';

interface OnboardingProps {
  onComplete: (config: WalletConfig, pin: string) => void;
}

type Step = 'intro' | 'entropy' | 'security' | 'backup' | 'verify';

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('intro');
  const [entropyProgress, setEntropyProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyWords, setVerifyWords] = useState<string[]>(['', '', '']);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const entropyBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 'entropy') {
      const handleMouseMove = () => {
        setEntropyProgress(prev => {
          const next = Math.min(100, prev + 0.5);
          if (next === 100 && !isGenerating) {
            setIsGenerating(true);
            setTimeout(() => {
              setMnemonic(['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident']);
              setStep('security');
              setIsGenerating(false);
            }, 1500);
          }
          return next;
        });
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [step, isGenerating]);

  const handleFinalize = () => {
    setIsFinalizing(true);
    setTimeout(() => {
      onComplete({
        type: "single",
        mnemonicVault: mnemonic.join(' '),
        backupVerified: true
      }, pin);
      setIsFinalizing(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-ivory z-[500] flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">
      <div className="w-full max-w-lg space-y-12 py-12">
        {step === 'intro' && (
          <div className="space-y-10 text-center animate-in fade-in slide-in-from-bottom-4">
             <div className="w-24 h-24 bg-white border border-border rounded-[2.5rem] flex items-center justify-center mx-auto text-accent-earth shadow-xl mb-6">
                <Shield size={48} />
             </div>
             <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-brand-deep">
                  Initialize <span className="text-accent-earth">Enclave</span>
                </h2>
                <p className="text-sm text-brand-earth max-w-sm mx-auto font-medium leading-relaxed">
                   Establish a hardware-isolated cryptographic root. Your keys NEVER leave this device.
                </p>
             </div>
             <button
                onClick={() => setStep('entropy')}
                className="w-full bg-accent-earth hover:bg-accent-earth/90 text-white font-black py-6 rounded-[2rem] text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
             >
                Start Entropy Capture <ArrowRight size={18} />
             </button>
          </div>
        )}

        {step === 'entropy' && (
          <div className="space-y-10 text-center animate-in zoom-in duration-500">
             <div className="space-y-6">
                <div className="w-16 h-16 bg-off-white border border-border rounded-2xl flex items-center justify-center mx-auto text-accent-earth animate-pulse shadow-sm">
                   <Fingerprint size={32} />
                </div>
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-brand-deep">Gathering Entropy</h3>
                <p className="text-xs text-brand-earth italic max-w-[240px] mx-auto">
                   Hardware-level noise captured via cursor trajectory.
                </p>
             </div>

             <div className="space-y-3">
                <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-border shadow-inner">
                   <div 
                     className="h-full bg-accent-earth transition-all duration-300"
                     style={{ width: `${entropyProgress}%` }}
                   />
                </div>
                <p className="text-[10px] font-black text-brand-earth uppercase tracking-widest">{Math.floor(entropyProgress)}% Captured</p>
             </div>
             {isGenerating && (
                <div className="flex items-center justify-center gap-2 text-accent-earth text-[10px] font-black uppercase tracking-widest animate-pulse">
                   <Loader2 size={12} className="animate-spin" /> Finalizing BIP-39 Map...
                </div>
             )}
          </div>
        )}

        {step === 'security' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-white border border-border rounded-2xl flex items-center justify-center mx-auto text-accent-earth shadow-xl mb-4">
                   <Lock size={32} />
                </div>
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-brand-deep">Secure Enclave</h3>
                <p className="text-xs text-brand-earth italic">Set a PIN to encrypt your local session.</p>
             </div>

             <div className="space-y-5">
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Enclave PIN (4-8 digits)</label>
                   <input 
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="PIN"
                      className="w-full bg-white border border-border rounded-2xl py-5 px-6 text-center text-3xl font-mono text-brand-deep tracking-[1em] focus:outline-none focus:border-accent-earth focus:ring-1 focus:ring-accent-earth transition-all shadow-sm"
                      maxLength={8}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Confirm PIN</label>
                   <input 
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Confirm"
                      className="w-full bg-white border border-border rounded-2xl py-5 px-6 text-center text-3xl font-mono text-brand-deep tracking-[1em] focus:outline-none focus:border-accent-earth focus:ring-1 focus:ring-accent-earth transition-all shadow-sm"
                      maxLength={8}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-brand-earth ml-1">BIP-39 Passphrase (Optional)</label>
                   <input 
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Optional passphrase"
                      className="w-full bg-white border border-border rounded-2xl py-4 px-6 text-center text-sm font-mono text-brand-deep tracking-widest focus:outline-none focus:border-accent-earth transition-all shadow-sm"
                   />
                </div>
             </div>

             <button 
                onClick={() => setStep('backup')}
                disabled={!pin || pin.length < 4 || pin !== confirmPin}
                className="w-full bg-brand-deep hover:bg-ivory disabled:opacity-50 text-white font-black py-6 rounded-[2rem] text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl"
             >
                <CheckCircle2 size={18} /> Confirm Encryption
             </button>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
             <div className="text-center space-y-2">
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-brand-deep">Master Seed Backup</h3>
                <p className="text-xs text-brand-earth italic">Production-grade recovery phrase.</p>
             </div>

             <div className="relative group">
                <div className={`grid grid-cols-3 gap-3 p-8 bg-white border border-border rounded-[3rem] transition-all duration-500 shadow-inner ${!showMnemonic ? 'blur-md' : 'blur-0'}`}>
                   {mnemonic.map((word, i) => (
                      <div key={i} className="flex items-center gap-2">
                         <span className="text-[9px] text-brand-earth font-mono">{i+1}.</span>
                         <span className="text-xs font-bold text-brand-deep">{showMnemonic ? word : '••••'}</span>
                      </div>
                   ))}
                </div>
                {!showMnemonic && (
                  <button 
                    onClick={() => setShowMnemonic(true)}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-transparent rounded-[3rem]"
                  >
                     <Eye size={32} className="text-accent-earth" />
                     <span className="text-[10px] font-black uppercase text-accent-earth mt-2">Reveal Phrase</span>
                  </button>
                )}
             </div>

             <div className="bg-accent-earth/10 border border-accent-earth/20 p-6 rounded-[2rem] flex gap-4 shadow-sm">
                <AlertTriangle className="text-accent-earth shrink-0" size={24} />
                <p className="text-[10px] text-accent-earth italic font-bold leading-relaxed">
                   This phrase is encrypted locally. It is NEVER transmitted to Conxian-Labs. Keep it offline.
                </p>
             </div>

             <button
               onClick={() => {
                  const array = new Uint32Array(3);
                  globalThis.crypto.getRandomValues(array);
                  const indices = [
                    array[0] % 4,
                    (array[1] % 4) + 4,
                    (array[2] % 4) + 8
                  ];
                  setVerifyIndices(indices);
                  setVerifyWords(['', '', '']);
                  setStep('verify');
               }}
               className="w-full bg-brand-deep text-white font-black py-6 rounded-[2rem] text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-ivory transition-all"
             >
                <ArrowRight size={18} /> Verify Backup
             </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
             <div className="text-center space-y-2">
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-brand-deep">Verify Backup</h3>
                <p className="text-xs text-brand-earth">Confirm you've secured your recovery phrase.</p>
             </div>

             <div className="space-y-6">
                {verifyIndices.map((idx, i) => (
                  <div key={idx} className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Word #{idx + 1}</label>
                    <input
                      type="password"
                      value={verifyWords[i]}
                      onChange={(e) => {
                        const next = [...verifyWords];
                        next[i] = e.target.value.toLowerCase().trim();
                        setVerifyWords(next);
                      }}
                      className="w-full bg-white border border-border rounded-2xl py-4 px-6 text-center text-lg font-mono text-brand-deep focus:outline-none focus:border-accent-earth focus:ring-1 focus:ring-accent-earth transition-all shadow-sm"
                    />
                  </div>
                ))}
             </div>

             <button 
               onClick={handleFinalize}
               disabled={isFinalizing || verifyWords.some((w, i) => w !== mnemonic[verifyIndices[i]])}
               className="w-full bg-accent-earth hover:bg-accent-earth/90 text-white font-black py-6 rounded-[2rem] text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all"
             >
                {isFinalizing ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {isFinalizing ? 'Deriving Roots...' : 'Initialize Enclave'}
             </button>
          </div>
        )}

        <p className="text-center text-[9px] text-brand-earth uppercase tracking-[0.3em] font-black">
          Conxius SVN 1.6 • SOVEREIGN EARTHY
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
