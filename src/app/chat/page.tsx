"use client";

/**
 * AI shopping agent chat — the agentic-commerce centerpiece.
 *
 * The agent has real tools: it searches the catalogue semantically, reads
 * listing details, creates real PayPal purchase orders (with the commission
 * split) and can issue real PayPal invoices. Tool calls and their results
 * are rendered transparently in the stream.
 *
 * Design: a futuristic "agent console" — neon-bordered glass terminal with
 * a sweeping scan-line, an animated AI avatar, gradient user bubbles,
 * terminal-style tool-call chips and animated typing dots.
 */
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PageTransition } from "@/components/fx/PageTransition";

const SUGGESTIONS = [
  "Find me an invoicing app under $300",
  "What AI-verified apps are for sale?",
  "I want to buy SupportGenie — create the order",
  "Create a PayPal invoice for a custom build",
];

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent/chat" }),
  });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const streamRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the agent streams.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function submit(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <PageTransition>
      <div className="mx-auto flex h-[calc(100svh-7rem)] max-w-4xl flex-col px-4 pb-6">
        {/* Header with animated AI avatar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5 flex items-center gap-4"
        >
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            {/* Pulsing halo rings around the agent orb. */}
            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-violet-500/40" />
            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-cyan-400/30 [animation-delay:1s]" />
            <span
              className="relative h-11 w-11 rounded-full"
              style={{
                background: "radial-gradient(circle at 35% 30%, #e0e7ff, #8b5cf6 45%, #0891b2 80%)",
                boxShadow: "0 0 30px rgba(139,92,246,0.8)",
              }}
            />
          </div>
          <div>
            <p className="eyebrow">Agentic commerce · live</p>
            <h1 className="mt-1 text-3xl font-bold text-white">
              AI Shopping <span className="text-gradient">Agent</span>
            </h1>
            <p className="text-muted text-sm">
              Searches the marketplace, compares apps, and creates real PayPal
              orders &amp; invoices.
            </p>
          </div>
        </motion.div>

        {/* Message stream — the console */}
        <div className="neon-border relative flex-1 overflow-hidden rounded-3xl">
          {/* Sweeping scan-line for the "terminal" vibe. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="h-1/4 w-full animate-[scan_6s_linear_infinite] bg-gradient-to-b from-transparent via-cyan-300/[0.04] to-transparent" />
          </div>
          <div aria-hidden className="dot-bg pointer-events-none absolute inset-0 opacity-30" />

          <div
            ref={streamRef}
            data-lenis-prevent
            className="relative h-full space-y-4 overflow-y-auto p-5"
          >
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-muted text-sm">Ask me anything — for example:</p>
                <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      onClick={() => submit(s)}
                      className="btn-ghost !rounded-full !px-4 !py-2 !text-xs"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  layout="position"
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-violet-600 to-cyan-600 text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.9)]"
                        : "glass text-white/90"
                    }`}
                  >
                    {m.parts.map((part, i) => {
                      // Plain text content
                      if (part.type === "text") {
                        return (
                          <span key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </span>
                        );
                      }
                      // Tool invocations — show them transparently so judges see
                      // the agent making REAL calls.
                      if (part.type.startsWith("tool-")) {
                        const p = part as unknown as {
                          toolName?: string;
                          type: string;
                          state?: string;
                          output?: unknown;
                        };
                        const name = p.toolName ?? p.type.replace("tool-", "");
                        const done = p.state === "output-available";
                        return (
                          <div
                            key={i}
                            className="my-2 rounded-xl border border-cyan-300/20 bg-black/40 px-3 py-2 font-mono text-xs text-cyan-200"
                          >
                            <span className="flex items-center gap-2">
                              {done ? (
                                <span className="text-emerald-300">✓</span>
                              ) : (
                                <span className="h-3 w-3 animate-spin rounded-full border border-cyan-300 border-t-transparent" />
                              )}
                              <span className="text-white/40">$</span> {name}
                            </span>
                            {done && p.output != null && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-violet-300 hover:text-violet-200">
                                  result
                                </summary>
                                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-white/60" data-lenis-prevent>
                                  {JSON.stringify(p.output, null, 2).slice(0, 1500)}
                                </pre>
                              </details>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {busy && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span className="flex gap-1">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-violet-300 [animation-delay:0.15s]" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-fuchsia-300 [animation-delay:0.3s]" />
                </span>
                Agent is working…
              </div>
            )}
            {error && <p className="alert-error">{error.message}</p>}
          </div>
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="glass-strong mt-4 flex gap-2 rounded-2xl p-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Find a SaaS for tracking expenses under $500…"
            className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
          <button type="submit" disabled={busy || !input.trim()} className="btn-primary !rounded-xl">
            Send ↵
          </button>
        </form>
      </div>
    </PageTransition>
  );
}
