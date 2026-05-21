"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  PhoneCall,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";

type DispatchLog = {
  id: string;
  channel: "whatsapp" | "email" | "sms";
  status:
    | "pending"
    | "scheduled"
    | "processing"
    | "sent"
    | "failed"
    | "cancelled";

  recipient: string | null;
  subject: string | null;
  message: string | null;

  automation_name: string | null;
  template_name: string | null;

  error_message: string | null;

  sent_at: string | null;
  scheduled_for: string | null;

  created_at: string;
};

const OPTION_STYLE = {
  backgroundColor: "#111827",
  color: "#ffffff",
};

export default function LogsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [logs, setLogs] = useState<DispatchLog[]>([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("todos");
  const [channelFilter, setChannelFilter] = useState("todos");

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
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "ativo")
      .maybeSingle();

    if (!membership?.company_id) {
      setLoading(false);
      return;
    }

    setCompanyId(membership.company_id);

    const { data, error } = await supabase
      .from("flowdesk_dispatch_logs")
      .select("*")
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLogs([]);
    } else {
      setLogs((data || []) as DispatchLog[]);
    }

    setLoading(false);
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const term = search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        String(log.recipient || "")
          .toLowerCase()
          .includes(term) ||
        String(log.template_name || "")
          .toLowerCase()
          .includes(term) ||
        String(log.automation_name || "")
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === "todos" ||
        log.status === statusFilter;

      const matchesChannel =
        channelFilter === "todos" ||
        log.channel === channelFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesChannel
      );
    });
  }, [
    logs,
    search,
    statusFilter,
    channelFilter,
  ]);

  const sentCount = logs.filter(
    (log) => log.status === "sent"
  ).length;

  const failedCount = logs.filter(
    (log) => log.status === "failed"
  ).length;

  const pendingCount = logs.filter(
    (log) =>
      log.status === "pending" ||
      log.status === "processing"
  ).length;

  if (loading) {
    return (
      <div className="p-10 text-white">
        Carregando logs...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] p-6 md:p-10 text-white">
      <div className="mx-auto max-w-7xl space-y-8">

        <section className="rounded-[32px] border border-white/10 bg-[#0f172a] p-6 md:p-8">

          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

            <div>

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Activity size={14} />
                Central Operacional
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
                Logs de Disparos
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                Visualize disparos enviados,
                falhas, pendências, automações
                e campanhas comerciais.
              </p>

            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              <MetricCard
                label="Enviados"
                value={String(sentCount)}
                icon={
                  <CheckCircle2 size={18} />
                }
                color="emerald"
              />

              <MetricCard
                label="Pendentes"
                value={String(pendingCount)}
                icon={<Clock3 size={18} />}
                color="amber"
              />

              <MetricCard
                label="Falhas"
                value={String(failedCount)}
                icon={
                  <AlertTriangle size={18} />
                }
                color="red"
              />

            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6">

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_220px]">

            <div className="relative">

              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Buscar logs..."
                className="w-full rounded-xl border border-white/10 bg-[#111827] py-3 pl-10 pr-4 text-white outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
            >

              <option
                value="todos"
                style={OPTION_STYLE}
              >
                Todos status
              </option>

              <option
                value="pending"
                style={OPTION_STYLE}
              >
                Pendente
              </option>

              <option
                value="processing"
                style={OPTION_STYLE}
              >
                Processando
              </option>

              <option
                value="sent"
                style={OPTION_STYLE}
              >
                Enviado
              </option>

              <option
                value="failed"
                style={OPTION_STYLE}
              >
                Falhou
              </option>

            </select>

            <select
              value={channelFilter}
              onChange={(e) =>
                setChannelFilter(e.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-white outline-none"
            >

              <option
                value="todos"
                style={OPTION_STYLE}
              >
                Todos canais
              </option>

              <option
                value="whatsapp"
                style={OPTION_STYLE}
              >
                WhatsApp
              </option>

              <option
                value="email"
                style={OPTION_STYLE}
              >
                E-mail
              </option>

              <option
                value="sms"
                style={OPTION_STYLE}
              >
                SMS
              </option>

            </select>

          </div>
        </section>

        <section className="space-y-4">

          {filteredLogs.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-[#0f172a] p-10 text-center text-white/50">
              Nenhum log encontrado.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-[28px] border border-white/10 bg-[#0f172a] p-6"
              >

                <div className="flex flex-wrap items-start justify-between gap-4">

                  <div className="flex items-start gap-4">

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
                      {log.channel ===
                      "whatsapp" ? (
                        <MessageCircle size={22} />
                      ) : log.channel ===
                        "email" ? (
                        <Mail size={22} />
                      ) : (
                        <PhoneCall size={22} />
                      )}
                    </div>

                    <div>

                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="text-lg font-bold">
                          {log.recipient ||
                            "Destinatário"}
                        </h2>

                        <StatusBadge
                          status={log.status}
                        />

                      </div>

                      <p className="mt-2 text-sm text-white/50">
                        {log.template_name ||
                          "Sem template"}
                      </p>

                    </div>

                  </div>

                  <div className="text-right text-xs text-white/40">

                    <p>
                      {new Date(
                        log.created_at
                      ).toLocaleString()}
                    </p>

                    {log.sent_at && (
                      <p className="mt-1">
                        Enviado em{" "}
                        {new Date(
                          log.sent_at
                        ).toLocaleString()}
                      </p>
                    )}

                  </div>
                </div>

                {log.subject && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">

                    <span className="text-xs uppercase tracking-[0.14em] text-white/40">
                      Assunto
                    </span>

                    <p className="mt-2 text-sm text-white/70">
                      {log.subject}
                    </p>

                  </div>
                )}

                {log.message && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#111827] p-4">

                    <span className="text-xs uppercase tracking-[0.14em] text-white/40">
                      Mensagem
                    </span>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">
                      {log.message}
                    </p>

                  </div>
                )}

                {log.error_message && (
                  <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">

                    <div className="flex items-start gap-2">

                      <XCircle
                        size={18}
                        className="mt-0.5 text-red-300"
                      />

                      <div>

                        <span className="text-xs uppercase tracking-[0.14em] text-red-200/70">
                          Erro
                        </span>

                        <p className="mt-2 text-sm text-red-100/80">
                          {log.error_message}
                        </p>

                      </div>
                    </div>
                  </div>
                )}

              </div>
            ))
          )}
        </section>

        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-3 text-sm font-bold text-cyan-300 hover:bg-cyan-500/20"
        >
          <RefreshCcw size={16} />
          Atualizar logs
        </button>

      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color:
    | "emerald"
    | "amber"
    | "red";
}) {
  const styles = {
    emerald:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber:
      "border-amber-500/20 bg-amber-500/10 text-amber-300",
    red:
      "border-red-500/20 bg-red-500/10 text-red-300",
  };

  return (
    <div
      className={`rounded-3xl border p-5 ${styles[color]}`}
    >

      <div className="flex items-center gap-3">

        <div>{icon}</div>

        <div>

          <p className="text-sm opacity-70">
            {label}
          </p>

          <p className="text-2xl font-bold">
            {value}
          </p>

        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (status === "sent") {
    return (
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
        Enviado
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-300">
        Falhou
      </span>
    );
  }

  if (
    status === "processing"
  ) {
    return (
      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
        Processando
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
      Pendente
    </span>
  );
}