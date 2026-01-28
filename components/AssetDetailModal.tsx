
import React, { useState, useEffect } from 'react';
import { Asset, Transaction } from '../types';
import { X, ArrowUpRight, ArrowDownLeft, Clock, Bot, Loader2, ExternalLink, History, ShieldCheck, Sparkles } from 'lucide-react';
import { LAYER_COLORS, MOCK_TRANSACTIONS } from '../constants';
import { getAssetInsight } from '../services/gemini';

interface AssetDetailModalProps {
  asset: Asset;
  onClose: () => void;
}

const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ asset, onClose }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
      setIsLoadingInsight(true);
      try {
        const res = await getAssetInsight(asset);
        setInsight(res || "No insight available.");
      } catch (e) {
        setInsight("Insight unavailable at this time.");
      } finally {
        setIsLoadingInsight(false);
      }
    };
    fetchInsight();
  }, [asset]);

  // Strictly filter by both symbol and layer as requested, then sort by newest first
  const assetTransactions = MOCK_TRANSACTIONS
    .filter(tx => tx.asset === asset.symbol && tx.layer === asset.layer)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-8 border-b border-zinc-900 flex justify-between items-start">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center font-bold text-3xl text-white shadow-lg ${LAYER_COLORS[asset.layer]}`}>
              {asset.symbol[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-100">{asset.name}</h2>
                <span title="D.i.D Verified Asset" className="flex items-center justify-center">
                  <ShieldCheck size={18} className="text-blue-500" />
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">{asset.layer}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="text-xs text-zinc-500 font-medium">{asset.type}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors"
            aria-label="Close"
            title="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          {asset.layer === 'Liquid' && (
            <div className="bg-amber-600/10 border border-amber-600/20 rounded-3xl p-6 text-[10px] text-amber-500 font-black uppercase tracking-widest">
              Liquid balances are read from public explorer APIs and do not include confidential asset support.
            </div>
          )}
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <p className="text-zinc-500 text-xs mb-1 font-bold uppercase tracking-wider">Available Balance</p>
              <p className="text-2xl font-mono font-bold tracking-tight text-zinc-100">
                {asset.balance.toLocaleString()} <span className="text-zinc-500 text-sm font-normal uppercase">{asset.symbol}</span>
              </p>
            </div>
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <p className="text-zinc-500 text-xs mb-1 font-bold uppercase tracking-wider">Estimated Value</p>
              <p className="text-2xl font-mono font-bold text-orange-500 tracking-tight">
                ${asset.valueUsd.toLocaleString()}
              </p>
            </div>
          </div>

          {/* AI Insights Section */}
          <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-7 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <Bot size={80} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-orange-500/20 p-2 rounded-lg">
                  <Sparkles className="text-orange-500" size={18} />
                </div>
                <h3 className="font-bold text-xs uppercase tracking-widest text-orange-500">Protocol Intelligence Analysis</h3>
              </div>
              <div className="text-sm text-zinc-300 leading-relaxed min-h-[100px] bg-zinc-950/30 p-4 rounded-2xl border border-orange-500/10">
                {isLoadingInsight ? (
                  <div className="flex items-center gap-3 text-zinc-500 italic py-4">
                    <Loader2 className="animate-spin" size={16} />
                    <span>Analyzing protocol utility...</span>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed">{insight}</p>
                )}
              </div>
            </div>
          </div>

          {/* Transaction History Section */}
          <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <History size={16} />
                Layer Activity
              </h3>
              <button type="button" className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 hover:text-orange-500 transition-colors flex items-center gap-1.5" aria-label="Open Explorer" title="Open Explorer">
                Explorer <ExternalLink size={10} />
              </button>
            </div>
            
            <div className="space-y-3">
              {assetTransactions.length > 0 ? (
                assetTransactions.map(tx => (
                  <div 
                    key={tx.id} 
                    className="bg-zinc-900/20 hover:bg-zinc-900/50 border border-zinc-800/40 p-5 rounded-[1.25rem] flex items-center justify-between group transition-all duration-300 hover:translate-x-1"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.type === 'receive' ? 'bg-green-500/10 text-green-500' : 
                        tx.type === 'send' ? 'bg-red-500/10 text-red-500' : 
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {tx.type === 'receive' ? <ArrowDownLeft size={18} /> : 
                         tx.type === 'send' ? <ArrowUpRight size={18} /> : 
                         <Bot size={18} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold capitalize text-zinc-200">{tx.type}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • {tx.counterparty}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-mono font-bold ${
                        tx.type === 'receive' ? 'text-green-500' : 'text-zinc-100'
                      }`}>
                        {tx.type === 'receive' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.asset}
                      </div>
                      <div className={`text-[9px] font-black uppercase tracking-tighter mt-1 px-1.5 py-0.5 rounded border inline-block ${
                        tx.status === 'completed' ? 'border-zinc-800 text-zinc-600' : 'border-orange-500/20 text-orange-500'
                      }`}>
                        {tx.status}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center border-2 border-dashed border-zinc-900 rounded-[2rem] flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                    <Clock size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-400 font-bold text-sm">No activity found</p>
                    <p className="text-zinc-600 text-xs max-w-[200px] mx-auto">No recorded transactions for {asset.symbol} on the {asset.layer} layer.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-900 flex gap-4">
          <button className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold py-4 rounded-2xl transition-all border border-zinc-800 active:scale-[0.98]">
            Receive
          </button>
          <button className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98]">
            Send {asset.symbol}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailModal;
