"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  DollarSign,
  Trophy,
  TrendingUp,
  Calendar,
  Medal,
  Target,
  Percent,
  BarChart3,
  Search,
  Wallet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Servico = {
  id: string;
  company_id: string;
  responsavel: string | null;
  valor_comissao: number | null;
  percentual_comissao: number | null;
  valor_orcamento: number | null;
  created_at: string;
  comissao_paga: boolean | null;
  status: string;
  user_id?: string | null;
  cliente?: string | null;
  tipo_servico?: string | null;
  ativo?: boolean | null;
};

type Vendedor = {
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  comissao_percentual?: number | null;
  meta_leads?: number | null;
  meta_vendas?: number | null;
  meta_receita?: number | null;
};

type ServicoCalculado = Servico & {
  percentual_comissao_calculado: number;
  valor_comissao_calculado: number;
};

const formatBRL = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
};

export default function ComissoesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<Servico[]>([]);
  const [periodo, setPeriodo] = useState("Hoje");
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [role, setRole] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroPagamento, setFiltroPagamento] = useState("todos");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

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

    const currentCompanyId = companyUser.company_id;
    setCompanyId(currentCompanyId);
    setRole(companyUser.role);

    if (companyUser.role === "vendedor") {
      setFiltroVendedor(user.id);
    }

    const { data: equipe } = await supabase
      .from("company_users")
      .select(
        "user_id, email, role, status, comissao_percentual, meta_leads, meta_vendas, meta_receita"
      )
      .eq("company_id", currentCompanyId)
      .eq("status", "accepted")
      .order("email", { ascending: true });

    setVendedores((equipe as Vendedor[]) || []);

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", currentCompanyId)
      .eq("status", "concluido")
      .eq("ativo", true);

    if (companyUser.role === "vendedor") {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (!error) setData((data as Servico[]) || []);
    setLoading(false);
  }

  async function marcarComoPaga(id: string) {
    if (!companyId) return;

    await supabase
      .from("servicos")
      .update({ comissao_paga: true })
      .eq("id", id)
      .eq("company_id", companyId);

    fetchData();
  }

  async function marcarComoPendente(id: string) {
    if (!companyId) return;

    await supabase
      .from("servicos")
      .update({ comissao_paga: false })
      .eq("id", id)
      .eq("company_id", companyId);

    fetchData();
  }

  const vendedorMap = useMemo(() => {
    const byUserId = new Map<string, Vendedor>();
    const byEmail = new Map<string, Vendedor>();

    vendedores.forEach((v) => {
      if (v.user_id) byUserId.set(v.user_id, v);
      if (v.email) byEmail.set(v.email.toLowerCase(), v);
    });

    return { byUserId, byEmail };
  }, [vendedores]);

  const dataComComissao = useMemo<ServicoCalculado[]>(() => {
    return data.map((item) => {
      const vendedorPorId =
        item.user_id ? vendedorMap.byUserId.get(item.user_id) : undefined;

      const vendedorPorEmail =
        item.responsavel
          ? vendedorMap.byEmail.get(item.responsavel.toLowerCase())
          : undefined;

      const vendedor = vendedorPorId || vendedorPorEmail;

      const percentualDoServico = Number(item.percentual_comissao || 0);
      const percentualDoVendedor = Number(vendedor?.comissao_percentual || 0);

      const percentualFinal =
        percentualDoServico > 0 ? percentualDoServico : percentualDoVendedor;

      let valorFinal = Number(item.valor_comissao || 0);

      if (valorFinal <= 0 && item.valor_orcamento && percentualFinal > 0) {
        valorFinal = (Number(item.valor_orcamento) * percentualFinal) / 100;
      }

      return {
        ...item,
        percentual_comissao_calculado: percentualFinal,
        valor_comissao_calculado: valorFinal,
      };
    });
  }, [data, vendedorMap]);

  const filtered = useMemo(() => {
    const now = new Date();

    return dataComComissao.filter((item) => {
      const date = new Date(item.created_at);

      if (dataSelecionada) {
        const selected = new Date(dataSelecionada + "T00:00:00");
        const sameDay =
          date.getDate() === selected.getDate() &&
          date.getMonth() === selected.getMonth() &&
          date.getFullYear() === selected.getFullYear();

        if (!sameDay) return false;
      } else {
        if (periodo === "Hoje") {
          const sameDay =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

          if (!sameDay) return false;
        }

        if (periodo === "7 Dias") {
          if (date < new Date(now.getTime() - 7 * 86400000)) return false;
        }

        if (periodo === "30 Dias") {
          if (date < new Date(now.getTime() - 30 * 86400000)) return false;
        }

        if (periodo === "Mês") {
          const sameMonth =
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

          if (!sameMonth) return false;
        }
      }

      if (role !== "vendedor" && filtroVendedor !== "todos") {
        if (item.user_id !== filtroVendedor) return false;
      }

      if (filtroPagamento === "pagas" && !item.comissao_paga) return false;
      if (filtroPagamento === "pendentes" && item.comissao_paga) return false;

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
  }, [
    dataComComissao,
    periodo,
    dataSelecionada,
    filtroVendedor,
    filtroPagamento,
    busca,
    role,
  ]);

  const totalComissao = filtered.reduce(
    (acc, item) => acc + Number(item.valor_comissao_calculado || 0),
    0
  );

  const totalPaga = filtered
    .filter((i) => i.comissao_paga)
    .reduce((acc, item) => acc + Number(item.valor_comissao_calculado || 0), 0);

  const totalPendente = totalComissao - totalPaga;

  const percentualPago =
    totalComissao > 0 ? Math.round((totalPaga / totalComissao) * 100) : 0;

  const percentualMedio =
    filtered.length > 0
      ? filtered.reduce(
          (acc, item) => acc + Number(item.percentual_comissao_calculado || 0),
          0
        ) / filtered.length
      : 0;

  const totalVendasComissionadas = filtered.length;

  const ranking = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        quantidade: number;
        pagas: number;
        pendentes: number;
      }
    > = {};

    filtered.forEach((item) => {
      const nome = item.responsavel || "Sem responsável";

      if (!map[nome]) {
        map[nome] = { total: 0, quantidade: 0, pagas: 0, pendentes: 0 };
      }

      map[nome].total += Number(item.valor_comissao_calculado || 0);
      map[nome].quantidade += 1;

      if (item.comissao_paga) {
        map[nome].pagas += Number(item.valor_comissao_calculado || 0);
      } else {
        map[nome].pendentes += Number(item.valor_comissao_calculado || 0);
      }
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        total: data.total,
        quantidade: data.quantidade,
        pagas: data.pagas,
        pendentes: data.pendentes,
        ticketMedio: data.quantidade > 0 ? data.total / data.quantidade : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const topSeller = ranking[0];

  function limparFiltros() {
    setBusca("");
    setDataSelecionada(null);
    setPeriodo("Hoje");
    setFiltroPagamento("todos");
    setFiltroVendedor(role === "vendedor" ? userId || "todos" : "todos");
  }

  if (loading) {
    return <div className="p-6 text-white">Carregando comissões...</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_35%),linear-gradient(180deg,#081120_0%,#0b1730_45%,#0f172a_100%)] text-white p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-cyan-400">
          Central de Comissões
        </h1>
        <p className="text-white/50">
          Painel financeiro estratégico da equipe comercial
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 md:p-6 shadow-[0_16px_42px_rgba(0,0,0,0.30)] space-y-5">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Search size={18} />
          Filtros de comissão
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

          <select
            value={filtroPagamento}
            onChange={(e) => setFiltroPagamento(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="todos" className="bg-[#0f172a]">
              Todas comissões
            </option>
            <option value="pagas" className="bg-[#0f172a]">
              Pagas
            </option>
            <option value="pendentes" className="bg-[#0f172a]">
              Pendentes
            </option>
          </select>
        </div>

        <div className="flex gap-3 flex-wrap">
          {["Hoje", "7 Dias", "30 Dias", "Mês"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p);
                setDataSelecionada(null);
              }}
              className={`px-4 py-2 rounded-xl text-sm transition ${
                periodo === p && !dataSelecionada
                  ? "bg-cyan-500 text-black font-bold"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={limparFiltros}
            className="px-4 py-2 rounded-xl text-sm bg-red-600 hover:bg-red-700 transition font-semibold"
          >
            Limpar filtros
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Calendar size={18} />
          <input
            type="date"
            value={dataSelecionada || ""}
            onChange={(e) => {
              setDataSelecionada(e.target.value);
              setPeriodo("Personalizado");
            }}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-6">
        <MegaCard
          title="Total Comissão"
          value={totalComissao}
          icon={<Wallet size={18} />}
          subtitle="Comissões no período"
          tone="cyan"
        />
        <MegaCard
          title="Comissão Paga"
          value={totalPaga}
          icon={<CheckCircle2 size={18} />}
          subtitle="Valor já liquidado"
          tone="green"
        />
        <MegaCard
          title="Pendente"
          value={totalPendente}
          icon={<AlertCircle size={18} />}
          subtitle="Aguardando pagamento"
          tone="yellow"
        />
        <MegaCard
          title="% Pago"
          value={`${percentualPago}%`}
          icon={<Target size={18} />}
          subtitle="Percentual quitado"
          tone="purple"
        />
        <MegaCard
          title="% Médio"
          value={`${percentualMedio.toFixed(1)}%`}
          icon={<Percent size={18} />}
          subtitle="Média de comissão"
          tone="blue"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <MiniCard
          title="Vendas comissionadas"
          value={String(totalVendasComissionadas)}
          icon={<BarChart3 size={18} />}
        />
        <MiniCard
          title="Ticket médio comissão"
          value={formatBRL(
            totalVendasComissionadas > 0
              ? totalComissao / totalVendasComissionadas
              : 0
          )}
          icon={<DollarSign size={18} />}
        />
        <MiniCard
          title="Top performer"
          value={topSeller ? topSeller.name : "-"}
          icon={<Trophy size={18} />}
        />
      </div>

      {topSeller && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-cyan-500/10 border border-yellow-400/20 p-6 rounded-3xl">
          <div className="flex items-center gap-3 text-yellow-400">
            <Medal />
            <span className="text-lg font-bold">Melhor Performance</span>
          </div>

          <div className="mt-3 text-2xl font-bold">{topSeller.name}</div>

          <div className="text-cyan-400 font-semibold">
            {formatBRL(topSeller.total)}
          </div>

          <div className="text-sm text-white/60 mt-1">
            {topSeller.quantidade} vendas • Ticket médio{" "}
            {formatBRL(topSeller.ticketMedio)}
          </div>
        </div>
      )}

      <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/10">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Trophy className="text-yellow-400" size={18} />
          Ranking Estratégico
        </h2>

        <div className="space-y-6">
          {ranking.length === 0 ? (
            <div className="text-white/50">Nenhuma comissão encontrada.</div>
          ) : (
            ranking.map((item, index) => {
              const percent =
                totalComissao > 0 ? (item.total / totalComissao) * 100 : 0;

              return (
                <div key={item.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">
                      {index === 0 && "🥇 "}
                      {index === 1 && "🥈 "}
                      {index === 2 && "🥉 "}
                      {item.name}
                    </span>

                    <span className="text-cyan-400 font-bold">
                      {formatBRL(item.total)}
                    </span>
                  </div>

                  <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-3 bg-gradient-to-r from-yellow-400 to-cyan-400"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="text-xs text-white/50 flex flex-wrap gap-4">
                    <span>{item.quantidade} vendas</span>
                    <span>{percent.toFixed(1)}% participação</span>
                    <span>Ticket médio: {formatBRL(item.ticketMedio)}</span>
                    <span>Pagas: {formatBRL(item.pagas)}</span>
                    <span>Pendentes: {formatBRL(item.pendentes)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/10">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <BarChart3 size={18} />
          Detalhamento de Comissões
        </h2>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-white/50">Nenhuma comissão encontrada.</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-white">
                    {item.responsavel || "Sem responsável"}
                  </div>

                  <div className="text-sm text-cyan-400">
                    {item.cliente || "Sem cliente"}{" "}
                    {item.tipo_servico ? `• ${item.tipo_servico}` : ""}
                  </div>

                  <div className="text-xs text-white/50">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </div>

                  <div className="text-xs text-white/60">
                    {item.percentual_comissao_calculado}% de comissão sobre{" "}
                    {formatBRL(item.valor_orcamento || 0)}
                  </div>
                </div>

                <div className="flex flex-col lg:items-end gap-2">
                  <div className="text-lg font-bold text-cyan-400">
                    {formatBRL(item.valor_comissao_calculado || 0)}
                  </div>

                  {item.comissao_paga ? (
                    <>
                      <div className="text-green-400 text-xs font-semibold">
                        Comissão paga
                      </div>

                      <button
                        onClick={() => marcarComoPendente(item.id)}
                        className="text-xs px-3 py-2 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
                      >
                        Voltar para pendente
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => marcarComoPaga(item.id)}
                      className="text-xs px-3 py-2 rounded-lg bg-green-500 text-black font-semibold hover:bg-green-400 transition"
                    >
                      Marcar como paga
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MegaCard({
  title,
  value,
  icon,
  subtitle,
  tone,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle: string;
  tone: "cyan" | "green" | "yellow" | "purple" | "blue";
}) {
  const toneMap = {
    cyan: "text-cyan-400 shadow-cyan-500/10",
    green: "text-green-400 shadow-green-500/10",
    yellow: "text-yellow-400 shadow-yellow-500/10",
    purple: "text-purple-400 shadow-purple-500/10",
    blue: "text-blue-400 shadow-blue-500/10",
  };

  return (
    <div className="bg-gradient-to-br from-[#0f172a] to-[#111827] p-6 rounded-3xl border border-white/10">
      <div className="flex justify-between text-sm text-white/50">
        <span>{title}</span>
        <span className={toneMap[tone]}>{icon}</span>
      </div>

      <div className={`mt-4 text-3xl font-bold ${toneMap[tone]}`}>
        {typeof value === "number" ? formatBRL(value) : value}
      </div>

      <div className="mt-2 text-xs text-white/40">{subtitle}</div>
    </div>
  );
}

function MiniCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between text-sm text-white/50">
        <span>{title}</span>
        <span className="text-cyan-400">{icon}</span>
      </div>
      <div className="mt-3 text-xl font-bold text-white">{value}</div>
    </div>
  );
}