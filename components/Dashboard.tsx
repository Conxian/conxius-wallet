
import React, { useState, useEffect, useContext } from 'react';
import { LAYER_COLORS } from '../constants';
import { Asset, BitcoinLayer, UTXO } from '../types';
import { TrendingUp, ArrowUpRight, Search, Bot, Loader2, Shield, Send, Plus, Network, ShieldCheck, EyeOff, CheckCircle2, X, ShoppingBag, RefreshCw, Key, Copy, ExternalLink, ArrowDownLeft, Clock, History, Sparkles, QrCode } from 'lucide-react';
import { fetchBtcBalance, fetchStacksBalances, fetchBtcPrice, fetchLiquidBalance, fetchRskBalance, broadcastBtcTx, fetchRunesBalances, fetchBtcUtxos, fetchBobAssets, fetchRgbAssets, fetchArkBalances, fetchMavenAssets, fetchStateChainBalances, fetchB2Assets, fetchBotanixAssets, fetchMezoAssets, fetchAlpenAssets, fetchZuluAssets, fetchBisonAssets, fetchHemiAssets, fetchNubitAssets, fetchLorenzoAssets, fetchCitreaAssets, fetchBabylonAssets, fetchMerlinAssets, fetchBitlayerAssets, fetchTaprootAssets } from '../services/protocol';
import { SignRequest } from '../services/signer';
import { getRecommendedFees } from '../services/fees';
import { buildPsbt } from '../services/psbt';
import AssetDetailModal from './AssetDetailModal';
import SovereigntyMeter from './SovereigntyMeter';
import { AppContext } from '../context';
import { getTranslation } from '../services/i18n';
import QRCode from 'qrcode';

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
  const [feeRate, setFeeRate] = useState<number>(8);
  const [feesRec, setFeesRec] = useState<{ fastestFee?: number; halfHourFee?: number; hourFee?: number }>({});
  const [availableUtxos, setAvailableUtxos] = useState<UTXO[]>([]);
  const [selectedUtxos, setSelectedUtxos] = useState<string[]>([]);
  const [psbtBase64, setPsbtBase64] = useState<string>('');
  const [rbfEnabled, setRbfEnabled] = useState<boolean>(true);
  const [signedHex, setSignedHex] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [receiveLayer, setReceiveLayer] = useState<BitcoinLayer>('Mainnet');

  const { mode, network, assets, privacyMode, walletConfig, language } = appContext?.state || {
    mode: 'simulation',
    network: 'mainnet',
    assets: [],
    privacyMode: false,
    walletConfig: null,
    language: 'en'
  };
  const btcAddress = walletConfig?.masterAddress || '';
  const taprootAddress = walletConfig?.taprootAddress || '';
  const stxAddress = walletConfig?.stacksAddress || '';
  const ethAddress = walletConfig?.ethAddress || '';


  const t = (key: string) => getTranslation(language, key);

  const syncAllLayers = async () => {
    if (mode === 'simulation' || !btcAddress) return;
    setIsSyncing(true);
    try {
        const btcPrice = await fetchBtcPrice();
        const results = await Promise.all([
            fetchBtcBalance(btcAddress, network),
            fetchStacksBalances(stxAddress, network),
            fetchLiquidBalance(btcAddress, network),
            fetchRskBalance(btcAddress, network),
            fetchRunesBalances(btcAddress),
            fetchBobAssets(btcAddress),
            fetchRgbAssets(btcAddress),
            fetchArkBalances(btcAddress),
            fetchMavenAssets(btcAddress),
            fetchStateChainBalances(btcAddress),
            fetchB2Assets(btcAddress, network),
            fetchBotanixAssets(btcAddress, network),
            fetchMezoAssets(btcAddress, network),
            fetchAlpenAssets(btcAddress, network),
            fetchZuluAssets(btcAddress, network),
            fetchBisonAssets(btcAddress, network),
            fetchHemiAssets(btcAddress, network),
            fetchNubitAssets(btcAddress, network),
            fetchLorenzoAssets(btcAddress, network),
            fetchCitreaAssets(btcAddress, network),
            fetchBabylonAssets(btcAddress, network),
            fetchMerlinAssets(btcAddress, network),
            fetchBitlayerAssets(btcAddress, network),
            fetchTaprootAssets(taprootAddress, network)
        ]);

        const [btcBal, stxAssets, liqBal, rskBal, runeAssets, bobAssets, rgbAssets, arkAssets, mavenAssets, scAssets, b2Assets, botAssets, mezoAssets, alpenAssets, zuluAssets, bisonAssets, hemiAssets, nubitAssets, lorenzoAssets, citreaAssets, babylonAssets, merlinAssets, bitlayerAssets, taprootAssets] = results;
        const finalAssets: Asset[] = [
            { id: 'btc-main', name: 'Bitcoin', symbol: 'BTC', balance: btcBal, valueUsd: btcBal * btcPrice, layer: 'Mainnet', type: 'Native', address: btcAddress },
            ...stxAssets,
            ...runeAssets,
            { id: 'lbtc-main', name: 'Liquid BTC', symbol: 'L-BTC', balance: liqBal, valueUsd: liqBal * btcPrice, layer: 'Liquid', type: 'Wrapped', address: btcAddress },
            { id: 'rbtc-main', name: 'Smart BTC', symbol: 'RBTC', balance: rskBal, valueUsd: rskBal * btcPrice, layer: 'Rootstock', type: 'Native', address: btcAddress },
            ...bobAssets,
            ...rgbAssets,
            ...arkAssets,
            ...mavenAssets,
            ...scAssets,
            ...b2Assets,
            ...botAssets,
            ...mezoAssets,
            ...alpenAssets,
            ...zuluAssets,
            ...bisonAssets,
            ...hemiAssets,
            ...nubitAssets,
            ...lorenzoAssets,
            ...citreaAssets,
            ...babylonAssets,
            ...merlinAssets,
            ...bitlayerAssets,
            ...taprootAssets
        ];
        appContext?.updateAssets(finalAssets);
        appContext?.notify('success', 'Ledger Synchronized via RPC');
    } catch (e) {
        console.error("Omni-Sync Failed", e);
        appContext?.notify('error', 'Sync Failed: Node Unreachable');
    } finally {
        setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (mode === 'sovereign' && btcAddress && assets.length === 0) syncAllLayers();
  }, [btcAddress]);

  useEffect(() => {
    if (btcAddress) {
      fetchBtcUtxos(btcAddress, network).then(setAvailableUtxos);
      const base = network === 'mainnet' ? 'https://mempool.space' : network === 'testnet' ? 'https://mempool.space/testnet' : 'https://mempool.space/signet';
      getRecommendedFees(base).then(setFeesRec);
    }
  }, [btcAddress, network]);

  const totalBalance = assets.reduce((acc, curr) => acc + curr.valueUsd, 0);

  // BIP-21 URI Generation
  const getBip21Uri = () => {
     if (receiveLayer === 'Mainnet') return `bitcoin:${btcAddress}?label=Conxius`;
     if (receiveLayer === 'Stacks') return `stacks:${stxAddress}`;
     return btcAddress;
  };

  const [qrSrc, setQrSrc] = useState<string>('');
  const [qrError, setQrError] = useState<boolean>(false);

  useEffect(() => {
    const generate = async () => {
        try {
            const data = getBip21Uri();
            // Local generation only - Privacy Preserved
            const dataUrl = await QRCode.toDataURL(data, { width: 240, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
            setQrSrc(dataUrl);
            setQrError(false);
        } catch (e) {
            setQrError(true);
        }
    };
    generate();
  }, [receiveLayer, btcAddress, stxAddress]);

  const handleQrError = async () => {
    // Retry local generation
    try {
      const dataUrl = await QRCode.toDataURL(getBip21Uri(), { width: 240, margin: 1 });
      setQrSrc(dataUrl);
      setQrError(false);
    } catch (e) {
      setQrError(true);
    }
  };

  if (!appContext) return null;

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
         <button type="button" onClick={syncAllLayers} aria-label="Refresh Layers" className="p-2 text-zinc-600 hover:text-orange-500 transition-all border border-zinc-900 rounded-lg bg-zinc-900/50">
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
         </button>
      </div>

      {/* Sovereign Capital Dashboard */}
      <div className="bg-[var(--surface-1)]/85 border border-[var(--border)] rounded-[3rem] p-8 md:p-12 relative overflow-hidden group shadow-2xl ring-1 ring-[rgba(247,147,26,0.15)]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-green-500" />
              <p className="text-[10px] font-black text-[var(--muted)] uppercase tracking-[0.3em]">{t('balance.title')}</p>
            </div>
            <div className={`flex items-baseline gap-3 transition-all duration-500 ${privacyMode ? 'blur-xl grayscale' : 'blur-0'}`}>
              <span className="text-5xl md:text-7xl font-black tracking-tighter text-[var(--text)] font-mono">${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <button onClick={() => appContext.setPrivacyMode(!privacyMode)} className="text-[9px] font-black uppercase tracking-widest text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-2">
                <EyeOff size={12} /> {t('balance.privacy')}
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
             <button type="button" onClick={() => { setShowSend(true); setSendStep('form'); }} className="flex-1 md:flex-none bg-amber-600 hover:bg-amber-500 text-white px-8 py-5 rounded-3xl transition-all font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 text-xs uppercase tracking-widest">
               <Send size={18} /> {t('action.transmit')}
             </button>
             <button type="button" onClick={() => setShowReceive(true)} className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white px-8 py-5 rounded-3xl transition-all font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 text-xs uppercase tracking-widest">
               <Plus size={18} /> {t('action.ingest')}
             </button>
             <a href="https://www.bitrefill.com/?ref=CONXIUS" target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-8 py-5 rounded-3xl transition-all font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 text-xs uppercase tracking-widest border border-zinc-700">
               <ShoppingBag size={18} /> Spend
             </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Key Topology Section */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-[3rem] p-8 space-y-8">
            <h3 className="text-xs font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
              <Key size={14} /> Sovereign Key Topology
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-zinc-500">Mainnet (BIP-84)</span>
                  <span className="bg-green-500/10 text-green-500 text-[8px] px-1.5 py-0.5 rounded border border-green-500/20">Segwit</span>
                </div>
                <p className="font-mono text-[10px] text-zinc-300 truncate">{btcAddress}</p>
              </div>
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-zinc-500">Taproot (BIP-86)</span>
                  <span className="bg-orange-500/10 text-orange-500 text-[8px] px-1.5 py-0.5 rounded border border-orange-500/20">Schnorr</span>
                </div>
                <p className="font-mono text-[10px] text-zinc-300 truncate">{taprootAddress || 'Deriving...'}</p>
              </div>
            </div>
          </div>

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
                  <div className="hidden md:flex flex-col items-end gap-1 px-8 border-x border-zinc-900/50">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">24h Vol</p>
                    <p className="text-[11px] font-mono font-bold text-zinc-400">$1.2M</p>
                  </div>
                  <div className="hidden md:flex flex-col items-end gap-1 px-8">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Yield (APY)</p>
                    <p className="text-[11px] font-mono font-bold text-green-500">4.2%</p>
                  </div>
                  <div className="text-right min-w-[120px]">
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 ml-4">Fee Rate (sat/vB)</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            value={feeRate}
                            onChange={(e) => setFeeRate(parseFloat(e.target.value))}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm font-mono text-white focus:outline-none focus:border-orange-500 transition-colors"
                            placeholder="sat/vB"
                            aria-label="Fee Rate (sat/vB)"
                            title="Fee Rate (sat/vB)"
                          />
                          <button type="button" onClick={() => feesRec.fastestFee && setFeeRate(feesRec.fastestFee)} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-amber-600 text-white" aria-label="Set Fast Fee">Fast</button>
                          <button type="button" onClick={() => feesRec.halfHourFee && setFeeRate(feesRec.halfHourFee)} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-green-600 text-white" aria-label="Set 30 minutes Fee">30m</button>
                          <button type="button" onClick={() => feesRec.hourFee && setFeeRate(feesRec.hourFee)} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-zinc-800 text-zinc-200" aria-label="Set 1 hour Fee">1h</button>
                          <button type="button" onClick={() => setRbfEnabled(!rbfEnabled)} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase ${rbfEnabled ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-200'}`} aria-label="Toggle RBF">RBF</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-zinc-600 ml-4 flex items-center justify-between">
                            <span>Coin Selection</span>
                            <button 
                                type="button" 
                                onClick={() => {
                                    if (selectedUtxos.length === availableUtxos.length) {
                                        setSelectedUtxos([]);
                                    } else {
                                        setSelectedUtxos(availableUtxos.map(u => `${u.txid}:${u.vout}`));
                                    }
                                }}
                                className="text-orange-500 hover:text-orange-400"
                            >
                                {selectedUtxos.length === availableUtxos.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </label>
                        <div className="max-h-40 overflow-auto border border-zinc-800 rounded-2xl">
                          {availableUtxos.map(u => (
                            <label key={`${u.txid}:${u.vout}`} className="flex items-center justify-between px-4 py-2 text-xs border-b border-zinc-900">
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={selectedUtxos.includes(`${u.txid}:${u.vout}`)} onChange={(e) => {
                                  const id = `${u.txid}:${u.vout}`;
                                  setSelectedUtxos(prev => e.target.checked ? [...prev, id] : prev.filter(x => x !== id));
                                }} />
                                <span className="font-mono text-zinc-300">{u.amount} sats</span>
                              </div>
                              <span className="text-[9px] text-zinc-600">{u.status}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                          <button type="button"
                        onClick={() => {
                          const utxos = availableUtxos.filter(u => selectedUtxos.includes(`${u.txid}:${u.vout}`));
                          const psbt = buildPsbt({
                            utxos,
                            toAddress: sendAddress,
                            amountSats: parseInt(sendAmount),
                            changeAddress: btcAddress,
                            feeRate,
                            rbf: rbfEnabled,
                            network
                          });
                          setPsbtBase64(psbt);
                          setSendStep('sign');
                        }}
                        disabled={!sendAddress || !sendAmount || selectedUtxos.length === 0}
                        className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50"
                      >
                        Construct PSBT
                      </button>
                      <div className="flex items-center justify-between">
                        <button type="button" onClick={() => { if (psbtBase64) navigator.clipboard.writeText(psbtBase64); }} className="text-[10px] uppercase font-black text-amber-600">Export PSBT</button>
                        <button type="button" onClick={() => {
                          const b = prompt('Paste PSBT base64');
                          if (b) { setPsbtBase64(b); setSendStep('sign'); }
                        }} className="text-[10px] uppercase font-black text-green-600">Import PSBT</button>
                      </div>
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
                                const signReq: SignRequest = {
                                    type: 'transaction',
                                    layer: 'Mainnet',
                                    payload: { psbt: psbtBase64, network },
                                    description: `Sign PSBT`
                                };
                                const result = await appContext.authorizeSignature(signReq);
                                setSignedHex(result.broadcastReadyHex || '');
                                setSendStep('broadcast');
                            } catch (e) {
                                appContext?.notify('error', 'Signing Failed');
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
                {(['Mainnet', 'Stacks', 'Liquid', 'Rootstock', 'RGB', 'Ark', 'BOB', 'B2', 'Botanix', 'Mezo', 'Alpen', 'Zulu', 'Bison', 'Hemi', 'Nubit', 'Lorenzo', 'Citrea', 'Babylon', 'Merlin', 'Bitlayer', 'TaprootAssets'] as BitcoinLayer[]).map(l => (
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
                    {!qrError ? (
                      <img src={qrSrc} onError={handleQrError} alt="Wallet Address QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-xs text-zinc-600">
                        QR unavailable. Share address below.
                      </div>
                    )}
                 </div>
                 <div className="w-full space-y-3">
                    <p className="text-[9px] font-black text-zinc-600 uppercase text-center">{receiveLayer} Root</p>
                    <div className="flex items-center gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                       <p className="text-[10px] font-mono text-zinc-400 truncate flex-1">{receiveLayer === 'Stacks' ? stxAddress : (receiveLayer === 'RGB' ? taprootAddress : btcAddress)}</p>
                       <button onClick={() => { navigator.clipboard.writeText(receiveLayer === 'Stacks' ? stxAddress : btcAddress); appContext.notify('info', 'Address Copied to Clipboard'); }} aria-label="Copy Address" className="text-orange-500"><Copy size={14} /></button>
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
