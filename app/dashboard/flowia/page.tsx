"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Bot,
  Brain,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  MessageSquareText,
  PlugZap,
  Send,
  Shield,
  Sparkles,
  Wand2,
  Loader2,
  AlertTriangle,
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function FlowIAPage() {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [apiError, setApiError] = useState("");
  const [connected, setConnected] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-flowia",
      role: "assistant",
      content:
        "Olá! Eu sou a FlowIA, sua assistente inteligente do FlowDesk. Já estou pronta para começar a responder via IA real. Me pergunte algo sobre o sistema.",
      createdAt: new Date().toISOString(),
    },
  ]);

  const quickPrompts = useMemo(
    () => [
      "Como funciona o pipeline do FlowDesk?",
      "Explique o módulo de comissões para um usuário novo.",
      "Quais relatórios a FlowIA poderá gerar?",
      "Como a IA pode ajudar no atendimento via WhatsApp?",
    ],
    []
  );

  async function handleSend(customText?: string) {
    const text = (customText ?? input).trim();
    if (!text || isTyping) return;

    setApiError("");

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/flowia/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          messages: nextMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || "Falha ao conectar a FlowIA com a IA."
        );
      }

      const assistantReply: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          result?.reply ||
          "Não consegui responder agora. Tente novamente em instantes.",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantReply]);
      setConnected(true);
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Erro ao conectar a FlowIA.";

      setApiError(message);

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            "Tive um problema para responder agora. Verifique se o Ollama está rodando e se a rota /api/flowia/chat está configurada corretamente.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="space-y-5 text-white">
      <section className="overflow-hidden rounded-[32px] border border-cyan-500/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_24%),linear-gradient(135deg,rgba(8,15,35,0.98),rgba(18,28,52,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_70px_rgba(0,0,0,0.35)]">
        <div className="p-5 md:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  <Bot className="h-3.5 w-3.5" />
                  FlowIA
                </span>

                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold",
                    connected
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                  )}
                >
                  {connected ? "IA conectada" : "Aguardando conexão"}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                  Assistente inteligente do FlowDesk
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-wide text-white md:text-4xl">
                {getGreeting()}, bem-vindo à FlowIA
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-[15px]">
                Uma central inteligente para responder dúvidas do sistema,
                orientar usuários, apoiar atendimento, analisar dados do CRM e
                evoluir para automações comerciais dentro do FlowDesk.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <HeroPill
                  icon={<Brain className="h-4 w-4" />}
                  label="Ajuda do sistema"
                />
                <HeroPill
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Relatórios inteligentes"
                />
                <HeroPill
                  icon={<MessageSquareText className="h-4 w-4" />}
                  label="Suporte ao usuário"
                />
                <HeroPill
                  icon={<PlugZap className="h-4 w-4" />}
                  label="Conexão com IA"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:min-w-[380px] xl:max-w-[420px]">
              <MetricCard
                icon={<Cpu className="h-4 w-4" />}
                label="Motor IA"
                value={connected ? "Ollama ativo" : "A conectar"}
                tone="cyan"
              />
              <MetricCard
                icon={<Database className="h-4 w-4" />}
                label="Base do CRM"
                value="Pronta"
                tone="violet"
              />
              <MetricCard
                icon={<Shield className="h-4 w-4" />}
                label="Contexto seguro"
                value="Em evolução"
                tone="emerald"
              />
              <MetricCard
                icon={<Sparkles className="h-4 w-4" />}
                label="Evolução"
                value="Assistente + IA"
                tone="amber"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,37,0.96),rgba(8,14,30,0.98))] shadow-[0_14px_40px_rgba(0,0,0,0.32)]">
          <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-4 py-4 md:px-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white md:text-xl">
                    Chat premium da FlowIA
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Assistente inicial para dúvidas, relatórios e orientação do
                    sistema.
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300">
                  Conectada via /api/flowia/chat
                </div>
              </div>

              {apiError && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative min-h-[520px] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.06),transparent_28%)]">
            <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />

            <div className="relative flex h-full min-h-[520px] flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
                {messages.map((message) => {
                  const isAssistant = message.role === "assistant";

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3",
                        isAssistant ? "justify-start" : "justify-end"
                      )}
                    >
                      {isAssistant && (
                        <AvatarBubble
                          icon={<Bot className="h-4 w-4" />}
                          label="IA"
                          tone="assistant"
                        />
                      )}

                      <div
                        className={cn(
                          "max-w-[92%] md:max-w-[78%]",
                          !isAssistant && "order-1"
                        )}
                      >
                        <div
                          className={cn(
                            "mb-1 px-1 text-[11px] font-medium",
                            isAssistant
                              ? "text-slate-400"
                              : "text-right text-cyan-200"
                          )}
                        >
                          {isAssistant ? "FlowIA" : "Você"}
                        </div>

                        <div
                          className={cn(
                            "rounded-[24px] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
                            isAssistant
                              ? "rounded-bl-md border border-white/10 bg-[linear-gradient(180deg,rgba(31,41,55,0.96),rgba(15,23,42,0.98))] text-white"
                              : "rounded-br-md bg-[linear-gradient(180deg,rgba(6,182,212,1),rgba(14,116,144,1))] text-white"
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {message.content}
                          </div>

                          <div
                            className={cn(
                              "mt-2 text-[11px]",
                              isAssistant
                                ? "text-right text-slate-400"
                                : "text-right text-cyan-100/80"
                            )}
                          >
                            {formatTime(message.createdAt)}
                          </div>
                        </div>
                      </div>

                      {!isAssistant && (
                        <AvatarBubble
                          icon={<Sparkles className="h-4 w-4" />}
                          label="Você"
                          tone="user"
                        />
                      )}
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex gap-3">
                    <AvatarBubble
                      icon={<Bot className="h-4 w-4" />}
                      label="IA"
                      tone="assistant"
                    />

                    <div className="max-w-[92%] md:max-w-[78%]">
                      <div className="mb-1 px-1 text-[11px] font-medium text-slate-400">
                        FlowIA
                      </div>

                      <div className="rounded-[24px] rounded-bl-md border border-white/10 bg-[linear-gradient(180deg,rgba(31,41,55,0.96),rgba(15,23,42,0.98))] px-4 py-3 text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                          FlowIA pensando...
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.08))] p-4">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <MiniAction
                      icon={<Wand2 className="h-4 w-4" />}
                      label="Explicar módulo"
                    />
                    <MiniAction
                      icon={<BarChart3 className="h-4 w-4" />}
                      label="Gerar relatório"
                    />
                    <MiniAction
                      icon={<Brain className="h-4 w-4" />}
                      label="Analisar CRM"
                    />
                  </div>

                  <div className="flex items-end gap-3">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Pergunte algo para a FlowIA..."
                      rows={3}
                      className="min-h-[92px] flex-1 resize-none rounded-[22px] border border-white/10 bg-[rgba(7,12,25,0.72)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40"
                    />

                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isTyping}
                      className="inline-flex h-[56px] items-center justify-center gap-2 rounded-[22px] bg-cyan-600 px-5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Enviar
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Agora a FlowIA usa uma API real. No próximo passo, vamos
                    adicionar contexto do FlowDesk, banco e treinamento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <SidebarPanel
            title="Status da implantação"
            subtitle="Visão rápida do que já existe"
          >
            <StatusRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Interface premium"
              value="Pronta"
              tone="success"
            />
            <StatusRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Menu no dashboard"
              value="Ativo"
              tone="success"
            />
            <StatusRow
              icon={<PlugZap className="h-4 w-4" />}
              label="Conexão com IA"
              value={connected ? "Ligada" : "Aguardando teste"}
              tone={connected ? "success" : "info"}
            />
            <StatusRow
              icon={<Database className="h-4 w-4" />}
              label="Treino / contexto"
              value="Próximo passo"
              tone="warning"
            />
          </SidebarPanel>

          <SidebarPanel
            title="O que a FlowIA vai fazer"
            subtitle="Escopo inicial pensado para o FlowDesk"
          >
            <FeatureCard
              icon={<MessageSquareText className="h-4 w-4" />}
              title="Responder dúvidas do sistema"
              description="Explicar módulos, fluxo de uso, processos e funcionalidades do CRM."
            />
            <FeatureCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="Gerar relatórios"
              description="Criar resumos de vendas, atendimento, funil, conversão e performance."
            />
            <FeatureCard
              icon={<Brain className="h-4 w-4" />}
              title="Analisar o CRM"
              description="Apontar gargalos, oportunidades e próximos passos estratégicos."
            />
          </SidebarPanel>

          <SidebarPanel
            title="Próximos passos"
            subtitle="Ordem ideal para começar certo"
          >
            <StepItem
              step="01"
              title="Testar conexão"
              description="Validar se o Ollama está respondendo pela rota /api/flowia/chat."
            />
            <StepItem
              step="02"
              title="Treinar com contexto"
              description="Ensinar regras, módulos, fluxos e linguagem do FlowDesk."
            />
            <StepItem
              step="03"
              title="Ler dados reais"
              description="Permitir consultas seguras ao CRM para relatórios e análises."
            />
            <StepItem
              step="04"
              title="Evoluir para automação"
              description="Criar sugestões, respostas e fluxos inteligentes."
            />
          </SidebarPanel>
        </div>
      </section>
    </div>
  );
}

function HeroPill({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
      <span className="text-cyan-300">{icon}</span>
      {label}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "violet" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
      : tone === "violet"
      ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
      : tone === "emerald"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : "border-amber-500/20 bg-amber-500/10 text-amber-300";

  return (
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>

      <div
        className={cn(
          "inline-flex rounded-full border px-3 py-1 text-sm font-semibold",
          toneClass
        )}
      >
        {value}
      </div>
    </div>
  );
}

function AvatarBubble({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone: "assistant" | "user";
}) {
  return (
    <div className="shrink-0">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_8px_20px_rgba(0,0,0,0.2)]",
          tone === "assistant"
            ? "border-cyan-500/30 bg-[linear-gradient(180deg,rgba(6,182,212,0.85),rgba(14,116,144,0.95))] text-white"
            : "border-white/15 bg-[linear-gradient(180deg,rgba(51,65,85,0.95),rgba(30,41,59,0.95))] text-white"
        )}
        aria-label={label}
      >
        {icon}
      </div>
    </div>
  );
}

function MiniAction({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
    >
      {icon}
      {label}
    </button>
  );
}

function SidebarPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,37,0.96),rgba(8,14,30,0.98))] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/10 px-4 py-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "success" | "info" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : tone === "info"
      ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
      : "border-amber-500/20 bg-amber-500/10 text-amber-300";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-sm text-slate-200">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <span
        className={cn(
          "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          toneClass
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepItem({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-sm font-bold text-violet-300">
        {step}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          {title}
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}