import React from 'react';
import { ShieldCheck, Globe, Clock, Fingerprint, X, AlertCircle } from 'lucide-react';
import { parseBip322Message } from '../services/signer';

interface SignLoginMessageModalProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const SignLoginMessageModal: React.FC<SignLoginMessageModalProps> = ({ message, onConfirm, onCancel }) => {
    const parsed = parseBip322Message(message);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-black/60 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                <div className="p-8 space-y-8">
                    <div className="flex justify-between items-center">
                        <div className="w-12 h-12 bg-orange-600/10 rounded-full flex items-center justify-center text-orange-500">
                            <ShieldCheck size={24} />
                        </div>
                        <button onClick={onCancel} className="text-zinc-600 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                            {parsed.isLogin ? 'Secure Domain Login' : 'Signature Request'}
                        </h3>
                        <p className="text-xs text-zinc-500 italic">
                            {parsed.isLogin
                                ? 'A decentralized application is requesting your sovereign identity.'
                                : 'A protocol is requesting a signed proof from your enclave.'}
                        </p>
                    </div>

                    {parsed.isLogin && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-4">
                            <div className="flex items-center gap-4 text-zinc-300">
                                <Globe size={16} className="text-orange-500" />
                                <div>
                                    <p className="text-[10px] font-black uppercase text-zinc-600">Requesting Domain</p>
                                    <p className="text-sm font-bold font-mono">{parsed.domain || 'Unknown Domain'}</p>
                                </div>
                            </div>

                            {parsed.nonce && (
                                <div className="flex items-center gap-4 text-zinc-300">
                                    <Fingerprint size={16} className="text-orange-500" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-zinc-600">Session Nonce</p>
                                        <p className="text-[10px] font-mono break-all">{parsed.nonce}</p>
                                    </div>
                                </div>
                            )}

                            {parsed.timestamp && (
                                <div className="flex items-center gap-4 text-zinc-300">
                                    <Clock size={16} className="text-orange-500" />
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-zinc-600">Issued At</p>
                                        <p className="text-[10px] font-mono">{new Date(parsed.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!parsed.isLogin && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-2">
                             <p className="text-[10px] font-black uppercase text-zinc-600">Raw Message Payload</p>
                             <div className="max-h-32 overflow-y-auto bg-zinc-950 p-4 rounded-xl border border-zinc-900">
                                <p className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">{message}</p>
                             </div>
                        </div>
                    )}

                    <div className="flex items-start gap-3 p-4 bg-orange-600/5 border border-orange-500/10 rounded-2xl">
                        <AlertCircle size={14} className="text-orange-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-zinc-500 italic leading-relaxed">
                            Signing this message proves you control the keys to this wallet. Ensure you trust the requesting application.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-px bg-zinc-900 border-t border-zinc-900">
                    <button
                        onClick={onCancel}
                        className="p-6 bg-zinc-950 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                        Decline
                    </button>
                    <button
                        onClick={onConfirm}
                        className="p-6 bg-orange-600 text-white hover:bg-orange-500 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                        <ShieldCheck size={16} />
                        Confirm Sign
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignLoginMessageModal;
