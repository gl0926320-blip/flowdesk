"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  MessageCircle,
  QrCode,
  Wifi,
  WifiOff,
  RefreshCcw,
  Save,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
} from "lucide-react";

export default function WhatsAppPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("disconnected");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

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
      .from("flowdesk_whatsapp_connections")
      .select("*")
      .eq("company_id", membership.company_id)
      .maybeSingle();

    if (data) {
      setPhone(data.phone || "");
      setStatus(data.status || "disconnected");
    }

    setLoading(false);
  }

  async function saveConfig() {
    if (!companyId) return;

    setSaving(true);

    const { error } = await supabase
      .from("flowdesk_whatsapp_connections")
      .upsert(
        {
          company_id: companyId,
          phone: phone.trim(),
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );

    setSaving(false);

    if (error) {
      alert("Erro ao salvar WhatsApp: " + error.message);
      return;
    }

    await load();
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando WhatsApp...</div>;
  }

  if (!["owner", "admin"].includes(role)) {
    return (
      <div className="p-10 text-white">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
          Apenas owner ou admin podem configurar o WhatsApp.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] p-6 md:p-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[#0f172a] p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <MessageCircle size={14} />
                Canal WhatsApp
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                WhatsApp Comercial
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                Configure o canal que será usado futuramente pelos disparos,
                automações e atendimento comercial via WhatsApp.js na VPS.
              </p>
            </div>

            <div
              className={`rounded-3xl border p-5 ${
                status === "connected"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/20 bg-red-500/10 text-red-300"
              }`}
            >
              <div className="flex items-center gap-3">
                {status === "connected" ? <Wifi /> : <WifiOff />}
                <div>
                  <p className="text-sm opacity-70">Status</p>
                  <p className="text-xl font-bold">
                    {status === "connected" ? "Conectado" : "Desconectado"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <Smartphone size={18} className="text-emerald-300" />
                <h2 className="font-bold">Configuração do número</h2>
              </div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                Número WhatsApp
              </label>

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 5562999999999"
                className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
              />

              <p className="mt-3 text-xs leading-5 text-white/45">
                Use DDI + DDD + número. Exemplo: 5562999999999.
              </p>

              <button
                onClick={saveConfig}
                disabled={saving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>

            <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 text-amber-300" size={20} />
                <div>
                  <h3 className="font-bold text-amber-200">
                    WhatsApp.js exige worker na VPS
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-amber-100/75">
                    Esta tela prepara a configuração. O QR Code real e o envio
                    automático serão conectados ao serviço Node.js da VPS.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <QrCode size={18} className="text-emerald-300" />
                <h2 className="font-bold">Conexão do WhatsApp</h2>
              </div>

              <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-[#111827] p-8 text-center">
                <div>
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-300">
                    <QrCode size={40} />
                  </div>

                  <h3 className="mt-5 text-xl font-bold">
                    QR Code será exibido aqui
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-white/50">
                    Depois que conectarmos a API da VPS, este painel vai mostrar
                    QR Code, status da sessão, reconectar e desconectar.
                  </p>

                  <button
                    onClick={load}
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/75 hover:bg-white/10"
                  >
                    <RefreshCcw size={16} />
                    Atualizar status
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">
              <div className="mb-5 flex items-center gap-2">
                <ShieldCheck size={18} className="text-cyan-300" />
                <h2 className="font-bold">Uso recomendado</h2>
              </div>

              <div className="space-y-3 text-sm text-white/60">
                <p>• Usar limite diário por empresa.</p>
                <p>• Enviar com intervalo entre mensagens.</p>
                <p>• Registrar logs de enviado, falhou e pendente.</p>
                <p>• Evitar disparo frio em massa para proteger o número.</p>
                <p>• Priorizar leads que já vieram do CRM, campanhas e pipeline.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}