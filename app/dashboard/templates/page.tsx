"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  FileText,
  Plus,
  Search,
  MessageCircle,
  Mail,
  PhoneCall,
  Save,
  Trash2,
  Copy,
  RefreshCcw,
} from "lucide-react";

type Template = {
  id: string;
  company_id: string;
  name: string;
  channel: "whatsapp" | "email" | "sms";
  category: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_at: string;
};

const OPTION_STYLE = {
  backgroundColor: "#111827",
  color: "#ffffff",
};

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
];

const CATEGORY_OPTIONS = [
  "Promoção",
  "Aniversário",
  "Follow-up",
  "Recuperação",
  "Pós-venda",
  "Proposta",
  "Relacionamento",
  "Outro",
];

const DEFAULT_BODY =
  "Olá {{cliente}}, tudo bem? Aqui é da {{empresa}}. Temos uma novidade especial para você. Posso te passar mais detalhes?";

export default function TemplatesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("FlowDesk");
  const [role, setRole] = useState("");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("todos");

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [category, setCategory] = useState("Promoção");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      .from("flowdesk_message_templates")
      .select("*")
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar templates:", error);
      setTemplates([]);
    } else {
      setTemplates((data || []) as Template[]);
    }

    setLoading(false);
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const term = search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        template.name.toLowerCase().includes(term) ||
        template.category.toLowerCase().includes(term) ||
        template.body.toLowerCase().includes(term);

      const matchesChannel =
        channelFilter === "todos" || template.channel === channelFilter;

      return matchesSearch && matchesChannel;
    });
  }, [templates, search, channelFilter]);

  function resetForm() {
    setName("");
    setChannel("whatsapp");
    setCategory("Promoção");
    setSubject("");
    setBody(DEFAULT_BODY);
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();

    if (!companyId) return;

    if (!name.trim()) {
      alert("Digite o nome do template.");
      return;
    }

    if (!body.trim()) {
      alert("Digite a mensagem do template.");
      return;
    }

    setSaving(true);

    const payload = {
      company_id: companyId,
      name: name.trim(),
      channel,
      category,
      subject: channel === "email" ? subject.trim() || null : null,
      body: body.trim(),
      is_active: true,
    };

    const { error } = await supabase.from("flowdesk_message_templates").insert(payload);

    setSaving(false);

    if (error) {
      alert("Erro ao salvar template: " + error.message);
      return;
    }

    resetForm();
    await load();
  }

  async function deleteTemplate(template: Template) {
    if (!companyId) return;

    const confirmDelete = window.confirm(
      `Deseja excluir o template "${template.name}"?`
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("flowdesk_message_templates")
      .delete()
      .eq("id", template.id)
      .eq("company_id", companyId);

    if (error) {
      alert("Erro ao excluir template: " + error.message);
      return;
    }

    await load();
  }

  async function copyTemplate(template: Template) {
    await navigator.clipboard.writeText(template.body);
    setCopiedId(template.id);

    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  }

  function previewText(text: string) {
    return text
      .replaceAll("{{cliente}}", "João")
      .replaceAll("{{empresa}}", companyName || "sua empresa")
      .replaceAll("{{responsavel}}", "Equipe comercial")
      .replaceAll("{{status}}", "proposta enviada")
      .replaceAll("{{origem}}", "Instagram");
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando templates...</div>;
  }

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="p-10 text-white">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
          Apenas owner ou admin podem acessar Templates.
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
                <FileText size={14} />
                Biblioteca Comercial
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Templates de Mensagens
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                Crie mensagens prontas para WhatsApp, e-mail e SMS. Depois esses
                templates serão usados em disparos manuais e automações.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard label="Templates" value={String(templates.length)} />
              <MetricCard
                label="WhatsApp"
                value={String(templates.filter((t) => t.channel === "whatsapp").length)}
              />
              <MetricCard
                label="E-mail/SMS"
                value={String(
                  templates.filter((t) => t.channel === "email" || t.channel === "sms")
                    .length
                )}
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
            <div className="mb-5 flex items-center gap-2">
              <Plus size={18} className="text-cyan-300" />
              <h2 className="font-bold">Novo template</h2>
            </div>

            <form onSubmit={saveTemplate} className="space-y-4">
              <Field label="Nome">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Promoção de Maio"
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                />
              </Field>

              <Field label="Canal">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                >
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={OPTION_STYLE}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Categoria">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                >
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item} style={OPTION_STYLE}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              {channel === "email" && (
                <Field label="Assunto">
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Temos uma condição especial para você"
                    className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                  />
                </Field>
              )}

              <Field label="Mensagem">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                />
              </Field>

              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100/80">
                Variáveis: <strong>{"{{cliente}}"}</strong>,{" "}
                <strong>{"{{empresa}}"}</strong>,{" "}
                <strong>{"{{responsavel}}"}</strong>,{" "}
                <strong>{"{{status}}"}</strong>, <strong>{"{{origem}}"}</strong>
              </div>

              <button
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Salvando..." : "Salvar template"}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar template..."
                    className="w-full rounded-xl border border-white/10 bg-[#111827] py-3 pl-10 pr-4 text-white outline-none"
                  />
                </div>

                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                >
                  <option value="todos" style={OPTION_STYLE}>
                    Todos os canais
                  </option>
                  {CHANNEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={OPTION_STYLE}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-8 text-center text-white/50">
                Nenhum template encontrado.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold">{template.name}</h2>
                          <ChannelBadge channel={template.channel} />
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50">
                            {template.category}
                          </span>
                        </div>

                        {template.subject && (
                          <p className="mt-2 text-sm text-white/55">
                            Assunto: {template.subject}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copyTemplate(template)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                        >
                          <Copy size={16} />
                        </button>

                        <button
                          onClick={() => deleteTemplate(template)}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-[#111827] p-4">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-white/70">
                        {previewText(template.body)}
                      </p>
                    </div>

                    {copiedId === template.id && (
                      <p className="mt-3 text-sm text-emerald-300">
                        Template copiado.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20"
            >
              <RefreshCcw size={16} />
              Atualizar templates
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-cyan-300">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
        <MessageCircle size={12} />
        WhatsApp
      </span>
    );
  }

  if (channel === "email") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
        <Mail size={12} />
        E-mail
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
      <PhoneCall size={12} />
      SMS
    </span>
  );
}