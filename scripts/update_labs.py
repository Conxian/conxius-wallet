import sys

file_path = "components/LabsExplorer.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Add Binary, CheckCircle2 to imports
if "Binary" not in content:
    content = content.replace("Globe", "Globe, Binary, CheckCircle2")

# Update UPCOMING_PROJECTS
if "BitVM Verifier" not in content:
    new_project = '  { id: "bitvm", name: "BitVM Verifier", status: "M6 READY", desc: "On-device ZK-STARK verification for optimistic rollups on Bitcoin.", icon: Binary, color: "text-green-500" },'
    content = content.replace("const UPCOMING_PROJECTS = [", f"const UPCOMING_PROJECTS = [\n{new_project}")

# Add states
if "bitVmProof" not in content:
    states = """  const [bitVmProof, setBitVmProof] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
"""
    content = content.replace("const LabsExplorer: React.FC = () => {", f"const LabsExplorer: React.FC = () => {{\n{states}")

# Add handleVerify
if "handleVerify" not in content:
    handle_verify = """
  const handleVerify = async () => {
    const { verifyBitVmProof } = await import("../services/protocol");
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await verifyBitVmProof(bitVmProof);
      setVerificationResult(res);
    } finally {
      setIsVerifying(false);
    }
  };
"""
    content = content.replace("const getProjectBlueprint = async (project: string) => {", f"{handle_verify}\n  const getProjectBlueprint = async (project: string) => {{")

# Add BitVM UI
if 'activeProject === "BitVM Verifier"' not in content:
    bitvm_ui = """
                   {activeProject === "BitVM Verifier" ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                         <div className="bg-green-600/10 border border-green-500/20 p-6 rounded-2xl">
                            <h4 className="text-green-500 font-black uppercase text-[10px] tracking-widest mb-2">STARK Proof Input</h4>
                            <textarea
                               value={bitVmProof}
                               onChange={(e) => setBitVmProof(e.target.value)}
                               placeholder="0x... (256+ character ZK-STARK proof)"
                               className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-4 text-zinc-300 font-mono text-[10px] focus:border-green-500/50 outline-none transition-all"
                            />
                         </div>
                         <button
                            onClick={handleVerify}
                            disabled={isVerifying || !bitVmProof}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-green-600/10"
                         >
                            {isVerifying ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                            Verify STARK Proof on TEE
                         </button>
                         {verificationResult !== null && (
                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${verificationResult ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-red-500/10 border-red-500/20 text-red-500"}`}>
                               {verificationResult ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                               <span className="font-black uppercase tracking-widest text-[10px]">
                                  {verificationResult ? "Proof Verified: Computational Integrity Guaranteed" : "Verification Failed: Proof Corrupted or Invalid"}
                               </span>
                            </div>
                         )}
                      </div>
                   ) : isGenerating ? ("""

    content = content.replace("{isGenerating ? (", bitvm_ui)

with open(file_path, "w") as f:
    f.write(content)
