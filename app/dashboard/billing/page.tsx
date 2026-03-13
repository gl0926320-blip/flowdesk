"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Crown,
  Users,
  Building2,
  BarChart3,
  GraduationCap,
  Check,
  Sparkles,
  ShieldCheck,
  Rocket,
} from "lucide-react";

type PlanKey = "free" | "starter" | "growth" | "scale" | "pro";

export default function BillingPage() {
  const supabase = createClient();

  const [plan, setPlan] = useState<PlanKey>("free");
  const [loading, setLoading] = useState(true);

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
        setPlan(data.plan as PlanKey);
      }

      setLoading(false);
    }

    loadPlan();
  }, [supabase]);

  function gerarWhatsapp(plano: string, preco: string) {
    const texto = `Olá! Quero contratar o plano ${plano} do FlowDesk.

Plano: ${plano}
Valor: R$ ${preco}/mês

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
    <div className="mx-auto max-w-7xl space-y-14 p-6 text-white md:p-10">
      <section className="overflow-hidden rounded-[32px] border border-cyan-500/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_24%),linear-gradient(135deg,rgba(7,15,34,0.98),rgba(15,23,42,0.98))] px-6 py-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_60px_rgba(0,0,0,0.35)] md:px-8 md:py-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300">
              <Crown className="h-4 w-4" />
              Planos FlowDesk
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
              Escolha o plano ideal para acelerar sua operação comercial
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
              O FlowDesk foi criado para organizar vendas, atendimento,
              orçamentos, equipe, campanhas e gestão comercial em um único
              sistema premium.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <HeroPill icon={<BarChart3 className="h-4 w-4" />} label="Inteligência comercial" />
              <HeroPill icon={<Users className="h-4 w-4" />} label="Equipe e performance" />
              <HeroPill icon={<Building2 className="h-4 w-4" />} label="Multiempresa" />
              <HeroPill icon={<Sparkles className="h-4 w-4" />} label="Operação mais profissional" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <MiniStat
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Gestão centralizada"
              value="Mais controle"
              tone="cyan"
            />
            <MiniStat
              icon={<Rocket className="h-4 w-4" />}
              title="Escalabilidade"
              value="Cresça com estrutura"
              tone="violet"
            />
            <MiniStat
              icon={<Users className="h-4 w-4" />}
              title="Equipe"
              value="Mais organização"
              tone="emerald"
            />
            <MiniStat
              icon={<GraduationCap className="h-4 w-4" />}
              title="Implantação"
              value="Apoio estratégico"
              tone="amber"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Feature
          icon={<BarChart3 className="h-5 w-5" />}
          title="Inteligência Comercial"
          desc="Métricas de conversão, faturamento, desempenho e visão gerencial da operação."
        />

        <Feature
          icon={<Users className="h-5 w-5" />}
          title="Gestão de Equipe"
          desc="Controle vendedores, acompanhe produtividade e evolua sua performance comercial."
        />

        <Feature
          icon={<Building2 className="h-5 w-5" />}
          title="Multiempresa"
          desc="Gerencie múltiplas empresas com mais organização e visão centralizada."
        />

        <Feature
          icon={<GraduationCap className="h-5 w-5" />}
          title="FlowDesk Academy"
          desc="Treinamento estratégico para implantação, uso do CRM e crescimento da operação."
        />
      </section>

      <section className="space-y-5">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Planos pensados para cada fase do negócio
          </h2>
          <p className="mt-2 text-sm text-slate-400 md:text-base">
            Comece no essencial e evolua para uma operação comercial mais forte,
            organizada e escalável.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          <Card
            title="Free"
            subtitle="Para começar"
            price="0"
            users="1 usuário"
            empresas="1 empresa"
            servicos="5 serviços"
            features={[
              "CRM básico",
              "Pipeline simples",
              "Dashboard básico",
            ]}
            current={plan === "free"}
            link={gerarWhatsapp("Free", "0")}
          />

          <Card
            title="Starter"
            subtitle="Para estruturar a operação"
            price="69,90"
            users="1 usuário"
            empresas="1 empresa"
            servicos="Ilimitado"
            features={[
              "CRM completo",
              "Pipeline avançado",
              "Orçamentos ilimitados",
              "Exportação em PDF",
            ]}
            current={plan === "starter"}
            link={gerarWhatsapp("Starter", "69,90")}
          />

          <Card
            title="Growth"
            subtitle="Para equipes em crescimento"
            price="149,90"
            users="3 usuários"
            empresas="2 empresas"
            servicos="Ilimitado"
            features={[
              "Gestão de equipe",
              "Controle de leads",
              "Métricas de vendas",
              "Comissões",
            ]}
            current={plan === "growth"}
            link={gerarWhatsapp("Growth", "149,90")}
          />

          <Card
            title="Scale"
            subtitle="Para operação mais forte"
            price="239,90"
            users="5 usuários"
            empresas="3 empresas"
            servicos="Ilimitado"
            features={[
              "Equipe completa",
              "Ranking de vendedores",
              "Dashboard avançado",
              "Suporte prioritário",
            ]}
            current={plan === "scale"}
            link={gerarWhatsapp("Scale", "239,90")}
          />

          <Card
            title="Pro"
            subtitle="Para gestão avançada"
            price="449,90"
            users="10 usuários"
            empresas="5 empresas"
            servicos="Ilimitado"
            features={[
              "Multiempresa avançado",
              "Alertas estratégicos",
              "Analytics avançado",
              "FlowDesk Academy",
            ]}
            recommended
            current={plan === "pro"}
            link={gerarWhatsapp("Pro", "449,90")}
          />
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
  price,
  users,
  empresas,
  servicos,
  features,
  recommended,
  current,
  link,
}: {
  title: string;
  subtitle: string;
  price: string;
  users: string;
  empresas: string;
  servicos: string;
  features: string[];
  recommended?: boolean;
  current?: boolean;
  link: string;
}) {
  return (
    <div
      className={[
        "relative flex h-full flex-col rounded-[28px] border p-6 shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition",
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

      <div className="mb-3">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="mb-5">
        <p className="flex items-end gap-1 text-4xl font-black tracking-tight text-white">
          <span>R$ {price}</span>
          <span className="mb-1 text-sm font-medium text-slate-400">/mês</span>
        </p>
      </div>

      <div className="mb-6 space-y-3 text-sm text-slate-300">
        <InfoRow text={users} />
        <InfoRow text={empresas} />
        <InfoRow text={servicos} />

        <div className="my-4 h-px bg-white/10" />

        {features.map((feature, index) => (
          <InfoRow key={index} text={feature} check />
        ))}
      </div>

      <div className="mt-auto">
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