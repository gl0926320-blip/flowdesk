"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Percent,
  Phone,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  ChevronDown,
  ChevronUp,
  Inbox,
  ArrowRightLeft,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type SenderType = "client" | "agent" | "system";

type ConversationStage =
  | "lead"
  | "proposta_enviada"
  | "aguardando_cliente"
  | "proposta_validada"
  | "andamento"
  | "concluido"
  | "perdido";

type ConversationStatus = "queue" | "in_progress" | "closed";

type ConversationRow = {
  id: string;
  company_id: string;
  client_name: string | null;
  client_phone: string;
  client_email?: string | null;
  subject?: string | null;
  lead_source: string | null;
  status?: ConversationStatus | null;
  stage?: ConversationStage | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  priority: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  tags: string[] | null;
  amount?: number | null;
  commission_value?: number | null;
  commission_percent?: number | null;
  profit_value?: number | null;
  temperature?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  sender_name: string | null;
  message: string;
  message_type: string;
  direction: "inbound" | "outbound";
  status: string | null;
  created_at: string;
};

type WhatsAppConnectionRow = {
  id: string;
  company_id: string;
  provider: string;
  connection_name: string | null;
  phone_number: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  access_token: string | null;
  verify_token: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

const PIPELINE_STAGES: ConversationStage[] = [
  "lead",
  "proposta_enviada",
  "aguardando_cliente",
  "proposta_validada",
  "andamento",
  "concluido",
  "perdido",
];

const STAGE_LABELS: Record<ConversationStage, string> = {
  lead: "Lead",
  proposta_enviada: "Proposta enviada",
  aguardando_cliente: "Aguardando cliente",
  proposta_validada: "Proposta validada",
  andamento: "Andamento",
  concluido: "Concluído",
  perdido: "Perdido",
};

const STAGE_BADGES: Record<ConversationStage, string> = {
  lead: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  proposta_enviada: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  aguardando_cliente: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  proposta_validada: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  andamento: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  concluido: "bg-green-500/15 text-green-300 border-green-500/20",
  perdido: "bg-red-500/15 text-red-300 border-red-500/20",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizePhone(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone(value?: string | null) {
  if (!value) return "—";
  const digits = normalizePhone(value);

  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(
      4,
      9
    )}-${digits.slice(9)}`;
  }

  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(
      4,
      8
    )}-${digits.slice(8)}`;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return value;
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatPercent(value?: number | null) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function formatRelative(value?: string | null) {
  if (!value) return "sem atividade";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}

function getTemperatureBadge(value?: string | null) {
  const temp = (value || "").toLowerCase();

  if (temp === "quente") {
    return "bg-red-500/15 text-red-300 border-red-500/20";
  }
  if (temp === "frio") {
    return "bg-slate-500/15 text-slate-300 border-slate-500/20";
  }
  return "bg-yellow-500/15 text-yellow-300 border-yellow-500/20";
}

function getEffectiveStage(item: ConversationRow): ConversationStage {
  if (item.stage && PIPELINE_STAGES.includes(item.stage)) return item.stage;
  if (item.status === "closed") return "concluido";
  if (item.status === "in_progress") return "andamento";
  return "lead";
}

function stageToStatus(stage: ConversationStage): ConversationStatus {
  if (stage === "concluido" || stage === "perdido") return "closed";
  if (stage === "lead") return "queue";
  return "in_progress";
}

function maskToken(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 12) return "••••••••";
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`;
}

export default function AtendimentoPage() {
  const supabase = useMemo(() => createClient(), []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Atendente");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [pageError, setPageError] = useState<string>("");
  const [pageSuccess, setPageSuccess] = useState<string>("");

  const [connection, setConnection] = useState<WhatsAppConnectionRow | null>(
    null
  );
  const [connectionForm, setConnectionForm] = useState({
    connection_name: "WhatsApp Principal",
    phone_number: "",
    phone_number_id: "",
    business_account_id: "",
    access_token: "",
    verify_token: "",
  });

  const isConnectionReady =
    !!connectionForm.phone_number_id.trim() &&
    !!connectionForm.business_account_id.trim() &&
    !!connectionForm.verify_token.trim() &&
    !!connectionForm.access_token.trim();

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`atendimento-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchConversations(companyId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_messages",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          fetchConversations(companyId);

          if (
            selectedId &&
            "new" in payload &&
            payload.new &&
            (payload.new as { conversation_id?: string }).conversation_id ===
              selectedId
          ) {
            fetchMessages(selectedId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, selectedId, supabase]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
      markAsRead(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function clearNotices() {
    setPageError("");
    setPageSuccess("");
  }

  async function bootstrap() {
    try {
      setLoading(true);
      clearNotices();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        setPageError(`Erro ao identificar usuário: ${authError.message}`);
        return;
      }

      if (!user) {
        setPageError("Usuário não autenticado.");
        return;
      }

      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email || "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Erro ao buscar profile:", profileError.message);
      }

      setCurrentUserName(
        profile?.full_name || profile?.name || profile?.email || "Atendente"
      );
      setCurrentUserEmail(profile?.email || user.email || "");

      const { data: membership, error: membershipError } = await supabase
        .from("company_users")
        .select("company_id, user_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        setPageError(
          `Erro ao localizar empresa do usuário: ${membershipError.message}`
        );
        return;
      }

      if (!membership?.company_id) {
        setPageError("Nenhuma empresa encontrada para este usuário.");
        return;
      }

      setCompanyId(membership.company_id);

      await Promise.all([
        fetchConversations(membership.company_id),
        fetchConnection(membership.company_id),
      ]);
    } catch (error) {
      console.error(error);
      setPageError("Falha ao carregar a central de atendimento.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchConnection(activeCompanyId: string) {
    const { data, error } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar conexão WhatsApp:", error.message);
      setPageError(`Erro ao buscar conexão: ${error.message}`);
      return;
    }

    const row = (data as WhatsAppConnectionRow | null) || null;
    setConnection(row);

    if (row) {
      setConnectionForm({
        connection_name: row.connection_name || "WhatsApp Principal",
        phone_number: row.phone_number || "",
        phone_number_id: row.phone_number_id || "",
        business_account_id: row.business_account_id || "",
        access_token: row.access_token || "",
        verify_token: row.verify_token || "",
      });

      if (row.status === "connected") {
        setApiOpen(false);
      }
    } else {
      setApiOpen(true);
    }
  }

  async function saveConnection() {
    if (!companyId) {
      setPageError("Empresa não identificada.");
      return;
    }

    clearNotices();

    const normalizedPhone = normalizePhone(connectionForm.phone_number);

    const payload = {
      company_id: companyId,
      provider: "meta",
      connection_name:
        connectionForm.connection_name.trim() || "WhatsApp Principal",
      phone_number: normalizedPhone ? `+${normalizedPhone}` : null,
      phone_number_id: connectionForm.phone_number_id.trim() || null,
      business_account_id: connectionForm.business_account_id.trim() || null,
      access_token: connectionForm.access_token.trim() || null,
      verify_token: connectionForm.verify_token.trim() || null,
      status:
        connectionForm.phone_number_id.trim() &&
        connectionForm.business_account_id.trim() &&
        connectionForm.access_token.trim() &&
        connectionForm.verify_token.trim()
          ? "connected"
          : "disconnected",
      updated_at: new Date().toISOString(),
    };

    if (
      !payload.phone_number_id ||
      !payload.business_account_id ||
      !payload.access_token ||
      !payload.verify_token
    ) {
      setPageError(
        "Preencha Phone Number ID, Business Account ID, Verify Token e Access Token para conectar a API."
      );
      return;
    }

    setSavingConnection(true);

    try {
      if (connection?.id) {
        const { data, error } = await supabase
          .from("whatsapp_connections")
          .update(payload)
          .eq("id", connection.id)
          .select()
          .maybeSingle();

        if (error) {
          console.error("Erro ao atualizar conexão:", error);
          setPageError(`Erro ao atualizar conexão: ${error.message}`);
          return;
        }

        setConnection((data as WhatsAppConnectionRow | null) || null);
        setPageSuccess("Conexão atualizada com sucesso.");
      } else {
        const { data, error } = await supabase
          .from("whatsapp_connections")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (error) {
          console.error("Erro ao salvar conexão:", error);
          setPageError(`Erro ao salvar conexão: ${error.message}`);
          return;
        }

        setConnection((data as WhatsAppConnectionRow | null) || null);
        setPageSuccess("Conexão salva com sucesso.");
      }

      await fetchConnection(companyId);
    } catch (error) {
      console.error("Falha inesperada ao salvar conexão:", error);
      setPageError("Falha inesperada ao salvar a conexão.");
    } finally {
      setSavingConnection(false);
    }
  }

  async function fetchConversations(activeCompanyId: string) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar conversas:", error.message);
      setPageError(`Erro ao carregar conversas: ${error.message}`);
      return;
    }

    const rows = (data || []) as ConversationRow[];
    setConversations(rows);

    if (!selectedId && rows.length > 0) {
      setSelectedId(rows[0].id);
    }

    if (selectedId && !rows.some((item) => item.id === selectedId)) {
      setSelectedId(rows[0]?.id || null);
    }
  }

  async function fetchMessages(conversationId: string) {
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erro ao carregar mensagens:", error.message);
      setPageError(`Erro ao carregar mensagens: ${error.message}`);
      return;
    }

    setMessages((data || []) as MessageRow[]);
  }

  async function markAsRead(conversationId: string) {
    const conv = conversations.find((item) => item.id === conversationId);
    if (!conv || !conv.unread_count) return;

    await supabase
      .from("conversations")
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  }

  async function handleRefresh() {
    if (!companyId) return;
    setRefreshing(true);
    clearNotices();

    await Promise.all([
      fetchConversations(companyId),
      fetchConnection(companyId),
      selectedId ? fetchMessages(selectedId) : Promise.resolve(),
    ]);

    setRefreshing(false);
  }

  async function assumeConversation(conversationId: string) {
    if (!currentUserId) return;

    const target = conversations.find((item) => item.id === conversationId);
    if (!target) return;

    clearNotices();

    const currentStage = getEffectiveStage(target);
    const nextStage = currentStage === "lead" ? "lead" : currentStage;

    const { error } = await supabase
      .from("conversations")
      .update({
        status: "in_progress",
        stage: nextStage,
        assigned_to: currentUserId,
        assigned_to_name: currentUserName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (error) {
      console.error("Erro ao assumir conversa:", error.message);
      setPageError(`Erro ao assumir conversa: ${error.message}`);
      return;
    }

    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      company_id: target.company_id,
      sender_type: "system",
      sender_name: "Sistema",
      message: `${
        currentUserName || "Atendente"
      } (${currentUserEmail || "sem e-mail"}) assumiu este atendimento.`,
      message_type: "text",
      direction: "outbound",
      status: "sent",
    });

    setSelectedId(conversationId);
    await fetchConversations(target.company_id);
    await fetchMessages(conversationId);
  }

  async function unassignConversation(conversationId: string) {
    const target = conversations.find((item) => item.id === conversationId);
    if (!target) return;

    clearNotices();

    const { error } = await supabase
      .from("conversations")
      .update({
        assigned_to: null,
        assigned_to_name: null,
        status: "queue",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (error) {
      console.error("Erro ao devolver para a fila:", error.message);
      setPageError(`Erro ao devolver para a fila: ${error.message}`);
      return;
    }

    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      company_id: target.company_id,
      sender_type: "system",
      sender_name: "Sistema",
      message: "Conversa devolvida para a fila de atendimento.",
      message_type: "text",
      direction: "outbound",
      status: "sent",
    });

    await fetchConversations(target.company_id);
    await fetchMessages(conversationId);
  }

  async function moveStage(conversationId: string, stage: ConversationStage) {
    const target = conversations.find((item) => item.id === conversationId);
    if (!target) return;

    clearNotices();

    const nextStatus =
      !target.assigned_to && stage === "lead" ? "queue" : stageToStatus(stage);

    const { error } = await supabase
      .from("conversations")
      .update({
        stage,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    if (error) {
      console.error("Erro ao mover etapa:", error.message);
      setPageError(`Erro ao mover etapa: ${error.message}`);
      return;
    }

    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      company_id: target.company_id,
      sender_type: "system",
      sender_name: "Sistema",
      message: `Conversa movida para a etapa: ${STAGE_LABELS[stage]}.`,
      message_type: "text",
      direction: "outbound",
      status: "sent",
    });

    await fetchConversations(target.company_id);
    await fetchMessages(conversationId);
  }

  async function finalizeConversation(conversationId: string) {
    await moveStage(conversationId, "concluido");
  }

  async function markLost(conversationId: string) {
    await moveStage(conversationId, "perdido");
  }

  async function returnToLead(conversationId: string) {
    await moveStage(conversationId, "lead");
  }

  async function sendMessage() {
    const text = messageText.trim();
    if (!selectedId || !companyId || !text || sending) return;

    clearNotices();
    setSending(true);

    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedId,
          text,
          userId: currentUserId,
          userName: currentUserName,
          userEmail: currentUserEmail,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage = result?.error || "Erro ao enviar mensagem";
        console.error(errorMessage);
        setPageError(errorMessage);
        return;
      }

      setMessageText("");
      setPageSuccess("Mensagem enviada com sucesso.");
      await fetchMessages(selectedId);
      if (companyId) await fetchConversations(companyId);
    } catch (error) {
      console.error(error);
      setPageError("Falha inesperada ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;

    return conversations.filter((item) => {
      const haystack = [
        item.client_name || "",
        item.client_phone || "",
        item.client_email || "",
        item.subject || "",
        item.last_message || "",
        item.assigned_to_name || "",
        item.lead_source || "",
        item.temperature || "",
        ...(item.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [conversations, search]);

  const queueItems = useMemo(
    () =>
      filtered.filter(
        (item) =>
          !item.assigned_to &&
          (item.status === "queue" || getEffectiveStage(item) === "lead")
      ),
    [filtered]
  );

  const grouped = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = filtered.filter(
        (item) => !!item.assigned_to && getEffectiveStage(item) === stage
      );
      return acc;
    }, {} as Record<ConversationStage, ConversationRow[]>);
  }, [filtered]);

  const selectedConversation =
    conversations.find((item) => item.id === selectedId) || null;

  const totalOpen =
    queueItems.length +
    grouped.lead.length +
    grouped.proposta_enviada.length +
    grouped.aguardando_cliente.length +
    grouped.proposta_validada.length +
    grouped.andamento.length;

  const myOpen = filtered.filter(
    (item) =>
      item.assigned_to === currentUserId &&
      !["concluido", "perdido"].includes(getEffectiveStage(item))
  ).length;

  const unreadTotal = conversations.reduce(
    (acc, item) => acc + Number(item.unread_count || 0),
    0
  );

  const totalRevenue = filtered.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0
  );

  const selectedStage = selectedConversation
    ? getEffectiveStage(selectedConversation)
    : null;

  const stageTotals = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = grouped[stage].reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );
      return acc;
    }, {} as Record<ConversationStage, number>);
  }, [grouped]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-8 text-white">
        Carregando atendimento...
      </div>
    );
  }

  return (
    <div className="space-y-5 text-white">
      <div className="rounded-[28px] border border-cyan-500/10 bg-[linear-gradient(135deg,rgba(8,15,35,0.98),rgba(20,31,58,0.98))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                FlowConversa
              </span>

              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold",
                  connection?.status === "connected"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                )}
              >
                {connection?.status === "connected"
                  ? "API conectada"
                  : "API não configurada"}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                {currentUserName}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400">
                {currentUserEmail || "sem e-mail"}
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-wide text-white">
              ATENDIMENTO
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Fila de atendimento + pipeline comercial + WhatsApp em uma única
              central.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
            <MetricCard
              icon={<Inbox className="h-4 w-4" />}
              label="Fila"
              value={String(queueItems.length)}
            />
            <MetricCard
              icon={<Users className="h-4 w-4" />}
              label="Abertos"
              value={String(totalOpen)}
            />
            <MetricCard
              icon={<UserCheck className="h-4 w-4" />}
              label="Meus atend."
              value={String(myOpen)}
            />
            <MetricCard
              icon={<MessageCircle className="h-4 w-4" />}
              label="Não lidas"
              value={String(unreadTotal)}
            />
            <MetricCard
              icon={<Wallet className="h-4 w-4" />}
              label="Receita"
              value={formatCurrency(totalRevenue)}
            />
            <MetricCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Concluídos"
              value={String(grouped.concluido.length)}
            />
          </div>
        </div>

        {(pageError || pageSuccess) && (
          <div className="mt-4 space-y-2">
            {pageError && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{pageError}</span>
              </div>
            )}

            {pageSuccess && (
              <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{pageSuccess}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, telefone, e-mail, origem, temperatura..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40"
            />
          </div>

          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <RefreshCcw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Atualizar
          </button>

          <button
            onClick={() => setApiOpen((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15"
          >
            <Settings2 className="h-4 w-4" />
            {apiOpen ? "Ocultar API" : "Configurar API"}
            {apiOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>

        {apiOpen && (
          <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-white">
                Configuração da WhatsApp Cloud API
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <InputField
                label="Nome da conexão"
                value={connectionForm.connection_name}
                onChange={(value) =>
                  setConnectionForm((prev) => ({
                    ...prev,
                    connection_name: value,
                  }))
                }
                placeholder="WhatsApp Principal"
              />
              <InputField
                label="Número conectado"
                value={connectionForm.phone_number}
                onChange={(value) =>
                  setConnectionForm((prev) => ({ ...prev, phone_number: value }))
                }
                placeholder="+55 11 99999-9999"
              />
              <InputField
                label="Phone Number ID"
                value={connectionForm.phone_number_id}
                onChange={(value) =>
                  setConnectionForm((prev) => ({
                    ...prev,
                    phone_number_id: value,
                  }))
                }
                placeholder="123456789012345"
              />
              <InputField
                label="Business Account ID"
                value={connectionForm.business_account_id}
                onChange={(value) =>
                  setConnectionForm((prev) => ({
                    ...prev,
                    business_account_id: value,
                  }))
                }
                placeholder="WABA ID"
              />
              <InputField
                label="Verify Token"
                value={connectionForm.verify_token}
                onChange={(value) =>
                  setConnectionForm((prev) => ({ ...prev, verify_token: value }))
                }
                placeholder="token de verificação do webhook"
              />
              <InputField
                label="Access Token"
                value={connectionForm.access_token}
                onChange={(value) =>
                  setConnectionForm((prev) => ({ ...prev, access_token: value }))
                }
                placeholder="token da Meta"
                type="password"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
              <StatusMini
                label="Status"
                value={
                  connection?.status === "connected"
                    ? "API conectada"
                    : isConnectionReady
                    ? "Pronta para salvar"
                    : "Campos obrigatórios pendentes"
                }
                tone={
                  connection?.status === "connected"
                    ? "success"
                    : isConnectionReady
                    ? "info"
                    : "warning"
                }
              />
              <StatusMini
                label="Token"
                value={maskToken(connectionForm.access_token)}
                tone="neutral"
              />
              <StatusMini
                label="Webhook esperado"
                value="/api/whatsapp/webhook"
                tone="info"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={saveConnection}
                disabled={savingConnection}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {savingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar conexão
              </button>

              <div className="text-xs text-slate-400">
                Após salvar, o status precisa ficar como{" "}
                <span className="text-emerald-300">API conectada</span>.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1.35fr]">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,38,0.96),rgba(8,14,30,0.98))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Kanban de conversas</h2>
              <p className="text-xs text-slate-400">
                Visual comercial com rolagem lateral e totais por etapa.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              <ArrowRightLeft className="h-4 w-4 text-cyan-300" />
              Arraste lateralmente
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4">
              <StageColumn
                title="Fila de atendimento"
                count={queueItems.length}
                total={queueItems.reduce(
                  (sum, item) => sum + Number(item.amount || 0),
                  0
                )}
                badgeClass="bg-blue-500/15 text-blue-300 border-blue-500/20"
              >
                {queueItems.length === 0 ? (
                  <EmptyColumn text="Nenhuma conversa aguardando atendimento." />
                ) : (
                  queueItems.map((item) => (
                    <ConversationCard
                      key={item.id}
                      item={item}
                      active={selectedId === item.id}
                      onClick={() => setSelectedId(item.id)}
                    />
                  ))
                )}
              </StageColumn>

              {PIPELINE_STAGES.map((stage) => (
                <StageColumn
                  key={stage}
                  title={STAGE_LABELS[stage]}
                  count={grouped[stage].length}
                  total={stageTotals[stage]}
                  badgeClass={STAGE_BADGES[stage]}
                >
                  {grouped[stage].length === 0 ? (
                    <EmptyColumn text="Nenhum item nesta etapa." />
                  ) : (
                    grouped[stage].map((item) => (
                      <ConversationCard
                        key={item.id}
                        item={item}
                        active={selectedId === item.id}
                        onClick={() => setSelectedId(item.id)}
                      />
                    ))
                  )}
                </StageColumn>
              ))}
            </div>
          </div>
        </div>

        <div className="min-h-[78vh] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,38,0.96),rgba(8,14,30,0.98))] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          {!selectedConversation ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
              Selecione uma conversa para ver os detalhes.
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-2xl font-bold text-white">
                          {selectedConversation.client_name || "Sem nome"}
                        </h2>

                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            selectedConversation.assigned_to
                              ? STAGE_BADGES[selectedStage || "lead"]
                              : "border-blue-500/20 bg-blue-500/10 text-blue-300"
                          )}
                        >
                          {selectedConversation.assigned_to
                            ? selectedStage
                              ? STAGE_LABELS[selectedStage]
                              : "Lead"
                            : "Fila de atendimento"}
                        </span>

                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                            getTemperatureBadge(selectedConversation.temperature)
                          )}
                        >
                          {selectedConversation.temperature || "Morno"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-4 w-4 text-slate-400" />
                          {formatPhone(selectedConversation.client_phone)}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-4 w-4 text-slate-400" />
                          {selectedConversation.client_email || "Sem e-mail"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {selectedConversation.subject || "Sem assunto definido"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!selectedConversation.assigned_to ? (
                        <button
                          onClick={() => assumeConversation(selectedConversation.id)}
                          className="rounded-2xl bg-cyan-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
                        >
                          Assumir atendimento
                        </button>
                      ) : (
                        <button
                          onClick={() => unassignConversation(selectedConversation.id)}
                          className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3.5 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/15"
                        >
                          Voltar para fila
                        </button>
                      )}

                      <button
                        onClick={() => finalizeConversation(selectedConversation.id)}
                        className="rounded-2xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Concluir
                      </button>

                      <button
                        onClick={() => markLost(selectedConversation.id)}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/15"
                      >
                        Perder
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {PIPELINE_STAGES.map((stage) => (
                      <button
                        key={stage}
                        onClick={() => moveStage(selectedConversation.id, stage)}
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                          selectedStage === stage
                            ? STAGE_BADGES[stage]
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                        )}
                      >
                        {STAGE_LABELS[stage]}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <InfoMini
                      icon={<Wallet className="h-4 w-4" />}
                      label="Valor"
                      value={formatCurrency(selectedConversation.amount)}
                      accent="text-cyan-300"
                    />
                    <InfoMini
                      icon={<Percent className="h-4 w-4" />}
                      label="Comissão"
                      value={`${formatCurrency(
                        selectedConversation.commission_value
                      )} • ${formatPercent(
                        selectedConversation.commission_percent
                      )}`}
                      accent="text-yellow-300"
                    />
                    <InfoMini
                      icon={<TrendingUp className="h-4 w-4" />}
                      label="Lucro"
                      value={formatCurrency(selectedConversation.profit_value)}
                      accent="text-emerald-300"
                    />
                    <InfoMini
                      icon={<Sparkles className="h-4 w-4" />}
                      label="Origem"
                      value={selectedConversation.lead_source || "WhatsApp"}
                      accent="text-purple-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <InfoMini
                      label="Responsável"
                      value={
                        selectedConversation.assigned_to_name || "Não atribuído"
                      }
                    />
                    <InfoMini label="Atendente logado" value={currentUserName} />
                    <InfoMini
                      label="Última atividade"
                      value={formatRelative(selectedConversation.last_message_at)}
                    />
                    <InfoMini
                      label="Não lidas"
                      value={String(selectedConversation.unread_count || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.06),transparent_28%)] p-5">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                    Ainda não há mensagens nesta conversa.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isAgent = msg.sender_type === "agent";
                      const isSystem = msg.sender_type === "system";

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            isSystem
                              ? "justify-center"
                              : isAgent
                              ? "justify-end"
                              : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[90%] rounded-[22px] px-4 py-3 text-sm shadow-sm",
                              isSystem &&
                                "border border-white/10 bg-white/5 text-slate-300",
                              isAgent &&
                                "bg-cyan-600 text-white shadow-[0_10px_30px_rgba(6,182,212,0.18)]",
                              !isAgent &&
                                !isSystem &&
                                "border border-white/10 bg-slate-800/70 text-white"
                            )}
                          >
                            {!isSystem && (
                              <div
                                className={cn(
                                  "mb-1 text-[11px] font-medium",
                                  isAgent ? "text-cyan-100" : "text-slate-400"
                                )}
                              >
                                {msg.sender_name ||
                                  (msg.sender_type === "client"
                                    ? selectedConversation.client_name || "Cliente"
                                    : "Atendente")}
                              </div>
                            )}

                            <div className="whitespace-pre-wrap leading-relaxed">
                              {msg.message}
                            </div>

                            <div
                              className={cn(
                                "mt-2 text-[11px]",
                                isAgent ? "text-cyan-100/80" : "text-slate-400"
                              )}
                            >
                              {formatDateTime(msg.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-black/10 p-4">
                <div className="flex items-end gap-3">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Digite uma mensagem para o cliente..."
                    rows={3}
                    className="min-h-[90px] flex-1 resize-none rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !messageText.trim()}
                    className="inline-flex h-[54px] items-center justify-center gap-2 rounded-[22px] bg-cyan-600 px-5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  O envio já está preparado para usar{" "}
                  <span className="text-cyan-300">/api/whatsapp/send</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40"
      />
    </div>
  );
}

function StageColumn({
  title,
  count,
  total,
  badgeClass,
  children,
}: {
  title: string;
  count: number;
  total: number;
  badgeClass: string;
  children: ReactNode;
}) {
  return (
    <div className="w-[285px] min-w-[285px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,27,52,0.94),rgba(12,19,38,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-xl border px-3 py-1 text-[11px] font-bold uppercase",
              badgeClass
            )}
          >
            {title}
          </span>
          <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-slate-300">
            {count}
          </span>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          Total da etapa
          <div className="mt-1 text-sm font-semibold text-white">
            {formatCurrency(total)}
          </div>
        </div>
      </div>

      <div className="max-h-[67vh] space-y-3 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  );
}

function EmptyColumn({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-500">
      {text}
    </div>
  );
}

function ConversationCard({
  item,
  active,
  onClick,
}: {
  item: ConversationRow;
  active: boolean;
  onClick: () => void;
}) {
  const stage = getEffectiveStage(item);
  const isQueue =
    !item.assigned_to && (item.status === "queue" || stage === "lead");

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-[22px] border p-4 text-left transition",
        active
          ? "border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isQueue && <Inbox className="h-4 w-4 text-blue-300" />}
            {!isQueue && stage === "lead" && (
              <CircleDot className="h-4 w-4 text-cyan-400" />
            )}
            {stage === "andamento" && (
              <Clock3 className="h-4 w-4 text-orange-300" />
            )}
            {stage === "concluido" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            {stage === "perdido" && (
              <XCircle className="h-4 w-4 text-red-400" />
            )}

            <h4 className="truncate font-semibold text-white">
              {item.client_name || "Sem nome"}
            </h4>
          </div>

          <div className="mt-2 line-clamp-2 text-xs text-slate-400">
            {item.last_message || item.subject || "Sem mensagem recente"}
          </div>

          <div className="mt-2 text-[11px] text-slate-500">
            {item.lead_source || "WhatsApp"}
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-bold text-cyan-300">
            {formatCurrency(item.amount)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {formatRelative(item.last_message_at || item.updated_at)}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-300">
        <div>{formatPhone(item.client_phone)}</div>
        <div className="truncate">{item.client_email || "Sem e-mail"}</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isQueue ? (
          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">
            Na fila
          </span>
        ) : (
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
              getTemperatureBadge(item.temperature)
            )}
          >
            {item.temperature || "Morno"}
          </span>
        )}

        {item.assigned_to_name && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
            {item.assigned_to_name}
          </span>
        )}

        {!!item.unread_count && item.unread_count > 0 && (
          <span className="rounded-full bg-cyan-600 px-2.5 py-1 text-[11px] font-bold text-white">
            {item.unread_count} nova(s)
          </span>
        )}
      </div>
    </button>
  );
}

function InfoMini({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("mt-1 text-sm font-semibold text-white", accent)}>
        {value}
      </div>
    </div>
  );
}

function StatusMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "neutral" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : tone === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
      : tone === "info"
      ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"
      : "border-white/10 bg-white/5 text-slate-200";

  return (
    <div className={cn("rounded-2xl border p-3", toneClass)}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-1 break-all text-sm font-semibold">{value}</div>
    </div>
  );
}