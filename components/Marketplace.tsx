
import React, { useState, useContext } from 'react';
import { ShoppingBag, Wifi, Gift, Zap, Globe, Smartphone, Search, Filter, ShieldCheck, Plane, Tag, Lock } from 'lucide-react';
import { AppContext } from '../context';

type Category = 'Airtime' | 'Data' | 'Vouchers' | 'eSIM';

interface Product {
  id: string;
  name: string;
  description: string;
  priceSats: number;
  category: Category;
  icon: any;
  provider: string;
  region: string;
}

const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Global Ghost eSIM', description: '1GB Data, 30 Days. Works in 140 countries. No KYC.', priceSats: 25000, category: 'eSIM', icon: Plane, provider: 'Silent.Link', region: 'Global' },
  { id: '2', name: 'Takealot R500', description: 'South African shopping voucher. Instant delivery.', priceSats: 35000, category: 'Vouchers', icon: Gift, provider: 'Bitrefill', region: 'ZA' },
  { id: '3', name: 'MTN R200 Data', description: 'Prepaid data for SA MTN users.', priceSats: 14500, category: 'Airtime', icon: Smartphone, provider: 'Bitrefill', region: 'ZA' },
  { id: '4', name: 'Mullvad VPN (6 Months)', description: 'Ultimate anonymity. No account required.', priceSats: 72000, category: 'Data', icon: ShieldCheck, provider: 'Mullvad', region: 'Global' },
  { id: '5', name: 'Nostr Relay Premium', description: 'High-bandwidth relay access for 1 year.', priceSats: 5000, category: 'Data', icon: Globe, provider: 'Nostr.Watch', region: 'Global' },
  { id: '6', name: 'Sovereign Node Setup', description: 'Guided remote setup for Umbrel/RaspiBlitz.', priceSats: 100000, category: 'Data', icon: Lock, provider: 'Conxian Labs', region: 'Global' },
  { id: '7', name: 'Private Mail (1 Year)', description: 'End-to-end encrypted email with custom domain.', priceSats: 45000, category: 'Data', icon: ShieldCheck, provider: 'Proton', region: 'Global' },
  { id: '8', name: 'BitBox02 Bitcoin-only', description: 'Swiss hardware wallet. 12% affiliate cashback.', priceSats: 1200000, category: 'Vouchers', icon: Lock, provider: 'Shift Crypto', region: 'Global' },
];

const Marketplace: React.FC = () => {
  const appContext = useContext(AppContext);
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [regionFilter, setRegionFilter] = useState('All');
  
  // Advanced Filters
  const [providerFilter, setProviderFilter] = useState('All');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  if (!appContext) return null;
  const { mode } = appContext.state;

  // In sovereign mode, we don't show mock products.
  const productsToShow = mode === 'simulation' ? MOCK_PRODUCTS : [];
  if (mode === 'sovereign') {
    console.info('Marketplace offline in Sovereign mode');
  }

  const providers = ['All', ...Array.from(new Set(productsToShow.map(p => p.provider)))];

  const filteredProducts = productsToShow.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesRegion = regionFilter === 'All' || p.region === regionFilter || p.region === 'Global';
    const matchesProvider = providerFilter === 'All' || p.provider === providerFilter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.provider.toLowerCase().includes(searchQuery.toLowerCase());
    
    const price = p.priceSats;
    const min = minPrice ? parseInt(minPrice) : 0;
    const max = maxPrice ? parseInt(maxPrice) : Infinity;
    const matchesPrice = price >= min && price <= max;

    return matchesCategory && matchesRegion && matchesProvider && matchesSearch && matchesPrice;
  });

  const handleBuy = (product: Product) => {
    setSelectedProduct(product);
  };

  const closePurchase = () => {
    setSelectedProduct(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-brand-deep flex items-center gap-3 italic uppercase">
            <ShoppingBag className="text-accent-earth" />
            Sovereign Bazaar
          </h2>
          <p className="text-brand-earth text-sm italic">Catalog preview only. Checkout and fulfillment are unavailable.</p>
        </div>
        
        <div className="flex gap-4">
           <div className="bg-off-white border border-border px-6 py-3 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                 <ShieldCheck size={24} />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase text-brand-earth">Privacy Status</p>
                 <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-brand-deep">No-KYC / Accountless</p>
                 </div>
              </div>
           </div>
        </div>
      </header>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-3 space-y-6">
            {/* Search */}
            <div className="relative">
               <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full bg-white border border-border rounded-2xl py-4 pl-12 pr-4 font-mono text-xs text-brand-deep focus:outline-none focus:border-orange-500/50"
               />
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-earth" size={16} />
            </div>

            {/* Region Filter */}
            <div className="bg-off-white/40 border border-border rounded-[2rem] p-6 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                  <Globe size={14} /> Region
               </h3>
               <div className="flex flex-wrap gap-2">
                  {['All', 'Global', 'Brazil', 'Nigeria', 'Kenya', 'China', 'MENA', 'SEA', 'EU'].map(r => (
                     <button 
                        key={r}
                        onClick={() => setRegionFilter(r)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                           regionFilter === r 
                              ? 'bg-orange-500 text-white' 
                              : 'bg-white border border-border text-brand-earth hover:border-brand-earth'
                        }`}
                     >
                        {r}
                     </button>
                  ))}
               </div>
            </div>

            {/* Provider Filter */}
            <div className="bg-off-white/40 border border-border rounded-[2rem] p-6 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                  <Tag size={14} /> Provider
               </h3>
               <div className="flex flex-wrap gap-2">
                  {providers.map(p => (
                     <button 
                        key={p}
                        onClick={() => setProviderFilter(p)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                           providerFilter === p 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-white border border-border text-brand-earth hover:border-brand-earth'
                        }`}
                     >
                        {p}
                     </button>
                  ))}
               </div>
            </div>

            {/* Price Filter */}
            <div className="bg-off-white/40 border border-border rounded-[2rem] p-6 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-earth flex items-center gap-2">
                  <Zap size={14} /> Price Range (Sats)
               </h3>
               <div className="flex gap-2">
                  <input 
                     type="number" 
                     placeholder="Min" 
                     value={minPrice} 
                     onChange={(e) => setMinPrice(e.target.value)}
                     className="w-full bg-white border border-border rounded-xl py-2 px-3 text-[10px] text-brand-deep focus:outline-none focus:border-orange-500/50"
                  />
                  <input 
                     type="number" 
                     placeholder="Max" 
                     value={maxPrice} 
                     onChange={(e) => setMaxPrice(e.target.value)}
                     className="w-full bg-white border border-border rounded-xl py-2 px-3 text-[10px] text-brand-deep focus:outline-none focus:border-orange-500/50"
                  />
               </div>
            </div>

            {/* Categories */}
            <div className="space-y-2">
               {[
                  { id: 'All', icon: Filter, label: 'All Items' },
                  { id: 'eSIM', icon: Wifi, label: 'Ghost Data (eSIM)' },
                  { id: 'Airtime', icon: Smartphone, label: 'Mobile Refills' },
                  { id: 'Vouchers', icon: Gift, label: 'Gift Cards' },
                  { id: 'Data', icon: ShieldCheck, label: 'Privacy Tools' },
               ].map((cat) => (
                  <button
                     key={cat.id}
                     onClick={() => setActiveCategory(cat.id as any)}
                     className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        activeCategory === cat.id 
                           ? 'bg-off-white border-orange-500/50 text-brand-deep shadow-lg'
                           : 'bg-white border-border text-brand-earth hover:border-border'
                     }`}
                  >
                     <div className="flex items-center gap-3">
                        <cat.icon size={16} className={activeCategory === cat.id ? 'text-accent-earth' : 'text-brand-earth'} />
                        <span className="text-xs font-bold uppercase tracking-wide">{cat.label}</span>
                     </div>
                     {activeCategory === cat.id && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                  </button>
               ))}
            </div>
         </div>

         {/* Product Grid */}
         <div className="lg:col-span-9">
            {mode === 'sovereign' ? (
                <div className="flex flex-col items-center justify-center h-96 opacity-70 space-y-4 border border-border rounded-[2.5rem] bg-off-white/20">
                    <Lock size={48} className="text-brand-earth" />
                    <p className="text-sm font-bold text-brand-earth uppercase tracking-widest">Marketplace Offline</p>
                    <p className="text-xs text-brand-earth italic">Sovereign P2P Bazaar connection requires active tor circuit.</p>
                </div>
            ) : filteredProducts.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-96 opacity-50 space-y-4">
                  <Search size={48} className="text-brand-earth" />
                  <p className="text-sm font-bold text-brand-earth">No products found matching your filters.</p>
                  <button 
                     onClick={() => {
                        setRegionFilter('All');
                        setProviderFilter('All');
                        setMinPrice('');
                        setMaxPrice('');
                        setSearchQuery('');
                     }}
                     className="text-[10px] uppercase font-black text-accent-earth hover:underline"
                     type="button"
                  >
                     Reset Filters
                  </button>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                     <button 
                        key={product.id}
                        onClick={() => handleBuy(product)}
                        aria-label={`Preview ${product.name}`}
                        className="bg-off-white/20 border border-border rounded-[2.5rem] p-6 text-left hover:bg-off-white/40 hover:border-orange-500/30 transition-all group flex flex-col h-full"
                        type="button"
                     >
                        <div className="flex justify-between items-start mb-6">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-border group-hover:border-border">
                              <product.icon size={20} className="text-brand-earth group-hover:text-accent-earth transition-colors" />
                           </div>
                           <span className="text-[9px] font-black uppercase bg-white text-brand-earth px-2 py-1 rounded border border-border">{product.provider}</span>
                        </div>
                        
                        <div className="flex-1">
                           <h3 className="font-bold text-brand-deep text-lg mb-1">{product.name}</h3>
                           <p className="text-xs text-brand-earth leading-relaxed">{product.description}</p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                           <div className="flex items-center gap-1.5">
                              <Zap size={14} className="text-yellow-500 fill-current" />
                              <span className="text-sm font-mono font-bold text-brand-deep">{product.priceSats.toLocaleString()}</span>
                              <span className="text-[10px] font-black uppercase text-brand-earth">Sats</span>
                           </div>
                           <span className="text-[9px] font-bold text-brand-earth uppercase">{product.region}</span>
                        </div>
                     </button>
                  ))}
               </div>
            )}
         </div>
      </div>

      {/* Purchase Modal */}
      {selectedProduct && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-deep/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white border border-border rounded-[3rem] p-8 space-y-6 relative shadow-2xl overflow-hidden">
               <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 bg-off-white rounded-2xl flex items-center justify-center mx-auto text-brand-earth border border-border">
                     <Lock size={28} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-accent-earth">Preview item</p>
                     <h3 className="text-2xl font-black text-brand-deep">{selectedProduct.name}</h3>
                     <p className="text-xs text-brand-earth mt-2">Checkout, payment, and code fulfillment are unavailable.</p>
                  </div>
                  <div className="bg-off-white/50 rounded-2xl p-4 border border-border">
                     <p className="text-[9px] font-black uppercase text-brand-earth">Reference price</p>
                     <p className="text-lg font-mono font-bold text-accent-earth">{selectedProduct.priceSats.toLocaleString()} sats</p>
                  </div>
                  <button onClick={closePurchase} className="w-full py-4 bg-brand-deep text-white font-black rounded-2xl text-[10px] uppercase tracking-widest" type="button">
                     Close preview
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Marketplace;
