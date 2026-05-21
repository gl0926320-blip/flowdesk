"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  PhoneCall,
  Save,
  RefreshCcw,
  ShieldCheck,
  AlertTriangle,
  MessageSquareText,
  Wallet,
  Server,
} from "lucide-react";

export default function SmsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState("");

  const [provider, setProvider] = useState("twilio");
  const [senderName, setSenderName] = useState("");
  const [status, setStatus] = useState("not_configured");
  const [dailyLimit, setDailyLimit] = useState("100");
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
      .from("flowdesk_sms_settings")
      .select("*")
      .eq("company_id", membership.company_id)
      .maybeSingle();

    if (data) {
      setProvider(data.provider || "twilio");
      setSenderName(data.sender_name || "");
      setStatus(data.status || "not_configured");
      setDailyLimit(String(data.daily_limit || 100));
    } else {
      setSenderName(companyName);
    }

    setLoading(false);
  }

  async function saveConfig() {
    if (!companyId) return;

    setSaving(true);

    const { error } = await supabase
      .from("flowdesk_sms_settings")
      .upsert(
        {
          company_id: companyId,
          provider,
          sender_name: senderName.trim(),
          daily_limit: Number(dailyLimit || 100),
          status: "configured",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );

    setSaving(false);

    if (error) {
      alert("Erro ao salvar SMS: " + error.message);
      return;
    }

    await load();
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando SMS...</div>;
  }

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="p-10 text-white">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
          Apenas owner ou admin podem configurar SMS.
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
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                <PhoneCall size={14} />
                Canal SMS
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                SMS Comercial
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                Configure o canal de SMS para campanhas rápidas, recuperação de
                leads, promoções, lembretes e avisos comerciais.
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
              <Server size={18} className="text-amber-300" />
              <h2 className="font-bold">Configuração do SMS</h2>
            </div>

            <div className="space-y-4">
              <Field label="Provedor">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                >
                  <option value="twilio" style={{ backgroundColor: "#111827" }}>
                    Twilio
                  </option>
                  <option value="manual" style={{ backgroundColor: "#111827" }}>
                    Manual / futuro
                  </option>
                </select>
              </Field>

              <Field label="Nome da empresa/remetente">
                <input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Ex: FlowDesk"
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                />
              </Field>

              <Field label="Limite diário de SMS">
                <input
                  type="number"
                  min={1}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
                />
              </Field>

              <button
                onClick={saveConfig}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <MessageSquareText size={18} className="text-amber-300" />
                <h2 className="font-bold">Prévia de SMS</h2>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#111827] p-6">
                <p className="text-xs uppercase tracking-[0.14em] text-white/35">
                  Mensagem exemplo
                </p>

                <p className="mt-4 text-sm leading-7 text-white/70">
                  Olá João, aqui é da {senderName || "sua empresa"}. Temos uma
                  condição especial para você. Responda esta mensagem para saber
                  mais.
                </p>

                <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100/80">
                  SMS deve ser curto, direto e com limite de caracteres para evitar
                  custo maior.
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Wallet size={18} className="text-cyan-300" />
                <h2 className="font-bold">Créditos e controle</h2>
              </div>

              <div className="space-y-3 text-sm text-white/60">
                <p>• O saldo real será conectado depois.</p>
                <p>• Os disparos devem consumir créditos por empresa.</p>
                <p>• Falhas precisam aparecer em Logs.</p>
                <p>• O limite diário evita uso indevido e protege a operação.</p>
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
                    Esta tela prepara o canal. Depois conectamos Twilio, fila de
                    disparos, créditos por empresa e atualização de status em Logs.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/20"
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