import React from 'react';
import {
  LayoutDashboard,
  Repeat,
  Settings,
  Shield,
  Zap,
  UserCheck,
  Coins,
  CreditCard,
  Network,
  Lock,
  BarChart3,
  Briefcase,
  FlaskConical,
  Medal,
  Gavel,
  Landmark,
  BookOpen,
  Package,
  Rocket,
  Layers,
  Castle,
  Binary,
  Palette,
  ShoppingBag,
  Activity,
  Globe,
  Ghost
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'diagnostics', icon: Activity, label: 'System Health' },
    { id: 'bazaar', icon: ShoppingBag, label: 'Marketplace & Services' },
    { id: 'browser', icon: Globe, label: 'Web3 Browser' },
    { id: 'studio', icon: Palette, label: 'Sovereign Studio' },
    { id: 'payments', icon: CreditCard, label: 'Payments' },
    { id: 'utxos', icon: Binary, label: 'Coin Control' },
    { id: 'silent-payments', icon: Ghost, label: 'Silent Payments' },
    { id: 'citadel', icon: Castle, label: 'My Citadel' },
    { id: 'defi', icon: Layers, label: 'DeFi Hub & Staking' },
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
    <div className="w-64 h-screen border-r border-border bg-white flex flex-col p-6 sticky top-0 shadow-sm">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl overflow-hidden ring-1 ring-border shadow-sm">
          <img src="/conxius-logo.svg" alt="Conxius" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tighter text-brand-deep uppercase italic">Conxius <span className="text-accent-earth">Wallet</span></h1>
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] text-brand-earth font-black uppercase tracking-widest">Native Enclave</p>
            <span className="bg-accent-earth/10 text-accent-earth text-[8px] px-1.5 py-0.5 rounded border border-accent-earth/30 font-black uppercase">SVN 1.6</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-accent-earth text-white shadow-md'
                : 'text-brand-earth hover:text-brand-deep hover:bg-off-white'
            }`}
          >
            <item.icon size={18} className={activeTab === item.id ? 'text-white' : 'text-brand-earth'} />
            <span className="font-bold text-xs uppercase tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-border">
        <div className="bg-off-white border border-border rounded-2xl p-4 flex items-center gap-3">
           <div className="p-2 bg-accent-earth rounded-lg text-white">
              <Medal size={16} />
           </div>
           <div>
              <p className="text-[8px] font-black uppercase text-accent-earth tracking-widest">Sovereign Build</p>
              <p className="text-[10px] font-bold text-brand-deep italic">Hardware-Backed</p>
           </div>
        </div>
      </div>
    </div>
  );
};

// Mock Trophy icon since it was missing in the previous import list
const Trophy = (props: any) => <BarChart3 {...props} />;

export default Sidebar;
