import React, { useState } from 'react';
import { Lock, Loader2, ShieldCheck, AlertCircle, Fingerprint } from 'lucide-react';
import { authenticateBiometric } from '../services/biometric';

interface LockScreenProps {
  onUnlock: (pin: string) => Promise<void>;
  isError: boolean;
  requireBiometric?: boolean;
  onResetWallet?: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, isError, requireBiometric, onResetWallet }) => {
  const [pin, setPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [biometricApproved, setBiometricApproved] = useState(!requireBiometric);
  const [isBiometricChecking, setIsBiometricChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    
    setIsValidating(true);
    await new Promise(r => setTimeout(r, 500));
    await onUnlock(pin);
    setIsValidating(false);
    setPin('');
  };

  const handleNumClick = (num: string) => {
    if (!biometricApproved) return;
    if (pin.length < 8) setPin(prev => prev + num);
  };

  const handleDel = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 bg-ivory flex items-center justify-center z-[1000] p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 animate-in zoom-in duration-300">
        <div className="flex flex-col items-center gap-4 mb-4">
           <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center shadow-xl border border-border relative">
              <Lock size={32} className="text-accent-earth" />
              {isError && (
                 <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1.5 rounded-full animate-bounce shadow-md">
                    <AlertCircle size={14} />
                 </div>
              )}
           </div>
           <div className="text-center">
              <h1 className="text-2xl font-black text-brand-deep tracking-tighter uppercase italic">Conxius Enclave</h1>
              <p className="text-xs text-brand-earth font-bold mt-1 tracking-widest uppercase">Locked Environment</p>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-10">
           {requireBiometric && !biometricApproved && (
             <button
               type="button"
               onClick={async () => {
                 setIsBiometricChecking(true);
                 const ok = await authenticateBiometric();
                 setBiometricApproved(ok);
                 setIsBiometricChecking(false);
               }}
               disabled={isBiometricChecking}
               className="w-full bg-off-white hover:bg-white border border-border text-brand-deep font-black py-5 rounded-3xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
             >
               {isBiometricChecking ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={18} />}
               {isBiometricChecking ? 'Verifying...' : 'Verify Biometrics'}
             </button>
           )}
           <div className="flex justify-center gap-5">
              {[...Array(4)].map((_, i) => (
                 <div 
                   key={i} 
                   className={`w-5 h-5 rounded-full transition-all duration-300 shadow-sm ${
                      i < pin.length 
                        ? isError ? 'bg-red-600 scale-110' : 'bg-accent-earth scale-110'
                        : 'bg-off-white border border-border'
                   }`} 
                 />
              ))}
           </div>

           <div className="grid grid-cols-3 gap-6 px-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((item, i) => (
                 item === '' ? <div key={i} /> :
                 item === 'del' ? (
                    <button 
                      type="button" 
                      key={i}
                      onClick={handleDel}
                      className="h-20 rounded-2xl flex items-center justify-center text-brand-earth hover:text-brand-deep font-black text-[10px] uppercase tracking-widest active:scale-90 transition-all"
                      disabled={!biometricApproved}
                    >
                       Delete
                    </button>
                 ) : (
                    <button 
                      type="button" 
                      key={i}
                      onClick={() => handleNumClick(item.toString())}
                      disabled={!biometricApproved}
                      className="h-20 bg-white hover:bg-off-white border border-border rounded-3xl text-2xl font-black text-brand-deep transition-all active:scale-90 disabled:opacity-40 shadow-sm"
                    >
                       {item}
                    </button>
                 )
              ))}
           </div>

           <div className="space-y-4">
              <button
                type="submit"
                disabled={!biometricApproved || pin.length < 4 || isValidating}
                className="w-full bg-brand-deep hover:bg-ivory disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-6 rounded-[2rem] text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                 {isValidating ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                 {isValidating ? 'Decrypting Vault...' : 'Unlock Enclave'}
              </button>
              {onResetWallet && (
                <button
                  type="button"
                  onClick={onResetWallet}
                  className="w-full text-brand-earth hover:text-brand-deep text-[9px] font-black uppercase tracking-widest py-2 transition-colors"
                >
                  Terminate & Wipe Enclave
                </button>
              )}
           </div>
        </form>
      </div>
    </div>
  );
};

export default LockScreen;
