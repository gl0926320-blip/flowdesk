"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  Plus,
  History,
  Trash2,
  MessageCircle,
  Clock3,
  PanelLeft,
  PanelRight,
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
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

function formatDateLabel(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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

function buildWelcomeMessage(): ChatMessage {
  return {
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content:
      "Olá! Eu sou a FlowIA, sua assistente do FlowDesk. Posso te ajudar com dúvidas sobre módulos, processos, atendimento, vendas e uso do sistema no dia a dia.",
    createdAt: new Date().toISOString(),
  };
}

function createInitialSession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: `chat-${Date.now()}`,
    title: "Novo chat",
    createdAt: now,
    updatedAt: now,
    messages: [buildWelcomeMessage()],
  };
}

function getSessionTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((msg) => msg.role === "user");
  if (!firstUserMessage) return "Novo chat";

  const clean = firstUserMessage.content.trim().replace(/\s+/g, " ");
  if (clean.length <= 38) return clean;
  return `${clean.slice(0, 38)}...`;
}

const STORAGE_KEY = "flowia-chat-sessions-v1";
const ACTIVE_STORAGE_KEY = "flowia-active-chat-v1";

export default function FlowIAPage() {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [apiError, setApiError] = useState("");
  const [connected, setConnected] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem(STORAGE_KEY);
      const storedActive = localStorage.getItem(ACTIVE_STORAGE_KEY);

      if (storedSessions) {
        const parsed = JSON.parse(storedSessions) as ChatSession[];

        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);

          const activeExists = parsed.some((s) => s.id === storedActive);
          setActiveSessionId(
            activeExists ? storedActive || parsed[0].id : parsed[0].id
          );
          return;
        }
      }

      const initial = createInitialSession();
      setSessions([initial]);
      setActiveSessionId(initial.id);
    } catch {
      const initial = createInitialSession();
      setSessions([initial]);
      setActiveSessionId(initial.id);
    }
  }, []);

  useEffect(() => {
    if (!sessions.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    localStorage.setItem(ACTIVE_STORAGE_KEY, activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSessionId, sessions, isTyping]);

  const activeSession = useMemo(() => {
    return sessions.find((session) => session.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const messages = activeSession?.messages ?? [buildWelcomeMessage()];

  const quickPrompts = useMemo(
    () => [
      "Como funciona o pipeline do FlowDesk?",
      "Explique o módulo de comissões para um usuário novo.",
      "Quais relatórios a FlowIA pode gerar?",
      "Como organizar melhor meu atendimento no sistema?",
    ],
    []
  );

  function updateActiveSessionMessages(
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) return session;

        const updatedMessages = updater(session.messages);
        return {
          ...session,
          messages: updatedMessages,
          updatedAt: new Date().toISOString(),
          title: getSessionTitle(updatedMessages),
        };
      })
    );
  }

  function handleNewChat() {
    const newSession = createInitialSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setInput("");
    setApiError("");
  }

  function handleDeleteChat(sessionId: string) {
    const next = sessions.filter((session) => session.id !== sessionId);

    if (next.length === 0) {
      const fresh = createInitialSession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      return;
    }

    setSessions(next);

    if (activeSessionId === sessionId) {
      setActiveSessionId(next[0].id);
    }
  }

async function handleSend(customText?: string) {
  const text = (customText ?? input).trim();
  if (!text || isTyping || !activeSession) return;

  setApiError("");

  const userMessage: ChatMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: text,
    createdAt: new Date().toISOString(),
  };

  const nextMessages = [...activeSession.messages, userMessage];

  updateActiveSessionMessages(() => nextMessages);
  setInput("");
  setIsTyping(true);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch("/api/flowia/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        message: text,
        messages: nextMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    });

    let result: any = null;

    try {
      result = await response.json();
    } catch (err) {
      console.error("Erro ao converter JSON:", err);
    }

    if (!response.ok) {
      throw new Error(
        typeof result?.error === "string"
          ? result.error
          : "Não foi possível responder no momento."
      );
    }

    const reply =
      typeof result?.reply === "string" ? result.reply.trim() : "";

    if (!reply) {
      throw new Error("A FlowIA não retornou uma resposta válida.");
    }

    const assistantReply: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString(),
    };

    updateActiveSessionMessages((prev) => [...prev, assistantReply]);
    setConnected(true);
  } catch (error) {
    console.error("Erro no handleSend:", error);

    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "A FlowIA demorou demais para responder. Tente novamente."
          : error.message
        : "Não foi possível responder no momento.";

    setApiError(message);

    updateActiveSessionMessages((prev) => [
      ...prev,
      {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content:
          "Tive um problema para responder agora. Tente novamente em instantes.",
        createdAt: new Date().toISOString(),
      },
    ]);
  } finally {
    clearTimeout(timeoutId);
    setIsTyping(false);
  }
}

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
                      : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  )}
                >
                  {connected ? "Assistente ativa" : "Pronta para ajudar"}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                  Assistente inteligente do FlowDesk
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-wide text-white md:text-4xl">
                {getGreeting()}, bem-vindo à FlowIA
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-[15px]">
                Sua central inteligente para tirar dúvidas, entender módulos,
                receber orientações de uso e ganhar mais produtividade dentro do
                FlowDesk.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <HeroPill
                  icon={<Brain className="h-4 w-4" />}
                  label="Ajuda do sistema"
                />
                <HeroPill
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Relatórios e resumos"
                />
                <HeroPill
                  icon={<MessageSquareText className="h-4 w-4" />}
                  label="Suporte ao usuário"
                />
                <HeroPill
                  icon={<PlugZap className="h-4 w-4" />}
                  label="Produtividade no dia a dia"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:min-w-[380px] xl:max-w-[420px]">
              <MetricCard
                icon={<Cpu className="h-4 w-4" />}
                label="Atendimento"
                value="Disponível"
                tone="cyan"
              />
              <MetricCard
                icon={<Database className="h-4 w-4" />}
                label="Orientação"
                value="Em tempo real"
                tone="violet"
              />
              <MetricCard
                icon={<Shield className="h-4 w-4" />}
                label="Apoio ao time"
                value="Ativo"
                tone="emerald"
              />
              <MetricCard
                icon={<Sparkles className="h-4 w-4" />}
                label="Experiência"
                value="Premium"
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
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white md:text-xl">
                    Conversa com a FlowIA
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Histórico local, novo chat e uma experiência mais fluida
                    para o dia a dia.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                  >
                    {historyOpen ? (
                      <PanelLeft className="h-4 w-4" />
                    ) : (
                      <PanelRight className="h-4 w-4" />
                    )}
                    {historyOpen ? "Ocultar histórico" : "Mostrar histórico"}
                  </button>

                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
                  >
                    <Plus className="h-4 w-4" />
                    Novo chat
                  </button>

                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300">
                    Assistente do FlowDesk
                  </div>
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

          <div className="grid min-h-[680px] grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]">
            {historyOpen && (
              <aside className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <History className="h-4 w-4 text-cyan-300" />
                      Histórico
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Suas conversas recentes
                    </p>
                  </div>
                </div>

                <div className="max-h-[680px] space-y-2 overflow-y-auto p-3">
                  {sessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    const preview =
                      session.messages
                        .filter((m) => m.role === "user")
                        .at(-1)?.content || "Nova conversa";

                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => {
                          setActiveSessionId(session.id);
                          setApiError("");
                        }}
                        className={cn(
                          "group w-full rounded-2xl border p-3 text-left transition",
                          isActive
                            ? "border-cyan-500/30 bg-cyan-500/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "truncate text-sm font-semibold",
                                isActive ? "text-cyan-200" : "text-white"
                              )}
                            >
                              {session.title}
                            </div>

                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                              {preview}
                            </p>

                            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatDateLabel(session.updatedAt)} ·{" "}
                              {formatTime(session.updatedAt)}
                            </div>
                          </div>

                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChat(session.id);
                            }}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/10 text-slate-400 opacity-100 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300 xl:opacity-0 xl:group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}

            <div className="relative min-h-[680px] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.06),transparent_28%)]">
              <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />

              <div className="relative flex h-full min-h-[680px] flex-col">
                <div className="border-b border-white/10 px-4 py-4 md:px-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white md:text-base">
                            {activeSession?.title || "Novo chat"}
                          </div>
                          <p className="text-xs text-slate-400">
                            {messages.length} mensagem
                            {messages.length !== 1 ? "ens" : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        {connected ? "FlowIA ativa" : "Pronta para ajudar"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-5">
                  <div className="mx-auto max-w-4xl space-y-5">
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
                              "max-w-[92%] md:max-w-[80%]",
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
                                "rounded-[26px] px-4 py-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-sm",
                                isAssistant
                                  ? "rounded-bl-md border border-white/10 bg-[linear-gradient(180deg,rgba(20,29,49,0.96),rgba(11,18,33,0.98))] text-white"
                                  : "rounded-br-md border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(8,145,178,1),rgba(14,116,144,1))] text-white"
                              )}
                            >
                              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed md:text-[15px]">
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

                        <div className="max-w-[92%] md:max-w-[80%]">
                          <div className="mb-1 px-1 text-[11px] font-medium text-slate-400">
                            FlowIA
                          </div>

                          <div className="rounded-[26px] rounded-bl-md border border-white/10 bg-[linear-gradient(180deg,rgba(20,29,49,0.96),rgba(11,18,33,0.98))] px-4 py-3.5 text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                              FlowIA preparando sua resposta...
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.08))] p-4">
                  <div className="mx-auto max-w-4xl rounded-[30px] border border-white/10 bg-white/5 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <MiniAction
                        icon={<Wand2 className="h-4 w-4" />}
                        label="Explicar módulo"
                      />
                      <MiniAction
                        icon={<BarChart3 className="h-4 w-4" />}
                        label="Gerar resumo"
                      />
                      <MiniAction
                        icon={<Brain className="h-4 w-4" />}
                        label="Analisar operação"
                      />
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                      <div className="flex-1">
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleTextareaKeyDown}
                          placeholder="Pergunte algo para a FlowIA..."
                          rows={3}
                          className="min-h-[92px] w-full resize-none rounded-[24px] border border-white/10 bg-[rgba(7,12,25,0.78)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40 md:text-[15px]"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          Enter envia · Shift + Enter quebra linha
                        </p>
                      </div>

                      <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isTyping}
                        className="inline-flex h-[56px] items-center justify-center gap-2 rounded-[22px] bg-cyan-600 px-5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 md:min-w-[132px]"
                      >
                        {isTyping ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Enviar
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      A FlowIA pode te ajudar com dúvidas, orientações,
                      resumos e apoio ao uso do sistema.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <SidebarPanel
            title="Como a FlowIA ajuda"
            subtitle="Visão rápida do que ela pode fazer por você"
          >
            <StatusRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Tirar dúvidas do sistema"
              value="Disponível"
              tone="success"
            />
            <StatusRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Apoiar o uso diário"
              value="Ativo"
              tone="success"
            />
            <StatusRow
              icon={<PlugZap className="h-4 w-4" />}
              label="Responder com agilidade"
              value={connected ? "Online" : "Pronta"}
              tone={connected ? "success" : "info"}
            />
            <StatusRow
              icon={<Database className="h-4 w-4" />}
              label="Orientar próximos passos"
              value="Disponível"
              tone="warning"
            />
          </SidebarPanel>

          <SidebarPanel
            title="O que a FlowIA pode fazer"
            subtitle="Escopo inicial pensado para o FlowDesk"
          >
            <FeatureCard
              icon={<MessageSquareText className="h-4 w-4" />}
              title="Responder dúvidas do sistema"
              description="Explicar módulos, fluxo de uso, processos e funcionalidades do CRM."
            />
            <FeatureCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="Gerar resumos"
              description="Criar visões rápidas de informações importantes para apoiar sua rotina."
            />
            <FeatureCard
              icon={<Brain className="h-4 w-4" />}
              title="Ajudar na operação"
              description="Apontar orientações, sugestões e próximos passos dentro do sistema."
            />
          </SidebarPanel>

          <SidebarPanel
            title="Sugestões para começar"
            subtitle="Perguntas úteis para iniciar sua conversa"
          >
            <StepItem
              step="01"
              title="Entender o pipeline"
              description="Pergunte como funciona cada etapa e como organizar melhor seus leads."
            />
            <StepItem
              step="02"
              title="Revisar comissões"
              description="Peça uma explicação simples do módulo e das regras para a equipe."
            />
            <StepItem
              step="03"
              title="Melhorar o atendimento"
              description="Use a FlowIA para receber orientações práticas no fluxo diário."
            />
            <StepItem
              step="04"
              title="Ganhar produtividade"
              description="Peça resumos, explicações rápidas e apoio para tomar decisões."
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