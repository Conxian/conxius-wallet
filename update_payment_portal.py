import sys

with open('components/PaymentPortal.tsx', 'r') as f:
    content = f.read()

# Add import
if 'import { estimateFees' not in content:
    content = content.replace(
        "import { Network } from '../types';",
        "import { Network } from '../types';\nimport { estimateFees, FeeEstimation } from '../services/FeeEstimator';"
    )

# Add state
if 'feeEstimation, setFeeEstimation' not in content:
    content = content.replace(
        "const [breezBalance, setBreezBalance] = useState<number | null>(null);",
        "const [breezBalance, setBreezBalance] = useState<number | null>(null);\n  const [feeEstimation, setFeeEstimation] = useState<FeeEstimation | null>(null);"
    )

# Add useEffect
if 'updateFees = async' not in content:
    use_effect_code = """
  useEffect(() => {
    const updateFees = async () => {
      if (amount && (method === "onchain" || recipient.includes(".btc"))) {
        const est = await estimateFees(context?.state.network || "mainnet", "mainnet");
        setFeeEstimation(est);
      } else {
        setFeeEstimation(null);
      }
    };
    updateFees();
  }, [amount, method, recipient, context?.state.network]);
"""
    content = content.replace(
        "  }, [context?.state.lnBackend]);",
        "  }, [context?.state.lnBackend]);\n" + use_effect_code
    )

# Add UI
if 'Gas Efficiency' not in content:
    ui_code = """
        {feeEstimation && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-4 space-y-3 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
               <span className="text-[10px] uppercase font-black text-zinc-500">Gas Efficiency</span>
               <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                 feeEstimation.efficiencyRating === 'optimal' ? 'bg-emerald-500/20 text-emerald-500' :
                 feeEstimation.efficiencyRating === 'high' ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'
               }`}>
                 <TrendingDown size={10} /> {feeEstimation.efficiencyRating}
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <p className="text-[8px] uppercase text-zinc-600 font-bold">Network Fee</p>
                  <p className="text-xs font-mono text-zinc-300">{feeEstimation.totalFee.toFixed(8)} BTC</p>
               </div>
               <div className="text-right">
                  <p className="text-[8px] uppercase text-zinc-600 font-bold">Abstracted Saving</p>
                  <p className="text-xs font-mono text-emerald-500">~0.00001 BTC</p>
               </div>
            </div>
          </div>
        )}"""

    # Insert before the button
    target = 'onClick={method === \'onramp\' ? handleOnrampInitiate : handleSend}'
    button_start = content.rfind('<button', 0, content.find(target))
    if button_start != -1:
        content = content[:button_start] + ui_code + "\n              " + content[button_start:]

with open('components/PaymentPortal.tsx', 'w') as f:
    f.write(content)
