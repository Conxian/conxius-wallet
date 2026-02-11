import re

with open('components/Settings.tsx', 'r') as f:
    content = f.read()

# Remove all duplicates of the "Native Plugins Status" section
pattern = r'\{\/\* Native Plugins Status \*\/\}' + r'.*?' + r'<\/section>'
# We only want to keep one. But wait, I might have messed up the nesting.
# Let's just search for the specific duplicated block and replace with one.

# Actually, I'll just find all matches and keep the first one that is in the right place.
# Or better, I'll remove all and insert it once at the right place.

# Identify the core of the section
core = """        {/* Native Plugins Status */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/20">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Zap size={16} className="text-orange-500" /> Native Environment
            </h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <Shield size={12} /> The Conclave (Enclave)
              </label>
              <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-900">
                 <span className="text-xs text-zinc-400">Status</span>
                 <span className="text-[10px] font-black text-green-500 uppercase">Hardware Locked</span>
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-zinc-600 flex items-center gap-2">
                <Zap size={12} /> Breez (Lightning)
              </label>
              <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-900">
                 <span className="text-xs text-zinc-400">Mobile Node</span>
                 <span className="text-[10px] font-black text-orange-500 uppercase">Ready</span>
              </div>
            </div>
          </div>
        </section>"""

# Remove all occurrences of the above core (approximately)
# and all "Native Plugins Status" comments
content = re.sub(r'\{\/\* Native Plugins Status \*\/\}', '', content)
# This is tricky because of the tags.

# Let's try to find the whole sections
sections = re.findall(r'<section className="bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden">.*?<Zap size={16} className="text-orange-500" /> Native Environment.*?<\/section>', content, re.DOTALL)
for s in sections:
    content = content.replace(s, '')

# Now find where to insert it. Before "System Persistence"
marker = '{/* System Persistence */}'
if marker in content:
    content = content.replace(marker, core + '\n        ' + marker)

with open('components/Settings.tsx', 'w') as f:
    f.write(content)
