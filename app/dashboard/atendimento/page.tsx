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
  AlertTriangle,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  File,
  FileImage,
  Inbox,
  KanbanSquare,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Percent,
  Phone,
  RefreshCcw,
  Save,
  Search,
  Send,
  Settings2,
  Smile,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
  Film,
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
  avatar_url?: string | null;
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
  media_url?: string | null;
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

type AttachmentDraft = {
  id: string;
  file: File;
  previewUrl: string | null;
  kind: "image" | "video" | "file";
};

type InboxView = "all" | "general_queue" | "my_queue" | "active";
type CenterView = "chat" | "kanban";
type FlowFilter = "all" | "queue" | ConversationStage;

type AgentLookup = Record<
  string,
  {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  }
>;

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
  lead: "border-cyan-500/25 bg-cyan-500/12 text-cyan-300",
  proposta_enviada: "border-yellow-500/25 bg-yellow-500/12 text-yellow-300",
  aguardando_cliente: "border-violet-500/25 bg-violet-500/12 text-violet-300",
  proposta_validada: "border-emerald-500/25 bg-emerald-500/12 text-emerald-300",
  andamento: "border-orange-500/25 bg-orange-500/12 text-orange-300",
  concluido: "border-green-500/25 bg-green-500/12 text-green-300",
  perdido: "border-red-500/25 bg-red-500/12 text-red-300",
};

const QUICK_EMOJIS = [
  "😀",
  "😁",
  "😎",
  "🔥",
  "🚀",
  "💬",
  "✅",
  "🙏",
  "👀",
  "❤️",
  "🎯",
  "📌",
];

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

function formatHour(value?: string | null) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function formatDayLabel(value?: string | null) {
  if (!value) return "";
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

function formatRelative(value?: string | null) {
  if (!value) return "sem atividade";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}

function getSlaInfo(value?: string | null) {
  if (!value) {
    return {
      label: "sem atividade",
      color: "text-slate-400",
      level: "none" as const,
    };
  }

  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 5) {
    return {
      label: "agora",
      color: "text-emerald-400",
      level: "good" as const,
    };
  }

  if (minutes < 15) {
    return {
      label: `${minutes} min`,
      color: "text-yellow-400",
      level: "warning" as const,
    };
  }

  if (minutes < 60) {
    return {
      label: `${minutes} min`,
      color: "text-orange-400",
      level: "alert" as const,
    };
  }

  if (minutes < 1440) {
    return {
      label: `${Math.floor(minutes / 60)} h`,
      color: "text-red-400",
      level: "critical" as const,
    };
  }

  return {
    label: `${Math.floor(minutes / 1440)} d`,
    color: "text-red-400",
    level: "critical" as const,
  };
}

function getTemperatureBadge(value?: string | null) {
  const temp = (value || "").toLowerCase();

  if (temp === "quente") {
    return "border-red-500/25 bg-red-500/12 text-red-300";
  }
  if (temp === "frio") {
    return "border-slate-500/25 bg-slate-500/12 text-slate-300";
  }
  return "border-yellow-500/25 bg-yellow-500/12 text-yellow-300";
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

function getConversationStatusMeta(item: ConversationRow) {
  const stage = getEffectiveStage(item);

  if (item.status === "closed" || stage === "concluido" || stage === "perdido") {
    return {
      label: "Finalizado",
      className: "border-slate-500/25 bg-slate-500/12 text-slate-300",
    };
  }

  if (item.status === "in_progress" || !!item.assigned_to) {
    return {
      label: "Em atendimento",
      className: "border-emerald-500/25 bg-emerald-500/12 text-emerald-300",
    };
  }

  return {
    label: "Fila",
    className: "border-blue-500/25 bg-blue-500/12 text-blue-300",
  };
}

function maskToken(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 12) return "••••••••";
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`;
}

function getInitials(name?: string | null) {
  const clean = String(name || "").trim();
  if (!clean) return "CL";

  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("");
}

function groupMessagesByDay(messages: MessageRow[]) {
  const groups: Array<{ day: string; items: MessageRow[] }> = [];

  for (const msg of messages) {
    const day = formatDayLabel(msg.created_at) || "Sem data";
    const found = groups.find((group) => group.day === day);
    if (found) found.items.push(msg);
    else groups.push({ day, items: [msg] });
  }

  return groups;
}

function getAttachmentKind(file: File): AttachmentDraft["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function getAssignedMeta(
  item: ConversationRow,
  agentLookup: AgentLookup
): { name: string; email: string } | null {
  if (!item.assigned_to && !item.assigned_to_name) return null;

  const lookup = item.assigned_to ? agentLookup[item.assigned_to] : null;

  return {
    name: lookup?.name || item.assigned_to_name || "Atendente",
    email: lookup?.email || "",
  };
}

export default function AtendimentoPage() {
  const supabase = useMemo(() => createClient(), []);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [removingConnection, setRemovingConnection] = useState(false);
  const [showRemoveConnectionConfirm, setShowRemoveConnectionConfirm] =
    useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Atendente");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  const [search, setSearch] = useState("");
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("all");
  const [inboxView, setInboxView] = useState<InboxView>("all");
  const [centerView, setCenterView] = useState<CenterView>("chat");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);

  const [apiOpen, setApiOpen] = useState(false);
  const [showAdvancedApi, setShowAdvancedApi] = useState(false);
  const [pageError, setPageError] = useState<string>("");
  const [pageSuccess, setPageSuccess] = useState<string>("");

  const [connection, setConnection] = useState<WhatsAppConnectionRow | null>(
    null
  );
  const [agentLookup, setAgentLookup] = useState<AgentLookup>({});

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

      const hasActiveConnection = connection?.status === "connected";

    
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

  useEffect(() => {
    return () => {
      attachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [attachments]);

  function clearNotices() {
    setPageError("");
    setPageSuccess("");
  }

    function resetConnectionForm() {
    setConnectionForm({
      connection_name: "WhatsApp Principal",
      phone_number: "",
      phone_number_id: "",
      business_account_id: "",
      access_token: "",
      verify_token: "",
    });
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
        .select("id, full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Erro ao buscar profile:", profileError.message);
      }

      setCurrentUserName(profile?.full_name || profile?.email || "Atendente");
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
        fetchAgents(membership.company_id),
      ]);
    } catch (error) {
      console.error(error);
      setPageError("Falha ao carregar a central de atendimento.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents(activeCompanyId: string) {
    const { data: memberships, error: membershipError } = await supabase
      .from("company_users")
      .select("user_id, role")
      .eq("company_id", activeCompanyId);

    if (membershipError) {
      console.error("Erro ao buscar company_users:", membershipError.message);
      return;
    }

    const userIds = Array.from(
      new Set((memberships || []).map((row) => row.user_id).filter(Boolean))
    );

    if (userIds.length === 0) {
      setAgentLookup({});
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profileError) {
      console.error("Erro ao buscar profiles:", profileError.message);
      return;
    }

    const profilesMap = new Map(
      (profiles || []).map((profile) => [profile.id, profile])
    );

    const nextLookup: AgentLookup = {};

    for (const membership of memberships || []) {
      const profile = profilesMap.get(membership.user_id);

      nextLookup[membership.user_id] = {
        id: membership.user_id,
        name: profile?.full_name || profile?.email || "Atendente",
        email: profile?.email || "",
        role: membership.role || null,
      };
    }

    setAgentLookup(nextLookup);
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
        setShowAdvancedApi(false);
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

    async function removeConnection() {
    if (!companyId || !connection?.id) {
      setPageError("Nenhuma conexão encontrada para remover.");
      return;
    }

    clearNotices();
    setRemovingConnection(true);

    try {
      const { error } = await supabase
        .from("whatsapp_connections")
        .delete()
        .eq("id", connection.id)
        .eq("company_id", companyId);

      if (error) {
        console.error("Erro ao remover conexão:", error);
        setPageError(`Erro ao remover conexão: ${error.message}`);
        return;
      }

      setConnection(null);
      resetConnectionForm();
      setShowAdvancedApi(false);
      setShowRemoveConnectionConfirm(false);
      setApiOpen(true);
      setSelectedId(null);
      setPageError("");
      setPageSuccess("Conexão removida com sucesso.");
    } catch (error) {
      console.error("Falha inesperada ao remover conexão:", error);
      setPageError("Falha inesperada ao remover a conexão.");
    } finally {
      setRemovingConnection(false);
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
      fetchAgents(companyId),
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

    setInboxView("my_queue");
    setSelectedId(conversationId);
    await fetchConversations(target.company_id);
    await fetchMessages(conversationId);
    await fetchAgents(target.company_id);
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
      message: "Conversa devolvida para a fila de atendimento geral.",
      message_type: "text",
      direction: "outbound",
      status: "sent",
    });

    setInboxView("general_queue");
    await fetchConversations(target.company_id);
    await fetchMessages(conversationId);
    await fetchAgents(target.company_id);
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

  function addEmoji(emoji: string) {
    setMessageText((prev) => `${prev}${emoji}`);
    setShowEmojiPanel(false);
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const newItems: AttachmentDraft[] = Array.from(fileList).map((file) => {
      const kind = getAttachmentKind(file);
      const previewUrl =
        kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;

      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl,
        kind,
      };
    });

    setAttachments((prev) => [...prev, ...newItems]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((entry) => entry.id !== id);
    });
  }

  function buildMessagePayload() {
    const text = messageText.trim();
    if (attachments.length === 0) return text;

    const attachmentLines = attachments.map((item) => {
      const icon =
        item.kind === "image" ? "🖼️" : item.kind === "video" ? "🎥" : "📎";
      return `${icon} ${item.file.name}`;
    });

    const attachmentBlock = `Arquivos anexados:\n${attachmentLines
      .map((line) => `• ${line}`)
      .join("\n")}`;

    if (text) return `${text}\n\n${attachmentBlock}`;
    return attachmentBlock;
  }

  async function sendMessage() {
    const payloadText = buildMessagePayload();
    if (!selectedId || !companyId || !payloadText.trim() || sending) return;

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
          text: payloadText,
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
      attachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setAttachments([]);
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

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

const searched = useMemo(() => {
  const term = search.trim().toLowerCase();

  const base = conversations.filter((item) => {
    if (!term) return true;

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

  return [...base].sort((a, b) => {
    const aUnassigned = !a.assigned_to ? 1 : 0;
    const bUnassigned = !b.assigned_to ? 1 : 0;

    if (aUnassigned !== bUnassigned) {
      return bUnassigned - aUnassigned;
    }

    const aTime = a.last_message_at
      ? new Date(a.last_message_at).getTime()
      : 0;
    const bTime = b.last_message_at
      ? new Date(b.last_message_at).getTime()
      : 0;

    return aTime - bTime;
  });
}, [conversations, search]);

  const queueItems = useMemo(
    () =>
      searched.filter(
        (item) =>
          !item.assigned_to &&
          (item.status === "queue" || getEffectiveStage(item) === "lead")
      ),
    [searched]
  );

  const myQueueItems = useMemo(
    () =>
      searched.filter(
        (item) =>
          item.assigned_to === currentUserId &&
          !["concluido", "perdido"].includes(getEffectiveStage(item))
      ),
    [searched, currentUserId]
  );

  const activeItems = useMemo(
    () =>
      searched.filter(
        (item) =>
          !!item.assigned_to &&
          !["concluido", "perdido"].includes(getEffectiveStage(item))
      ),
    [searched]
  );

  const filtered = useMemo(() => {
    if (inboxView === "general_queue") return queueItems;
    if (inboxView === "my_queue") return myQueueItems;
    if (inboxView === "active") return activeItems;
    return searched;
  }, [inboxView, queueItems, myQueueItems, activeItems, searched]);

  const filteredKanban = useMemo(() => {
    if (flowFilter === "all") return searched;

    if (flowFilter === "queue") {
      return searched.filter(
        (item) =>
          !item.assigned_to &&
          (item.status === "queue" || getEffectiveStage(item) === "lead")
      );
    }

    return searched.filter((item) => getEffectiveStage(item) === flowFilter);
  }, [searched, flowFilter]);

  const groupedKanban = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = filteredKanban.filter(
        (item) => getEffectiveStage(item) === stage
      );
      return acc;
    }, {} as Record<ConversationStage, ConversationRow[]>);
  }, [filteredKanban]);

  const selectedConversation =
    conversations.find((item) => item.id === selectedId) || null;

  const totalOpen =
    queueItems.length +
    searched.filter((item) => getEffectiveStage(item) === "proposta_enviada")
      .length +
    searched.filter((item) => getEffectiveStage(item) === "aguardando_cliente")
      .length +
    searched.filter((item) => getEffectiveStage(item) === "proposta_validada")
      .length +
    searched.filter((item) => getEffectiveStage(item) === "andamento").length;

  const myOpen = myQueueItems.length;

  const unreadTotal = conversations.reduce(
    (acc, item) => acc + Number(item.unread_count || 0),
    0
  );

  const totalRevenue = searched.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0
  );

  const selectedStage = selectedConversation
    ? getEffectiveStage(selectedConversation)
    : null;

  const groupedMessages = useMemo(() => groupMessagesByDay(messages), [messages]);

  const stageTotals = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage] = groupedKanban[stage].reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );
      return acc;
    }, {} as Record<ConversationStage, number>);
  }, [groupedKanban]);

  const timelineMessages = useMemo(() => {
    return [...messages]
      .filter((msg) => msg.sender_type === "system")
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 8);
  }, [messages]);

  const selectedAssignedAgent = selectedConversation
    ? getAssignedMeta(selectedConversation, agentLookup)
    : null;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-[28px] border border-white/10 bg-white/5 p-8 text-white">
        Carregando atendimento...
      </div>
    );
  }

  return (
    <div className="space-y-5 text-white">
      <div className="overflow-hidden rounded-[30px] border border-cyan-500/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),linear-gradient(135deg,rgba(8,15,35,0.98),rgba(18,28,52,0.98))] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_60px_rgba(0,0,0,0.35)]">
        <div className="p-5 md:p-6">
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
                    : "API desconectada"}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                  {currentUserName}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-400">
                  {currentUserEmail || "sem e-mail"}
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-wide text-white md:text-4xl">
                CENTRAL DE ATENDIMENTO
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-[15px]">
                Atendimento oficial com fila geral, operadores, etapas comerciais e conexão da API do WhatsApp da própria empresa.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              <MetricCard
                icon={<Inbox className="h-4 w-4" />}
                label="Fila geral"
                value={String(queueItems.length)}
              />
              <MetricCard
                icon={<Users className="h-4 w-4" />}
                label="Abertos"
                value={String(totalOpen)}
              />
              <MetricCard
                icon={<UserCheck className="h-4 w-4" />}
                label="Minha fila"
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
                value={String(
                  searched.filter(
                    (item) => getEffectiveStage(item) === "concluido"
                  ).length
                )}
              />
            </div>
          </div>

          {!hasActiveConnection && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div className="text-sm text-amber-200">
                  <div className="font-semibold">WhatsApp desconectado</div>
                  <div className="mt-1 text-amber-100/80">
                    O histórico continua disponível, mas a empresa precisa reconectar a API para voltar a responder clientes.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setApiOpen(true);
                  setShowAdvancedApi(true);
                  setPageError("");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                <MessageCircle className="h-4 w-4" />
                Reconectar
              </button>
            </div>
          )}

          {(pageError || pageSuccess) && (
            <div className="mt-4 space-y-2">
          {!hasActiveConnection && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div className="text-sm text-amber-200">
                  <div className="font-semibold">WhatsApp desconectado</div>
                  <div className="mt-1 text-amber-100/80">
                    O histórico continua disponível, mas a empresa precisa reconectar a API para voltar a responder clientes.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setApiOpen(true);
                  setShowAdvancedApi(true);
                  setPageError("");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                <MessageCircle className="h-4 w-4" />
                Reconectar
              </button>
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

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const nextOpen = !apiOpen;
                  setApiOpen(nextOpen);

                  if (!hasActiveConnection && nextOpen) {
                    setShowAdvancedApi(true);
                    setPageError("");
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15"
              >
                <MessageCircle className="h-4 w-4" />
                {hasActiveConnection
                  ? apiOpen
                    ? "Fechar conexão"
                    : "Gerenciar conexão"
                  : apiOpen
                  ? "Fechar conexão"
                  : "Conectar WhatsApp"}
                {apiOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {connection?.id && (
  <button
                  type="button"
                  onClick={() => setShowRemoveConnectionConfirm(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/15"
                >
                  <X className="h-4 w-4" />
                  Remover conexão
                </button>
              )}
            </div>
          </div>
                        {apiOpen && (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-cyan-300" />
                    <h2 className="text-sm font-semibold text-white">
                      Conexão oficial do WhatsApp
                    </h2>
                  </div>

                  <h3 className="mt-3 text-2xl font-bold text-white">
                    Conecte o número da empresa
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Centralize conversas, assuma atendimentos, mova etapas do funil
                    e responda clientes usando a API oficial do WhatsApp Cloud.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <StatusMini
                      label="Status da conexão"
                      value={
                        connection?.status === "connected"
                          ? "WhatsApp conectado"
                          : isConnectionReady
                          ? "Pronto para conectar"
                          : "Configuração pendente"
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
                      label="Número"
                      value={
                        connectionForm.phone_number
                          ? connectionForm.phone_number
                          : "Não informado"
                      }
                      tone="neutral"
                    />

                    <StatusMini
                      label="Webhook"
                      value="/api/whatsapp/webhook"
                      tone="info"
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Conexão atual
                        </p>
                        <p className="mt-2 text-base font-semibold text-white">
                          {connectionForm.connection_name || "WhatsApp Principal"}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {connectionForm.phone_number
                            ? connectionForm.phone_number
                            : "Nenhum número conectado ainda"}
                        </p>
                      </div>

                      <div
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                          connection?.status === "connected"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                        )}
                      >
                        {connection?.status === "connected" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        {connection?.status === "connected"
                          ? "Conectado"
                          : "Pendente"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Etapas para conectar
                    </p>

                    <div className="mt-3 space-y-2 text-sm text-slate-300">
                      <div className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-cyan-300" />
                        <span>Defina o nome da conexão e o número principal da empresa.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-cyan-300" />
                        <span>Preencha os dados da Meta na configuração avançada.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-cyan-300" />
                        <span>Salve a conexão para ativar o atendimento oficial.</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-[360px] rounded-[24px] border border-cyan-500/15 bg-[linear-gradient(180deg,rgba(8,15,35,0.95),rgba(14,24,48,0.95))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                    Ação principal
                  </p>

                  <h4 className="mt-3 text-lg font-bold text-white">
                    {hasActiveConnection
                      ? "Canal conectado"
                      : "Conecte seu WhatsApp"}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {hasActiveConnection
                      ? "O canal oficial da empresa está ativo e pronto para operar dentro da central."
                      : "Reconecte o canal da empresa para liberar atendimento, resposta e operação completa pela API oficial."}
                  </p>

                  <div className="mt-4 flex flex-col gap-3">
                    <button
                      onClick={saveConnection}
                      disabled={savingConnection}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60"
                    >
                      {savingConnection ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {hasActiveConnection
                        ? "Salvar ajustes"
                        : "Reconectar WhatsApp"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAdvancedApi((prev) => !prev)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10"
                    >
                      <Settings2 className="h-4 w-4" />
                      {showAdvancedApi
                        ? "Ocultar configuração avançada"
                        : "Mostrar configuração avançada"}
                    </button>

                    {connection?.id && (
                      <button
                        type="button"
                        onClick={() => setShowRemoveConnectionConfirm(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/15"
                      >
                        <X className="h-4 w-4" />
                        Remover conexão
                      </button>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-slate-400">Token atual</p>
                    <p className="mt-1 text-sm text-white">
                      {maskToken(connectionForm.access_token)}
                    </p>
                  </div>

                  {connection?.id && (
                    <div className="mt-3 rounded-2xl border border-red-500/15 bg-red-500/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-300">
                        Zona de risco
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        Remover a conexão desativa o uso da API oficial nesta empresa até uma nova configuração.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {showAdvancedApi && (
                <div className="mt-5 rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Configuração avançada da Meta
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Área técnica para integrador ou administrador configurar os dados oficiais.
                      </p>
                    </div>

                    <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
                      Modo avançado
                    </div>
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
                        setConnectionForm((prev) => ({
                          ...prev,
                          phone_number: value,
                        }))
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
                        setConnectionForm((prev) => ({
                          ...prev,
                          verify_token: value,
                        }))
                      }
                      placeholder="token de verificação do webhook"
                    />

                    <InputField
                      label="Access Token"
                      value={connectionForm.access_token}
                      onChange={(value) =>
                        setConnectionForm((prev) => ({
                          ...prev,
                          access_token: value,
                        }))
                      }
                      placeholder="token da Meta"
                      type="password"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

                    {showRemoveConnectionConfirm && (
            <div className="mt-5 rounded-[24px] border border-red-500/20 bg-[rgba(127,29,29,0.12)] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-300" />
                    <h3 className="text-sm font-semibold text-white">
                      Confirmar remoção da conexão
                    </h3>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Você está prestes a remover a conexão oficial do WhatsApp desta empresa.
                    Depois disso, o atendimento via API ficará indisponível até que uma nova conexão seja configurada.
                  </p>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-slate-400">Conexão selecionada</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {connectionForm.connection_name || "WhatsApp Principal"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {connectionForm.phone_number || "Sem número configurado"}
                    </p>
                  </div>
                </div>

                <div className="flex w-full max-w-[340px] flex-col gap-3">
                  <button
                    type="button"
                    onClick={removeConnection}
                    disabled={removingConnection}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {removingConnection ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Confirmar remoção
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRemoveConnectionConfirm(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
       
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,37,0.96),rgba(8,14,30,0.98))] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Conversas</h2>
                <p className="text-xs text-slate-400">
                  Filas por atendente + visão geral.
                </p>
              </div>

              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-300">
                {inboxView === "general_queue"
                  ? queueItems.length
                  : inboxView === "my_queue"
                  ? myQueueItems.length
                  : inboxView === "active"
                  ? activeItems.length
                  : searched.length}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <InboxTab
                icon={<ChevronRight className="h-4 w-4" />}
                label="Todos"
                count={searched.length}
                active={inboxView === "all"}
                onClick={() => setInboxView("all")}
              />
              <InboxTab
                icon={<Inbox className="h-4 w-4" />}
                label="Fila geral"
                count={queueItems.length}
                active={inboxView === "general_queue"}
                onClick={() => setInboxView("general_queue")}
              />
              <InboxTab
                icon={<UserCheck className="h-4 w-4" />}
                label="Minha fila"
                count={myQueueItems.length}
                active={inboxView === "my_queue"}
                onClick={() => setInboxView("my_queue")}
              />
              <InboxTab
                icon={<Users className="h-4 w-4" />}
                label="Ativos"
                count={activeItems.length}
                active={inboxView === "active"}
                onClick={() => setInboxView("active")}
              />
            </div>

            <button
              onClick={() => setCenterView("kanban")}
              className={cn(
                "mt-3 flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                centerView === "kanban"
                  ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              )}
            >
              <span className="inline-flex items-center gap-2">
                <KanbanSquare className="h-4 w-4" />
                Abrir kanban
              </span>
              {centerView === "kanban" ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="max-h-[78vh] overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-center text-sm text-slate-400">
                Nenhuma conversa encontrada nesta fila.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const assignedMeta = getAssignedMeta(item, agentLookup);

                  return (
                    <ConversationInboxCard
                      key={item.id}
                      item={item}
                      active={selectedId === item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setCenterView("chat");
                      }}
                      assignedName={
                        assignedMeta?.name || item.assigned_to_name || ""
                      }
                      assignedEmail={assignedMeta?.email || ""}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-[78vh] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,38,0.96),rgba(8,14,30,0.98))] shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          {!selectedConversation ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">
              Selecione uma conversa para abrir o painel.
            </div>
          ) : centerView === "kanban" ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-4 py-4 md:px-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white md:text-2xl">
                      Kanban comercial
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Visual de pipeline completo separado do chat.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <CenterTab
                      active={false}
                      onClick={() => setCenterView("chat")}
                      label="Chat"
                      icon={<MessageCircle className="h-4 w-4" />}
                    />
                    <CenterTab
                      active
                      onClick={() => setCenterView("kanban")}
                      label="Kanban"
                      icon={<KanbanSquare className="h-4 w-4" />}
                    />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-3">
                    <FlowStagePill
                      title="Todos"
                      active={flowFilter === "all"}
                      onClick={() => setFlowFilter("all")}
                      count={searched.length}
                      total={totalRevenue}
                      badgeClass="border-white/10 bg-white/5 text-slate-200"
                    />
                    <FlowStagePill
                      title="Fila"
                      active={flowFilter === "queue"}
                      onClick={() => setFlowFilter("queue")}
                      count={queueItems.length}
                      total={queueItems.reduce(
                        (sum, item) => sum + Number(item.amount || 0),
                        0
                      )}
                      badgeClass="border-blue-500/25 bg-blue-500/12 text-blue-300"
                    />
                    {PIPELINE_STAGES.map((stage) => (
                      <FlowStagePill
                        key={stage}
                        title={STAGE_LABELS[stage]}
                        active={flowFilter === stage}
                        onClick={() => setFlowFilter(stage)}
                        count={groupedKanban[stage].length}
                        total={stageTotals[stage]}
                        badgeClass={STAGE_BADGES[stage]}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
                <div className="flex min-w-max gap-4">
                  {PIPELINE_STAGES.map((stage) => (
                    <KanbanColumn
                      key={stage}
                      title={STAGE_LABELS[stage]}
                      badgeClass={STAGE_BADGES[stage]}
                      count={groupedKanban[stage].length}
                      total={stageTotals[stage]}
                    >
                      {groupedKanban[stage].length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-500">
                          Nenhuma conversa nesta etapa.
                        </div>
                      ) : (
                        groupedKanban[stage].map((item) => {
                          const assignedMeta = getAssignedMeta(item, agentLookup);

                          return (
                            <ConversationInboxCard
                              key={item.id}
                              item={item}
                              active={selectedId === item.id}
                              onClick={() => {
                                setSelectedId(item.id);
                                setCenterView("chat");
                              }}
                              assignedName={
                                assignedMeta?.name || item.assigned_to_name || ""
                              }
                              assignedEmail={assignedMeta?.email || ""}
                            />
                          );
                        })
                      )}
                    </KanbanColumn>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] px-4 py-4 md:px-5">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarBubble
                        name={selectedConversation.client_name}
                        avatarUrl={selectedConversation.avatar_url}
                        size="lg"
                        showWhatsapp
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-bold text-white md:text-2xl">
                            {selectedConversation.client_name || "Sem nome"}
                          </h2>

                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              selectedConversation.assigned_to
                                ? STAGE_BADGES[selectedStage || "lead"]
                                : "border-blue-500/25 bg-blue-500/12 text-blue-300"
                            )}
                          >
                            {selectedConversation.assigned_to
                              ? selectedStage
                                ? STAGE_LABELS[selectedStage]
                                : "Lead"
                              : "Fila geral"}
                          </span>

                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              getTemperatureBadge(selectedConversation.temperature)
                            )}
                          >
                            {selectedConversation.temperature || "Morno"}
                          </span>

                          {selectedAssignedAgent?.name && (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                              Assumido por {selectedAssignedAgent.name}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-300">
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
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <CenterTab
                        active
                        onClick={() => setCenterView("chat")}
                        label="Chat"
                        icon={<MessageCircle className="h-4 w-4" />}
                      />
                      <CenterTab
                        active={false}
                        onClick={() => setCenterView("kanban")}
                        label="Kanban"
                        icon={<KanbanSquare className="h-4 w-4" />}
                      />

                      {!selectedConversation.assigned_to ? (
                        <button
                          onClick={() => assumeConversation(selectedConversation.id)}
                          disabled={!hasActiveConnection}
                          className="rounded-2xl bg-cyan-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Assumir atendimento
                        </button>
                      ) : selectedConversation.assigned_to === currentUserId ? (
                        <button
                          onClick={() =>
                            unassignConversation(selectedConversation.id)
                          }
                          className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3.5 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/15"
                        >
                          Voltar para fila
                        </button>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-slate-300">
                          Em atendimento por{" "}
                          {selectedAssignedAgent?.name || "outro atendente"}
                        </div>
                      )}

                      <button
                        onClick={() => finalizeConversation(selectedConversation.id)}
                        className="rounded-2xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Concluir
                      </button>

                      <button
                        onClick={() => markLost(selectedConversation.id)}
                        className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/15"
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
                </div>
              </div>

              <div className="relative flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.06),transparent_28%)] p-4 md:p-5">
                <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
                <div className="relative">
                  {messages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                      Ainda não há mensagens nesta conversa.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {groupedMessages.map((group) => (
                        <div key={group.day}>
                          <div className="mb-4 flex justify-center">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                              {group.day}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {group.items.map((msg) => {
                              const isAgent = msg.sender_type === "agent";
                              const isSystem = msg.sender_type === "system";

                              return (
                                <div
                                  key={msg.id}
                                  className={cn(
                                    "flex gap-3",
                                    isSystem
                                      ? "justify-center"
                                      : isAgent
                                      ? "justify-end"
                                      : "justify-start"
                                  )}
                                >
                                  {!isAgent && !isSystem && (
                                    <AvatarBubble
                                      name={
                                        msg.sender_name ||
                                        selectedConversation.client_name ||
                                        "Cliente"
                                      }
                                      avatarUrl={selectedConversation.avatar_url}
                                      size="sm"
                                      showWhatsapp
                                    />
                                  )}

                                  <div
                                    className={cn(
                                      "max-w-[90%] md:max-w-[76%]",
                                      isSystem && "max-w-full"
                                    )}
                                  >
                                    {!isSystem && (
                                      <div
                                        className={cn(
                                          "mb-1 px-1 text-[11px] font-medium",
                                          isAgent
                                            ? "text-right text-cyan-200"
                                            : "text-slate-400"
                                        )}
                                      >
                                        {msg.sender_name ||
                                          (msg.sender_type === "client"
                                            ? selectedConversation.client_name ||
                                              "Cliente"
                                            : "Atendente")}
                                      </div>
                                    )}

                                    <div
                                      className={cn(
                                        "rounded-[24px] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]",
                                        isSystem &&
                                          "border border-white/10 bg-white/5 text-center text-slate-300",
                                        isAgent &&
                                          "rounded-br-md bg-[linear-gradient(180deg,rgba(6,182,212,1),rgba(14,116,144,1))] text-white",
                                        !isAgent &&
                                          !isSystem &&
                                          "rounded-bl-md border border-white/10 bg-[linear-gradient(180deg,rgba(31,41,55,0.96),rgba(15,23,42,0.98))] text-white"
                                      )}
                                    >
                                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                        {msg.message}
                                      </div>

                                      <div
                                        className={cn(
                                          "mt-2 flex items-center gap-1 text-[11px]",
                                          isSystem
                                            ? "justify-center text-slate-400"
                                            : isAgent
                                            ? "justify-end text-cyan-100/80"
                                            : "justify-end text-slate-400"
                                        )}
                                      >
                                        <span>{formatHour(msg.created_at)}</span>
                                        {isAgent && (
                                          <>
                                            {msg.status === "read" ? (
                                              <CheckCheck className="h-3.5 w-3.5" />
                                            ) : (
                                              <Check className="h-3.5 w-3.5" />
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {isAgent && (
                                    <AvatarBubble
                                      name={currentUserName}
                                      size="sm"
                                      agent
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.08))] p-4">
                {attachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-3">
                    {attachments.map((item) => (
                      <AttachmentChip
                        key={item.id}
                        item={item}
                        onRemove={() => removeAttachment(item.id)}
                      />
                    ))}
                  </div>
                )}

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPanel((prev) => !prev)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                    >
                      <Smile className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    <div className="hidden items-center gap-2 md:flex">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                      >
                        <FileImage className="h-4 w-4" />
                        Foto
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                      >
                        <Film className="h-4 w-4" />
                        Vídeo
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                      >
                        <File className="h-4 w-4" />
                        Arquivo
                      </button>
                    </div>

                    <div className="ml-auto text-[11px] text-slate-500">
                      Enter envia • Shift + Enter quebra linha
                    </div>
                  </div>

                  {showEmojiPanel && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-wrap gap-2">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addEmoji(emoji)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg transition hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-end gap-3">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder="Digite uma mensagem para o cliente..."
                      rows={3}
                      className="min-h-[92px] flex-1 resize-none rounded-[22px] border border-white/10 bg-[rgba(7,12,25,0.72)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40"
                    />

                    <button
                      onClick={sendMessage}
                      disabled={
                        !hasActiveConnection ||
                        sending ||
                        (!messageText.trim() && attachments.length === 0)
                      }
                      className="inline-flex h-[56px] items-center justify-center gap-2 rounded-[22px] bg-cyan-600 px-5 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />

                <p className="mt-2 text-xs text-slate-500">
                  {hasActiveConnection ? (
                    <>
                      O envio de texto continua usando{" "}
                      <span className="text-cyan-300">/api/whatsapp/send</span>.
                    </>
                  ) : (
                    <>
                      A conexão oficial do WhatsApp está desativada. Reconecte a empresa para voltar a enviar mensagens.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,37,0.96),rgba(8,14,30,0.98))] shadow-[0_12px_40px_rgba(0,0,0,0.35)] 2xl:block">
          {!selectedConversation ? (
            <div className="flex h-full min-h-[260px] items-center justify-center p-8 text-center text-sm text-slate-400">
              Selecione uma conversa para ver os detalhes.
            </div>
          ) : (
            <div className="max-h-[78vh] overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Painel da conversa
                  </h3>
                  <p className="text-xs text-slate-400">
                    Responsável, e-mail, etapa e linha do tempo.
                  </p>
                </div>
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <AvatarBubble
                      name={selectedConversation.client_name}
                      avatarUrl={selectedConversation.avatar_url}
                      size="md"
                      showWhatsapp
                    />
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white">
                        {selectedConversation.client_name || "Sem nome"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {formatPhone(selectedConversation.client_phone)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
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
                      accent="text-violet-300"
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 text-sm font-semibold text-white">
                    Situação e atendimento
                  </div>
                  <div className="space-y-3">
                    <InfoMini
                      label="Responsável"
                      value={selectedAssignedAgent?.name || "Não atribuído"}
                    />
                    <InfoMini
                      label="E-mail do responsável"
                      value={
                        selectedAssignedAgent?.email ||
                        (selectedConversation.assigned_to
                          ? "E-mail não encontrado"
                          : "Sem responsável")
                      }
                    />
                    <InfoMini label="Atendente logado" value={currentUserName} />
                    <InfoMini label="Seu e-mail" value={currentUserEmail || "—"} />
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

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 text-sm font-semibold text-white">
                    Etapa atual
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
                            : "border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                        )}
                      >
                        {STAGE_LABELS[stage]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 text-sm font-semibold text-white">
                    Linha do tempo
                  </div>

                  {timelineMessages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                      Nenhum evento de sistema ainda.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {timelineMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className="rounded-2xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="text-sm leading-relaxed text-slate-200">
                            {msg.message}
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500">
                            {formatDateTime(msg.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedConversation.notes && (
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 text-sm font-semibold text-white">
                      Observações
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {selectedConversation.notes}
                    </p>
                  </div>
                )}
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
    <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm">
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

function InboxTab({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition",
        active
          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      )}
    >
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-bold text-white">
        {count}
      </span>
    </button>
  );
}

function CenterTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition",
        active
          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FlowStagePill({
  title,
  active,
  onClick,
  count,
  total,
  badgeClass,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  count: number;
  total: number;
  badgeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-w-[180px] rounded-[22px] border px-4 py-3 text-left transition",
        badgeClass,
        active
          ? "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_12px_30px_rgba(0,0,0,0.16)]"
          : "opacity-85 hover:opacity-100"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="truncate text-xs font-bold uppercase tracking-[0.12em]">
          {title}
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-bold text-white">
          {count}
        </div>
      </div>
      <div className="mt-2 text-sm font-semibold text-white">
        {formatCurrency(total)}
      </div>
    </button>
  );
}

function KanbanColumn({
  title,
  badgeClass,
  count,
  total,
  children,
}: {
  title: string;
  badgeClass: string;
  count: number;
  total: number;
  children: ReactNode;
}) {
  return (
    <div className="w-[320px] rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,37,0.96),rgba(8,14,30,0.98))] p-3">
      <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-bold",
              badgeClass
            )}
          >
            {title}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] font-bold text-white">
            {count}
          </span>
        </div>
        <div className="mt-2 text-sm font-semibold text-white">
          {formatCurrency(total)}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ConversationInboxCard({
  item,
  active,
  onClick,
  assignedName,
  assignedEmail,
}: {
  item: ConversationRow;
  active: boolean;
  onClick: () => void;
  assignedName?: string;
  assignedEmail?: string;
}) {
  
 const stage = getEffectiveStage(item);
const statusMeta = getConversationStatusMeta(item);

return (
  <button
    onClick={onClick}
    className={cn(
      "w-full rounded-[24px] border p-4 text-left transition",
      active
        ? "border-cyan-500/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(34,211,238,0.06))] shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
        : "border-white/10 bg-white/5 hover:bg-white/10"
    )}
  >
    <div className="flex items-start gap-3">
      <AvatarBubble
        name={item.client_name}
        avatarUrl={item.avatar_url}
        size="md"
        showWhatsapp
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {item.client_name || "Sem nome"}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {formatPhone(item.client_phone)}
            </div>
          </div>

          <div className="shrink-0 text-right">
            {(() => {
              const sla = getSlaInfo(item.last_message_at || item.updated_at);

              return (
                <div className={`text-[11px] font-semibold ${sla.color}`}>
                  ⏱ {sla.label}
                </div>
              );
            })()}

            {!!item.unread_count && item.unread_count > 0 && (
              <div className="mt-1 inline-flex rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {item.unread_count}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-300">
            {item.last_message || item.subject || "Sem mensagem recente"}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              statusMeta.className
            )}
          >
            {statusMeta.label}
          </span>

          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              STAGE_BADGES[stage]
            )}
          >
            {STAGE_LABELS[stage]}
          </span>

          {item.temperature && (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                getTemperatureBadge(item.temperature)
              )}
            >
              {item.temperature}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="min-w-0 truncate">
            {assignedName ? `Responsável: ${assignedName}` : "Sem responsável"}
          </div>
          <div className="truncate">
            {item.lead_source || assignedEmail || "Origem não informada"}
          </div>
        </div>
      </div>
    </div>
  </button>
);

}

function AvatarBubble({
  name,
  avatarUrl,
  size = "md",
  showWhatsapp = false,
  agent = false,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  showWhatsapp?: boolean;
  agent?: boolean;
}) {
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 text-sm"
      : size === "sm"
      ? "h-9 w-9 text-[11px]"
      : "h-11 w-11 text-xs";

  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || "avatar"}
          className={cn(
            "rounded-full border object-cover shadow-[0_8px_20px_rgba(0,0,0,0.2)]",
            sizeClass,
            agent ? "border-cyan-500/30" : "border-white/15"
          )}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-full border font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)]",
            sizeClass,
            agent
              ? "border-cyan-500/30 bg-[linear-gradient(180deg,rgba(6,182,212,0.85),rgba(14,116,144,0.95))]"
              : "border-white/15 bg-[linear-gradient(180deg,rgba(51,65,85,0.95),rgba(30,41,59,0.95))]"
          )}
        >
          {getInitials(name)}
        </div>
      )}

      {showWhatsapp && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#08111f] bg-emerald-500 text-[9px] text-white shadow">
          ●
        </span>
      )}
    </div>
  );
}

function AttachmentChip({
  item,
  onRemove,
}: {
  item: AttachmentDraft;
  onRemove: () => void;
}) {
  return (
    <div className="group relative flex max-w-[220px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        {item.kind === "image" && item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="h-14 w-14 object-cover"
          />
        ) : item.kind === "video" && item.previewUrl ? (
          <video
            src={item.previewUrl}
            className="h-14 w-14 object-cover"
            muted
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center">
            <File className="h-5 w-5 text-slate-400" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-white">
          {item.file.name}
        </div>
        <div className="mt-1 text-[11px] capitalize text-slate-400">
          {item.kind === "image"
            ? "Imagem"
            : item.kind === "video"
            ? "Vídeo"
            : "Arquivo"}
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
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