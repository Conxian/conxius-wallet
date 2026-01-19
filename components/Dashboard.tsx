
import React, { useState, useEffect, useContext } from 'react';
import { LAYER_COLORS } from '../constants';
import { Asset, BitcoinLayer } from '../types';
import { TrendingUp, ArrowUpRight, ArrowRight, Search, Bot, Loader2, Zap, Layers, Activity, Sparkles, Shield, Send, Plus, Network, ShieldCheck, EyeOff, Users, FileSignature, CheckCircle2, X, Binary, Castle, Palette, ShoppingBag, Hammer, Award, RefreshCw, Import, Wallet, QrCode, Copy, ExternalLink, AlertTriangle, Key } from 'lucide-react';
import { fetchBtcBalance, fetchStacksBalances, fetchBtcPrice, fetchStxPrice, fetchLiquidBalance, fetchRskBalance, broadcastBtcTx, fetchRunesBalances } from '../services/protocol';
import { requestEnclaveSignature } from '../services/signer';
import AssetDetailModal from './AssetDetailModal';
import SovereigntyMeter from './SovereigntyMeter';
import { AppContext } from '../context';
import { getTranslation } from '../services/i18n';

const Dashboard: React.FC = () => {
  const appContext = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailedAsset, setDetailedAsset] = useState<Asset | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  // Send State
  const [sendStep, setSendStep] = useState<'form' | 'sign' | 'broadcast'>('form');
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [signedHex, setSignedHex] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [receiveLayer, setReceiveLayer] = useState<BitcoinLayer>('Mainnet');

  if (!appContext) return null;
  const { mode, assets, privacyMode, walletConfig, language } = appContext.state;
  const btcAddress = walletConfig?.masterAddress || '';
  const stxAddress = walletConfig?.stacksAddress || '';

  const t = (key: string) => getTranslation(language, key);

  const syncAllLayers = async () => {
    if (mode === 'simulation' || !btcAddress) return;
    setIsSyncing(true);
    try {
        const btcPrice = await fetchBtcPrice();
        const results = await Promise.all([
            fetchBtcBalance(btcAddress),
            fetchStacksBalances(stxAddress),
            fetchLiquidBalance(btcAddress),
            fetchRskBalance(btcAddress),
            fetchRunesBalances(btcAddress)
        ]);

        const [btcBal, stxAssets, liqBal, rskBal, runeAssets] = results;
        const finalAssets: Asset[] = [
            { id: 'btc-main', name: 'Bitcoin', symbol: 'BTC', balance: btcBal, valueUsd: btcBal * btcPrice, layer: 'Mainnet', type: 'Native', address: btcAddress },
            ...stxAssets,
            ...runeAssets,
            { id: 'lbtc-main', name: 'Liquid BTC', symbol: 'L-BTC', balance: liqBal, valueUsd: liqBal * btcPrice, layer: 'Liquid', type: 'Wrapped', address: btcAddress },
            { id: 'rbtc-main', name: 'Smart BTC', symbol: 'RBTC', balance: rskBal, valueUsd: rskBal * btcPrice, layer: 'Rootstock', type: 'Native', address: btcAddress }
        ];
        appContext.updateAssets(finalAssets);
        appContext.notify('success', 'Ledger Synchronized via RPC');
    } catch (e) {
        console.error("Omni-Sync Failed", e);
        appContext.notify('error', 'Sync Failed: Node Unreachable');
    } finally {
        setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (mode === 'sovereign' && btcAddress && assets.length === 0) syncAllLayers();
  }, [btcAddress]);

  const totalBalance = assets.reduce((acc, curr) => acc + curr.valueUsd, 0);

  // BIP-21 URI Generation
  const getBip21Uri = () => {
     if (receiveLayer === 'Mainnet') return `bitcoin:${btcAddress}?label=Conxius`;
     if (receiveLayer === 'Stacks') return `stacks:${stxAddress}`;
     return btcAddress;
  };

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-10 animate-in fade-in duration-700 pb-32">
      
      {/* Omni-Layer Mesh Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-zinc-950 border border-zinc-900 rounded-[2.5rem] px-8 py-4 gap-4">
         <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full ${isSyncing ? 'animate-ping bg-orange-500' : 'bg-green-500 shadow-lg shadow-green-500/50'}`} />
               <span className="text-[10px] font-black uppercase text-zinc-100 tracking-widest">
                 {isSyncing ? 'SCANNING_PROTOCOLS...' : 'ENCLAVE_SYNCHRONIZED'}
               </span>
            </div>
            <div className="flex items-center gap-2 md:border-l border-zinc-800 md:pl-6">
               <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-widest">BIP-84 • SIP-010 • PSBT Ready</span>
            </div>
         </div>
         <button onClick={syncAllLayers} aria-label="Refresh Layers" className="p-2 text-zinc-600 hover:text-orange-500 transition-all border border-zinc-900 rounded-lg bg-zinc-900/50">
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
         </button>
      </div>

      {/* Sovereign Capital Dashboard */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-[3rem] p-8 md:p-12 relative overflow-hidden group shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-green-500" />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">{t('balance.title')}</p>
            </div>
            <div className={`flex items-baseline gap-3 transition-all duration-500 ${privacyMode ? 'blur-xl grayscale' : 'blur-0'}`}>
              <span className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-100 font-mono">${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <button onClick={() => appContext.setPrivacyMode(!privacyMode)} className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 flex items-center gap-2">
                <EyeOff size={12} /> {t('balance.privacy')}
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
             <button onClick={() => { setShowSend(true); setSendStep('form'); }} className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-500 text-white px-8 py-5 rounded-3xl transition-all font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 text-xs uppercase tracking-widest">
               <Send size={18} /> {t('action.transmit')}
             </button>
             <button onClick={() => setShowReceive(true)} className="flex-1 md:flex-none bg-zinc-100 hover:bg-white text-zinc-950 px-8 py-5 rounded-3xl transition-all font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 text-xs uppercase tracking-widest">
               <Plus size={18} /> {t('action.ingest')}
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-zinc-950 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl min-h-[400px]">
            <div className="px-6 md:px-10 py-8 border-b border-zinc-900 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-zinc-500 tracking-[0.2em]">{t('assets.verified')}</h3>
              <div className="relative">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('assets.search')} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:outline-none w-full md:w-64" />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-700" size={16} />
              </div>
            </div>
            <div className="divide-y divide-zinc-900">
              {assets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.symbol.toLowerCase().includes(searchQuery.toLowerCase())).map(asset => (
                <div key={asset.id} onClick={() => setDetailedAsset(asset)} className="px-6 md:px-10 py-6 flex items-center justify-between hover:bg-zinc-900/30 transition-all cursor-pointer group">
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white group-hover:scale-105 transition-transform ${LAYER_COLORS[asset.layer]}`}>{asset.symbol[0]}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-zinc-100">{asset.name}</p>
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-zinc-900 text-zinc-500 rounded border border-zinc-800">{asset.type}</span>
                      </div>
                      <p className="text-[8px] font-black uppercase text-zinc-600 mt-1">{asset.layer}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-zinc-100">{asset.balance.toFixed(asset.balance < 1 ? 8 : 2)} {asset.symbol}</p>
                    {asset.valueUsd > 0 && <p className="text-[10px] text-orange-500 font-mono font-bold">${asset.valueUsd.toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-10">
          <SovereigntyMeter />
        </div>
      </div>

      {/* SEND MODAL */}
      {showSend && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[3rem] p-10 space-y-8 relative shadow-2xl">
              <button onClick={() => setShowSend(false)} aria-label="Close" className="absolute top-8 right-8 text-zinc-700 hover:text-zinc-300"><X size={24} /></button>
              
              <div className="text-center space-y-2">
                 <div className="w-16 h-16 bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500 mb-4"><Send size={32} /></div>
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">{t('action.transmit')}</h3>
                 <p className="text-xs text-zinc-500">Sovereign Transaction Construction</p>
              </div>

              {sendStep === 'form' && (
                  <div className="space-y-6">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-zinc-600 ml-4">Recipient Address</label>
                          <input 
                            type="text" 
                            value={sendAddress}
                            onChange={(e) => setSendAddress(e.target.value)}
                            placeholder="bc1q..." 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm font-mono text-white focus:outline-none focus:border-orange-500 transition-colors"
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-zinc-600 ml-4">Amount (SATS)</label>
                          <input 
                            type="number" 
                            value={sendAmount}
                            onChange={(e) => setSendAmount(e.target.value)}
                            placeholder="0" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm font-mono text-white focus:outline-none focus:border-orange-500 transition-colors"
                          />
                      </div>
                      <button 
                        onClick={() => setSendStep('sign')}
                        disabled={!sendAddress || !sendAmount}
                        className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50"
                      >
                        Construct PSBT
                      </button>
                  </div>
              )}

              {sendStep === 'sign' && (
                  <div className="space-y-6 text-center">
                      <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 text-left space-y-2">
                          <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">To</span>
                              <span className="font-mono text-zinc-200 truncate w-32">{sendAddress}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Amount</span>
                              <span className="font-mono text-orange-500 font-bold">{parseInt(sendAmount).toLocaleString()} sats</span>
                          </div>
                          <div className="flex justify-between text-xs">
                              <span className="text-zinc-500">Network Fee</span>
                              <span className="font-mono text-zinc-400">~142 sats</span>
                          </div>
                      </div>
                      <button 
                        onClick={async () => {
                            setIsSigning(true);
                            try {
                                const result = await requestEnclaveSignature({
                                    type: 'transaction',
                                    layer: 'Mainnet',
                                    payload: { to: sendAddress, amount: parseInt(sendAmount) },
                                    description: `Send ${sendAmount} sats to ${sendAddress}`
                                }, walletConfig?.mnemonic); // Pass mnemonic if available in context/config
                                
                                setSignedHex(result.broadcastReadyHex || '');
                                setSendStep('broadcast');
                            } catch (e) {
                                appContext.notify('error', 'Signing Failed');
                            } finally {
                                setIsSigning(false);
                            }
                        }}
                        disabled={isSigning}
                        className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-orange-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSigning ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                        {isSigning ? 'Signing in Enclave...' : 'Sign Transaction'}
                      </button>
                  </div>
              )}

              {sendStep === 'broadcast' && (
                  <div className="space-y-6 text-center">
                      <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500 mb-2">
                          <CheckCircle2 size={32} />
                      </div>
                      <h4 className="font-bold text-zinc-200">Signed & Ready</h4>
                      <p className="text-xs text-zinc-500 font-mono break-all px-4">{signedHex.substring(0, 32)}...</p>
                      
                      <button 
                        onClick={async () => {
                            setIsBroadcasting(true);
                            try {
                                const txid = await broadcastBtcTx(signedHex);
                                setBroadcastResult(txid);
                                appContext.notify('success', 'Transaction Broadcasted!');
                                setTimeout(() => { setShowSend(false); setSendStep('form'); }, 2000);
                            } catch (e) {
                                appContext.notify('error', 'Broadcast Failed');
                            } finally {
                                setIsBroadcasting(false);
                            }
                        }}
                        disabled={isBroadcasting}
                        className="w-full bg-green-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                         {isBroadcasting ? <Loader2 className="animate-spin" /> : <Network size={18} />}
                         {isBroadcasting ? 'Propagating...' : 'Broadcast to Mempool'}
                      </button>
                  </div>
              )}
           </div>
        </div>
      )}

      {/* RECEIVE MODAL */}
      {showReceive && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[3rem] p-10 space-y-8 relative shadow-2xl">
              <button onClick={() => setShowReceive(false)} aria-label="Close" className="absolute top-8 right-8 text-zinc-700 hover:text-zinc-300"><X size={24} /></button>
              
              <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 mb-4">
                {(['Mainnet', 'Stacks', 'Rootstock'] as BitcoinLayer[]).map(l => (
                    <button 
                        key={l}
                        onClick={() => setReceiveLayer(l)}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${receiveLayer === l ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                        {l}
                    </button>
                ))}
              </div>

              <div className="text-center space-y-4">
                 <div className="w-16 h-16 bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500"><QrCode size={32} /></div>
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter">{t('qr.root')}</h3>
                 <p className="text-xs text-zinc-500">{t('qr.share')}</p>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] flex flex-col items-center gap-6">
                 <div className="bg-white p-4 rounded-2xl shadow-xl overflow-hidden">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(getBip21Uri())}`} alt="Wallet Address QR Code" className="w-48 h-48" />
                 </div>
                 <div className="w-full space-y-3">
                    <p className="text-[9px] font-black text-zinc-600 uppercase text-center">{receiveLayer} Root</p>
                    <div className="flex items-center gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                       <p className="text-[10px] font-mono text-zinc-400 truncate flex-1">{receiveLayer === 'Stacks' ? stxAddress : btcAddress}</p>
                       <button onClick={() => { navigator.clipboard.writeText(receiveLayer === 'Stacks' ? stxAddress : btcAddress); appContext.notify('info', 'Address Copied to Clipboard'); }} aria-label="Copy Address" className="text-orange-500"><Copy size={14} /></button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {detailedAsset && <AssetDetailModal asset={detailedAsset} onClose={() => setDetailedAsset(null)} />}
    </div>
  );
};

export default Dashboard;
