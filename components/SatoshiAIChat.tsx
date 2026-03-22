import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Terminal,
  Send,
  Bot,
  Loader2,
  X,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { AppContext } from "../context";
import { calculatePrivacyScore } from "../services/privacy";
import { getRandomInt } from "../services/random";
import { secureAuditPrompt } from "../services/ai-security";
import { callAi } from "../services/ai";

const SatoshiAIChat: React.FC = () => {
  const appContext = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; content: string; isSanitized?: boolean }[]
  >([
    {
      role: "ai",
      content:
        "I am Satoshi AI. Ask me about your sovereign risk, L2 alpha, or the genesis block secrets.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastSanitized, setLastSanitized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !appContext) return;

    const userMessage = input;
    setInput("");

    const {
      sanitized: uiSanitized,
      isBlocked,
      reason,
    } = secureAuditPrompt(userMessage);

    const config = appContext?.state.aiConfig;

    if (isBlocked) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "ai", content: `[Sovereign Audit Blocked]: ${reason}` },
      ]);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: uiSanitized,
        isSanitized: uiSanitized !== userMessage,
      },
    ]);

    setIsLoading(true);
    setLastSanitized(uiSanitized !== userMessage);

    try {
      let responseText = "";

      if (!appContext || !config || (!config.apiKey && config.provider !== "Custom")) {
        await new Promise((r) => setTimeout(r, 1000));
        const responses = [
          "Analyzing the mempool... The blocks are full but fees are low. A good time to consolidate UTXOs.",
          "Your sovereignty score is solid. Have you considered running a local node to reach 100%?",
          "Stacks sBTC peg-in is approaching activation. Keep an eye on the Signer set.",
          "Reminder: Not your keys, not your coins. The Enclave is secure.",
          "Layer 2 liquidity is deepening. Arbitrage opportunities detected between Liquid and Rootstock.",
          `Privacy Audit: ${appContext ? calculatePrivacyScore(appContext.state).score : 0}/100. ${appContext ? (calculatePrivacyScore(appContext.state).recommendations[0] || "Maintain vigilance.") : ""}`,
        ];
        responseText =
          responses[getRandomInt(responses.length)] + " [SIMULATION]";
      } else {
        responseText = await callAi(userMessage, {
          systemInstruction: `You are Satoshi AI, a master of Bitcoin technology and sovereign finance.
You are concise, technical, and prioritize user privacy.
You help users understand Bitcoin layers and risk.
Current Wallet Context:
- Privacy Score: ${calculatePrivacyScore(appContext.state).score}/100
- Privacy Recommendations: ${calculatePrivacyScore(appContext.state).recommendations.join(", ")}
- Tor Routing: ${appContext.state.isTorEnabled ? "ENABLED" : "DISABLED"}
Use a terminal-style tone.
NOTE: Some sensitive identifiers in user messages may be replaced with placeholders like [BTC_ADDR_XXXX]. Always refer to them by their placeholders.`,
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: responseText || "Connection to the network lost.",
        },
      ]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "An error occurred in the mempool. Try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-accent-earth text-white rounded-2xl shadow-2xl shadow-accent-earth/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-60 border border-accent-earth/20"
        aria-label="Open Satoshi AI Chat"
        title="Open Satoshi AI Chat"
      >
        <Bot size={24} className="md:w-7 md:h-7" />
      </button>
    );
  }

  const isAiActive =
    appContext?.state.aiConfig?.apiKey ||
    (appContext?.state.aiConfig?.provider === "Custom" &&
      appContext?.state.aiConfig?.endpoint);

  return (
    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 w-[calc(100vw-2rem)] md:w-96 h-[500px] bg-white border border-border rounded-[2.5rem] shadow-2xl z-70 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
      <div className="p-5 border-b border-border bg-off-white/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-accent-earth" />
          <h3 className="font-bold text-sm tracking-tight text-brand-deep">Satoshi Terminal</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-border/50 px-2 py-0.5 rounded-full border border-brand-earth/50">
            <ShieldCheck size={10} className="text-green-600" />
            <span className="text-[9px] text-brand-earth font-mono uppercase tracking-widest">
              Sovereign-Audit-v1.0
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-off-white rounded-lg text-brand-earth"
            aria-label="Close Chat"
            title="Close Chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-ivory"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`relative max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-deep text-white shadow-lg"
                  : "bg-white border border-border text-brand-deep font-mono shadow-sm"
              }`}
            >
              {m.role === "ai" && (
                <ChevronRight
                  size={12}
                  className="inline mr-1 text-accent-earth"
                />
              )}
              {m.content}
              {m.isSanitized && (
                <div
                  className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 border border-accent-earth shadow-sm"
                  title="Sensitive data redacted from outgoing prompt"
                >
                  <ShieldAlert size={8} className="text-accent-earth" />
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-border p-3 rounded-2xl text-accent-earth flex items-center gap-2 shadow-sm">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-[10px] font-mono uppercase tracking-widest">
                Thinking...
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="p-4 bg-white border-t border-border flex flex-col gap-2 shadow-inner"
      >
        <div className="flex gap-2">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            placeholder="Ask Satoshi anything..."
            className="flex-1 bg-off-white border border-border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent-earth text-brand-deep transition-all"
          />
          <button
            disabled={isLoading || !input.trim()}
            type="submit"
            className="w-10 h-10 bg-accent-earth text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-accent-earth/90 transition-all shadow-md active:scale-90"
            aria-label="Send Message"
            title="Send Message"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between px-1">
          <p className="text-[9px] text-brand-earth font-mono">
            {lastSanitized
              ? "⚠️ Sensitive identifiers redacted for privacy."
              : "✓ Zero-Leak Privacy Active"}
          </p>
          <div className="flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isAiActive ? "bg-green-600 animate-pulse" : "bg-accent-earth"}`}
            ></div>
            <span className="text-[9px] text-brand-earth uppercase tracking-widest font-black">
              {isAiActive
                ? `Remote-${appContext?.state.aiConfig?.provider}`
                : "Local-Sim"}
            </span>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SatoshiAIChat;
