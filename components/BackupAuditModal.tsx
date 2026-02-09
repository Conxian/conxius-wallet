import React, { useState, useContext } from 'react';
import { ShieldCheck, X, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { AppContext } from '../context';
import { decryptSeed } from '../services/seed';

interface BackupAuditModalProps {
  onClose: () => void;
}

const BackupAuditModal: React.FC<BackupAuditModalProps> = ({ onClose }) => {
  const handleClose = () => {
    // SECURITY: Clear sensitive material before closing
    setPin('');
    setMnemonicInput('');
    onClose();
  };

  const appContext = useContext(AppContext);
  const [step, setStep] = useState<'pin' | 'mnemonic' | 'success' | 'failure'>('pin');
  const [pin, setPin] = useState('');
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!appContext?.state.walletConfig?.mnemonicVault) throw new Error("No vault found");
      // Test PIN by attempting to decrypt
      await decryptSeed(appContext.state.walletConfig.mnemonicVault, pin);
      setStep('mnemonic');
    } catch (err) {
      setError("Invalid Enclave PIN");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMnemonicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const vault = appContext?.state.walletConfig?.mnemonicVault;
      if (!vault) throw new Error("Vault missing");

      const decryptedBytes = await decryptSeed(vault, pin);
      const decryptedMnemonic = new TextDecoder().decode(decryptedBytes).trim().toLowerCase();
      const inputMnemonic = mnemonicInput.trim().toLowerCase();

      if (decryptedMnemonic === inputMnemonic) {
        setStep('success');

        // SECURITY: Clear sensitive material from memory immediately after verification
        setPin('');
        setMnemonicInput('');

        appContext?.setSecurity({ ...appContext.state.security, ...{ backupVerified: true } } as any);
        // We also want to update the walletConfig itself
        if (appContext?.state.walletConfig) {
           appContext.setWalletConfig({
             ...appContext.state.walletConfig,
             backupVerified: true
           });
        }
      } else {
        setStep('failure');
      }
    } catch (err) {
      setError("Verification failed. Ensure your phrase is correct.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[3rem] p-8 space-y-6 relative shadow-2xl">
        <button onClick={handleClose} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500 mb-2">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Backup Health Audit</h3>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Milestone M8 • Protocol Alpha</p>
        </div>

        {step === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-6 animate-in slide-in-from-bottom-4">
            <p className="text-xs text-zinc-400 text-center px-4">Enter your Enclave PIN to authorize the audit.</p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 text-center text-2xl font-mono text-white tracking-[1em] focus:outline-none focus:border-orange-500/50"
            />
            {error && <p className="text-[10px] text-red-500 text-center font-bold uppercase">{error}</p>}
            <button
              disabled={isLoading || pin.length < 4}
              className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Authorize Audit'}
            </button>
          </form>
        )}

        {step === 'mnemonic' && (
          <form onSubmit={handleMnemonicSubmit} className="space-y-6 animate-in slide-in-from-right-4">
            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-2xl flex gap-3">
              <AlertTriangle size={18} className="text-orange-500 shrink-0" />
              <p className="text-[10px] text-orange-200 leading-relaxed font-medium">
                Enter your 12 or 24-word recovery phrase exactly as written. This check happens entirely in memory and is cleared immediately.
              </p>
            </div>
            <textarea
              value={mnemonicInput}
              onChange={(e) => setMnemonicInput(e.target.value)}
              placeholder="word1 word2 word3..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-orange-500/50 resize-none"
            />
            {error && <p className="text-[10px] text-red-500 text-center font-bold uppercase">{error}</p>}
            <button
              disabled={isLoading || !mnemonicInput.trim()}
              className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-orange-500 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Verify Phrase'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="text-center space-y-6 animate-in zoom-in-95">
            <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-[2rem] space-y-2">
              <p className="text-sm font-bold text-green-500 uppercase tracking-widest italic">Verification Successful</p>
              <p className="text-xs text-zinc-400">Your physical backup is healthy and matches the enclave's root.</p>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-zinc-100 text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-white transition-all"
            >
              Done
            </button>
          </div>
        )}

        {step === 'failure' && (
          <div className="text-center space-y-6 animate-in zoom-in-95">
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2rem] space-y-2">
              <p className="text-sm font-bold text-red-500 uppercase tracking-widest italic">Verification Failed</p>
              <p className="text-xs text-zinc-400">The phrase entered does not match your active vault.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('mnemonic')}
                className="flex-1 bg-zinc-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCcw size={16} /> Retry
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-zinc-200 transition-all"
              >
                Abort
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupAuditModal;
