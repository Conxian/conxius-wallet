import React from 'react';
import { ExternalLink, ShieldCheck, ShoppingCart } from 'lucide-react';

interface HardwareWallet {
  name: string;
  description: string;
  link: string;
  commission: string;
  payout: string;
  recommended?: boolean;
  color: string;
  iconLetter: string;
}

const RecommendedHardware: React.FC = () => {
  const wallets: HardwareWallet[] = [
    {
      name: 'BitBox02',
      description: 'Swiss-made, open-source firmware. The best fit for "Bitcoin-only" sovereignty.',
      link: 'https://shiftcrypto.ch/bitbox02/?ref=CONXIUS', // TODO: Replace with actual affiliate link
      commission: '12%',
      payout: 'Bitcoin',
      recommended: true,
      color: 'bg-zinc-100 text-zinc-950',
      iconLetter: 'B'
    },
    {
      name: 'Trezor',
      description: 'The original hardware wallet. High compatibility and brand recognition.',
      link: 'https://trezor.io/?offer_id=12&aff_id=CONXIUS', // TODO: Replace with actual affiliate link
      commission: '12-15%',
      payout: 'BTC / EUR',
      color: 'bg-emerald-600 text-white',
      iconLetter: 'T'
    },
    {
      name: 'Ledger',
      description: 'Market leader with vast altcoin support. Great entry point.',
      link: 'https://shop.ledger.com/?r=CONXIUS', // TODO: Replace with actual affiliate link
      commission: '10%',
      payout: 'Fiat',
      color: 'bg-zinc-800 text-white',
      iconLetter: 'L'
    }
  ];

  return (
    <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2 uppercase tracking-widest text-orange-500 text-xs">
          <ShoppingCart size={16} />
          Sovereign Shield Shop
        </h3>
        <span className="text-[10px] font-bold text-zinc-600 uppercase">Verified Hardware</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {wallets.map((wallet, idx) => (
          <a
            key={idx}
            href={wallet.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`relative p-6 rounded-2xl flex flex-col justify-between border transition-all group ${
              wallet.recommended 
                ? 'bg-zinc-900/60 border-orange-500/30 hover:border-orange-500' 
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-600'
            }`}
          >
            {wallet.recommended && (
               <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg">
                 Top Pick
               </div>
            )}
            
            <div className="space-y-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${wallet.color} text-lg`}>
                {wallet.iconLetter}
              </div>
              <div>
                <h4 className="font-bold text-sm text-zinc-200">{wallet.name}</h4>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{wallet.description}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-zinc-600 uppercase">Support Us</span>
                  <span className="text-[9px] text-zinc-500">Earns {wallet.commission}</span>
               </div>
               <div className="w-8 h-8 rounded-full bg-zinc-950 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <ExternalLink size={12} />
               </div>
            </div>
          </a>
        ))}
      </div>
      
      <p className="text-[10px] text-zinc-500 italic text-center">
        Buying via these links directly funds Conxian Labs development without extra cost to you.
      </p>
    </div>
  );
};

export default RecommendedHardware;
