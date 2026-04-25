import React, { useState, useEffect, useRef } from 'react';
import { Zap, Activity, Globe, Copy, Info, AlertTriangle, Loader2, RefreshCw, X, ShieldCheck, BookOpen, Cpu, Database, Download, Layers, Network, Plus, Shield, Sparkles, Terminal } from 'lucide-react';
import { getNodeEthosAdvice, getNetworkRPCResearch } from '../services/gemini';
import { useContext } from 'react';
import { AppContext } from '../context';

interface NodeConfig {
  id: string;
  layer: string;
  type: 'Public' | 'Local' | 'Private' | 'Replicate';
  endpoint: string;
  latency: number;
  status: 'online' | 'offline' | 'syncing';
  peers?: number;
  provider?: string;
  isDefault?: boolean;
}

const DEFAULT_RPC_CATALOG: NodeConfig[] = [
  { id: 'btc-local', layer: 'Bitcoin L1', type: 'Local', endpoint: 'http://127.0.0.1:8332', latency: 4, status: 'online', peers: 12, provider: 'LocalNode', isDefault: true },
  { id: 'btc-mempool', layer: 'Bitcoin L1', type: 'Public', endpoint: 'https://mempool.space/api', latency: 45, status: 'online', provider: 'Mempool.space', isDefault: true },
  { id: 'stx-hiro', layer: 'Stacks L2', type: 'Public', endpoint: 'https://api.mainnet.hiro.so', latency: 62, status: 'online', provider: 'Hiro Systems', isDefault: true },
  { id: 'rsk-iov', layer: 'Rootstock', type: 'Public', endpoint: 'https://public-node.rsk.co', latency: 156, status: 'online', provider: 'RSK IOV', isDefault: true },
  { id: 'liq-blockstream', layer: 'Liquid', type: 'Public', endpoint: 'https://blockstream.info/liquid/api', latency: 89, status: 'online', provider: 'Blockstream', isDefault: true },
];

const SOVEREIGN_BUNDLES = [
  { name: 'Bitcoin Core', os: ['Linux', 'Mac', 'Win'], icon: <Download size={16} />, link: 'https://bitcoincore.org/en/download/' },
  { name: 'Umbrel OS', os: ['Raspberry Pi', 'Linux'], icon: <Layers size={16} />, link: 'https://umbrel.com/' },
  { name: 'EmbassyOS', os: ['Pro Hardware'], icon: <Shield size={16} />, link: 'https://start9.com/' },
];

const NodeSettings: React.FC = () => {
  const appContext = useContext(AppContext);
  const [nodes, setNodes] = useState<NodeConfig[]>(DEFAULT_RPC_CATALOG);
  const [ethosAdvice, setEthosAdvice] = useState<string | null>(null);
  const [researchData, setResearchData] = useState<string | null>(null);
  const [isLoadingEthos, setIsLoadingEthos] = useState(false);
  const [isLoadingResearch, setIsLoadingResearch] = useState(false);
  const [selectedPath, setSelectedPath] = useState('Extreme (Full Node)');
  const [syncProgress, setSyncProgress] = useState(84.2);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [conxiusHardened, setConxiusHardened] = useState(true);

  // Form State
  const [newNode, setNewNode] = useState({ layer: 'Bitcoin L1', endpoint: '', provider: '' });
  const [lnBackend, setLnBackend] = useState({ 
      type: appContext?.state.lnBackend?.type || 'None', 
      endpoint: appContext?.state.lnBackend?.endpoint || '', 
      apiKey: appContext?.state.lnBackend?.apiKey || '' 
  });
  const appLnType = appContext?.state.lnBackend?.type;

  const fetchEthos = async (path: string) => {
    setIsLoadingEthos(true);
    try {
      const res = await getNodeEthosAdvice(path);
      setEthosAdvice(res || "Advice unavailable.");
    } finally {
      setIsLoadingEthos(false);
    }
  };

  const researchLayer = async (layer: string) => {
    setIsLoadingResearch(true);
    try {
      const res = await getNetworkRPCResearch(layer);
      setResearchData(res || "Research unavailable.");
    } finally {
      setIsLoadingResearch(false);
    }
  };

  useEffect(() => {
//     fetchEthos(selectedPath);
//     researchLayer('Bitcoin L1');
    setTimeout(() => { fetchEthos(selectedPath); researchLayer("Bitcoin L1"); }, 0);
    const interval = setInterval(() => {
      setSyncProgress(prev => prev < 100 ? +(prev + 0.01).toFixed(2) : 100);
      
      // Simulated Latency Jitter
      setNodes(prev => prev.map(node => {
        const randomValues = new Uint32Array(1);
        globalThis.crypto.getRandomValues(randomValues);
        const jitter = randomValues[0] > 0x7FFFFFFF ? 5 : -5;
        return {
          ...node,
          latency: Math.max(2, node.latency + jitter)
        };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedPath]);

  const handleAddNode = (e: React.FormEvent) => {
    e.preventDefault();
    const config: NodeConfig = {
      id: `custom-${Date.now()}`,
      layer: newNode.layer,
      type: 'Private',
      endpoint: newNode.endpoint,
      provider: newNode.provider || 'Custom Provider',
      latency: 0,
      status: 'online',
    };
    setNodes([...nodes, config]);
    appContext?.setCustomNodes([...(appContext?.state.customNodes || []), { ...config, isActive: true }]);
    setIsAddingNode(false);
    setNewNode({ layer: 'Bitcoin L1', endpoint: '', provider: '' });
  };

  const removeNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-deep flex items-center gap-3 italic uppercase">
            <div className="flex flex-col md:flex-row md:items-center gap-6"><Network className="text-accent-earth" /><div><select value={appContext?.state.rpcStrategy || "Sovereign-First"} onChange={e => appContext?.setRpcStrategy(e.target.value as any)} className="bg-off-white border border-border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-accent-earth focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all shadow-xl shadow-orange-600/10"><option value="Sovereign-First">Sovereign-First</option><option value="Mixed">Mixed Mode</option><option value="Public-Only">Public-Only</option></select><p className="text-[8px] text-brand-earth mt-1 uppercase font-bold tracking-tighter">Current Routing Strategy</p></div></div>
            Sovereign Node Hub
          </h2>
          <p className="text-brand-earth text-sm italic">Decentralize your source of truth. Don't trust, verify.</p>
        </div>
        <div className="flex gap-4">
           <div className={`bg-off-white border px-6 py-3 rounded-2xl flex items-center gap-4 transition-all ${conxiusHardened ? 'border-orange-500/50' : 'border-border'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${conxiusHardened ? 'bg-accent-earth text-white' : 'bg-border text-brand-earth'}`}>
                 <ShieldCheck size={20} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black uppercase text-brand-earth">Conxius Hardened</p>
                 <button onClick={() => setConxiusHardened(!conxiusHardened)} className={`text-xs font-bold uppercase tracking-widest ${conxiusHardened ? 'text-accent-earth' : 'text-brand-earth'}`}>
                    {conxiusHardened ? 'Active (Tor Routed)' : 'Inactive (Public)'}
                 </button>
              </div>
           </div>
           <button onClick={() => setIsAddingNode(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-amber-600/20 active:scale-95">
              <Plus size={18} /> Add Custom RPC
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          
          {/* Active Node Matrix */}
          <div className="bg-white border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
             <div className="p-6 border-b border-border bg-off-white/20 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                   <Activity size={16} /> RPC Connection Matrix
                </h3>
                <span className="text-[10px] font-mono text-brand-earth font-bold uppercase tracking-tighter">Verified peers: 142 (Tor-v3)</span>
             </div>
             <div className="divide-y divide-off-white">
                {nodes.map((node) => (
                  <div key={node.id} className="p-6 flex items-center justify-between group hover:bg-off-white/10 transition-all">
                     <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                          node.status === 'online' ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-off-white border-border'
                        }`}>
                           <p className="text-[8px] font-black uppercase tracking-tighter mb-0.5">{node.latency}ms</p>
                           <Activity size={14} className={node.status === 'online' ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                           <div className="flex items-center gap-3">
                              <p className="text-[10px] font-black uppercase text-brand-earth tracking-widest">{node.layer}</p>
                              {node.isDefault && <span className="text-[8px] font-black bg-off-white text-brand-earth px-1.5 py-0.5 rounded uppercase">Preset</span>}
                              {node.type === 'Local' && <span className="text-[8px] font-black bg-orange-500/10 text-accent-earth px-1.5 py-0.5 rounded uppercase border border-orange-500/20">Sovereign Root</span>}
                           </div>
                           <p className="text-sm font-mono font-bold text-brand-deep mt-1">{node.provider}</p>
                           <p className="text-[10px] font-mono text-brand-earth italic truncate w-48 md:w-96">{node.endpoint}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        {!node.isDefault && (
                          <button type="button" onClick={() => removeNode(node.id)} className="opacity-0 group-hover:opacity-100 p-2 text-brand-earth hover:text-red-500 transition-all" aria-label="Remove Node" title="Remove Node">
                             <X size={16} />
                          </button>
                        )}
                        <div className={`w-2.5 h-2.5 rounded-full ${node.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-border'}`} />
                     </div>
                  </div>
                ))}
             </div>
          </div>

          {/* Infrastructure Research (Gemini Terminal) */}
          <div className="bg-ivory border border-border rounded-[3rem] p-1 shadow-2xl group">
             <div className="bg-white rounded-[2.8rem] flex flex-col min-h-[500px]">
                <div className="p-8 border-b border-border bg-off-white/20 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <Terminal size={18} className="text-accent-earth" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-brand-earth font-mono italic">INFRA_STRATEGIC_RESEARCH_TERMINAL</h3>
                   </div>
                   <div className="flex bg-off-white p-1 rounded-xl">
                      {['Bitcoin L1', 'Stacks', 'Rootstock'].map(l => (
                         <button 
                           key={l}
                           onClick={() => researchLayer(l)}
                           className="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-brand-earth hover:text-accent-earth transition-colors"
                         >
                            {l}
                         </button>
                      ))}
                   </div>
                </div>
                
                <div className="flex-1 p-10 font-mono text-xs text-brand-earth leading-relaxed overflow-y-auto custom-scrollbar relative">
                   {isLoadingResearch ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                         <Loader2 className="animate-spin text-accent-earth" size={32} />
                         <p className="uppercase tracking-[0.3em] font-black animate-pulse">Researching Global Peer Mesh...</p>
                      </div>
                   ) : researchData ? (
                      <div className="animate-in fade-in duration-500">
                         <div className="bg-orange-500/5 border border-orange-500/10 p-6 rounded-2xl mb-8 flex items-center gap-4">
                            <Sparkles className="text-accent-earth shrink-0" size={18} />
                            <p className="text-[10px] font-black uppercase text-accent-earth italic">Chief Infra Advisor: Optimal Routes Found</p>
                         </div>
                         <div className="whitespace-pre-wrap">{researchData}</div>
                      </div>
                   ) : (
                      <div className="flex flex-col items-center justify-center h-full text-brand-earth opacity-30 select-none">
                         <Database size={48} className="mb-4" />
                         <p className="text-sm uppercase tracking-[0.3em] font-black text-center">Execute Infrastructure Scan</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
          
            {/* Lightning Backend & Status */}
            <div className="bg-off-white/40 border border-border rounded-[2rem] p-6 space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                     <Zap size={14} /> Lightning Backend
                  </h3>
                  {lnBackend.type === 'Breez' && (
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[8px] font-bold uppercase text-green-500">Greenlight Active</span>
                     </div>
                  )}
               </div>

               {lnBackend.type === 'Breez' || appLnType === 'Breez' || appLnType === 'Greenlight' ? (
                  <BreezStatsView />
               ) : (
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                       <label className="text-[10px] font-black uppercase text-brand-earth">Type</label>
                       <select value={lnBackend.type} onChange={(e) => setLnBackend(prev => ({ ...prev, type: e.target.value as any }))} className="w-full bg-white border border-border rounded-2xl px-4 py-3 text-sm" aria-label="Lightning Backend Type" title="Lightning Backend Type">
                         <option>None</option>
                         <option value="Breez">Breez / Greenlight (Embedded)</option>
                         <option value="LND">LND (Remote)</option>
                       </select>
                     </div>
                     {lnBackend.type === 'LND' && (
                        <>
                           <div>
                             <label className="text-[10px] font-black uppercase text-brand-earth">Endpoint</label>
                             <input value={lnBackend.endpoint} onChange={(e) => setLnBackend(prev => ({ ...prev, endpoint: e.target.value }))} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" className="w-full bg-white border border-border rounded-2xl px-4 py-3 text-sm" placeholder="https://host:port" />
                           </div>
                           <div>
                             <label className="text-[10px] font-black uppercase text-brand-earth">API Key</label>
                             <input type="password" value={lnBackend.apiKey} onChange={(e) => setLnBackend(prev => ({ ...prev, apiKey: e.target.value }))} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" className="w-full bg-white border border-border rounded-2xl px-4 py-3 text-sm" placeholder="Macaroon hex or token" />
                           </div>
                        </>
                     )}
                   </div>
               )}
               
               <div className="flex justify-end gap-3">
                  {(lnBackend.type === 'Breez' || appLnType === 'Breez') && (
                      <p className="text-[9px] text-brand-earth self-center mr-auto italic">
                          Breez SDK is running locally. Keys are in Secure Enclave.
                      </p>
                  )}
                  <button type="button" onClick={() => appContext?.setLnBackend({ type: (lnBackend.type as any), endpoint: lnBackend.endpoint, apiKey: lnBackend.apiKey })} className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest" aria-label="Save Config">
                     Save Config
                  </button>
               </div>
            </div>

            {/* Network Sovereignty / Tor */}
            <div className="bg-off-white/40 border border-border rounded-[2rem] p-6 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                  <ShieldCheck size={14} /> Network Sovereignty
               </h3>
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-brand-deep text-sm font-bold">Tor Proxy (Orbot/Internal)</p>
                     <p className="text-[10px] text-brand-earth">Route all HTTP and PayJoin traffic through Tor network.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                     <input type="checkbox" className="sr-only peer" disabled checked={false} />
                     <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white0 after:border-white0 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 opacity-50 cursor-not-allowed"></div>
                  </label>
               </div>
               <p className="text-[9px] text-red-500 italic">Tor integration requires native binary. Currently disabled in Alpha.</p>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           {/* Ethos Advisor (Gemini) */}
           <div className="bg-accent-earth border border-orange-500 rounded-[3rem] p-10 text-white relative overflow-hidden group shadow-2xl shadow-orange-600/30">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                 <BookOpen size={100} />
              </div>
              <div className="relative z-10">
                 <h4 className="text-xl font-black italic uppercase tracking-tighter mb-4 flex items-center gap-2">
                    <Shield size={20} />
                    Sovereign Ethos Audit
                 </h4>
                 <div className="text-xs leading-relaxed font-medium space-y-4 opacity-90 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {isLoadingEthos ? (
                       <div className="flex flex-col items-center justify-center py-20 gap-3">
                          <Loader2 className="animate-spin" />
                          <span className="uppercase tracking-widest text-[10px] font-black">Analyzing Protocol Ethos...</span>
                       </div>
                    ) : (
                       <div className="whitespace-pre-wrap leading-relaxed">{ethosAdvice}</div>
                    )}
                 </div>
                 <button onClick={() => fetchEthos(selectedPath)} className="mt-8 w-full bg-white text-orange-600 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2 shadow-xl">
                    <RefreshCw size={14} /> Refresh Research
                 </button>
              </div>
           </div>

           {/* Hardware Specs Widget */}
           <div className="bg-white border border-border rounded-[2.5rem] p-8 space-y-6 shadow-xl">
              <h4 className="font-bold text-sm text-brand-earth flex items-center gap-2 uppercase tracking-widest">
                 <Cpu size={18} className="text-blue-500" />
                 Sovereign Specs
              </h4>
              <div className="space-y-4">
                 {[
                   { label: 'Storage', value: '2TB NVMe SSD', sub: 'Fast block validation' },
                   { label: 'RAM', value: '16GB DDR4', sub: 'Mempool & DB Cache' },
                   { label: 'Network', value: '1Gbps + Tor', sub: 'Privacy routing enabled' },
                 ].map((spec, i) => (
                    <div key={i} className="flex justify-between items-start border-b border-border pb-3 last:border-0">
                       <div>
                          <p className="text-[10px] font-black uppercase text-brand-earth">{spec.label}</p>
                          <p className="text-xs font-bold text-brand-deep">{spec.value}</p>
                       </div>
                       <p className="text-[9px] text-brand-earth italic">{spec.sub}</p>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Add Custom RPC Modal */}
      {isAddingNode && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-deep/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white border border-border rounded-[3rem] p-10 space-y-8 relative shadow-2xl">
               <button type="button" onClick={() => setIsAddingNode(false)} className="absolute top-8 right-8 text-brand-earth hover:text-brand-deep transition-colors" aria-label="Close Modal" title="Close Modal">
                  <X size={24} />
               </button>
               <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">Register Custom RPC</h3>
                  <p className="text-xs text-brand-earth italic leading-relaxed">Ensure your node supports JSON-RPC 2.0 and is accessible via Tor if hardened mode is active.</p>
               </div>
               
               <form onSubmit={handleAddNode} className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Protocol Layer</label>
                     <select 
                        value={newNode.layer}
                        onChange={e => setNewNode({ ...newNode, layer: e.target.value })}
                        className="w-full bg-off-white border border-border rounded-2xl py-4 px-5 text-brand-deep focus:outline-none"
                        aria-label="Protocol Layer"
                        title="Protocol Layer"
                     >
                        <option>Bitcoin L1</option>
                        <option>Stacks L2</option>
                        <option>Rootstock</option>
                        <option>Liquid</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Endpoint URI</label>
                     <input 
                        value={newNode.endpoint}
                        onChange={e => setNewNode({ ...newNode, endpoint: e.target.value })}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        placeholder="http://127.0.0.1:8332 or .onion"
                        className="w-full bg-off-white border border-border rounded-2xl py-4 px-5 font-mono text-sm text-brand-deep focus:outline-none focus:border-orange-500/50"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase text-brand-earth ml-1">Provider Alias</label>
                     <input 
                        value={newNode.provider}
                        onChange={e => setNewNode({ ...newNode, provider: e.target.value })}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        placeholder="e.g. Satoshi Home Node"
                        className="w-full bg-off-white border border-border rounded-2xl py-4 px-5 text-sm text-brand-deep focus:outline-none focus:border-orange-500/50"
                     />
                  </div>
                  <button type="submit" className="w-full bg-accent-earth hover:bg-accent-earth/90 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-orange-600/20 active:scale-95">
                     Authorize & Add Node
                  </button>
               </form>
            </div>
         </div>
      )}
    </div>
  );
};

const BreezStatsView: React.FC = () => {
    const [info, setInfo] = useState<any>(null);
    useEffect(() => {
        const poll = async () => {
             const { getBreezInfo } = await import('../services/breez');
             try {
                const data = await getBreezInfo();
                setInfo(data);
             } catch(e) { console.warn("Breez info failed", e); }
        };
        poll();
        const interval = setInterval(poll, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!info) return <div className="text-xs text-brand-earth italic"><Loader2 className="inline animate-spin mr-2" size={12}/>Connecting to Greenlight...</div>;
    
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/50 p-4 rounded-2xl border border-border">
            <div>
               <p className="text-[9px] font-black uppercase text-brand-earth">Node ID</p>
               <p className="text-xs font-mono text-brand-deep truncate" title={info.id}>{info.id.substring(0,8)}...</p>
            </div>
            <div>
               <p className="text-[9px] font-black uppercase text-brand-earth">Block Height</p>
               <p className="text-xs font-mono text-accent-earth">{info.blockHeight}</p>
            </div>
            <div>
               <p className="text-[9px] font-black uppercase text-brand-earth">Spendable (Local)</p>
               <p className="text-xs font-mono text-brand-deep">{(info.maxPayableMsat/1000).toLocaleString()} sats</p>
            </div>
            <div>
               <p className="text-[9px] font-black uppercase text-brand-earth">Inbound (Remote)</p>
               <p className="text-xs font-mono text-brand-deep">{(info.maxReceivableMsat/1000).toLocaleString()} sats</p>
            </div>
        </div>
    );
};

export default NodeSettings;
