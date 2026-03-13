"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Crown,
  Users,
  BarChart3,
  GraduationCap,
  Check,
  Sparkles,
  ShieldCheck,
  Rocket,
  Target,
  Layers3,
  Plus,
  Minus,
  MessageCircle,
  Megaphone,
} from "lucide-react";

type PlanKey = "free" | "starter" | "growth" | "scale" | "pro";

type PlanConfig = {
  key: PlanKey;
  title: string;
  subtitle: string;
  idealFor: string;
  price: number;
  usersIncluded: number;
  limitLabel: string;
  limitValue: string;
  features: string[];
  recommended?: boolean;
};

const EXTRA_USER_PRICE = 29.9;
const WHATSAPP_ADDON_PRICE = 149.9;
const CAMPAIGNS_ADDON_PRICE = 49.9;

const PLAN_CONFIGS: PlanConfig[] = [
  {
    key: "free",
    title: "Free",
    subtitle: "Para começar",
    idealFor:
      "Ideal para quem quer conhecer o FlowDesk e iniciar a organização comercial.",
    price: 0,
    usersIncluded: 1,
    limitLabel: "Recursos iniciais",
    limitValue: "5 serviços",
    features: [
      "CRM básico",
      "Pipeline simples",
      "Dashboard básico",
      "Gestão inicial de leads",
    ],
  },
  {
    key: "starter",
    title: "Starter",
    subtitle: "Para estruturar a operação",
    idealFor:
      "Ideal para pequenos negócios que querem sair do improviso e vender com mais organização.",
    price: 69.9,
    usersIncluded: 1,
    limitLabel: "Recursos",
    limitValue: "Ilimitados",
    features: [
      "CRM completo",
      "Pipeline avançado",
      "Orçamentos ilimitados",
      "Exportação em PDF",
    ],
  },
  {
    key: "growth",
    title: "Growth",
    subtitle: "Para crescer com controle",
    idealFor:
      "Ideal para empresas com operação comercial ativa e necessidade de acompanhar equipe e resultados.",
    price: 149.9,
    usersIncluded: 3,
    limitLabel: "Gestão",
    limitValue: "Mais profundidade",
    features: [
      "Gestão de equipe",
      "Controle de leads",
      "Métricas de vendas",
      "Comissões",
    ],
  },
  {
    key: "scale",
    title: "Scale",
    subtitle: "Para operação mais forte",
    idealFor:
      "Ideal para equipes maiores que precisam de visão gerencial, produtividade e acompanhamento avançado.",
    price: 239.9,
    usersIncluded: 5,
    limitLabel: "Estrutura",
    limitValue: "Mais performance",
    features: [
      "Equipe completa",
      "Ranking de vendedores",
      "Dashboard avançado",
      "Suporte prioritário",
    ],
  },
  {
    key: "pro",
    title: "Pro",
    subtitle: "Para gestão avançada",
    idealFor:
      "Ideal para empresas que querem uma operação comercial premium, mais inteligência e acompanhamento estratégico.",
    price: 449.9,
    usersIncluded: 10,
    limitLabel: "Operação",
    limitValue: "Mais inteligência",
    features: [
      "Alertas estratégicos",
      "Analytics avançado",
      "Recursos premium de gestão",
      "FlowDesk Academy",
    ],
    recommended: true,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatCompactCurrency(value: number) {
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return `R$ ${formatted}`;
}

export default function BillingPage() {
  const supabase = createClient();

  const [plan, setPlan] = useState<PlanKey>("free");
  const [loading, setLoading] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("starter");
  const [desiredUsers, setDesiredUsers] = useState(1);
  const [includeWhatsapp, setIncludeWhatsapp] = useState(false);
  const [includeCampaigns, setIncludeCampaigns] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      if (data?.plan) {
        const currentPlan = data.plan as PlanKey;
        setPlan(currentPlan);
        setSelectedPlan(currentPlan);
      }

      setLoading(false);
    }

    loadPlan();
  }, [supabase]);

  const activePlan = useMemo(() => {
    return (
      PLAN_CONFIGS.find((item) => item.key === selectedPlan) || PLAN_CONFIGS[1]
    );
  }, [selectedPlan]);

  useEffect(() => {
    setDesiredUsers((prev) => Math.max(prev, activePlan.usersIncluded));
  }, [activePlan.usersIncluded]);

  const extraUsers = Math.max(0, desiredUsers - activePlan.usersIncluded);
  const extraUsersTotal = extraUsers * EXTRA_USER_PRICE;
  const addonsTotal =
    (includeWhatsapp ? WHATSAPP_ADDON_PRICE : 0) +
    (includeCampaigns ? CAMPAIGNS_ADDON_PRICE : 0);
  const estimatedTotal = activePlan.price + extraUsersTotal + addonsTotal;

  function gerarWhatsapp(planoNome: string, preco: string) {
    const texto = `Olá! Quero contratar o plano ${planoNome} do FlowDesk.

Plano: ${planoNome}
Valor base: R$ ${preco}/mês
Usuários desejados: ${desiredUsers}
Usuários extras: ${extraUsers}
Atendimento / WhatsApp: ${includeWhatsapp ? "Sim" : "Não"}
Campanhas: ${includeCampaigns ? "Sim" : "Não"}
Valor estimado: ${formatCurrency(estimatedTotal)}

Observação:
- Módulo de WhatsApp com API e consumo por conta do cliente.

Gostaria de ativar para minha empresa.`;

    return `https://wa.me/5562994693465?text=${encodeURIComponent(texto)}`;
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-white">
        Carregando plano...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-16 p-6 text-white md:p-10">
      <section className="overflow-hidden rounded-[32px] border border-cyan-500/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_24%),linear-gradient(135deg,rgba(7,15,34,0.98),rgba(15,23,42,0.98))] px-6 py-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_60px_rgba(0,0,0,0.35)] md:px-8 md:py-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
              <Crown className="h-4 w-4" />
              Planos FlowDesk
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
              Monte o plano ideal para sua operação comercial
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
              Escolha a base ideal para sua empresa, defina a quantidade de
              usuários e adicione módulos opcionais conforme sua necessidade.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <HeroPill
                icon={<BarChart3 className="h-4 w-4" />}
                label="Inteligência comercial"
              />
              <HeroPill
                icon={<Users className="h-4 w-4" />}
                label="Equipe e produtividade"
              />
              <HeroPill
                icon={<Layers3 className="h-4 w-4" />}
                label="Operação organizada"
              />
              <HeroPill
                icon={<Sparkles className="h-4 w-4" />}
                label="Plano flexível"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <MiniStat
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Mais controle"
              value="Tudo centralizado"
              tone="cyan"
            />
            <MiniStat
              icon={<Rocket className="h-4 w-4" />}
              title="Mais crescimento"
              value="Estrutura para escalar"
              tone="violet"
            />
            <MiniStat
              icon={<Target className="h-4 w-4" />}
              title="Mais performance"
              value="Operação mais eficiente"
              tone="emerald"
            />
            <MiniStat
              icon={<GraduationCap className="h-4 w-4" />}
              title="Mais apoio"
              value="Implantação estratégica"
              tone="amber"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Feature
          icon={<BarChart3 className="h-5 w-5" />}
          title="Inteligência Comercial"
          desc="Acompanhe métricas, conversão, desempenho e a evolução real da operação."
        />

        <Feature
          icon={<Users className="h-5 w-5" />}
          title="Gestão de Equipe"
          desc="Controle usuários, acompanhe produtividade e organize melhor o trabalho comercial."
        />

        <Feature
          icon={<Layers3 className="h-5 w-5" />}
          title="Operação Organizada"
          desc="Centralize pipeline, orçamentos, follow-up, clientes e atendimento em um só lugar."
        />

        <Feature
          icon={<GraduationCap className="h-5 w-5" />}
          title="FlowDesk Academy"
          desc="Apoio estratégico para implantação, uso e crescimento da operação."
        />
      </section>

      <section className="space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Planos pensados para cada fase do seu negócio
          </h2>
          <p className="mt-2 text-sm text-slate-400 md:text-base">
            Comece com o essencial e evolua para uma gestão mais estratégica,
            produtiva e profissional.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-5">
          {PLAN_CONFIGS.map((item) => (
            <Card
              key={item.key}
              title={item.title}
              subtitle={item.subtitle}
              idealFor={item.idealFor}
              price={item.price}
              usersIncluded={item.usersIncluded}
              limitLabel={item.limitLabel}
              limitValue={item.limitValue}
              features={item.features}
              recommended={item.recommended}
              current={plan === item.key}
              activeForBuilder={selectedPlan === item.key}
              onSelectBuilder={() => setSelectedPlan(item.key)}
              link={gerarWhatsapp(
                item.title,
                item.price.toFixed(2).replace(".", ",")
              )}
            />
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(9,14,28,0.98))] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)] md:p-8">
        <div className="mb-8 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            <Sparkles className="h-4 w-4" />
            Simulador de plano
          </div>

          <h3 className="text-2xl font-bold text-white md:text-3xl">
            Monte seu plano do jeito que sua empresa precisa
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-slate-400 md:text-base">
            Escolha o plano base, defina a quantidade de usuários e adicione
            módulos opcionais como Atendimento / WhatsApp e Campanhas.
          </p>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold text-white">
                1. Escolha o plano base
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {PLAN_CONFIGS.map((item) => {
                  const active = selectedPlan === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedPlan(item.key)}
                      className={[
                        "flex min-h-[156px] min-w-0 flex-col justify-between rounded-2xl border px-4 py-4 text-left transition",
                        active
                          ? "border-cyan-500/30 bg-cyan-500/10 shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
                          : "border-white/10 bg-[rgba(255,255,255,0.03)] hover:bg-white/10",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-base font-bold text-white">
                          {item.title}
                        </div>

                        <div className="mt-1 min-h-[38px] text-xs leading-relaxed text-slate-400">
                          {item.subtitle}
                        </div>
                      </div>

                      <div className="mt-4 min-w-0">
                        <div className="text-xl font-black leading-none tracking-tight text-white sm:text-2xl">
                          {formatCompactCurrency(item.price)}
                        </div>
                        <div className="mt-1 text-xs font-medium text-slate-400">
                          /mês
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold text-white">
                2. Quantos usuários sua empresa precisa?
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-slate-400">
                    Plano{" "}
                    <span className="font-semibold text-white">
                      {activePlan.title}
                    </span>{" "}
                    inclui{" "}
                    <span className="font-semibold text-cyan-300">
                      {activePlan.usersIncluded}
                    </span>{" "}
                    usuário{activePlan.usersIncluded > 1 ? "s" : ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Usuário extra: {formatCurrency(EXTRA_USER_PRICE)} / mês
                  </div>
                </div>

                <div className="inline-flex items-center rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDesiredUsers((prev) =>
                        Math.max(activePlan.usersIncluded, prev - 1)
                      )
                    }
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <div className="min-w-[120px] px-4 text-center">
                    <div className="text-2xl font-black text-white">
                      {desiredUsers}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      usuários
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDesiredUsers((prev) => prev + 1)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
              <div className="mb-4 text-sm font-semibold text-white">
                3. Adicionais opcionais
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <AddonCard
                  active={includeWhatsapp}
                  onToggle={() => setIncludeWhatsapp((prev) => !prev)}
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="Atendimento / WhatsApp"
                  description="Módulo opcional para empresas que precisam de operação de atendimento integrada. A API oficial e os custos de consumo são por conta do cliente."
                  price={formatCurrency(WHATSAPP_ADDON_PRICE)}
                  note="API e consumo não inclusos"
                />

                <AddonCard
                  active={includeCampaigns}
                  onToggle={() => setIncludeCampaigns((prev) => !prev)}
                  icon={<Megaphone className="h-5 w-5" />}
                  title="Campanhas"
                  description="Módulo opcional para empresas que querem controlar campanhas, origem de leads e performance comercial."
                  price={formatCurrency(CAMPAIGNS_ADDON_PRICE)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-purple-500/30 bg-[linear-gradient(180deg,rgba(88,28,135,0.28),rgba(30,41,59,0.98))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
            <div className="mb-4 inline-flex rounded-xl bg-purple-600 px-3 py-1 text-xs font-semibold text-white">
              Resumo estimado
            </div>

            <h4 className="text-2xl font-bold text-white">{activePlan.title}</h4>
            <p className="mt-1 text-sm text-slate-300">{activePlan.subtitle}</p>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <PriceRow
                label={`Plano base (${activePlan.title})`}
                value={formatCurrency(activePlan.price)}
              />
              <PriceRow
                label="Usuários incluídos"
                value={`${activePlan.usersIncluded}`}
              />
              <PriceRow
                label={`Usuários extras (${extraUsers})`}
                value={formatCurrency(extraUsersTotal)}
              />
              <PriceRow
                label="Atendimento / WhatsApp"
                value={
                  includeWhatsapp
                    ? formatCurrency(WHATSAPP_ADDON_PRICE)
                    : "Não adicionado"
                }
              />
              <PriceRow
                label="Campanhas"
                value={
                  includeCampaigns
                    ? formatCurrency(CAMPAIGNS_ADDON_PRICE)
                    : "Não adicionado"
                }
              />
            </div>

            {includeWhatsapp && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                O módulo de WhatsApp não inclui custos de API. A conta, a API
                oficial e o consumo ficam por conta do cliente.
              </div>
            )}

            <div className="my-6 h-px bg-white/10" />

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                Valor mensal estimado
              </div>
              <div className="mt-2 break-words text-3xl font-black text-white md:text-4xl">
                {formatCurrency(estimatedTotal)}
              </div>
            </div>

            <a
              href={gerarWhatsapp(
                activePlan.title,
                activePlan.price.toFixed(2).replace(".", ",")
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_30px_rgba(139,92,246,0.35)] transition hover:scale-[1.02] hover:from-fuchsia-500 hover:to-violet-500"
            >
              Solicitar este plano
            </a>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              O valor estimado pode variar conforme a configuração final da sua
              operação e módulos adicionais contratados.
            </p>
          </div>
        </div>
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

function Card({
  title,
  subtitle,
  idealFor,
  price,
  usersIncluded,
  limitLabel,
  limitValue,
  features,
  recommended,
  current,
  activeForBuilder,
  onSelectBuilder,
  link,
}: {
  title: string;
  subtitle: string;
  idealFor: string;
  price: number;
  usersIncluded: number;
  limitLabel: string;
  limitValue: string;
  features: string[];
  recommended?: boolean;
  current?: boolean;
  activeForBuilder?: boolean;
  onSelectBuilder?: () => void;
  link: string;
}) {
  return (
    <div
      className={[
        "relative flex min-w-0 flex-col rounded-[28px] border p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition hover:-translate-y-1",
        recommended
          ? "border-purple-500 bg-[linear-gradient(180deg,rgba(88,28,135,0.35),rgba(30,41,59,0.98))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(9,14,28,0.98))]",
      ].join(" ")}
    >
      {recommended && (
        <div className="mb-4 inline-flex w-fit rounded-xl bg-purple-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
          Mais escolhido
        </div>
      )}

      <div className="mb-3 min-w-0">
        <h2 className="truncate text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="mb-5 min-w-0">
        <div className="flex flex-wrap items-end gap-x-1 gap-y-1">
          <span className="break-words text-3xl font-black tracking-tight text-white xl:text-[2rem]">
            {formatCurrency(price)}
          </span>
          <span className="text-sm font-medium text-slate-400">/mês</span>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
          Para quem é
        </div>
        <p className="text-sm leading-relaxed text-slate-300">{idealFor}</p>
      </div>

      <div className="mb-6 space-y-3 text-sm text-slate-300">
        <InfoRow
          text={`${usersIncluded} usuário${usersIncluded > 1 ? "s" : ""} incluído${
            usersIncluded > 1 ? "s" : ""
          }`}
        />
        <InfoRow text={`${limitLabel}: ${limitValue}`} />

        <div className="my-4 h-px bg-white/10" />

        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          O que este plano oferece
        </div>

        {features.map((feature, index) => (
          <InfoRow key={index} text={feature} check />
        ))}
      </div>

      <div className="mt-auto space-y-3">
        {onSelectBuilder && (
          <button
            type="button"
            onClick={onSelectBuilder}
            className={[
              "w-full rounded-2xl border py-3 text-sm font-semibold transition",
              activeForBuilder
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                : "border-white/10 bg-white/5 text-white hover:bg-white/10",
            ].join(" ")}
          >
            {activeForBuilder ? "Selecionado no simulador" : "Usar no simulador"}
          </button>
        )}

        {current ? (
          <button
            type="button"
            className="w-full rounded-2xl border border-white/10 bg-white/10 py-3 text-sm font-semibold text-white opacity-80"
          >
            Plano atual
          </button>
        ) : (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_30px_rgba(139,92,246,0.35)] transition hover:scale-[1.02] hover:from-fuchsia-500 hover:to-violet-500"
          >
            Quero este plano
          </a>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  text,
  check,
}: {
  text: string;
  check?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          check
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-white/5 text-slate-400"
        }`}
      >
        {check ? <Check className="h-3.5 w-3.5" /> : "•"}
      </span>
      <span className="leading-relaxed">{text}</span>
    </div>
  );
}

function AddonCard({
  active,
  onToggle,
  icon,
  title,
  description,
  price,
  note,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  price: string;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "w-full rounded-[24px] border p-4 text-left transition",
        active
          ? "border-cyan-500/30 bg-cyan-500/10"
          : "border-white/10 bg-[rgba(255,255,255,0.03)] hover:bg-white/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-300">
            {icon}
          </div>
          <div className="text-base font-semibold text-white">{title}</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            {description}
          </p>
          {note && (
            <div className="mt-3 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
              {note}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-white">{price}</div>
          <div className="text-xs text-slate-500">/mês</div>
          <div
            className={[
              "mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
              active
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/5 text-slate-300",
            ].join(" ")}
          >
            {active ? "Adicionado" : "Opcional"}
          </div>
        </div>
      </div>
    </button>
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