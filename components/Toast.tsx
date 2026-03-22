import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-24 md:bottom-8 right-6 md:right-8 z-[1000] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; removeToast: (id: string) => void }> = ({ toast, removeToast }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const icons = {
    success: <CheckCircle2 className="text-success" size={18} />,
    error: <AlertCircle className="text-red-600" size={18} />,
    info: <Info className="text-accent-earth" size={18} />,
  };

  const bgColors = {
    success: 'bg-white border-success/30 shadow-success/10',
    error: 'bg-white border-red-200 shadow-red-100',
    info: 'bg-white border-accent-earth/30 shadow-accent-earth/10',
  };

  return (
    <div className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl border bg-white shadow-2xl animate-in slide-in-from-right-4 duration-300 ${bgColors[toast.type]}`}>
      <div className="shrink-0">{icons[toast.type]}</div>
      <p className="text-xs font-bold text-brand-deep tracking-tight">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-2 text-brand-earth hover:text-brand-deep transition-colors"
        aria-label="Dismiss toast"
        title="Dismiss toast"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ToastContainer;
