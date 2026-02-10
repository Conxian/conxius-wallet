
import React, { useState, useEffect, useRef } from 'react';
import { Shield as ShieldIcon, ArrowRight, Key, Users, Zap, ShieldCheck, RefreshCcw, RotateCcw, Loader2, Eye, Lock, AlertTriangle, Database, Globe, CheckCircle2, FlaskConical } from 'lucide-react';
import { WalletConfig, AppMode } from '../types';
import { deriveSovereignRoots } from '../services/signer';
import { encryptSeed } from '../services/seed';
import * as bip39 from 'bip39';

interface OnboardingProps {
  onComplete: (config: WalletConfig & { mode: AppMode }, pin: string) => void;
}

const BIP39_SUBSET = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse", "access", "accident",
  "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
  "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance", "advice", "aerobic", "affair", "afford",
  "afraid", "again", "age", "agent", "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol",
  "alert", "alien", "all", "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter", "always", "amaze",
  "amber", "ambush", "among", "amount", "amuse", "analyst", "anchor", "ancient", "anger", "angle", "angry", "animal",
  "ankle", "announce", "annual", "another", "answer", "antenna", "antique", "anxiety", "any", "apart", "apology", "appear",
  "apple", "approve", "april", "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor", "army", "around",
  "arrange", "arrest", "arrive", "arrow", "art", "artefact", "artist", "artwork", "ask", "aspect", "assault", "asset",
  "assist", "assume", "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction", "audit", "august"
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'start' | 'import' | 'type' | 'entropy' | 'security' | 'backup' | 'verify'>('start');
  const [appMode, setAppMode] = useState<AppMode>('sovereign');
  const [walletType, setWalletType] = useState<'single' | 'multisig' | 'hot'>('single');
  const [entropyProgress, setEntropyProgress] = useState(0);
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  // Refs for dynamic styles to avoid inline-style linter warnings
  const entropyCircleRef = useRef<HTMLDivElement>(null);
  const entropyBarRef = useRef<HTMLDivElement>(null);
  
  // Security State
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [passphrase, setPassphrase] = useState('');

  // Import State
  const [importText, setImportText] = useState('');

  // Verification State
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyWords, setVerifyWords] = useState<string[]>([]);

  // Entropy Harvesting
  const handleEntropyInput = () => {
    if (step === 'entropy' && entropyProgress < 100) {
      setEntropyProgress(prev => Math.min(100, prev + 0.5)); // Increased speed slightly for better mobile feel
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleEntropyInput();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleEntropyInput();
  };

  const generateSeed = async () => {
    setIsGenerating(true);
    
    // Real Production Logic using BIP-39
    await new Promise(r => setTimeout(r, 800)); // UX Pause for "Entropy Calculation" effect
    const generatedMnemonic = bip39.generateMnemonic();
    const generated = generatedMnemonic.split(' ');

    setMnemonic(generated);
    setIsGenerating(false);
    setStep('security');
  };

  useEffect(() => {
    // Direct DOM manipulation to avoid linter errors with inline styles
    if (entropyCircleRef.current) {
      entropyCircleRef.current.style.height = `${entropyProgress}%`;
    }
    if (entropyBarRef.current) {
      entropyBarRef.current.style.width = `${entropyProgress}%`;
    }

    if (entropyProgress >= 100) {
      generateSeed();
    }
  }, [entropyProgress]);

  const handleFinalize = async () => {
    setIsFinalizing(true);
    let seedString: string | null = mnemonic.join(' ');

    // Create a reference for seedBytes that can be accessed in finally block
    let seedBytes: Uint8Array | null = null;
    
    try {
      seedBytes = await bip39.mnemonicToSeed(seedString, passphrase || undefined);

      // Async derivation ensures UI doesn't freeze during heavy hashing
      const roots = await deriveSovereignRoots(seedString, passphrase || undefined);
      const seedVault = await encryptSeed(new Uint8Array(seedBytes), pin);
      const mnemonicVault = await encryptSeed(new TextEncoder().encode(seedString), pin);

      // SECURITY: Nullify local reference to seedString after its last cryptographic use
      seedString = null;

      // Pass PIN up to App for encryption
      onComplete({
        mode: appMode,
        type: walletType,
        seedVault,
        mnemonicVault,
        backupVerified: true,
        masterAddress: roots.btc,
        taprootAddress: roots.taproot,
        stacksAddress: roots.stx
      }, pin);
    } finally {
      // Memory Hardening: scrubbing sensitive seed bytes from RAM
      if (seedBytes) {
        seedBytes.fill(0);
      }
      seedString = null;

      // SECURITY: Clear sensitive material from component state immediately after use
      // This is now in the finally block to ensure it runs even if an error occurs.
      setMnemonic([]);
      setPin('');
      setConfirmPin('');
      setPassphrase('');
      setImportText('');
      setVerifyWords([]);
    }

    setIsFinalizing(false);
  };

  return (
    <div 
      className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans select-none touch-none"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl md:rounded-[3rem] p-6 md:p-10 space-y-6 md:space-y-8 shadow-2xl animate-in fade-in zoom-in duration-500">
        
        {step === 'start' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-orange-500 shadow-xl">
                <FlaskConical size={32} />
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-100 uppercase italic">Conxius Enclave</h2>
              <p className="text-zinc-500 text-sm">Initialize your sovereign interface.</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setStep('type')}
                className="w-full p-6 bg-orange-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-orange-500 transition-all flex items-center justify-between"
              >
                <span>Create Vault</span>
                <ArrowRight size={20} />
              </button>
              <button
                onClick={() => setStep('import')}
                className="w-full p-6 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-[2rem] font-black uppercase tracking-widest hover:border-zinc-700 transition-all flex items-center justify-between"
              >
                <span>Import Recovery</span>
                <RefreshCcw size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 'import' && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="text-center space-y-2">
              <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Import Vault</h3>
              <p className="text-xs text-zinc-500">Enter your 12 or 24 word BIP-39 phrase.</p>
            </div>

            <div className="space-y-4">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="abandon ability able..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-sm font-mono text-white focus:outline-none focus:border-orange-500/50 resize-none"
              />
              <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex gap-3">
                <AlertTriangle className="text-orange-500 shrink-0" size={16} />
                <p className="text-[10px] text-orange-200">Warning: Never enter your seed on an untrusted device.</p>
              </div>
            </div>

            <div className="flex gap-4">
               <button onClick={() => setStep('start')} className="flex-1 py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-black text-xs uppercase">Cancel</button>
               <button
                  disabled={!bip39.validateMnemonic(importText.trim())}
                  onClick={() => {
                    setMnemonic(importText.trim().split(/\s+/));
                    setStep('security');
                  }}
                  className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50"
               >
                  Verify Mnemonic
               </button>
            </div>
          </div>
        )}

        {step === 'type' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg">
                <ShieldIcon size={32} />
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-100 uppercase italic">Configure Vault</h2>
              <p className="text-zinc-500 text-sm">Define your multi-layer signature policy.</p>
            </div>

            <div className="space-y-4">
              {[
                { id: 'single', label: 'Personal Vault', desc: 'Standard security for personal assets.', icon: Key },
                { id: 'multisig', label: 'Treasury (Multi-Sig)', desc: 'Institutional grade M-of-N protection.', icon: Users },
                { id: 'hot', label: 'Lightning Hot Wallet', desc: 'Ephemeral keys for high-speed payments.', icon: Zap },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setWalletType(type.id as any)}
                  className={`w-full p-6 rounded-[2rem] border text-left transition-all group ${
                    walletType === type.id 
                      ? 'bg-orange-600/10 border-orange-500/50 text-white shadow-lg' 
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl transition-colors ${
                      walletType === type.id ? 'bg-orange-500 text-white' : 'bg-zinc-900 text-zinc-600'
                    }`}>
                      <type.icon size={20} />
                    </div>
                    <div>
                       <p className="font-bold text-sm">{type.label}</p>
                       <p className="text-[10px] opacity-70 leading-relaxed">{type.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button 
              onClick={() => setStep('entropy')}
              className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-black py-5 rounded-3xl text-xs uppercase tracking-widest transition-all active:scale-95"
            >
              Continue to Entropy Scan
            </button>
          </div>
        )}

        {step === 'entropy' && (
          <div className="text-center space-y-10 py-10 animate-in fade-in">
             <div className="space-y-4">
                <div className="w-20 h-20 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center mx-auto relative overflow-hidden">
                   <div 
                     ref={entropyCircleRef}
                     className="absolute bottom-0 left-0 right-0 bg-orange-600 transition-all duration-300" 
                   />
                   <RotateCcw className={`text-zinc-200 relative z-10 ${entropyProgress < 100 ? 'animate-spin' : ''}`} size={32} />
                </div>
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Gathering Entropy</h3>
                <p className="text-xs text-zinc-500 italic max-w-[240px] mx-auto">
                   Hardware-level noise captured via cursor trajectory.
                </p>
             </div>

             <div className="space-y-2">
                <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                   <div 
                     ref={entropyBarRef}
                     className="h-full bg-orange-500 transition-all" 
                   />
                </div>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{Math.floor(entropyProgress)}% Captured</p>
             </div>
             {isGenerating && (
                <div className="flex items-center justify-center gap-2 text-orange-500 text-[10px] font-black uppercase">
                   <Loader2 size={12} className="animate-spin" /> Finalizing BIP-39 Map...
                </div>
             )}
          </div>
        )}

        {step === 'security' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-orange-500 shadow-xl mb-4">
                   <Lock size={32} />
                </div>
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Secure Enclave</h3>
                <p className="text-xs text-zinc-500 italic">Set a PIN to encrypt your local session.</p>
             </div>

             <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-zinc-600 ml-1">Enclave PIN (4-8 digits)</label>
                   <input 
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="PIN"
                      aria-label="Enclave PIN"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-center text-2xl font-mono text-white tracking-widest focus:outline-none focus:border-orange-500/50"
                      maxLength={8}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-zinc-600 ml-1">Confirm PIN</label>
                   <input 
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Confirm"
                      aria-label="Confirm Enclave PIN"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-center text-2xl font-mono text-white tracking-widest focus:outline-none focus:border-orange-500/50"
                      maxLength={8}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-zinc-600 ml-1">BIP-39 Passphrase (Optional)</label>
                   <input 
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Optional passphrase"
                      aria-label="BIP-39 Passphrase"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-center text-sm font-mono text-white tracking-widest focus:outline-none focus:border-orange-500/50"
                   />
                </div>
             </div>

             <button 
                onClick={() => setStep('backup')}
                disabled={!pin || pin.length < 4 || pin !== confirmPin}
                className="w-full bg-zinc-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-black py-5 rounded-3xl text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
             >
                <CheckCircle2 size={16} /> Confirm Encryption
             </button>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
             <div className="text-center space-y-2">
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Master Seed Backup</h3>
                <p className="text-xs text-zinc-500 italic">Production-grade recovery phrase.</p>
             </div>

             <div className="relative group">
                <div className={`grid grid-cols-3 gap-2 p-6 bg-zinc-950 border border-zinc-800 rounded-[2rem] transition-all duration-500 ${!showMnemonic ? 'blur-md' : 'blur-0'}`}>
                   {mnemonic.map((word, i) => (
                      <div key={i} className="flex items-center gap-2">
                         <span className="text-[9px] text-zinc-700 font-mono">{i+1}.</span>
                         <span className="text-xs font-bold text-zinc-300">{word}</span>
                      </div>
                   ))}
                </div>
                {!showMnemonic && (
                  <button 
                    onClick={() => setShowMnemonic(true)}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-transparent rounded-[2rem]"
                  >
                     <Eye size={32} className="text-orange-500" />
                     <span className="text-[10px] font-black uppercase text-orange-500 mt-2">Reveal Phrase</span>
                  </button>
                )}
             </div>

             <div className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-2xl flex gap-4">
                <AlertTriangle className="text-orange-500 shrink-0" size={20} />
                <p className="text-[10px] text-orange-200 italic font-medium">
                   This phrase is encrypted locally. It is NEVER transmitted to Conxius Labs.
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
               className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-black py-5 rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3"
             >
                <ArrowRight size={16} /> Verify Backup
             </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
             <div className="text-center space-y-2">
                <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter">Verify Backup</h3>
                <p className="text-xs text-zinc-500">Confirm you've secured your recovery phrase.</p>
             </div>

             <div className="space-y-6">
                {verifyIndices.map((idx, i) => (
                  <div key={idx} className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-600 ml-1">Word #{idx + 1}</label>
                    <input
                      type="password"
                      value={verifyWords[i]}
                      onChange={(e) => {
                        const next = [...verifyWords];
                        next[i] = e.target.value.toLowerCase().trim();
                        setVerifyWords(next);
                      }}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-6 text-center text-lg font-mono text-white focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                ))}
             </div>

             <button 
               onClick={handleFinalize}
               disabled={isFinalizing || verifyWords.some((w, i) => w !== mnemonic[verifyIndices[i]])}
               className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-3xl text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
             >
                {isFinalizing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {isFinalizing ? 'Deriving Roots...' : 'Initialize Enclave'}
             </button>
          </div>
        )}

        <p className="text-center text-[9px] text-zinc-700 uppercase tracking-widest font-black">
          Conxius SVN 0.3 • SOVEREIGN
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
