"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Send,
  MessageCircle,
  Mail,
  PhoneCall,
  Search,
  Filter,
  Users,
  Thermometer,
  FileText,
  Eye,
  Copy,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type Lead = {
  id: string;
  cliente: string | null;
  telefone: string | null;
  responsavel: string | null;
  origem_lead: string | null;
  status: string | null;
  temperatura: string | null;
  valor_orcamento: number | string | null;
  created_at: string | null;
};

const OPTION_STYLE = {
  backgroundColor: "#111827",
  color: "#ffffff",
};

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os status" },
  { value: "lead", label: "Lead" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "aguardando_cliente", label: "Aguardando cliente" },
  { value: "proposta_validada", label: "Proposta validada" },
  { value: "andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "perdido", label: "Perdido" },
];

const TEMP_OPTIONS = [
  { value: "todos", label: "Todas temperaturas" },
  { value: "frio", label: "Frio" },
  { value: "morno", label: "Morno" },
  { value: "quente", label: "Quente" },
];

const DEFAULT_MESSAGE =
  "Olá {{cliente}}, tudo bem? Aqui é da {{empresa}}. Passando para falar sobre uma oportunidade especial para você. Posso te passar mais detalhes?";

export default function DisparosPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("FlowDesk");
  const [role, setRole] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tempFilter, setTempFilter] = useState("todos");
  const [channel, setChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [subject, setSubject] = useState("Mensagem da nossa equipe");
  const [copied, setCopied] = useState(false);

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
      .select("company_id, role, companies(name)")
      .eq("user_id", user.id)
      .eq("status", "ativo")
      .maybeSingle();

    if (!membership?.company_id) {
      setLoading(false);
      return;
    }

    setCompanyId(membership.company_id);
    setRole(membership.role || "");
    setCompanyName((membership as any)?.companies?.name || "FlowDesk");

    const { data, error } = await supabase
      .from("servicos")
      .select(
        "id, cliente, telefone, responsavel, origem_lead, status, temperatura, valor_orcamento, created_at"
      )
      .eq("company_id", membership.company_id)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar leads para disparos:", error);
      setLeads([]);
    } else {
      setLeads((data || []) as Lead[]);
    }

    setLoading(false);
  }

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const term = search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        String(lead.cliente || "").toLowerCase().includes(term) ||
        String(lead.telefone || "").toLowerCase().includes(term) ||
        String(lead.responsavel || "").toLowerCase().includes(term) ||
        String(lead.origem_lead || "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "todos" || lead.status === statusFilter;

      const matchesTemp =
        tempFilter === "todos" || (lead.temperatura || "morno") === tempFilter;

      return matchesSearch && matchesStatus && matchesTemp;
    });
  }, [leads, search, statusFilter, tempFilter]);

  const validContacts = useMemo(() => {
    if (channel === "whatsapp" || channel === "sms") {
      return filteredLeads.filter((lead) => Boolean(lead.telefone?.trim()));
    }

    return filteredLeads;
  }, [filteredLeads, channel]);

  const firstLead = validContacts[0] || null;

  function buildMessage(lead?: Lead | null) {
    return message
      .replaceAll("{{cliente}}", lead?.cliente || "cliente")
      .replaceAll("{{empresa}}", companyName || "nossa empresa")
      .replaceAll("{{responsavel}}", lead?.responsavel || "nossa equipe")
      .replaceAll("{{status}}", lead?.status || "")
      .replaceAll("{{origem}}", lead?.origem_lead || "");
  }

  async function copyPreview() {
    await navigator.clipboard.writeText(buildMessage(firstLead));
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2500);
  }

  function openWhatsAppSample() {
    if (!firstLead?.telefone) {
      alert("Nenhum contato com telefone encontrado nesse público.");
      return;
    }

    const phone = firstLead.telefone.replace(/\D/g, "");
    const text = encodeURIComponent(buildMessage(firstLead));

    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando disparos...</div>;
  }

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="p-10 text-white">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
          Apenas owner ou admin podem acessar a Central de Disparos.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] p-6 md:p-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[#0f172a] p-6 md:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Send size={14} />
                Automação Comercial
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Central de Disparos
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                Prepare disparos comerciais para WhatsApp, e-mail e SMS usando os
                leads reais do FlowDesk. Primeiro deixamos a segmentação pronta;
                depois conectamos fila, VPS e envio automático.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                icon={<Users size={18} />}
                label="Público filtrado"
                value={String(filteredLeads.length)}
              />
              <MetricCard
                icon={<CheckCircle2 size={18} />}
                label="Com contato"
                value={String(validContacts.length)}
              />
              <MetricCard
                icon={<MessageCircle size={18} />}
                label="Canal atual"
                value={
                  channel === "whatsapp"
                    ? "WhatsApp"
                    : channel === "email"
                    ? "E-mail"
                    : "SMS"
                }
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Filter size={18} className="text-cyan-300" />
                <h2 className="font-bold">Segmentação</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Buscar
                  </label>

                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cliente, telefone, origem ou responsável..."
                      className="w-full rounded-xl border border-white/10 bg-[#111827] py-3 pl-10 pr-4 text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        style={OPTION_STYLE}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Temperatura
                  </label>
                  <select
                    value={tempFilter}
                    onChange={(e) => setTempFilter(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                  >
                    {TEMP_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        style={OPTION_STYLE}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Send size={18} className="text-cyan-300" />
                <h2 className="font-bold">Canal do disparo</h2>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <ChannelButton
                  active={channel === "whatsapp"}
                  icon={<MessageCircle size={18} />}
                  title="WhatsApp"
                  subtitle="Via WhatsApp.js na VPS"
                  onClick={() => setChannel("whatsapp")}
                />

                <ChannelButton
                  active={channel === "email"}
                  icon={<Mail size={18} />}
                  title="E-mail"
                  subtitle="Campanhas e relacionamento"
                  onClick={() => setChannel("email")}
                />

                <ChannelButton
                  active={channel === "sms"}
                  icon={<PhoneCall size={18} />}
                  title="SMS"
                  subtitle="Mensagens curtas e urgentes"
                  onClick={() => setChannel("sms")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <FileText size={18} className="text-cyan-300" />
                <h2 className="font-bold">Mensagem</h2>
              </div>

              {channel === "email" && (
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Assunto do e-mail
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                  />
                </div>
              )}

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                Texto do disparo
              </label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="w-full resize-none rounded-xl border border-white/10 bg-[#111827] p-4 text-white outline-none"
              />

              <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100/80">
                Variáveis disponíveis:{" "}
                <strong>{"{{cliente}}"}</strong>, <strong>{"{{empresa}}"}</strong>,{" "}
                <strong>{"{{responsavel}}"}</strong>, <strong>{"{{status}}"}</strong>,{" "}
                <strong>{"{{origem}}"}</strong>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Eye size={18} className="text-cyan-300" />
                <h2 className="font-bold">Prévia do disparo</h2>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111827] p-5">
                <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/35">
                  {firstLead?.cliente || "Cliente exemplo"}
                </div>

                {channel === "email" && (
                  <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <span className="text-white/45">Assunto: </span>
                    <span className="font-semibold">{subject}</span>
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm leading-7 text-white/75">
                  {buildMessage(firstLead)}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={copyPreview}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 transition hover:bg-white/10"
                >
                  <Copy size={16} />
                  {copied ? "Copiado" : "Copiar prévia"}
                </button>

                {channel === "whatsapp" && (
                  <button
                    onClick={openWhatsAppSample}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
                  >
                    <MessageCircle size={16} />
                    Testar no WhatsApp
                  </button>
                )}

                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  <RefreshCcw size={16} />
                  Atualizar público
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 text-amber-300" size={20} />
                <div>
                  <h3 className="font-bold text-amber-200">
                    Envio automático ainda será conectado
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-amber-100/75">
                    Esta tela já prepara público, canal e mensagem. O próximo passo
                    é criar fila de disparos, logs e worker na VPS para WhatsApp.js,
                    SMS e e-mail.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <h2 className="mb-4 font-bold">Público encontrado</h2>

              {validContacts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/50">
                  Nenhum contato encontrado para esse filtro.
                </div>
              ) : (
                <div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">
                  {validContacts.slice(0, 20).map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">
                            {lead.cliente || "Lead sem nome"}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            {lead.telefone || "Sem telefone"} ·{" "}
                            {lead.responsavel || "Sem responsável"}
                          </div>
                        </div>

                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
                          {lead.status || "lead"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
      <div className="flex items-center gap-3">
        <div className="text-cyan-300">{icon}</div>
        <div>
          <p className="text-sm text-white/50">{label}</p>
          <p className="text-2xl font-bold text-cyan-300">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ChannelButton({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
        active
          ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
          : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          active ? "bg-cyan-500/15 text-cyan-300" : "bg-white/5 text-white/50"
        }`}
      >
        {icon}
      </div>

      <div>
        <div className="font-bold">{title}</div>
        <div className="mt-0.5 text-xs opacity-60">{subtitle}</div>
      </div>
    </button>
  );
}