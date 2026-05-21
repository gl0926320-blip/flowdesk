"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Mail,
  Save,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  Send,
  Server,
} from "lucide-react";

export default function EmailPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState("");

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [provider, setProvider] = useState("manual");
  const [status, setStatus] = useState("not_configured");
  const [saving, setSaving] = useState(false);

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

    const companyName = (membership as any)?.companies?.name || "FlowDesk";

    const { data } = await supabase
      .from("flowdesk_email_settings")
      .select("*")
      .eq("company_id", membership.company_id)
      .maybeSingle();

    if (data) {
      setFromName(data.from_name || "");
      setFromEmail(data.from_email || "");
      setReplyTo(data.reply_to || "");
      setProvider(data.provider || "manual");
      setStatus(data.status || "not_configured");
    } else {
      setFromName(companyName);
    }

    setLoading(false);
  }

  async function saveConfig() {
    if (!companyId) return;

    if (!fromName.trim()) {
      alert("Informe o nome do remetente.");
      return;
    }

    if (!fromEmail.trim()) {
      alert("Informe o e-mail remetente.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("flowdesk_email_settings")
      .upsert(
        {
          company_id: companyId,
          from_name: fromName.trim(),
          from_email: fromEmail.trim().toLowerCase(),
          reply_to: replyTo.trim().toLowerCase() || null,
          provider,
          status: "configured",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );

    setSaving(false);

    if (error) {
      alert("Erro ao salvar e-mail: " + error.message);
      return;
    }

    await load();
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando E-mail...</div>;
  }

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="p-10 text-white">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
          Apenas owner ou admin podem configurar e-mail.
        </div>
      </div>
    );
  }

  const configured = status === "configured";

  return (
    <div className="min-h-screen bg-[#0A0F1C] p-6 md:p-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[#0f172a] p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Mail size={14} />
                Canal de E-mail
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                E-mail Comercial
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                Configure o remetente usado em campanhas, automações, recuperação
                de oportunidades, pós-venda e relacionamento.
              </p>
            </div>

            <div
              className={`rounded-3xl border p-5 ${
                configured
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-300"
              }`}
            >
              <div className="flex items-center gap-3">
                {configured ? <ShieldCheck /> : <AlertTriangle />}
                <div>
                  <p className="text-sm opacity-70">Status</p>
                  <p className="text-xl font-bold">
                    {configured ? "Configurado" : "Pendente"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
            <div className="mb-5 flex items-center gap-2">
              <Server size={18} className="text-emerald-300" />
              <h2 className="font-bold">Configuração do remetente</h2>
            </div>

            <div className="space-y-4">
              <Field label="Nome do remetente">
                <input
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Ex: Equipe Comercial"
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                />
              </Field>

              <Field label="E-mail remetente">
                <input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="ex: comercial@suaempresa.com"
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                />
              </Field>

              <Field label="Responder para">
                <input
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="opcional"
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                />
              </Field>

              <Field label="Provedor">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                >
                  <option value="manual" style={{ backgroundColor: "#111827" }}>
                    Manual / futuro
                  </option>
                  <option value="resend" style={{ backgroundColor: "#111827" }}>
                    Resend
                  </option>
                  <option value="smtp" style={{ backgroundColor: "#111827" }}>
                    SMTP
                  </option>
                </select>
              </Field>

              <button
                onClick={saveConfig}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Send size={18} className="text-emerald-300" />
                <h2 className="font-bold">Prévia de envio</h2>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111827] p-6">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">
                  Remetente
                </p>
                <p className="mt-2 font-semibold">
                  {fromName || "Nome do remetente"}{" "}
                  <span className="text-white/45">
                    &lt;{fromEmail || "email@empresa.com"}&gt;
                  </span>
                </p>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-bold">Assunto: Condição especial para você</p>
                  <p className="mt-3 text-sm leading-7 text-white/65">
                    Olá João, tudo bem? Aqui é da sua empresa. Temos uma novidade
                    especial para você. Posso te passar mais detalhes?
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 text-amber-300" size={20} />
                <div>
                  <h3 className="font-bold text-amber-200">
                    Envio real será conectado depois
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-amber-100/75">
                    Esta tela deixa o canal preparado. Depois conectamos Resend,
                    SMTP ou outro provedor para envio automático pela fila de disparos.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
            >
              <RefreshCcw size={16} />
              Atualizar dados
            </button>
          </div>
        </section>
      </div>
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