import React from 'react';
import { AlertCircle, ShieldCheck, X } from 'lucide-react';
import type { PreparedValueOperationAuthorizationRequest } from '../services/value-operations';

interface ValueOperationAuthorizationModalProps {
    request: PreparedValueOperationAuthorizationRequest;
    onConfirm: () => void;
    onCancel: () => void;
}

const ValueOperationAuthorizationModal: React.FC<ValueOperationAuthorizationModalProps> = ({
    request,
    onConfirm,
    onCancel,
}) => {
    const { summary } = request;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 backdrop-blur-sm bg-brand-deep/60 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="p-8 space-y-7">
                    <div className="flex justify-between items-center">
                        <div className="w-12 h-12 bg-accent-earth/10 rounded-full flex items-center justify-center text-accent-earth">
                            <ShieldCheck size={24} />
                        </div>
                        <button onClick={onCancel} aria-label="Cancel value operation" className="text-brand-earth hover:text-brand-deep">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-brand-deep">{summary.title}</h3>
                        <p className="text-xs text-brand-earth italic">Confirmation records your intent only. Evidence and custody are verified separately.</p>
                    </div>

                    <div className="bg-off-white/50 border border-border rounded-3xl p-6 space-y-4 text-sm">
                        <div><p className="text-[9px] font-black uppercase text-brand-earth">Action</p><p className="font-bold text-brand-deep">{summary.action}</p></div>
                        {summary.amount && <div><p className="text-[9px] font-black uppercase text-brand-earth">Amount</p><p className="font-mono text-brand-deep">{summary.amount}</p></div>}
                        {summary.destination && <div><p className="text-[9px] font-black uppercase text-brand-earth">Destination</p><p className="font-mono text-brand-deep break-all">{summary.destination}</p></div>}
                        <div className="grid grid-cols-2 gap-4">
                            <div><p className="text-[9px] font-black uppercase text-brand-earth">Network</p><p className="font-bold text-brand-deep">{summary.network}</p></div>
                            <div><p className="text-[9px] font-black uppercase text-brand-earth">Purpose</p><p className="font-bold text-brand-deep">{summary.purpose}</p></div>
                        </div>
                        <div className="pt-4 border-t border-border">
                            <p className="text-[9px] font-black uppercase text-brand-earth">Bound intent</p>
                            <p className="font-mono text-[10px] text-brand-earth break-all">{request.intentDigest}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-accent-earth/5 border border-orange-500/10 rounded-2xl">
                        <AlertCircle size={14} className="text-accent-earth shrink-0 mt-0.5" />
                        <p className="text-[10px] text-brand-earth italic leading-relaxed">The operation remains unavailable unless authoritative evidence and native custody checks pass.</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-off-white border-t border-border">
                    <button onClick={onCancel} className="p-6 bg-white text-brand-earth text-[10px] font-black uppercase tracking-widest">Decline</button>
                    <button onClick={onConfirm} className="p-6 bg-accent-earth text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        <ShieldCheck size={16} /> Confirm intent
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ValueOperationAuthorizationModal;
