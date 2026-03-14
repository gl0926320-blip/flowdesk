"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Bot,
  Loader2,
  Sparkles,
  Database,
  BarChart3,
  BrainCircuit,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function FlowIAPage() {
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá! Eu sou a FlowIA. Posso te ajudar a entender o FlowDesk, analisar leads, pipeline, conversão, receita e gerar relatórios com base no seu CRM.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadCompany();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    autoResizeTextarea();
  }, [input]);

  async function loadCompany() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: membership } = await supabase
      .from("company_users")
      .select("company_id, created_at")
      .eq("user_id", userData.user.id)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membership?.company_id) {
      setCompanyId(membership.company_id);
    }
  }

  function autoResizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    if (!companyId) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Não consegui identificar a empresa atual para consultar o CRM.",
        },
      ]);
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    const assistantIndex = messages.length + 1;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/flowia/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          companyId,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao iniciar resposta da FlowIA.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        setMessages((prev) =>
          prev.map((msg, index) =>
            index === assistantIndex ? { ...msg, content: fullText } : msg
          )
        );
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === assistantIndex
            ? {
                ...msg,
                content: error?.message || "Erro ao falar com a FlowIA.",
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-[#07101f] text-white">
      <div className="mx-auto flex h-[calc(100vh-32px)] max-w-[1600px] flex-col px-4 py-4 lg:px-6">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-cyan-500/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,#091427_0%,#08111f_100%)] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          {/* topo */}
          <div className="border-b border-white/10 px-5 py-4 lg:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                  <Bot size={24} className="text-cyan-300" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight text-white">
                      FlowIA
                    </h1>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                      Beta
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-400">
                    Assistente inteligente do FlowDesk para análise comercial,
                    relatórios e apoio operacional.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge icon={<Database size={14} />} label="CRM em tempo real" />
                <Badge icon={<BarChart3 size={14} />} label="Relatórios" />
                <Badge icon={<BrainCircuit size={14} />} label="Análises" />
              </div>
            </div>
          </div>

          {/* conteúdo */}
          <div className="flex min-h-0 flex-1 flex-col px-3 py-3 lg:px-5 lg:py-5">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                {/* sub header do chat */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 lg:px-5">
                  <div>
                    <p className="text-sm font-medium text-white">Conversa com a FlowIA</p>
                    <p className="text-xs text-slate-400">
                      Pergunte sobre leads, pipeline, receita, conversão, follow-up e operação.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </div>
                </div>

                {/* mensagens com scroll interno */}
                <div
                  ref={messagesRef}
                  className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6"
                >
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                    {messages.map((msg, i) => {
                      const isAssistant = msg.role === "assistant";

                      return (
                        <div
                          key={i}
                          className={`flex w-full ${
                            isAssistant ? "justify-start" : "justify-end"
                          }`}
                        >
                          <div
                            className={`flex max-w-[88%] items-end gap-3 lg:max-w-[75%] ${
                              isAssistant ? "flex-row" : "flex-row-reverse"
                            }`}
                          >
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                                isAssistant
                                  ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-300"
                                  : "border-blue-400/20 bg-blue-500/15 text-blue-200"
                              }`}
                            >
                              {isAssistant ? <Bot size={18} /> : <span className="text-sm font-bold">Você</span>}
                            </div>

                            <div
                              className={`relative overflow-hidden rounded-[22px] border px-4 py-3.5 text-sm leading-7 shadow-lg ${
                                isAssistant
                                  ? "border-white/10 bg-[#121c30] text-slate-100"
                                  : "border-cyan-400/20 bg-gradient-to-br from-cyan-500 to-sky-600 text-white"
                              }`}
                            >
                              {isAssistant && (
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
                              )}

                              <div className="whitespace-pre-wrap break-words">
                                {msg.content ||
                                  (loading && i === messages.length - 1
                                    ? "Pensando..."
                                    : "")}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex items-center gap-2 pl-[52px] text-sm text-slate-400">
                        <Loader2 className="animate-spin" size={16} />
                        FlowIA escrevendo...
                      </div>
                    )}

                    <div ref={bottomRef} />
                  </div>
                </div>

                {/* input */}
                <div className="border-t border-white/10 bg-black/10 px-4 py-4 lg:px-5">
                  <div className="mx-auto w-full max-w-5xl">
                    <div className="rounded-[24px] border border-white/10 bg-[#0d1628]/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pergunte algo sobre seu CRM, peça análises, relatórios ou próximos passos..."
                            rows={1}
                            className="max-h-[180px] min-h-[54px] w-full resize-none bg-transparent px-3 py-3 text-[15px] text-white outline-none placeholder:text-slate-500"
                          />
                        </div>

                        <button
                          onClick={sendMessage}
                          disabled={loading || !input.trim()}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-[0_10px_30px_rgba(14,165,233,0.35)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Send size={18} />
                          )}
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between px-2">
                        <p className="text-[11px] text-slate-500">
                          Enter envia • Shift + Enter quebra linha
                        </p>

                        <div className="flex items-center gap-1 text-[11px] text-cyan-300/80">
                          <Sparkles size={12} />
                          FlowDesk Intelligence
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* fim input */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
      <span className="text-cyan-300">{icon}</span>
      <span>{label}</span>
    </div>
  );
}