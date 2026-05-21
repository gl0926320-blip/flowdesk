"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Bot,
  Clock3,
  Flame,
  FileText,
  RefreshCcw,
  Save,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  XCircle,
  Zap,
  BellRing,
  Users,
  CalendarClock,
  Sparkles,
  MessageSquare,
  Mail,
  PhoneCall,
  PackageCheck,
  Brain,
  Workflow,
} from "lucide-react";

type AutomationType =
  | "lead_parado"
  | "proposta_sem_resposta"
  | "lead_quente"
  | "lead_perdido"
  | "pos_venda"
  | "lead_sem_resposta"
  | "cliente_inativo"
  | "reativacao"
  | "followup_atrasado"
  | "lead_novo"
  | "bling_pedido"
  | "whatsapp_primeiro_contato";

type AutomationRow = {
  id?: string;
  company_id?: string;
  type: AutomationType;
  category: string;
  title: string;
  description: string;
  is_active: boolean;
  trigger_days: number;
  target_status?: string | null;
  target_temperature?: string | null;
  followup_title: string;
  followup_description: string;
  channels?: string[];
};

const OPTION_STYLE = {
  backgroundColor: "#111827",
  color: "#ffffff",
};

const STATUS_OPTIONS = [
  { value: "", label: "Qualquer status" },
  { value: "lead", label: "Lead" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "aguardando_cliente", label: "Aguardando cliente" },
  { value: "proposta_validada", label: "Proposta validada" },
  { value: "andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "perdido", label: "Perdido" },
];

const TEMPERATURE_OPTIONS = [
  { value: "", label: "Qualquer temperatura" },
  { value: "frio", label: "Frio" },
  { value: "morno", label: "Morno" },
  { value: "quente", label: "Quente" },
];

const AUTOMATION_TEMPLATES: AutomationRow[] = [
  {
    type: "lead_novo",
    category: "SDR / Entrada",
    title: "Novo lead recebido",
    description: "Cria atividade imediata para todo novo lead que entrar no CRM.",
    is_active: false,
    trigger_days: 0,
    target_status: "lead",
    target_temperature: null,
    followup_title: "Atender novo lead",
    followup_description: "Novo lead entrou no CRM. Fazer primeiro contato comercial.",
    channels: ["Interno", "WhatsApp"],
  },
  {
    type: "whatsapp_primeiro_contato",
    category: "WhatsApp",
    title: "Primeiro contato via WhatsApp",
    description: "Prepara a automação para iniciar atendimento pelo WhatsApp.js.",
    is_active: false,
    trigger_days: 0,
    target_status: "lead",
    target_temperature: null,
    followup_title: "Enviar primeira mensagem",
    followup_description: "Enviar mensagem inicial para o lead pelo WhatsApp.",
    channels: ["WhatsApp"],
  },
  {
    type: "lead_parado",
    category: "Comercial",
    title: "Lead parado",
    description: "Cria follow-up automático quando um lead fica sem movimentação.",
    is_active: false,
    trigger_days: 3,
    target_status: null,
    target_temperature: null,
    followup_title: "Retornar contato comercial",
    followup_description: "Lead sem movimentação recente. Verificar andamento.",
    channels: ["Interno", "WhatsApp"],
  },
  {
    type: "proposta_sem_resposta",
    category: "Comercial",
    title: "Proposta sem resposta",
    description: "Cria retorno automático quando uma proposta enviada fica sem resposta.",
    is_active: false,
    trigger_days: 3,
    target_status: "proposta_enviada",
    target_temperature: null,
    followup_title: "Cobrar retorno da proposta",
    followup_description: "Cliente recebeu proposta e ainda não respondeu.",
    channels: ["Interno", "WhatsApp", "E-mail"],
  },
  {
    type: "lead_sem_resposta",
    category: "Comercial",
    title: "Cliente sem resposta",
    description: "Detecta leads aguardando cliente e cria uma nova tentativa.",
    is_active: false,
    trigger_days: 2,
    target_status: "aguardando_cliente",
    target_temperature: null,
    followup_title: "Cliente sem resposta",
    followup_description: "Cliente não respondeu ao último contato.",
    channels: ["Interno", "WhatsApp"],
  },
  {
    type: "lead_quente",
    category: "Prioridade",
    title: "Lead quente",
    description: "Cria follow-up urgente para leads marcados como quentes.",
    is_active: false,
    trigger_days: 1,
    target_status: null,
    target_temperature: "quente",
    followup_title: "Priorizar lead quente",
    followup_description: "Lead quente precisa de contato rápido.",
    channels: ["Interno", "WhatsApp"],
  },
  {
    type: "lead_perdido",
    category: "Recuperação",
    title: "Recuperação de lead perdido",
    description: "Agenda nova tentativa automática após perda.",
    is_active: false,
    trigger_days: 15,
    target_status: "perdido",
    target_temperature: null,
    followup_title: "Tentar recuperar oportunidade",
    followup_description: "Lead perdido anteriormente. Avaliar nova tentativa.",
    channels: ["Interno", "WhatsApp", "E-mail"],
  },
  {
    type: "reativacao",
    category: "Recuperação",
    title: "Reativação automática",
    description: "Cria reativação para leads antigos com potencial.",
    is_active: false,
    trigger_days: 60,
    target_status: null,
    target_temperature: "morno",
    followup_title: "Nova tentativa comercial",
    followup_description: "Lead antigo pode voltar a negociar.",
    channels: ["Interno", "WhatsApp", "SMS"],
  },
  {
    type: "pos_venda",
    category: "Relacionamento",
    title: "Pós-venda",
    description: "Cria relacionamento automático após venda concluída.",
    is_active: false,
    trigger_days: 30,
    target_status: "concluido",
    target_temperature: null,
    followup_title: "Pós-venda / relacionamento",
    followup_description: "Verificar satisfação do cliente e possível recompra.",
    channels: ["Interno", "WhatsApp", "E-mail"],
  },
  {
    type: "cliente_inativo",
    category: "Relacionamento",
    title: "Cliente inativo",
    description: "Cria follow-up para clientes sem nova movimentação.",
    is_active: false,
    trigger_days: 45,
    target_status: "concluido",
    target_temperature: null,
    followup_title: "Reativar cliente",
    followup_description: "Cliente está sem novas oportunidades.",
    channels: ["Interno", "WhatsApp", "SMS"],
  },
  {
    type: "followup_atrasado",
    category: "Produtividade",
    title: "Follow-up atrasado",
    description: "Detecta follow-ups vencidos automaticamente.",
    is_active: false,
    trigger_days: 1,
    target_status: null,
    target_temperature: null,
    followup_title: "Follow-up atrasado",
    followup_description: "Existe follow-up vencido pendente.",
    channels: ["Interno"],
  },
  {
    type: "bling_pedido",
    category: "Bling / ERP",
    title: "Criar pedido no Bling",
    description: "Prepara integração para criar proposta/pedido quando a venda for concluída.",
    is_active: false,
    trigger_days: 0,
    target_status: "concluido",
    target_temperature: null,
    followup_title: "Gerar pedido no Bling",
    followup_description: "Venda concluída. Criar pedido/proposta no Bling.",
    channels: ["Bling"],
  },
];

function iconByType(type: AutomationType) {
  if (type === "lead_parado") return Clock3;
  if (type === "proposta_sem_resposta") return FileText;
  if (type === "lead_quente") return Flame;
  if (type === "lead_perdido") return XCircle;
  if (type === "cliente_inativo") return Users;
  if (type === "reativacao") return RefreshCcw;
  if (type === "followup_atrasado") return BellRing;
  if (type === "lead_novo") return Sparkles;
  if (type === "bling_pedido") return PackageCheck;
  if (type === "whatsapp_primeiro_contato") return MessageSquare;
  return TrendingUp;
}

export default function AutomacoesPage() {
  const supabase = createClient();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [automations, setAutomations] = useState<AutomationRow[]>(AUTOMATION_TEMPLATES);

  const activeCount = useMemo(
    () => automations.filter((item) => item.is_active).length,
    [automations]
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "ativo")
      .maybeSingle();

    if (!membership?.company_id) {
      setLoading(false);
      return;
    }

    setCompanyId(membership.company_id);
    setRole(membership.role || "");

    const { data } = await supabase
      .from("flowdesk_automations")
      .select("*")
      .eq("company_id", membership.company_id);

    const saved = (data || []) as AutomationRow[];

    const merged = AUTOMATION_TEMPLATES.map((template) => {
      const found = saved.find((item) => item.type === template.type);
      return found ? { ...template, ...found, channels: template.channels } : template;
    });

    setAutomations(merged);
    setLoading(false);
  }

  function updateAutomation(type: AutomationType, patch: Partial<AutomationRow>) {
    setAutomations((prev) =>
      prev.map((item) => (item.type === type ? { ...item, ...patch } : item))
    );
  }

  async function saveAutomation(item: AutomationRow) {
    if (!companyId) return;

    setSavingType(item.type);

    const payload = {
      company_id: companyId,
      type: item.type,
      title: item.title,
      description: item.description,
      is_active: item.is_active,
      trigger_days: Number(item.trigger_days || 0),
      target_status: item.target_status || null,
      target_temperature: item.target_temperature || null,
      followup_title: item.followup_title,
      followup_description: item.followup_description,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("flowdesk_automations")
      .upsert(payload, {
        onConflict: "company_id,type",
      });

    setSavingType(null);

    if (error) {
      alert("Erro ao salvar automação: " + error.message);
      return;
    }

    await load();
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando automações...</div>;
  }

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="p-10 text-white">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
          Apenas owner ou admin podem configurar automações.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] p-6 md:p-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[#0f172a] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Bot size={14} />
                Central de Automações
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                CRM inteligente do FlowDesk
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                Configure regras para follow-up, WhatsApp, recuperação de leads,
                pós-venda e integração futura com Bling.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <HeaderCard icon={<Zap />} label="Ativas" value={String(activeCount)} />
              <HeaderCard icon={<MessageSquare />} label="WhatsApp.js" value="Preparado" />
              <HeaderCard icon={<PackageCheck />} label="Bling" value="ERP / pedidos" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {automations.map((item) => {
            const Icon = iconByType(item.type);

            return (
              <div
                key={item.type}
                className="rounded-[30px] border border-white/10 bg-[#0f172a] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                      <Icon size={22} />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">{item.title}</h2>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-white/45">
                          {item.category}
                        </span>
                      </div>

                      <p className="mt-1 text-sm leading-6 text-white/55">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => updateAutomation(item.type, { is_active: !item.is_active })}
                    className={`rounded-2xl border px-3 py-2 transition ${
                      item.is_active
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                        : "border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {item.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <Field label="Dias para disparar">
                    <input
                      type="number"
                      min={0}
                      value={item.trigger_days}
                      onChange={(e) =>
                        updateAutomation(item.type, {
                          trigger_days: Number(e.target.value || 0),
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                    />
                  </Field>

                  <Field label="Status alvo">
                    <select
                      value={item.target_status || ""}
                      onChange={(e) =>
                        updateAutomation(item.type, {
                          target_status: e.target.value || null,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} style={OPTION_STYLE}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Temperatura alvo">
                    <select
                      value={item.target_temperature || ""}
                      onChange={(e) =>
                        updateAutomation(item.type, {
                          target_temperature: e.target.value || null,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                    >
                      {TEMPERATURE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} style={OPTION_STYLE}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Título do follow-up">
                    <input
                      value={item.followup_title}
                      onChange={(e) =>
                        updateAutomation(item.type, {
                          followup_title: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                    />
                  </Field>
                </div>

                <Field label="Descrição do follow-up">
                  <textarea
                    value={item.followup_description}
                    onChange={(e) =>
                      updateAutomation(item.type, {
                        followup_description: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                  />
                </Field>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(item.channels || ["Interno"]).map((channel) => (
                      <ChannelBadge key={channel} channel={channel} />
                    ))}
                  </div>

                  <button
                    onClick={() => saveAutomation(item)}
                    disabled={savingType === item.type}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-60"
                  >
                    {savingType === item.type ? (
                      <RefreshCcw size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Salvar automação
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function HeaderCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
      <div className="flex items-center gap-3">
        <div className="text-cyan-300">{icon}</div>
        <div>
          <p className="text-sm text-white/50">{label}</p>
          <p className="text-lg font-bold text-cyan-300">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "WhatsApp") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-300">
        <MessageSquare size={12} />
        WhatsApp
      </span>
    );
  }

  if (channel === "E-mail") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
        <Mail size={12} />
        E-mail
      </span>
    );
  }

  if (channel === "SMS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
        <PhoneCall size={12} />
        SMS
      </span>
    );
  }

  if (channel === "Bling") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[11px] text-purple-300">
        <PackageCheck size={12} />
        Bling
      </span>
    );
  }

  if (channel === "IA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-pink-500/20 bg-pink-500/10 px-2.5 py-1 text-[11px] text-pink-300">
        <Brain size={12} />
        IA
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
      <Workflow size={12} />
      Interno
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-5 block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}