"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Users,
  DollarSign,
  TrendingUp,
  Crown,
  Target,
  Search,
  BadgeDollarSign,
  BarChart3,
  Medal,
} from "lucide-react";

type Servico = {
  id: string;
  responsavel: string | null;
  valor_orcamento: number | null;
  valor_comissao: number | null;
  percentual_comissao: number | null;
  status: string;
  created_at: string;
  ativo: boolean;
  user_id?: string | null;
  company_id?: string | null;
  cliente?: string | null;
  tipo_servico?: string | null;
  custo?: number | null;
};

type Vendedor = {
  user_id: string | null;
  email: string;
  role: string;
  status: string;
};

const formatBRL = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export default function EquipePage() {
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<Servico[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState("Hoje");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(true);

  const [role, setRole] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const user = userData.user;
    setUserId(user.id);

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .single();

    if (!companyUser) {
      setLoading(false);
      return;
    }

    const companyId = companyUser.company_id;
    setCompanyId(companyId);
    setRole(companyUser.role);

    if (companyUser.role === "vendedor") {
      setFiltroVendedor(user.id);
    }

    const { data: equipe } = await supabase
      .from("company_users")
      .select("user_id, email, role, status")
      .eq("company_id", companyId)
      .eq("status", "accepted")
      .order("email", { ascending: true });

    setVendedores((equipe as Vendedor[]) || []);

    let query = supabase
      .from("servicos")
      .select(`
        id,
        responsavel,
        valor_orcamento,
        valor_comissao,
        percentual_comissao,
        status,
        created_at,
        ativo,
        user_id,
        company_id,
        cliente,
        tipo_servico,
        custo
      `)
      .eq("company_id", companyId)
      .eq("status", "concluido")
      .eq("ativo", true);

    if (companyUser.role === "vendedor") {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (!error) setData((data as Servico[]) || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const now = new Date();

    return data.filter((item) => {
      const d = new Date(item.created_at);

      if (periodo === "Hoje") {
        const inicio = new Date();
        inicio.setHours(0, 0, 0, 0);

        const fim = new Date();
        fim.setHours(23, 59, 59, 999);

        if (!(d >= inicio && d <= fim)) return false;
      }

      if (periodo === "7 Dias") {
        const past = new Date();
        past.setDate(now.getDate() - 7);
        if (d < past) return false;
      }

      if (periodo === "30 Dias") {
        const past = new Date();
        past.setDate(now.getDate() - 30);
        if (d < past) return false;
      }

      if (periodo === "Mês") {
        const sameMonth =
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear();

        if (!sameMonth) return false;
      }

      if (periodo === "manual" && dataInicio && dataFim) {
        const inicio = new Date(dataInicio + "T00:00:00");
        const fim = new Date(dataFim + "T23:59:59");
        if (!(d >= inicio && d <= fim)) return false;
      }

      if (role !== "vendedor" && filtroVendedor !== "todos") {
        if (item.user_id !== filtroVendedor) return false;
      }

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const bate =
          (item.responsavel || "").toLowerCase().includes(termo) ||
          (item.cliente || "").toLowerCase().includes(termo) ||
          (item.tipo_servico || "").toLowerCase().includes(termo);

        if (!bate) return false;
      }

      return true;
    });
  }, [data, periodo, dataInicio, dataFim, filtroVendedor, busca, role]);

  const equipeStats = useMemo(() => {
    const map: Record<
      string,
      {
        vendas: number;
        faturamento: number;
        comissao: number;
        custo: number;
      }
    > = {};

    filtered.forEach((item) => {
      const nome = item.responsavel?.trim() || "Não definido";

      if (!map[nome]) {
        map[nome] = {
          vendas: 0,
          faturamento: 0,
          comissao: 0,
          custo: 0,
        };
      }

      map[nome].vendas++;
      map[nome].faturamento += Number(item.valor_orcamento) || 0;
      map[nome].custo += Number(item.custo) || 0;

      let valorComissao = item.valor_comissao;

      if (!valorComissao && item.valor_orcamento && item.percentual_comissao) {
        valorComissao =
          (item.valor_orcamento * item.percentual_comissao) / 100;
      }

      map[nome].comissao += Number(valorComissao || 0);
    });

    return Object.entries(map)
      .map(([nome, stats]) => ({
        nome,
        ...stats,
        ticketMedio: stats.vendas > 0 ? stats.faturamento / stats.vendas : 0,
        lucro:
          stats.faturamento - stats.custo - stats.comissao,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [filtered]);

  const totalFaturamento = equipeStats.reduce(
    (acc, item) => acc + item.faturamento,
    0
  );

  const totalComissao = equipeStats.reduce(
    (acc, item) => acc + item.comissao,
    0
  );

  const totalVendas = equipeStats.reduce(
    (acc, item) => acc + item.vendas,
    0
  );

  const ticketMedioGeral =
    totalVendas > 0 ? totalFaturamento / totalVendas : 0;

  const melhor = equipeStats[0];

  if (loading) {
    return <div className="p-6 text-white">Carregando equipe...</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_35%),linear-gradient(180deg,#081120_0%,#0b1730_45%,#0f172a_100%)] text-white p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-cyan-400 flex items-center gap-3">
          <Users />
          Central da Equipe
        </h1>
        <p className="text-white/40">
          Ranking estratégico e inteligência comercial por vendedor
        </p>
      </div>

      {/* FILTROS */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 md:p-6 shadow-[0_16px_42px_rgba(0,0,0,0.30)] space-y-5">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Search size={18} />
          Filtros da equipe
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 flex items-center bg-white/10 border border-white/20 px-4 py-3 rounded-2xl">
            <Search size={18} className="text-blue-200" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por responsável, cliente ou serviço..."
              className="bg-transparent outline-none ml-3 w-full text-white placeholder:text-white/40"
            />
          </div>

          <select
            value={role === "vendedor" ? userId || "todos" : filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            disabled={role === "vendedor"}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white disabled:opacity-60"
          >
            {role !== "vendedor" && (
              <option value="todos" className="bg-[#0f172a]">
                Todos vendedores
              </option>
            )}

            {vendedores
              .filter((v) => ["vendedor", "admin", "owner"].includes(v.role))
              .map((v) => (
                <option
                  key={v.user_id || v.email}
                  value={v.user_id || ""}
                  className="bg-[#0f172a]"
                >
                  {v.email}
                </option>
              ))}
          </select>

          <button
            onClick={() => {
              setBusca("");
              setDataInicio("");
              setDataFim("");
              setPeriodo("Hoje");
              setFiltroVendedor(role === "vendedor" ? userId || "todos" : "todos");
            }}
            className="p-3 rounded-2xl bg-red-600 hover:bg-red-700 transition font-semibold"
          >
            Limpar filtros
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {[
            ["Hoje", "Hoje"],
            ["7 Dias", "7 dias"],
            ["30 Dias", "30 dias"],
            ["Mês", "Mês"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => {
                setPeriodo(v);
                setDataInicio("");
                setDataFim("");
              }}
              className={`px-4 py-2 rounded-xl transition ${
                periodo === v
                  ? "bg-cyan-600 shadow-lg shadow-cyan-600/30"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {l}
            </button>
          ))}

          <button
            onClick={() => {
              setPeriodo("manual");
            }}
            className={`px-4 py-2 rounded-xl transition ${
              periodo === "manual"
                ? "bg-cyan-600 shadow-lg shadow-cyan-600/30"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            Personalizado
          </button>
        </div>

        {periodo === "manual" && (
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
            />
          </div>
        )}
      </div>

      {/* RESUMO */}
      <div className="grid md:grid-cols-4 gap-6">
        <StatCard
          icon={<DollarSign />}
          title="Faturamento"
          value={formatBRL(totalFaturamento)}
          subtitle="Total vendido pela equipe"
          color="text-cyan-400"
        />

        <StatCard
          icon={<BadgeDollarSign />}
          title="Comissão Total"
          value={formatBRL(totalComissao)}
          subtitle="Comissão acumulada"
          color="text-purple-400"
        />

        <StatCard
          icon={<Target />}
          title="Vendedores Ativos"
          value={String(equipeStats.length)}
          subtitle="Participando do ranking"
          color="text-emerald-400"
        />

        <StatCard
          icon={<TrendingUp />}
          title="Ticket Médio"
          value={formatBRL(ticketMedioGeral)}
          subtitle="Média geral da equipe"
          color="text-yellow-400"
        />
      </div>

      {/* DESTAQUE */}
      {melhor && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-cyan-500/10 border border-yellow-400/20 p-6 rounded-3xl">
          <div className="flex items-center gap-3 text-yellow-400">
            <Medal />
            <span className="text-lg font-bold">Destaque da Equipe</span>
          </div>

          <div className="mt-3 text-2xl font-bold">{melhor.nome}</div>

          <div className="text-cyan-400 font-semibold">
            {formatBRL(melhor.faturamento)}
          </div>

          <div className="text-sm text-white/60 mt-1">
            {melhor.vendas} vendas • Ticket médio {formatBRL(melhor.ticketMedio)}
          </div>
        </div>
      )}

      {/* RANKING */}
      <div className="space-y-4">
        {equipeStats.length === 0 ? (
          <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/10 text-white/50">
            Nenhum dado encontrado para o período selecionado.
          </div>
        ) : (
          equipeStats.map((item, index) => {
            const porcentagem =
              totalFaturamento > 0
                ? (item.faturamento / totalFaturamento) * 100
                : 0;

            return (
              <div
                key={item.nome}
                className="bg-[#0f172a] p-6 rounded-2xl border border-white/10"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex items-center gap-3 text-lg font-semibold">
                    {index === 0 && <Crown className="text-yellow-400" />}
                    {item.nome}
                  </div>

                  <div className="text-cyan-400 font-bold text-lg">
                    {formatBRL(item.faturamento)}
                  </div>
                </div>

                <div className="w-full bg-white/10 h-2 rounded-full mt-4 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-2 rounded-full"
                    style={{ width: `${porcentagem}%` }}
                  />
                </div>

                <div className="grid md:grid-cols-5 gap-3 text-sm text-white/60 mt-4">
                  <span>Vendas: {item.vendas}</span>
                  <span>Ticket: {formatBRL(item.ticketMedio)}</span>
                  <span>Comissão: {formatBRL(item.comissao)}</span>
                  <span>Lucro: {formatBRL(item.lucro)}</span>
                  <span>{porcentagem.toFixed(1)}% participação</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="bg-gradient-to-br from-[#0f172a] to-[#111827] p-6 rounded-2xl border border-white/10">
      <div className="flex justify-between text-white/50">
        <span>{title}</span>
        <span className={color}>{icon}</span>
      </div>

      <div className={`text-3xl font-bold mt-3 ${color}`}>{value}</div>
      <div className="text-xs text-white/40 mt-2">{subtitle}</div>
    </div>
  );
}