import { GoogleGenAI } from "@google/genai";
import { Asset, AppState } from "../types";
import { secureAuditPrompt, rehydrateResponse } from './ai-security';

/**
 * Unified AI Service (Sovereign v1.1)
 * Supports BYOS (Bring Your Own Service) and local simulation.
 */

let _aiConfig: AppState['aiConfig'];

export const setAiConfig = (config: AppState['aiConfig']) => {
  _aiConfig = config;
};

export const callAi = async (prompt: string, options: {
    systemInstruction?: string;
    model?: string;
    thinkingBudget?: number;
} = {}): Promise<string> => {

  if (!_aiConfig || (!_aiConfig.apiKey && _aiConfig.provider !== 'Custom')) {
     return "AI Service not configured. Using local simulation heuristics.";
  }

  // 1. SECURITY AUDIT: Sanitize outgoing prompt
  const { sanitized, isBlocked, reason } = secureAuditPrompt(prompt);
  if (isBlocked) return `[Sovereign Audit Blocked]: ${reason}`;

  try {
    let responseText = "";

    if (_aiConfig.provider === 'Gemini') {
        const ai = new GoogleGenAI({ apiKey: _aiConfig.apiKey! });
        const response = await ai.models.generateContent({
            model: options.model || 'gemini-1.5-flash',
            contents: sanitized,
            config: {
                systemInstruction: options.systemInstruction,
                ...(options.thinkingBudget ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } } : {})
            }
        });
        responseText = response.text || "";
    } else if (_aiConfig.provider === 'Custom' && _aiConfig.endpoint) {
        // BYOS: Custom AI Hook (Compatible with OpenAI-style APIs)
        const response = await fetch(_aiConfig.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${_aiConfig.apiKey || ''}`
            },
            body: JSON.stringify({
                model: options.model || 'custom-model',
                messages: [
                    { role: 'system', content: options.systemInstruction || '' },
                    { role: 'user', content: sanitized }
                ]
            })
        });

        if (!response.ok) throw new Error(`BYOS Error: ${response.status}`);
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || data.response || "";
    } else {
        return "Provider not supported or missing endpoint.";
    }

    // 2. REHYDRATE: Re-inject redacted data for user visibility
    return rehydrateResponse(responseText);

  } catch (error: any) {
    console.error("[Sovereign AI] Call failed", error);
    return `AI Protocol Error: ${error.message}`;
  }
};
