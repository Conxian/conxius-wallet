import sys

file_path = "components/LabsExplorer.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Add Binary, CheckCircle2, and the typed BitVM imports
if "Binary" not in content:
    content = content.replace("Globe", "Globe, Binary, CheckCircle2")
if "BitVmVerificationResult" not in content:
    content = content.replace(
        'import { GoogleGenAI } from "@google/genai";\n',
        'import { GoogleGenAI } from "@google/genai";\nimport type { BitVmProofEnvelope, BitVmProofRequest, BitVmVerificationResult } from "@/services/bitvm";\n',
    )

# Update UPCOMING_PROJECTS
if "BitVM2 Research" not in content:
    new_project = '  { id: "bitvm", name: "BitVM2 Research", status: "RESEARCH / QUARANTINED", desc: "Versioned quarantine-envelope research only; no reviewed BitVM2 verifier is integrated.", icon: Binary, color: "text-accent-earth" },'
    content = content.replace("const UPCOMING_PROJECTS = [", f"const UPCOMING_PROJECTS = [\n{new_project}")

# Add states
if "bitVmProof" not in content:
    states = """  const [bitVmProof, setBitVmProof] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<BitVmVerificationResult | null>(null);
"""
    content = content.replace("const LabsExplorer: React.FC = () => {", f"const LabsExplorer: React.FC = () => {{\n{states}")

# Add handleVerify
if "handleVerify" not in content:
    handle_verify = """
  const handleVerify = async () => {
    const { verifyBitVmProof } = await import("../services/bitvm");
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      let input: string | BitVmProofEnvelope | BitVmProofRequest = bitVmProof;
      try {
        input = JSON.parse(bitVmProof) as BitVmProofEnvelope | BitVmProofRequest;
      } catch {
        // Raw text is intentionally rejected as malformed by the service.
      }
      const res = await verifyBitVmProof(input);
      setVerificationResult(res);
    } finally {
      setIsVerifying(false);
    }
  };
"""
    content = content.replace("const getProjectBlueprint = async (project: string) => {", f"{handle_verify}\n  const getProjectBlueprint = async (project: string) => {{")

# Add BitVM UI
if 'activeProject === "BitVM2 Research"' not in content:
    bitvm_ui = """
                   {activeProject === "BitVM2 Research" ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                         <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl">
                            <h4 className="text-accent-earth font-black uppercase text-[10px] tracking-widest mb-2">Versioned BitVM2 Quarantine Envelope (JSON)</h4>
                            <textarea
                               value={bitVmProof}
                               onChange={(e) => setBitVmProof(e.target.value)}
                               placeholder="Paste the versioned quarantine envelope JSON; raw proofs are not accepted."
                               className="w-full h-32 bg-ivory border border-border rounded-xl p-4 text-brand-deep font-mono text-[10px] focus:border-orange-500/50 outline-none transition-all"
                            />
                            <p className="mt-3 text-[10px] text-brand-earth leading-relaxed">
                              Research/scaffolding only. No reviewed verifier is integrated, and this surface cannot authorize signing.
                            </p>
                         </div>
                         <button
                            onClick={handleVerify}
                            disabled={isVerifying || !bitVmProof}
                            className="w-full py-4 bg-accent-earth hover:bg-orange-600 disabled:bg-border text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-orange-600/10"
                         >
                            {isVerifying ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                            Check Envelope Metadata
                         </button>
                         {verificationResult !== null && (
                            <div className="p-4 rounded-xl border flex items-start gap-3 bg-orange-500/10 border-orange-500/20 text-accent-earth">
                               <Zap size={16} className="mt-0.5 shrink-0" />
                               <div className="space-y-1">
                                  <span className="font-black uppercase tracking-widest text-[10px]">{verificationResult.status === 'verified' ? 'QUARANTINED' : verificationResult.status.toUpperCase()}</span>
                                  <p className="text-[10px] leading-relaxed">{verificationResult.status === 'simulated' ? 'Simulation results are non-authoritative and cannot be used for signing.' : verificationResult.status === 'verified' ? 'Caller-provided verified metadata is not trusted; authoritative verification is disabled until a reviewed verifier is integrated.' : verificationResult.reason}</p>
                               </div>
                            </div>
                         )}
                      </div>
                   ) : isGenerating ? ("""

    content = content.replace("{isGenerating ? (", bitvm_ui)

with open(file_path, "w") as f:
    f.write(content)
