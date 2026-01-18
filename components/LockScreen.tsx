
import React, { useState } from 'react';
import { Lock, ChevronRight, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface LockScreenProps {
  onUnlock: (pin: string) => Promise<void>;
  isError: boolean;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, isError }) => {
  const [pin, setPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;
    
    setIsValidating(true);
    // Artificial delay to prevent brute-force timing attacks
    await new Promise(r => setTimeout(r, 500));
    await onUnlock(pin);
    setIsValidating(false);
    setPin('');
  };

  const handleNumClick = (num: string) => {
    if (pin.length < 8) setPin(prev => prev + num);
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-[1000] p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 animate-in zoom-in duration-300">
        <div className="flex flex-col items-center gap-4 mb-4">
           <div className="w-20 h-20 bg-zinc-900 rounded-[2rem] flex items-center justify-center shadow-2xl border border-zinc-800 relative">
              <Lock size={32} className="text-orange-500" />
              {isError && (
                 <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full animate-bounce">
                    <AlertCircle size={14} />
                 </div>
              )}
           </div>
           <div className="text-center">
              <h1 className="text-2xl font-black text-zinc-100 tracking-tighter uppercase italic">Conxius Enclave</h1>
              <p className="text-xs text-zinc-500 font-medium mt-1">Sovereign Environment Locked</p>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-8">
           <div className="flex justify-center gap-4">
              {[...Array(4)].map((_, i) => (
                 <div 
                   key={i} 
                   className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      i < pin.length 
                        ? isError ? 'bg-red-500 scale-110' : 'bg-orange-500 scale-110' 
                        : 'bg-zinc-800'
                   }`} 
                 />
              ))}
           </div>

           <div className="grid grid-cols-3 gap-4 px-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((item, i) => (
                 item === '' ? <div key={i} /> :
                 item === 'del' ? (
                    <button 
                      type="button" 
                      key={i}
                      onClick={() => setPin(prev => prev.slice(0, -1))}
                      className="h-16 rounded-2xl flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 transition-all font-bold text-xs uppercase"
                    >
                       Delete
                    </button>
                 ) : (
                    <button 
                      type="button" 
                      key={i}
                      onClick={() => handleNumClick(item.toString())}
                      className="h-16 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-900 hover:border-zinc-700 rounded-2xl text-xl font-bold text-zinc-200 transition-all active:scale-95"
                    >
                       {item}
                    </button>
                 )
              ))}
           </div>

           <button 
             type="submit" 
             disabled={pin.length < 4 || isValidating}
             className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-3xl text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
           >
              {isValidating ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {isValidating ? 'Decrypting State...' : 'Unlock Vault'}
           </button>
        </form>
      </div>
    </div>
  );
};

export default LockScreen;
