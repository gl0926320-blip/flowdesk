"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  BarChart3,
  Check,
  Crown,
  GraduationCap,
  Layers3,
  Minus,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const BASE_PRICE = 149.9;
const EXTRA_USER_PRICE = 89.9;
const USERS_INCLUDED = 1;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function BillingPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companyActive, setCompanyActive] = useState(true);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [lastPaymentDate, setLastPaymentDate] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [desiredUsers, setDesiredUsers] = useState(1);

  useEffect(() => {
    async function loadBilling() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("company_users")
          .select("company_id, role, status")
          .eq("user_id", user.id)
          .eq("status", "ativo")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          console.error(
            "Erro ao buscar vínculo da empresa:",
            membershipError
          );
          setLoading(false);
          return;
        }

        if (!membership?.company_id) {
          console.error("Usuário sem empresa ativa vinculada.");
          setCompanyActive(false);
          setLoading(false);
          return;
        }

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select(
            "is_active, billing_status, next_billing_date, last_payment_date, price_amount"
          )
          .eq("id", membership.company_id)
          .maybeSingle();

        if (companyError) {
          console.error("Erro ao buscar assinatura da empresa:", companyError);
          setLoading(false);
          return;
        }

        setCompanyActive(company?.is_active !== false);
        setBillingStatus(company?.billing_status || null);
        setNextBillingDate(company?.next_billing_date || null);
        setLastPaymentDate(company?.last_payment_date || null);

        const savedPrice = Number(company?.price_amount);
        setCurrentPrice(
          Number.isFinite(savedPrice) && savedPrice > 0 ? savedPrice : null
        );

        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar assinatura:", error);
        setLoading(false);
      }
    }

    loadBilling();
  }, [supabase]);

  const extraUsers = Math.max(0, desiredUsers - USERS_INCLUDED);
  const extraUsersTotal = extraUsers * EXTRA_USER_PRICE;
  const estimatedTotal = BASE_PRICE + extraUsersTotal;

  function formatDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("pt-BR").format(date);
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-white">
        Carregando assinatura...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 p-6 text-white md:p-10">
      <section className="overflow-hidden rounded-[32px] border border-cyan-500/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_24%),linear-gradient(135deg,rgba(7,15,34,0.98),rgba(15,23,42,0.98))] px-6 py-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_60px_rgba(0,0,0,0.35)] md:px-8 md:py-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
              <Crown className="h-4 w-4" />
              Assinatura FlowDesk
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
              Um único plano. Todos os recursos.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
              Tenha acesso completo ao FlowDesk por{" "}
              <span className="font-bold text-white">
                {formatCurrency(BASE_PRICE)}/mês
              </span>{" "}
              com 1 usuário incluído. Adicione novos usuários por{" "}
              <span className="font-bold text-cyan-300">
                {formatCurrency(EXTRA_USER_PRICE)}/mês
              </span>{" "}
              cada.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <HeroPill
                icon={<BarChart3 className="h-4 w-4" />}
                label="CRM completo"
              />
              <HeroPill
                icon={<Users className="h-4 w-4" />}
                label="Gestão de equipe"
              />
              <HeroPill
                icon={<Layers3 className="h-4 w-4" />}
                label="Todos os módulos"
              />
              <HeroPill
                icon={<Sparkles className="h-4 w-4" />}
                label="FlowIA incluída"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <MiniStat
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Plano"
              value="Completo"
              tone="cyan"
            />
            <MiniStat
              icon={<Rocket className="h-4 w-4" />}
              title="Usuário inicial"
              value="1 incluído"
              tone="violet"
            />
            <MiniStat
              icon={<Target className="h-4 w-4" />}
              title="Usuário adicional"
              value={formatCurrency(EXTRA_USER_PRICE)}
              tone="emerald"
            />
            <MiniStat
              icon={<GraduationCap className="h-4 w-4" />}
              title="Cobrança"
              value="Mensal"
              tone="amber"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Feature
          icon={<BarChart3 className="h-5 w-5" />}
          title="Gestão Comercial"
          desc="Leads, carteira, pipeline, clientes, orçamentos, vendas e acompanhamento da operação."
        />

        <Feature
          icon={<Users className="h-5 w-5" />}
          title="Equipe e Comissões"
          desc="Gerencie usuários, vendedores, produtividade, metas e comissões em um único ambiente."
        />

        <Feature
          icon={<Layers3 className="h-5 w-5" />}
          title="Recursos Inclusos"
          desc="Estoque, campanhas, automações, WhatsApp, e-mail, SMS, templates e logs sem cobrança por módulo."
        />

        <Feature
          icon={<Sparkles className="h-5 w-5" />}
          title="FlowIA"
          desc="Inteligência integrada à operação comercial para apoiar análise, produtividade e tomada de decisão."
        />
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(9,14,28,0.98))] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)] md:p-8">
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              <Users className="h-4 w-4" />
              Quantidade de usuários
            </div>

            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Monte sua assinatura pela sua equipe
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
              O primeiro usuário custa {formatCurrency(BASE_PRICE)} por mês e
              já possui acesso completo ao sistema. Cada usuário adicional custa{" "}
              {formatCurrency(EXTRA_USER_PRICE)} por mês.
            </p>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/5 p-5 md:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">
                  Quantos usuários vão utilizar o FlowDesk?
                </div>

                <div className="mt-2 text-sm text-slate-400">
                  1 usuário incluído no valor base.
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Usuário adicional: {formatCurrency(EXTRA_USER_PRICE)} / mês
                </div>
              </div>

              <div className="inline-flex items-center self-start rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-2 md:self-auto">
                <button
                  type="button"
                  aria-label="Diminuir quantidade de usuários"
                  onClick={() =>
                    setDesiredUsers((prev) => Math.max(1, prev - 1))
                  }
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <div className="min-w-[130px] px-4 text-center">
                  <div className="text-2xl font-black text-white">
                    {desiredUsers}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {desiredUsers === 1 ? "usuário" : "usuários"}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Aumentar quantidade de usuários"
                  onClick={() => setDesiredUsers((prev) => prev + 1)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <PriceInfo
                label="Assinatura base"
                value={formatCurrency(BASE_PRICE)}
                description="1 usuário incluído"
              />

              <PriceInfo
                label={`Usuários adicionais (${extraUsers})`}
                value={formatCurrency(extraUsersTotal)}
                description={`${formatCurrency(EXTRA_USER_PRICE)} por usuário`}
              />
            </div>
          </div>

          <div className="mt-6 rounded-[26px] border border-emerald-500/20 bg-emerald-500/10 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                <Check className="h-5 w-5" />
              </div>

              <div>
                <div className="font-semibold text-white">
                  Todos os recursos estão inclusos
                </div>
                <p className="mt-1 text-sm leading-relaxed text-emerald-100/70">
                  Você não precisa comprar módulos separadamente. O valor varia
                  apenas conforme a quantidade de usuários da sua empresa.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Dashboard financeiro e comercial",
              "Leads, carteira e pipeline",
              "Atendimento e clientes",
              "Estoque",
              "Orçamentos e vendas",
              "Comissões",
              "Campanhas",
              "Disparos e automações",
              "Templates e logs",
              "WhatsApp",
              "E-mail",
              "SMS",
              "Gestão de empresas",
              "Gestão de equipe",
              "Configurações",
              "FlowIA",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {feature}
              </div>
            ))}
          </div>
        </div>

        <aside className="h-fit rounded-[30px] border border-purple-500/30 bg-[linear-gradient(180deg,rgba(88,28,135,0.28),rgba(30,41,59,0.98))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)] xl:sticky xl:top-6">
          <div className="mb-4 inline-flex rounded-xl bg-purple-600 px-3 py-1 text-xs font-semibold text-white">
            Resumo da assinatura
          </div>

          <h3 className="text-2xl font-bold text-white">FlowDesk Completo</h3>
          <p className="mt-1 text-sm text-slate-300">
            Todos os recursos liberados.
          </p>

          <div className="mt-6 space-y-3 text-sm">
            <PriceRow
              label="Plano base"
              value={formatCurrency(BASE_PRICE)}
            />

            <PriceRow
              label="Usuários incluídos"
              value={`${USERS_INCLUDED}`}
            />

            <PriceRow
              label={`Usuários adicionais (${extraUsers})`}
              value={formatCurrency(extraUsersTotal)}
            />

            <PriceRow
              label="Total de usuários"
              value={`${desiredUsers}`}
            />
          </div>

          <div className="my-6 h-px bg-white/10" />

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Valor mensal
            </div>

            <div className="mt-2 break-words text-3xl font-black text-white md:text-4xl">
              {formatCurrency(estimatedTotal)}
            </div>

            <div className="mt-1 text-xs text-emerald-100/60">
              Cobrança mensal conforme quantidade de usuários.
            </div>
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3.5 text-center text-sm font-semibold text-white shadow-[0_12px_30px_rgba(139,92,246,0.35)] transition hover:scale-[1.02] hover:from-fuchsia-500 hover:to-violet-500"
            onClick={() => {
              console.log("[FlowDesk Billing] assinatura selecionada", {
                users: desiredUsers,
                basePrice: BASE_PRICE,
                extraUsers,
                extraUserPrice: EXTRA_USER_PRICE,
                total: estimatedTotal,
              });
            }}
          >
            Continuar para pagamento
          </button>

          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            O checkout do Mercado Pago será conectado a este botão na próxima
            etapa. O valor final deverá ser validado e recalculado no servidor.
          </p>

          <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <StatusRow
              label="Status"
              value={
                companyActive
                  ? billingStatus || "Ativa"
                  : "Inativa"
              }
            />

            <StatusRow
              label="Próxima cobrança"
              value={formatDate(nextBillingDate)}
            />

            <StatusRow
              label="Último pagamento"
              value={formatDate(lastPaymentDate)}
            />

            {currentPrice !== null && (
              <StatusRow
                label="Valor atual cadastrado"
                value={formatCurrency(currentPrice)}
              />
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function HeroPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
      <span className="text-cyan-300">{icon}</span>
      {label}
    </div>
  );
}

function MiniStat({
  icon,
  title,
  value,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium">{title}</span>
      </div>

      <span
        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${toneClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(10,17,32,0.98))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)] transition hover:-translate-y-1 hover:border-purple-500/30">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
        {icon}
      </div>

      <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function PriceInfo({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{description}</div>
    </div>
  );
}

function PriceRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-300">{value}</span>
    </div>
  );
}
