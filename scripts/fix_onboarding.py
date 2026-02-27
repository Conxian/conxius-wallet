import re

onboarding_start_replacement = """        {step === 'start' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-orange-500 shadow-xl">
                <FlaskConical size={32} />
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-100 uppercase italic">Conxius Enclave</h2>
              <p className="text-zinc-500 text-sm">Initialize your sovereign interface.</p>
            </div>

            <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 mb-6">
                <button
                  onClick={() => setAppMode('sovereign')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${appMode === 'sovereign' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Sovereign
                </button>
                <button
                  onClick={() => setAppMode('simulation')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${appMode === 'simulation' ? 'bg-orange-600 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Simulation
                </button>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setStep('type')}
                className="w-full p-6 bg-orange-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-orange-500 transition-all flex items-center justify-between"
              >
                <span>Create Vault</span>
                <ArrowRight size={20} />
              </button>
              <button
                onClick={() => setStep('import')}
                className="w-full p-6 bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-[2rem] font-black uppercase tracking-widest hover:border-zinc-700 transition-all flex items-center justify-between"
              >
                <span>Import Recovery</span>
                <RefreshCcw size={20} />
              </button>
            </div>
          </div>
        )}"""

with open('components/Onboarding.tsx', 'r') as f:
    content = f.read()

# Refined regex to match the step === 'start' block accurately
pattern = r'\{step === \'start\' && \(.*?\n\s+<\/div>\n\s+\)\}'
content = re.sub(pattern, onboarding_start_replacement, content, flags=re.DOTALL)

with open('components/Onboarding.tsx', 'w') as f:
    f.write(content)
