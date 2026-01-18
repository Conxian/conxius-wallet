
import React from 'react';
import { LayoutDashboard, Repeat, Settings, Shield, Zap, Info, UserCheck, Coins, CreditCard, Network, Lock, Crown, TrendingUp, Trophy, BarChart3, Briefcase, Terminal, FlaskConical, Medal, Gavel, Landmark, BookOpen, Package, Rocket, Layers, Castle, Binary, Palette, ShoppingBag, Activity } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'diagnostics', icon: Activity, label: 'System Health' },
    { id: 'bazaar', icon: ShoppingBag, label: 'Sovereign Bazaar' },
    { id: 'studio', icon: Palette, label: 'Sovereign Studio' },
    { id: 'payments', icon: CreditCard, label: 'Payments' },
    { id: 'utxos', icon: Binary, label: 'Coin Control' },
    { id: 'citadel', icon: Castle, label: 'My Citadel' },
    { id: 'defi', icon: Layers, label: 'DeFi Enclave' },
    { id: 'rewards', icon: Trophy, label: 'Rewards Hub' },
    { id: 'labs', icon: FlaskConical, label: 'Labs Discovery' },
    { id: 'governance', icon: Gavel, label: 'Senate' },
    { id: 'reserves', icon: Landmark, label: 'Reserves' },
    { id: 'investor', icon: Briefcase, label: 'Stakeholder' },
    { id: 'benchmark', icon: BarChart3, label: 'Benchmark' },
    { id: 'docs', icon: BookOpen, label: 'System Manual' },
    { id: 'handoff', icon: Package, label: 'Release Manager' },
    { id: 'deploy', icon: Rocket, label: 'Deploy Network' },
    { id: 'stacking', icon: Coins, label: 'Stacking (PoX)' },
    { id: 'bridge', icon: Repeat, label: 'NTT Bridge' },
    { id: 'identity', icon: UserCheck, label: 'Identity (D.i.D)' },
    { id: 'nodes', icon: Network, label: 'Node Hub' },
    { id: 'privacy', icon: Lock, label: 'Privacy Enclave' },
    { id: 'security', icon: Shield, label: 'Security' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-64 h-screen border-r border-zinc-800 bg-zinc-950 flex flex-col p-6 sticky top-0">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
          <FlaskConical className="text-white fill-current" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Conxian <span className="text-orange-500">Labs</span></h1>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">Conxius Wallet</p>
            <span className="bg-orange-500/10 text-orange-500 text-[8px] px-1.5 py-0.5 rounded border border-orange-500/20 font-black uppercase shadow-sm">v1.2.0-ST</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <item.icon size={18} className={activeTab === item.id ? 'text-orange-500' : 'text-zinc-500'} />
            <span className="font-semibold text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-zinc-900 space-y-4">
        <div className="bg-gradient-to-tr from-orange-600/20 to-zinc-900 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-3">
           <div className="p-2 bg-orange-500 rounded-lg text-white">
              <Medal size={16} />
           </div>
           <div>
              <p className="text-[8px] font-black uppercase text-orange-500 tracking-widest">BSL License</p>
              <p className="text-[10px] font-bold text-zinc-200 italic">Commercial Limited</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
