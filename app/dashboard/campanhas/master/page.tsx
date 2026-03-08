"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Building2,
  Megaphone,
  MousePointerClick,
  Search,
  Filter,
  BarChart3,
  Activity,
  CheckCircle2,
  PauseCircle,
  TrendingUp,
  DollarSign,
  Target,
  RefreshCw,
  CalendarDays,
  ShieldAlert,
} from "lucide-react";

type Company = {
  id: string;
  name: string;
};

type Membership = {
  company_id: string;
  role: string;
  status: string;
};

type Campaign = {
  id: string;
  company_id: string;
  name: string;
  source: string | null;
  slug: string;
  target_type: string | null;
  target_value: string | null;
  is_active: boolean;
  created_at: string;
};

type CampaignClick = {
  id: string;
  campaign_id: string;
  created_at?: string | null;
  clicked_at?: string | null;
  timestamp?: string | null;
};

type Servico = {
  id: string;
  company_id: string | null;
  campaign_id: string | null;
  valor: number | string | null;
  valor_orcamento?: number | string | null;
  status: string | null;
  created_at: string | null;
};

type CampaignMetric = {
  id: string;
  company_id: string;
  company_name: string;
  name: string;
  source: string | null;
  slug: string;
  target_type: string | null;
  target_value: string | null;
  is_active: boolean;
  created_at: string;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  conversionRate: number;
};

export default function MasterCampanhasPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clicks, setClicks] = useState<CampaignClick[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  async function carregarTudo(showRefresh = false) {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setAccessDenied(false);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Erro ao buscar usuário:", userError);
        setAccessDenied(true);
        return;
      }

      if (!user) {
        setAccessDenied(true);
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("company_users")
        .select("company_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        console.error("Erro ao buscar vínculo da empresa:", membershipError);
        setAccessDenied(true);
        return;
      }

      if (!membership?.company_id) {
        console.error("Usuário sem vínculo ativo com empresa.");
        setAccessDenied(true);
        return;
      }

      const currentCompanyId = membership.company_id;
      const currentRole = membership.role || "";

      setCompanyId(currentCompanyId);
      setRole(currentRole);

      // Blindagem extra de front:
      // vendedor não deve acessar campanhas
      if (!["owner", "admin"].includes(currentRole)) {
        setAccessDenied(true);
        return;
      }

      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", currentCompanyId)
        .maybeSingle();

      if (companyError) {
        console.error("Erro ao carregar empresa:", companyError);
      }

      setCompany((companyData as Company) || null);

      const { data: campaignsData, error: campaignsError } = await supabase
        .from("campaigns")
        .select(
          "id, company_id, name, source, slug, target_type, target_value, is_active, created_at"
        )
        .eq("company_id", currentCompanyId)
        .order("created_at", { ascending: false });

      if (campaignsError) {
        console.error("Erro campaigns:", campaignsError);
        setCampaigns([]);
        setClicks([]);
        setServicos([]);
        return;
      }

      const safeCampaigns = (campaignsData || []) as Campaign[];
      setCampaigns(safeCampaigns);

      const campaignIds = safeCampaigns.map((item) => item.id);

      const { data: servicosData, error: servicosError } = await supabase
        .from("servicos")
        .select("id, company_id, campaign_id, valor, valor_orcamento, status, created_at")
        .eq("company_id", currentCompanyId);

      if (servicosError) {
        console.error("Erro servicos:", servicosError);
        setServicos([]);
      } else {
        setServicos((servicosData || []) as Servico[]);
      }

      if (campaignIds.length === 0) {
        setClicks([]);
        return;
      }

      const { data: clicksData, error: clicksError } = await supabase
        .from("campaign_clicks")
        .select("id, campaign_id, created_at, clicked_at, timestamp")
        .in("campaign_id", campaignIds);

      if (clicksError) {
        console.error("Erro campaign_clicks:", clicksError);
        setClicks([]);
      } else {
        setClicks((clicksData || []) as CampaignClick[]);
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard de campanhas:", error);
      setAccessDenied(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  }

  function formatPercent(value: number) {
    return `${value.toFixed(1)}%`;
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function normalizeSource(source?: string | null) {
    if (!source || !source.trim()) return "Não informado";
    return source.trim();
  }

  function toNumber(value: number | string | null | undefined) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  function getValorServico(servico: Servico) {
    return toNumber(servico.valor_orcamento ?? servico.valor);
  }

  function getDateFromAny(item: {
    created_at?: string | null;
    clicked_at?: string | null;
    timestamp?: string | null;
  }) {
    return item.created_at || item.clicked_at || item.timestamp || null;
  }

  function isWithinPeriod(dateString: string | null | undefined, period: string) {
    if (period === "all") return true;
    if (!dateString) return false;

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();

    if (period === "today") {
      return date.toDateString() === now.toDateString();
    }

    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (period === "7d") return diffDays <= 7;
    if (period === "30d") return diffDays <= 30;
    if (period === "90d") return diffDays <= 90;

    return true;
  }

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((campaign) => {
      set.add(normalizeSource(campaign.source));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [campaigns]);

  const campaignMetrics = useMemo<CampaignMetric[]>(() => {
    const filteredClicks = clicks.filter((click) =>
      isWithinPeriod(getDateFromAny(click), periodFilter)
    );

    const filteredServicos = servicos.filter((servico) =>
      isWithinPeriod(servico.created_at, periodFilter)
    );

    const clicksByCampaign = new Map<string, number>();
    filteredClicks.forEach((click) => {
      if (!click.campaign_id) return;
      clicksByCampaign.set(
        click.campaign_id,
        (clicksByCampaign.get(click.campaign_id) || 0) + 1
      );
    });

    const leadsByCampaign = new Map<string, number>();
    const salesByCampaign = new Map<string, number>();
    const revenueByCampaign = new Map<string, number>();

    filteredServicos.forEach((servico) => {
      if (!servico.campaign_id) return;

      leadsByCampaign.set(
        servico.campaign_id,
        (leadsByCampaign.get(servico.campaign_id) || 0) + 1
      );

      const isSale = (servico.status || "").toLowerCase() === "concluido";
      if (isSale) {
        salesByCampaign.set(
          servico.campaign_id,
          (salesByCampaign.get(servico.campaign_id) || 0) + 1
        );

        revenueByCampaign.set(
          servico.campaign_id,
          (revenueByCampaign.get(servico.campaign_id) || 0) + getValorServico(servico)
        );
      }
    });

    return campaigns.map((campaign) => {
      const leads = leadsByCampaign.get(campaign.id) || 0;
      const sales = salesByCampaign.get(campaign.id) || 0;
      const revenue = revenueByCampaign.get(campaign.id) || 0;
      const clicksCount = clicksByCampaign.get(campaign.id) || 0;

      return {
        id: campaign.id,
        company_id: campaign.company_id,
        company_name: company?.name || "Sem empresa",
        name: campaign.name,
        source: campaign.source,
        slug: campaign.slug,
        target_type: campaign.target_type,
        target_value: campaign.target_value,
        is_active: campaign.is_active,
        created_at: campaign.created_at,
        clicks: clicksCount,
        leads,
        sales,
        revenue,
        conversionRate: leads > 0 ? (sales / leads) * 100 : 0,
      };
    });
  }, [campaigns, clicks, servicos, company, periodFilter]);

  const filteredCampaigns = useMemo(() => {
    return campaignMetrics.filter((campaign) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && campaign.is_active) ||
        (statusFilter === "inactive" && !campaign.is_active);

      const sourceLabel = normalizeSource(campaign.source);
      const matchesSource =
        sourceFilter === "all" ||
        sourceLabel.toLowerCase() === sourceFilter.toLowerCase();

      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        campaign.name.toLowerCase().includes(term) ||
        campaign.slug.toLowerCase().includes(term) ||
        campaign.company_name.toLowerCase().includes(term) ||
        sourceLabel.toLowerCase().includes(term);

      return matchesStatus && matchesSource && matchesSearch;
    });
  }, [campaignMetrics, statusFilter, sourceFilter, search]);

  const summary = useMemo(() => {
    const totalCampaigns = filteredCampaigns.length;
    const activeCampaigns = filteredCampaigns.filter((c) => c.is_active).length;
    const inactiveCampaigns = filteredCampaigns.filter((c) => !c.is_active).length;
    const totalClicks = filteredCampaigns.reduce((acc, item) => acc + item.clicks, 0);
    const totalLeads = filteredCampaigns.reduce((acc, item) => acc + item.leads, 0);
    const totalSales = filteredCampaigns.reduce((acc, item) => acc + item.sales, 0);
    const totalRevenue = filteredCampaigns.reduce((acc, item) => acc + item.revenue, 0);
    const averageConversion =
      totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;

    return {
      totalCampaigns,
      activeCampaigns,
      inactiveCampaigns,
      totalClicks,
      totalLeads,
      totalSales,
      totalRevenue,
      averageConversion,
    };
  }, [filteredCampaigns]);

  const topCampaign = useMemo(() => {
    if (!filteredCampaigns.length) return null;
    return [...filteredCampaigns].sort((a, b) => b.revenue - a.revenue)[0];
  }, [filteredCampaigns]);

  const mostClickedCampaign = useMemo(() => {
    if (!filteredCampaigns.length) return null;
    return [...filteredCampaigns].sort((a, b) => b.clicks - a.clicks)[0];
  }, [filteredCampaigns]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-6 text-white">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-80 rounded bg-white/10" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-white/5 border border-white/10"
              />
            ))}
          </div>
          <div className="h-32 rounded-2xl bg-white/5 border border-white/10" />
          <div className="h-96 rounded-2xl bg-white/5 border border-white/10" />
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="p-4 md:p-8 text-white">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 md:p-8 max-w-2xl">
          <div className="flex items-center gap-3 text-red-300 mb-3">
            <ShieldAlert size={22} />
            <h1 className="text-xl md:text-2xl font-bold">Acesso não permitido</h1>
          </div>
          <p className="text-sm md:text-base text-red-100/80">
            Você não tem permissão para visualizar o dashboard de campanhas desta área.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 text-white">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300 mb-3">
            <BarChart3 size={14} />
            Painel isolado por empresa
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Dashboard de Campanhas
          </h1>

          <p className="text-sm md:text-base text-gray-400 mt-2 max-w-4xl">
            Acompanhe as campanhas, cliques, leads, vendas e receita da empresa
            logada no FlowDesk 2.0.
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {company?.name && (
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Empresa: {company.name}
              </span>
            )}
            {role && (
              <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                Perfil: {role}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => carregarTudo(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0B1120] px-4 py-3 text-sm font-medium hover:bg-white/5 transition disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Atualizando..." : "Atualizar dados"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-4 md:p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-cyan-400" />
          <h2 className="text-lg font-semibold">Filtros inteligentes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-2">
            <label className="text-sm text-gray-400 mb-2 block">Buscar</label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                placeholder="Nome da campanha, slug ou origem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0F172A] pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
            >
              <option value="all">Todos</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Origem</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0F172A] px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
            >
              <option value="all">Todas as origens</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Período</label>
            <div className="relative">
              <CalendarDays
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0F172A] pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-cyan-500/40"
              >
                <option value="all">Todo período</option>
                <option value="today">Hoje</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4">
        <MetricCard
          title="Campanhas"
          value={formatNumber(summary.totalCampaigns)}
          subtitle="Total após filtros"
          icon={<Megaphone className="text-cyan-400" size={18} />}
        />

        <MetricCard
          title="Ativas"
          value={formatNumber(summary.activeCampaigns)}
          subtitle="Em execução"
          icon={<CheckCircle2 className="text-emerald-400" size={18} />}
        />

        <MetricCard
          title="Inativas"
          value={formatNumber(summary.inactiveCampaigns)}
          subtitle="Pausadas ou encerradas"
          icon={<PauseCircle className="text-yellow-400" size={18} />}
        />

        <MetricCard
          title="Cliques"
          value={formatNumber(summary.totalClicks)}
          subtitle="Interações rastreadas"
          icon={<MousePointerClick className="text-blue-400" size={18} />}
        />

        <MetricCard
          title="Leads"
          value={formatNumber(summary.totalLeads)}
          subtitle="Leads vinculados"
          icon={<Target className="text-fuchsia-400" size={18} />}
        />

        <MetricCard
          title="Vendas"
          value={formatNumber(summary.totalSales)}
          subtitle="Status concluído"
          icon={<TrendingUp className="text-green-400" size={18} />}
        />

        <MetricCard
          title="Receita"
          value={formatCurrency(summary.totalRevenue)}
          subtitle="Total gerado"
          icon={<DollarSign className="text-emerald-400" size={18} />}
        />

        <MetricCard
          title="Empresa"
          value={company?.name || "-"}
          subtitle="Empresa logada"
          icon={<Building2 className="text-purple-400" size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-cyan-400" />
            <h2 className="text-lg font-semibold">Indicadores rápidos</h2>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-gray-400">Conversão média</span>
              <span className="font-semibold text-white">
                {formatPercent(summary.averageConversion)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-gray-400">Receita por venda</span>
              <span className="font-semibold text-white">
                {summary.totalSales > 0
                  ? formatCurrency(summary.totalRevenue / summary.totalSales)
                  : formatCurrency(0)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-gray-400">Leads por campanha</span>
              <span className="font-semibold text-white">
                {summary.totalCampaigns > 0
                  ? (summary.totalLeads / summary.totalCampaigns).toFixed(1)
                  : "0.0"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Cliques por campanha</span>
              <span className="font-semibold text-white">
                {summary.totalCampaigns > 0
                  ? (summary.totalClicks / summary.totalCampaigns).toFixed(1)
                  : "0.0"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={18} className="text-emerald-400" />
            <h2 className="text-lg font-semibold">Campanha destaque em receita</h2>
          </div>

          {topCampaign ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold">{topCampaign.name}</p>
                <p className="text-sm text-gray-400">{topCampaign.company_name}</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Receita: {formatCurrency(topCampaign.revenue)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Vendas: {formatNumber(topCampaign.sales)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                  Leads: {formatNumber(topCampaign.leads)}
                </span>
              </div>

              <p className="text-sm text-gray-400">
                Slug: <span className="text-white">/c/{topCampaign.slug}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Nenhuma campanha disponível com os filtros atuais.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <MousePointerClick size={18} className="text-blue-400" />
            <h2 className="text-lg font-semibold">Campanha destaque em cliques</h2>
          </div>

          {mostClickedCampaign ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold">{mostClickedCampaign.name}</p>
                <p className="text-sm text-gray-400">{mostClickedCampaign.company_name}</p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Cliques: {formatNumber(mostClickedCampaign.clicks)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                  Leads: {formatNumber(mostClickedCampaign.leads)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Conversão: {formatPercent(mostClickedCampaign.conversionRate)}
                </span>
              </div>

              <p className="text-sm text-gray-400">
                Slug: <span className="text-white">/c/{mostClickedCampaign.slug}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Nenhuma campanha disponível com os filtros atuais.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0B1120] shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold">Campanhas da empresa</h2>
            <p className="text-sm text-gray-400">
              Visão detalhada das campanhas com cliques, leads, vendas e receita
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
            <Activity size={14} />
            {filteredCampaigns.length} resultado(s)
          </div>
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
              <Megaphone size={24} className="text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold">Nenhuma campanha encontrada</h3>
            <p className="text-sm text-gray-400 mt-2">
              Ajuste os filtros para visualizar campanhas do período ou origem desejada.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="p-4 md:p-6 hover:bg-white/[0.02] transition"
              >
                <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-5">
                  <div className="space-y-3 2xl:max-w-[45%]">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>

                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border ${
                          campaign.is_active
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-yellow-500/10 text-yellow-300 border-yellow-500/20"
                        }`}
                      >
                        {campaign.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        Empresa: {campaign.company_name}
                      </span>

                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                        Origem: {normalizeSource(campaign.source)}
                      </span>

                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                        Slug: /c/{campaign.slug}
                      </span>

                      <span className="px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                        Criada em: {formatDate(campaign.created_at)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        <span className="text-gray-500">Destino:</span>{" "}
                        <span className="text-white">
                          {campaign.target_type || "Não definido"}
                        </span>
                      </p>
                      <p className="break-all">
                        <span className="text-gray-500">Target:</span>{" "}
                        <span className="text-white">
                          {campaign.target_value || "Não informado"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 2xl:min-w-[760px]">
                    <KpiBox label="Cliques" value={formatNumber(campaign.clicks)} />
                    <KpiBox label="Leads" value={formatNumber(campaign.leads)} />
                    <KpiBox label="Vendas" value={formatNumber(campaign.sales)} />
                    <KpiBox
                      label="Conversão"
                      value={formatPercent(campaign.conversionRate)}
                    />
                    <KpiBox
                      label="Receita"
                      value={formatCurrency(campaign.revenue)}
                    />
                    <KpiBox
                      label="Receita / Venda"
                      value={
                        campaign.sales > 0
                          ? formatCurrency(campaign.revenue / campaign.sales)
                          : formatCurrency(0)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{title}</span>
        {icon}
      </div>
      <h2 className="text-2xl font-bold mt-4 break-words">{value}</h2>
      <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
  );
}

function KpiBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0F172A] p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-base md:text-lg font-bold mt-1 break-words">{value}</p>
    </div>
  );
}