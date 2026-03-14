"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Send,
  Bot,
  Loader2,
  Sparkles,
  Database,
  BarChart3,
  BrainCircuit,
  ArrowRight,
  Flame,
  Clock3,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type ActionButton = {
  id: string;
  label: string;
  prompt: string;
  variant?: "primary" | "secondary" | "ghost";
};

type InsightCard = {
  id: string;
  title: string;
  value: string;
  tone?: "cyan" | "green" | "yellow" | "red";
};

type LeadCard = {
  id: string;
  leadId: string;
  title: string;
  status: string;
  temperatura: string;
  valor: string;
  responsavel: string;
  origem: string;
  subtitle?: string;
  prompt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ActionButton[];
  leadCards?: LeadCard[];
};

export default function FlowIAPage() {
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Olá! Eu sou a FlowIA. Posso te ajudar a entender o FlowDesk, analisar leads, pipeline, conversão, receita e gerar relatórios com base no seu CRM.",
      actions: [
        {
          id: "intro-1",
          label: "Ver meus leads",
          prompt: "Me mostra o detalhe completo de todos os leads.",
          variant: "primary",
        },
        {
          id: "intro-2",
          label: "Gerar relatório",
          prompt: "Gere um relatório executivo do meu CRM.",
          variant: "secondary",
        },
      ],
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [quickActions] = useState<ActionButton[]>([
    {
      id: "qa-1",
      label: "Leads quentes",
      prompt: "Me mostre os leads quentes.",
      variant: "ghost",
    },
    {
      id: "qa-2",
      label: "Aguardando cliente",
      prompt: "Me mostre os leads em aguardando_cliente.",
      variant: "ghost",
    },
    {
      id: "qa-3",
      label: "Relatório executivo",
      prompt: "Gere um relatório executivo do meu CRM.",
      variant: "ghost",
    },
    {
      id: "qa-4",
      label: "O que preciso melhorar",
      prompt: "O que preciso melhorar agora no meu CRM?",
      variant: "ghost",
    },
  ]);

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

  async function sendMessage(prefilled?: string) {
    const text = (prefilled ?? input).trim();
    if (!text || loading) return;

    if (!companyId) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Não consegui identificar a empresa atual para consultar o CRM.",
        },
      ]);
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        actions: [],
        leadCards: [],
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
          message: text,
          companyId,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao iniciar resposta da FlowIA.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const packet = JSON.parse(line) as {
              type: "meta" | "delta" | "done";
              insights?: InsightCard[];
              actions?: ActionButton[];
              leadCards?: LeadCard[];
              text?: string;
            };

            if (packet.type === "meta") {
              if (packet.insights?.length) {
                setInsights(packet.insights);
              }

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        actions: packet.actions || [],
                        leadCards: packet.leadCards || [],
                      }
                    : msg
                )
              );
            }

            if (packet.type === "delta") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        content: (msg.content || "") + (packet.text || ""),
                      }
                    : msg
                )
              );
            }

            if (packet.type === "done") {
              setLoading(false);
            }
          } catch {
            // ignora linha inválida
          }
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao falar com a FlowIA.";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: message,
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
      void sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-[#07101f] text-white">
      <div className="mx-auto flex h-[calc(100vh-32px)] max-w-[1650px] flex-col px-4 py-4 lg:px-6">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[30px] border border-cyan-500/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.09),transparent_30%),linear-gradient(180deg,#091427_0%,#07111e_100%)] shadow-[0_25px_90px_rgba(0,0,0,0.45)]">
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
                      Copilot
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-400">
                    Assistente inteligente do FlowDesk com análise comercial,
                    relatórios, insights e ações rápidas.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <TopBadge icon={<Database size={14} />} label="CRM em tempo real" />
                <TopBadge icon={<BarChart3 size={14} />} label="Relatórios" />
                <TopBadge icon={<BrainCircuit size={14} />} label="Inteligência" />
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-3 lg:px-6">
            <div className="flex flex-wrap gap-3">
              {insights.length > 0 ? (
                insights.map((item) => <InsightBadge key={item.id} insight={item} />)
              ) : (
                <>
                  <SkeletonBadge />
                  <SkeletonBadge />
                  <SkeletonBadge />
                  <SkeletonBadge />
                </>
              )}
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-3 lg:px-6">
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => void sendMessage(action.prompt)}
                  disabled={loading}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-3 py-3 lg:px-5 lg:py-5">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 lg:px-5">
                <div>
                  <p className="text-sm font-medium text-white">Conversa com a FlowIA</p>
                  <p className="text-xs text-slate-400">
                    Pergunte sobre leads, pipeline, receita, follow-up e operação.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
                  {messages.map((msg) => {
                    const isAssistant = msg.role === "assistant";

                    return (
                      <div
                        key={msg.id}
                        className={`flex w-full ${
                          isAssistant ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`flex max-w-[90%] items-end gap-3 lg:max-w-[78%] ${
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
                            {isAssistant ? (
                              <Bot size={18} />
                            ) : (
                              <span className="text-xs font-bold">Você</span>
                            )}
                          </div>

                          <div className="w-full">
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
                                  (loading && isAssistant ? "Pensando..." : "")}
                              </div>
                            </div>

                            {isAssistant && msg.actions && msg.actions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {msg.actions.map((action) => (
                                  <button
                                    key={action.id}
                                    onClick={() => void sendMessage(action.prompt)}
                                    disabled={loading}
                                    className={buttonClass(action.variant)}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {isAssistant && msg.leadCards && msg.leadCards.length > 0 && (
                              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                {msg.leadCards.map((card) => (
                                  <button
                                    key={card.id}
                                    onClick={() => void sendMessage(card.prompt)}
                                    className="rounded-2xl border border-white/10 bg-[#0d1628] p-4 text-left transition hover:border-cyan-400/25 hover:bg-[#101b31]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="font-semibold text-white">
                                          {card.title}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-400">
                                          {card.subtitle}
                                        </div>
                                      </div>
                                      <ArrowRight
                                        size={16}
                                        className="mt-1 text-cyan-300"
                                      />
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                                      <MiniPill>{card.status}</MiniPill>
                                      <MiniPill>{card.temperatura}</MiniPill>
                                      <MiniPill>{card.valor}</MiniPill>
                                    </div>

                                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                                      <div>Responsável: {card.responsavel}</div>
                                      <div>Origem: {card.origem}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
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
                        onClick={() => void sendMessage()}
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
                        FlowDesk Copilot
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* fim conteúdo */}
        </div>
      </div>
    </div>
  );
}

function buttonClass(variant?: "primary" | "secondary" | "ghost") {
  if (variant === "primary") {
    return "rounded-xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50";
  }

  if (variant === "secondary") {
    return "rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:opacity-50";
  }

  return "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-50";
}

function TopBadge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
      <span className="text-cyan-300">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function MiniPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
      {children}
    </span>
  );
}

function SkeletonBadge() {
  return <div className="h-10 w-32 animate-pulse rounded-2xl bg-white/5" />;
}

function InsightBadge({ insight }: { insight: InsightCard }) {
  const tones = {
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
    yellow: "border-yellow-400/20 bg-yellow-500/10 text-yellow-300",
    red: "border-red-400/20 bg-red-500/10 text-red-300",
  } as const;

  const tone = tones[insight.tone || "cyan"];

  const icon =
    insight.title.toLowerCase().includes("quente") ? (
      <Flame size={14} />
    ) : insight.title.toLowerCase().includes("convers") ? (
      <BarChart3 size={14} />
    ) : insight.title.toLowerCase().includes("receita") ? (
      <Database size={14} />
    ) : (
      <Clock3 size={14} />
    );

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${tone}`}>
      <span>{icon}</span>
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] opacity-80">
          {insight.title}
        </div>
        <div className="text-sm font-semibold">{insight.value}</div>
      </div>
    </div>
  );
}