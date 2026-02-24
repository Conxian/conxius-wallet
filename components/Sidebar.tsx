
import React from 'react';
import { LayoutDashboard, Repeat, Settings, Shield, Zap, Info, UserCheck, Coins, CreditCard, Network, Lock, Crown, TrendingUp, Trophy, BarChart3, Briefcase, Terminal, FlaskConical, Medal, Gavel, Landmark, BookOpen, Package, Rocket, Layers, Castle, Binary, Palette, ShoppingBag, Activity, Globe, Ghost } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'diagnostics', icon: Activity, label: 'System Health' },
    { id: 'bazaar', icon: ShoppingBag, label: 'Sovereign Bazaar' },
    { id: 'browser', icon: Globe, label: 'Web3 Browser' },
    { id: 'studio', icon: Palette, label: 'Sovereign Studio' },
    { id: 'payments', icon: CreditCard, label: 'Payments' },
    { id: 'utxos', icon: Binary, label: 'Coin Control' },
    { id: 'silent-payments', icon: Ghost, label: 'Silent Payments' },
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
    <div className="w-64 h-screen border-r border-[var(--border)] bg-[var(--surface-1)]/95 backdrop-blur-xl flex flex-col p-6 sticky top-0">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-[var(--border)] shadow-lg shadow-black/30">
          <img src="/conxius-logo.svg" alt="Conxius" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">Conxius <span className="text-[var(--accent)]">Wallet</span></h1>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-[var(--muted)] font-black uppercase tracking-[0.2em]">Native Enclave</p>
            <span className="bg-[rgba(247,147,26,0.12)] text-[var(--accent)] text-[8px] px-1.5 py-0.5 rounded border border-[rgba(247,147,26,0.35)] font-black uppercase shadow-sm">SVN 1.5</span>
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
                ? 'bg-[rgba(247,147,26,0.12)] text-[var(--accent)] border border-[rgba(247,147,26,0.35)] shadow-sm' 
                : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <item.icon size={18} className={activeTab === item.id ? 'text-[var(--accent)]' : 'text-[var(--muted)]'} />
            <span className="font-semibold text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-[var(--border)] space-y-4">
        <div className="bg-gradient-to-tr from-[rgba(247,147,26,0.18)] to-[rgba(17,24,39,0.9)] border border-[rgba(247,147,26,0.3)] rounded-2xl p-4 flex items-center gap-3">
           <div className="p-2 bg-[var(--accent)] rounded-lg text-white">
              <Medal size={16} />
           </div>
           <div>
              <p className="text-[8px] font-black uppercase text-[var(--accent-2)] tracking-widest">Sovereign Build</p>
              <p className="text-[10px] font-bold text-[var(--text)] italic">Hardware-Backed</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
