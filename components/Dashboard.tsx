import React, { useState, useEffect, useContext } from 'react';
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  Shield,
  Zap,
  History,
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Copy,
  ExternalLink,
  QrCode,
  X,
  ShieldCheck,
  CheckCircle2,
  Network,
  Loader2
} from 'lucide-react';
import { AppContext } from '../context';
import { Asset, BitcoinLayer } from '../types';
import { SignRequest } from '../services/signer';
import { getTranslation } from '../services/i18n';
import { generateRandomString } from '../services/random';
import AssetDetailModal from './AssetDetailModal';
import UTXOManager from './UTXOManager';
import SilentPayments from './SilentPayments';

const Dashboard: React.FC = () => {
  const appContext = useContext(AppContext);
  if (!appContext) return null;
  const { state } = appContext;
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [sendStep, setSendStep] = useState<'form' | 'sign' | 'broadcast'>('form');
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [receiveLayer, setReceiveLayer] = useState<BitcoinLayer>('Mainnet');
  const [detailedAsset, setDetailedAsset] = useState<Asset | null>(null);
  const [qrSrc, setQrSrc] = useState('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=bc1qcxn...root');
  const [qrError, setQrError] = useState(false);
  const [selectedUtxos, setSelectedUtxos] = useState<any[]>([]);
  const [psbtBase64, setPsbtBase64] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [signedHex, setSignedHex] = useState('');
  const [broadcastResult, setBroadcastResult] = useState('');

  const t = (key: string) => getTranslation(state.language, key);

  const totalValue = state.assets.reduce((acc: number, asset: Asset) => acc + asset.valueUsd, 0);
  const btcAddress = "bc1qcxn...root";
  const stxAddress = "SPCXN...root";
  const ethAddress = "0xCXN...root";
  const taprootAddress = "bc1p...root";
  const network = state.network;

  const handleQrError = () => setQrError(true);

  const broadcastBtcTx = async (hex: string, net: string) => {
    return "txid_" + generateRandomString(12);
  };

  return (
    <div className="p-6 md:p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HERO SECTION */}
      <div className="relative overflow-hidden rounded-[3rem] bg-brand-deep p-10 md:p-14 text-white shadow-2xl">
         <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-earth">{t('dashboard.totalBalance')}</p>
               <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter">
                 ${(totalValue || 0).toLocaleString()}
               </h2>
               <div className="flex items-center gap-2 text-success font-bold text-sm bg-success/10 px-3 py-1 rounded-full w-fit border border-success/20">
                  <TrendingUp size={16} />
                  <span>+2.4% {t('dashboard.today')}</span>
               </div>
            </div>
            <div className="flex gap-4">
               <button
                onClick={() => { setShowSend(true); setSendStep('form'); }}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-accent-earth hover:bg-accent-earth/90 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-105 shadow-lg active:scale-95"
               >
                 <ArrowUpRight size={20} />
                 <span>{t('actions.send')}</span>
               </button>
               <button
                onClick={() => setShowReceive(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-white text-brand-deep px-8 py-5 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-105 shadow-lg active:scale-95"
               >
                 <ArrowDownLeft size={20} />
                 <span>{t('actions.receive')}</span>
               </button>
            </div>
         </div>
         {/* Abstract background elements for hero */}
         <div className="absolute top-0 right-0 w-96 h-96 bg-accent-earth/20 blur-[100px] rounded-full -mr-20 -mt-20"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-success/10 blur-[80px] rounded-full -ml-20 -mb-20"></div>
      </div>

      {/* ASSETS GRID */}
      <div className="space-y-6">
         <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-brand-deep">{t('dashboard.yourAssets')}</h3>
            <button className="text-[10px] font-black uppercase tracking-widest text-brand-earth hover:text-accent-earth transition-colors flex items-center gap-2">
               {t('actions.viewAll')} <ChevronRight size={14} />
            </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.assets.map((asset: Asset) => (
              <div
                key={asset.id}
                onClick={() => setDetailedAsset(asset)}
                className="group bg-white border border-border rounded-[2.5rem] p-8 hover:border-accent-earth transition-all cursor-pointer hover:shadow-xl hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-8">
                   <div className="w-14 h-14 rounded-2xl bg-off-white flex items-center justify-center ring-1 ring-border group-hover:ring-accent-earth/30 transition-all">
                      <div className="w-10 h-10 rounded-xl bg-accent-earth flex items-center justify-center text-white font-black italic shadow-md">
                        {asset.symbol[0]}
                      </div>
                   </div>
                   <div className="text-right">
                      <p className={`text-xs font-bold ${(asset.change ?? 0) >= 0 ? 'text-success' : 'text-red-600'}`}>
                        {(asset.change ?? 0) >= 0 ? '+' : ''}{(asset.change ?? 0)}%
                      </p>
                      <p className="text-[9px] font-black text-brand-earth uppercase tracking-widest">{asset.layer}</p>
                   </div>
                </div>
                <div className="space-y-1">
                   <h4 className="text-xl font-black text-brand-deep">{asset.name}</h4>
                   <div className="flex items-end justify-between">
                      <p className="text-sm font-mono font-bold text-brand-earth">{asset.balance} {asset.symbol}</p>
                      <p className="text-2xl font-black italic tracking-tighter text-brand-deep">${asset.valueUsd.toLocaleString()}</p>
                   </div>
                </div>
              </div>
            ))}

            <button className="group border-2 border-dashed border-border rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 hover:border-accent-earth hover:bg-off-white transition-all min-h-[220px]">
               <div className="w-12 h-12 rounded-full bg-off-white flex items-center justify-center text-brand-earth group-hover:bg-accent-earth group-hover:text-white transition-all shadow-sm">
                 <Plus size={24} />
               </div>
               <span className="text-xs font-black uppercase tracking-widest text-brand-earth group-hover:text-accent-earth">Add Asset / Protocol</span>
            </button>
         </div>
      </div>

      {/* QUICK ACTIONS / NETWORK STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         <div className="bg-white border border-border rounded-[3rem] p-10 space-y-8">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-brand-deep">Network Activity</h3>
            <div className="space-y-4">
               {[1, 2, 3].map(i => (
                 <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-off-white border border-border hover:border-accent-earth transition-all">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-earth shadow-sm">
                       <History size={18} />
                    </div>
                    <div className="flex-1">
                       <p className="text-xs font-bold text-brand-deep">Received Bitcoin</p>
                       <p className="text-[10px] text-brand-earth font-mono">bc1q...{generateRandomString(8)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-black text-success">+0.0042 BTC</p>
                       <p className="text-[9px] text-brand-earth uppercase font-bold">Confirmed</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="bg-accent-forest text-white rounded-[3rem] p-10 space-y-8 shadow-xl relative overflow-hidden">
            <h3 className="text-xl font-black italic uppercase tracking-tighter">Protocol Sovereignty</h3>
            <div className="space-y-8 relative z-10">
               <div className="space-y-3">
                  <div className="flex justify-between items-end">
                     <p className="text-[10px] font-black uppercase tracking-widest text-accent-earth">Enclave Health</p>
                     <p className="text-2xl font-black italic tracking-tighter">98%</p>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-accent-earth w-[98%] shadow-[0_0_15px_rgba(194,94,0,0.5)]" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                     <p className="text-[8px] font-black uppercase text-brand-earth tracking-widest mb-1">Mempool Depth</p>
                     <p className="text-lg font-black italic">Low-Fee</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                     <p className="text-[8px] font-black uppercase text-brand-earth tracking-widest mb-1">Gateway Status</p>
                     <p className="text-lg font-black italic text-success">Active</p>
                  </div>
               </div>
               <button className="w-full py-4 bg-white text-accent-forest rounded-2xl font-black uppercase tracking-widest hover:bg-off-white transition-all">
                  Audit Protocol
               </button>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-earth/5 blur-[80px] rounded-full -mr-20 -mt-20"></div>
         </div>
      </div>

      {/* SEND MODAL */}
      {showSend && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-deep/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white border border-border rounded-[3rem] p-10 space-y-8 relative shadow-2xl">
              <button onClick={() => setShowSend(false)} aria-label="Close" className="absolute top-8 right-8 text-brand-earth hover:text-brand-deep"><X size={24} /></button>
              
              <div className="text-center space-y-2">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-brand-deep">Disburse Assets</h3>
                 <p className="text-xs text-brand-earth">Hardware-signed transaction via Secure Enclave.</p>
              </div>

              {sendStep === 'form' && (
                  <div className="space-y-6">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-brand-earth ml-2">Destination Address</label>
                          <input 
                            value={sendAddress}
                            onChange={(e) => setSendAddress(e.target.value)}
                            placeholder="Enter Bitcoin Address"
                            className="w-full bg-off-white border border-border rounded-2xl p-5 text-sm font-mono focus:ring-2 focus:ring-accent-earth focus:border-transparent outline-none transition-all"
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-brand-earth ml-2">Amount (Sats)</label>
                          <div className="relative">
                            <input
                                value={sendAmount}
                                onChange={(e) => setSendAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-off-white border border-border rounded-2xl p-5 text-sm font-mono focus:ring-2 focus:ring-accent-earth focus:border-transparent outline-none transition-all"
                            />
                            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-accent-earth bg-accent-earth/10 px-3 py-1 rounded-lg">Max</button>
                          </div>
                      </div>
                      <button
                        onClick={() => {
                          const psbt = "dGhpcyBpcyBhIG1vY2sgcHlidA==";
                          setPsbtBase64(psbt);
                          setSendStep('sign');
                        }}
                        disabled={!sendAddress || !sendAmount}
                        className="w-full bg-brand-deep text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-ivory transition-all disabled:opacity-50 shadow-lg"
                      >
                        Construct PSBT
                      </button>
                  </div>
              )}

              {sendStep === 'sign' && (
                  <div className="space-y-6 text-center">
                      <div className="bg-off-white p-6 rounded-3xl border border-border text-left space-y-3">
                          <div className="flex justify-between text-xs">
                              <span className="text-brand-earth font-bold">To</span>
                              <span className="font-mono text-brand-deep truncate w-32">{sendAddress}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                              <span className="text-brand-earth font-bold">Amount</span>
                              <span className="font-mono text-accent-earth font-bold">{parseInt(sendAmount).toLocaleString()} sats</span>
                          </div>
                      </div>
                      <button 
                        onClick={async () => {
                            setIsSigning(true);
                            try {
                                const signReq: SignRequest = {
                                    type: 'psbt',
                                    layer: 'Mainnet',
                                    payload: { psbt: psbtBase64, network },
                                    description: `Sign PSBT`
                                };
                                const result = await appContext.authorizeSignature(signReq);
                                setSignedHex(result.broadcastReadyHex || 'mock_hex_abc123');
                                setSendStep('broadcast');
                            } catch (e) {
                                appContext?.notify('error', 'Signing Failed');
                            } finally {
                                setIsSigning(false);
                            }
                        }}
                        disabled={isSigning}
                        className="w-full bg-accent-earth text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-accent-earth/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                      >
                        {isSigning ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                        {isSigning ? 'Signing in Enclave...' : 'Sign Transaction'}
                      </button>
                  </div>
              )}

              {sendStep === 'broadcast' && (
                  <div className="space-y-6 text-center">
                      <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success mb-2 shadow-sm">
                          <CheckCircle2 size={40} />
                      </div>
                      <h4 className="text-xl font-black italic uppercase text-brand-deep">Signed & Ready</h4>
                      <p className="text-xs text-brand-earth font-mono break-all px-4">{signedHex.substring(0, 32)}...</p>
                      
                      <button 
                        onClick={async () => {
                            setIsBroadcasting(true);
                            try {
                                const txid = await broadcastBtcTx(signedHex, network);
                                setBroadcastResult(txid);
                                appContext?.notify('success', 'Transaction Broadcasted!');
                                setTimeout(() => { setShowSend(false); setSendStep('form'); }, 2000);
                            } catch (e) {
                                appContext?.notify('error', 'Broadcast Failed');
                            } finally {
                                setIsBroadcasting(false);
                            }
                        }}
                        disabled={isBroadcasting}
                        className="w-full bg-success text-white font-black py-5 rounded-2xl uppercase tracking-widest hover:bg-success/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
                      >
                         {isBroadcasting ? <Loader2 className="animate-spin" /> : <Network size={20} />}
                         {isBroadcasting ? 'Propagating...' : 'Broadcast to Mempool'}
                      </button>
                  </div>
              )}
           </div>
        </div>
      )}

      {/* RECEIVE MODAL */}
      {showReceive && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-deep/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white border border-border rounded-[3rem] p-10 space-y-8 relative shadow-2xl">
              <button onClick={() => setShowReceive(false)} aria-label="Close" className="absolute top-8 right-8 text-brand-earth hover:text-brand-deep"><X size={24} /></button>
              
              <div className="flex bg-off-white p-1 rounded-2xl border border-border mb-4 overflow-x-auto custom-scrollbar no-scrollbar">
                {(['Mainnet', 'Stacks', 'Liquid', 'Rootstock', 'RGB', 'Ark', 'BOB', 'B2', 'Botanix', 'Mezo', 'Alpen', 'Zulu', 'Bison', 'Hemi', 'Nubit', 'Lorenzo', 'Citrea', 'Babylon', 'Merlin', 'Bitlayer', 'TaprootAssets'] as BitcoinLayer[]).map(l => (
                    <button 
                        key={l}
                        onClick={() => setReceiveLayer(l)}
                        className={`whitespace-nowrap px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${receiveLayer === l ? 'bg-accent-earth text-white shadow-md' : 'text-brand-earth hover:text-brand-deep'}`}
                    >
                        {l}
                    </button>
                ))}
              </div>

              <div className="text-center space-y-4">
                 <div className="w-16 h-16 bg-accent-earth/10 rounded-2xl flex items-center justify-center mx-auto text-accent-earth shadow-sm"><QrCode size={32} /></div>
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-brand-deep">{t('qr.root')}</h3>
                 <p className="text-xs text-brand-earth">{t('qr.share')}</p>
              </div>
              <div className="bg-off-white border border-border p-8 rounded-[3rem] flex flex-col items-center gap-6 shadow-inner">
                 <div className="bg-white p-4 rounded-3xl shadow-xl overflow-hidden ring-1 ring-border">
                    {!qrError ? (
                      <img src={qrSrc} onError={handleQrError} alt="Wallet Address QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-xs text-brand-earth">
                        QR unavailable. Share address below.
                      </div>
                    )}
                 </div>
                 <div className="w-full space-y-3">
                    <p className="text-[9px] font-black text-brand-earth uppercase text-center">{receiveLayer} Root</p>
                    <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-border shadow-sm">
                       <p className="text-[10px] font-mono text-brand-deep truncate flex-1">{["Rootstock", "BOB", "B2", "Botanix", "Mezo", "Alpen", "Zulu", "Bison", "Hemi", "Nubit", "Lorenzo", "Citrea", "Babylon", "Merlin", "Bitlayer"].includes(receiveLayer) ? ethAddress : (receiveLayer === "Stacks" ? stxAddress : (receiveLayer === "RGB" || receiveLayer === "TaprootAssets" ? taprootAddress : btcAddress))}</p>
                       <button onClick={() => { navigator.clipboard.writeText(["Rootstock", "BOB", "B2", "Botanix", "Mezo", "Alpen", "Zulu", "Bison", "Hemi", "Nubit", "Lorenzo", "Citrea", "Babylon", "Merlin", "Bitlayer"].includes(receiveLayer) ? ethAddress : (receiveLayer === "Stacks" ? stxAddress : (receiveLayer === "RGB" || receiveLayer === "TaprootAssets" ? taprootAddress : btcAddress))); appContext.notify('info', 'Address Copied to Clipboard'); }} aria-label="Copy Address" className="text-accent-earth"><Copy size={16} /></button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {detailedAsset && (
        <AssetDetailModal 
            asset={detailedAsset} 
            onClose={() => setDetailedAsset(null)} 
            onSend={() => {
                setDetailedAsset(null);
                setShowSend(true);
                setSendStep('form');
            }}
            onReceive={() => {
                setDetailedAsset(null);
                setReceiveLayer(detailedAsset.layer);
                setShowReceive(true);
            }}
        />
      )}
    </div>
  );
};

export default Dashboard;
