
import React, { useContext } from 'react';
import { LayoutDashboard, CreditCard, Trophy, FlaskConical, Gavel, Landmark, Briefcase, BarChart3, BookOpen, Package, Rocket, Coins, Repeat, UserCheck, Network, Lock, Shield, Settings, X, ChevronRight, LogOut, Zap, Layers, Palette, ShoppingBag } from 'lucide-react';
import { AppContext } from '../context';

interface MobileMenuProps {
  setActiveTab: (tab: string) => void;
  activeTab: string;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ setActiveTab, activeTab }) => {
  const context = useContext(AppContext);

  const MENU_SECTIONS = [
    {
      title: 'Finance',
      items: [
        { id: 'dashboard', label: 'Wallet', icon: LayoutDashboard },
        { id: 'bazaar', label: 'Bazaar', icon: ShoppingBag },
        { id: 'payments', label: 'Payments', icon: CreditCard },
        { id: 'defi', label: 'DeFi', icon: Layers },
        { id: 'stacking', label: 'Stacking', icon: Coins },
        { id: 'bridge', label: 'Bridge', icon: Repeat },
      ]
    },
    {
      title: 'Protocol',
      items: [
        { id: 'studio', label: 'Studio', icon: Palette },
        { id: 'governance', label: 'Senate', icon: Gavel },
        { id: 'labs', label: 'Labs', icon: FlaskConical },
        { id: 'rewards', label: 'Rewards', icon: Trophy },
        { id: 'nodes', label: 'Nodes', icon: Network },
        { id: 'deploy', label: 'Deploy', icon: Rocket },
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'identity', label: 'Identity', icon: UserCheck },
        { id: 'privacy', label: 'Privacy', icon: Lock },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'handoff', label: 'Release', icon: Package },
        { id: 'reserves', label: 'Reserves', icon: Landmark },
        { id: 'settings', label: 'Config', icon: Settings },
      ]
    }
  ];

  return (
    <div className="p-6 pb-32 animate-in slide-in-from-bottom-10 duration-300">
      
      {/* Mobile Header Profile */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] mb-8 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
              <Zap size={24} fill="currentColor" />
           </div>
           <div>
              <h3 className="text-lg font-black text-zinc-100 italic uppercase tracking-tighter">Sovereign Mode</h3>
              <p className="text-[10px] font-mono text-zinc-500 font-bold uppercase">
                 {context?.state.isMainnetLive ? 'Mainnet Active' : 'Testnet Alpha'}
              </p>
           </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black uppercase text-zinc-500">Score</p>
           <p className="text-xl font-bold text-orange-500">{context?.state.sovereigntyScore}</p>
        </div>
      </div>

      <div className="space-y-8">
        {MENU_SECTIONS.map((section, idx) => (
          <div key={idx}>
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-4 ml-2">{section.title}</h4>
            <div className="grid grid-cols-4 gap-3">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 aspect-square ${
                    activeTab === item.id 
                      ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30' 
                      : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-[9px] font-bold uppercase tracking-tight truncate w-full text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-4 border-t border-zinc-900">
         <button className="w-full py-4 flex items-center justify-center gap-2 text-red-500 font-black uppercase text-xs tracking-widest hover:bg-red-500/10 rounded-2xl transition-all">
            <LogOut size={16} /> Lock Enclave
         </button>
         <p className="text-center text-[9px] text-zinc-700 mt-4 font-mono">v1.0.0-STABLE • Build 872941</p>
      </div>
    </div>
  );
};

export default MobileMenu;
