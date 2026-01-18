
import React from 'react';
import { LayoutDashboard, CreditCard, Repeat, Shield, Grid } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const items = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Wallet' },
    { id: 'payments', icon: CreditCard, label: 'Pay' },
    { id: 'bridge', icon: Repeat, label: 'Bridge' },
    { id: 'security', icon: Shield, label: 'Security' },
    { id: 'menu', icon: Grid, label: 'Menu' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-900 pb-safe-area-inset px-6 h-20 z-[90] flex items-center justify-between">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex flex-col items-center gap-1.5 transition-all p-2 rounded-xl active:bg-zinc-900/50 ${
            activeTab === item.id ? 'text-orange-500' : 'text-zinc-500'
          }`}
        >
          <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
          <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
