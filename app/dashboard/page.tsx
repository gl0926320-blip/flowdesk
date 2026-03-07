"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Search,
  Users,
  Target,
  Flame,
  Snowflake,
  Clock3,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type CompanyUser = {
  company_id: string;
  role: string;
};

type Vendedor = {
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  comissao_percentual?: number | null;
};

type ServicoCalculado = {
  [key: string]: any;
  valor_comissao_calculado: number;
  percentual_comissao_calculado: number;
  lucro_calculado: number;
};

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [filtroPeriodo, setFiltroPeriodo] = useState("Hoje");
  const [dataInicioCustom, setDataInicioCustom] = useState("");
  const [dataFimCustom, setDataFimCustom] = useState("");

  const [todosServicos, setTodosServicos] = useState<any[]>([]);
  const [orcamentosRecentes, setOrcamentosRecentes] = useState<any[]>([]);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroTemperatura, setFiltroTemperatura] = useState("todos");
  const [busca, setBusca] = useState("");

  function getDataInicio(periodo: string) {
    const agora = new Date();

    switch (periodo) {
      case "Hoje":
        return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      case "7 Dias": {
        const sete = new Date();
        sete.setDate(agora.getDate() - 7);
        return sete;
      }

      case "30 Dias": {
        const trinta = new Date();
        trinta.setDate(agora.getDate() - 30);
        return trinta;
      }

      case "Mes":
        return new Date(agora.getFullYear(), agora.getMonth(), 1);

      case "Ano":
        return new Date(agora.getFullYear(), 0, 1);

      default:
        return null;
    }
  }

  function findVendedorByUserId(userId?: string | null) {
    if (!userId) return null;
    return vendedores.find((v) => v.user_id === userId) || null;
  }

  function findVendedorByEmail(email?: string | null) {
    if (!email) return null;
    return (
      vendedores.find(
        (v) => (v.email || "").toLowerCase() === email.toLowerCase()
      ) || null
    );
  }

  function calcularComissaoCongelada(params: {
    valorOrcamento: number;
    valorComissaoAtual?: number | null;
    percentualComissaoAtual?: number | null;
    vendedor?: Vendedor | null;
  }) {
    const valorOrcamento = Number(params.valorOrcamento || 0);
    const valorComissaoAtual = Number(params.valorComissaoAtual || 0);
    const percentualComissaoAtual = Number(params.percentualComissaoAtual || 0);
    const percentualVendedor = Number(params.vendedor?.comissao_percentual || 0);

    const percentualFinal =
      percentualComissaoAtual > 0 ? percentualComissaoAtual : percentualVendedor;

    const valorFinal =
      valorComissaoAtual > 0
        ? valorComissaoAtual
        : percentualFinal > 0 && valorOrcamento > 0
        ? (valorOrcamento * percentualFinal) / 100
        : 0;

    return {
      percentual_comissao: percentualFinal,
      valor_comissao: valorFinal,
    };
  }

  async function carregarDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUser(user);
    setLoadingUser(false);

    const { data: companyUser, error: companyUserError } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (companyUserError || !companyUser) {
      console.error("Usuário sem empresa vinculada");
      return;
    }

    const typedCompanyUser = companyUser as CompanyUser;

    setCompanyId(typedCompanyUser.company_id);
    setRole(typedCompanyUser.role);

    if (typedCompanyUser.role === "vendedor") {
      setFiltroVendedor(user.id);
    }

    const { data: equipe } = await supabase
      .from("company_users")
      .select("user_id, email, role, status, comissao_percentual")
      .eq("company_id", typedCompanyUser.company_id)
      .eq("status", "accepted")
      .order("email", { ascending: true });

    setVendedores((equipe as Vendedor[]) || []);

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", typedCompanyUser.company_id);

    if (typedCompanyUser.role === "vendedor") {
      query = query.eq("user_id", user.id);
    }

    if (
      filtroPeriodo === "Personalizado" &&
      dataInicioCustom &&
      dataFimCustom
    ) {
      query = query
        .gte("created_at", new Date(dataInicioCustom + "T00:00:00").toISOString())
        .lte("created_at", new Date(dataFimCustom + "T23:59:59").toISOString());
    } else {
      const dataInicio = getDataInicio(filtroPeriodo);
      if (dataInicio) {
        query = query.gte("created_at", dataInicio.toISOString());
      }
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setTodosServicos(data);
      setOrcamentosRecentes(data.slice(0, 5));
    }
  }

  useEffect(() => {
    carregarDashboard();
  }, [router, filtroPeriodo, dataInicioCustom, dataFimCustom]);

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const servicosCalculados = useMemo<ServicoCalculado[]>(() => {
    return todosServicos.map((item) => {
      const vendedor =
        findVendedorByUserId(item.user_id) || findVendedorByEmail(item.responsavel);

      const comissao = calcularComissaoCongelada({
        valorOrcamento: Number(item.valor_orcamento || 0),
        valorComissaoAtual: item.valor_comissao,
        percentualComissaoAtual: item.percentual_comissao,
        vendedor,
      });

      const lucro =
        Number(item.valor_orcamento || 0) -
        Number(item.custo || 0) -
        Number(comissao.valor_comissao || 0);

      return {
        ...item,
        valor_comissao_calculado: Number(comissao.valor_comissao || 0),
        percentual_comissao_calculado: Number(comissao.percentual_comissao || 0),
        lucro_calculado: lucro,
      };
    });
  }, [todosServicos, vendedores]);

  const servicosFiltradosView = useMemo(() => {
    let base = [...servicosCalculados];

    if (filtroVendedor !== "todos") {
      base = base.filter((item) => item.user_id === filtroVendedor);
    }

    if (filtroTemperatura !== "todos") {
      base = base.filter(
        (item) => (item.temperatura || "morno") === filtroTemperatura
      );
    }

    if (busca.trim()) {
      const termo = busca.toLowerCase();

      base = base.filter((item) => {
        return (
          item.cliente?.toLowerCase().includes(termo) ||
          item.tipo_servico?.toLowerCase().includes(termo) ||
          item.origem_lead?.toLowerCase().includes(termo) ||
          item.responsavel?.toLowerCase().includes(termo)
        );
      });
    }

    return base;
  }, [servicosCalculados, filtroVendedor, filtroTemperatura, busca]);

  if (loadingUser) {
    return <div style={{ padding: 40, color: "white" }}>Carregando...</div>;
  }

  const servicosAtivos = servicosFiltradosView.filter((s) => s.ativo === true);
  const servicosInativos = servicosFiltradosView.filter((s) => s.ativo === false);
  const servicosFiltrados = servicosAtivos;

  const totalOrcamentos = servicosFiltrados.length;

  const STATUS_POTENCIAL = ["lead", "proposta_enviada", "aguardando_cliente"];
  const STATUS_CONFIRMADA = ["proposta_validada", "andamento"];
  const STATUS_REALIZADA = ["concluido"];

  const potencialList = servicosFiltrados.filter((o) =>
    STATUS_POTENCIAL.includes(o.status)
  );

  const confirmadaList = servicosFiltrados.filter((o) =>
    STATUS_CONFIRMADA.includes(o.status)
  );

  const realizadosList = servicosFiltrados.filter((o) =>
    STATUS_REALIZADA.includes(o.status)
  );

  const recusadosList = servicosFiltrados.filter((o) =>
    ["recusado", "cancelado"].includes(o.status)
  );

  const leadsQuentes = servicosFiltrados.filter(
    (item) => (item.temperatura || "morno") === "quente"
  ).length;

  const leadsMornos = servicosFiltrados.filter(
    (item) => (item.temperatura || "morno") === "morno"
  ).length;

  const leadsFrios = servicosFiltrados.filter(
    (item) => (item.temperatura || "morno") === "frio"
  ).length;

  const receitaTotal = realizadosList.reduce(
    (acc, item) => acc + Number(item.valor_orcamento || 0),
    0
  );

  const receitaConfirmada = confirmadaList.reduce(
    (acc, item) => acc + Number(item.valor_orcamento || 0),
    0
  );

  const receitaPotencial = potencialList.reduce(
    (acc, item) => acc + Number(item.valor_orcamento || 0),
    0
  );

  const comissaoTotal = realizadosList.reduce(
    (acc, item) => acc + Number(item.valor_comissao_calculado || 0),
    0
  );

  const lucroTotal = realizadosList.reduce(
    (acc, item) => acc + Number(item.lucro_calculado || 0),
    0
  );

  const ticketMedio =
    realizadosList.length > 0 ? receitaTotal / realizadosList.length : 0;

  const baseConversao =
    potencialList.length + confirmadaList.length + realizadosList.length;

  const taxaConversao =
    baseConversao > 0
      ? (realizadosList.length / baseConversao) * 100
      : 0;

  const meses = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  const receitaPorMes: Record<number, number> = {};
  const lucroPorMes: Record<number, number> = {};
  const totalPorMes: Record<number, number> = {};
  const aprovadosPorMes: Record<number, number> = {};

  servicosFiltrados.forEach((item) => {
    const mes = new Date(item.created_at).getMonth();

    totalPorMes[mes] = (totalPorMes[mes] || 0) + 1;

    if (item.status === "concluido") {
      const receita = Number(item.valor_orcamento || 0);
      const lucro = Number(item.lucro_calculado || 0);

      receitaPorMes[mes] = (receitaPorMes[mes] || 0) + receita;
      lucroPorMes[mes] = (lucroPorMes[mes] || 0) + lucro;
      aprovadosPorMes[mes] = (aprovadosPorMes[mes] || 0) + 1;
    }
  });

  const graficoReceitaLucro = meses.map((mes, index) => ({
    mes,
    receita: receitaPorMes[index] || 0,
    lucro: lucroPorMes[index] || 0,
  }));

  const graficoConversao = meses.map((mes, index) => ({
    mes,
    conversao:
      totalPorMes[index] > 0
        ? ((aprovadosPorMes[index] || 0) / totalPorMes[index]) * 100
        : 0,
  }));

  const graficoStatus = [
    { name: "Potenciais", valor: potencialList.length },
    { name: "Confirmadas", valor: confirmadaList.length },
    { name: "Realizadas", valor: realizadosList.length },
    { name: "Recusados", valor: recusadosList.length },
  ];

  const graficoCarteira = [
    { name: "Ativos", valor: servicosAtivos.length },
    { name: "Inativos", valor: servicosInativos.length },
  ];

  const graficoTemperatura = [
    { name: "Quentes", valor: leadsQuentes },
    { name: "Mornos", valor: leadsMornos },
    { name: "Frios", valor: leadsFrios },
  ];

  const resumoOrigem = Object.values(
    servicosFiltrados.reduce((acc: any, item: any) => {
      const chave = item.origem_lead?.trim() || "Sem origem";
      if (!acc[chave]) {
        acc[chave] = { origem: chave, total: 0, valor: 0 };
      }
      acc[chave].total += 1;
      acc[chave].valor += Number(item.valor_orcamento || 0);
      return acc;
    }, {})
  )
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 6);

  const orcamentosRecentesFiltrados = orcamentosRecentes
    .map((item) => {
      const vendedor =
        findVendedorByUserId(item.user_id) || findVendedorByEmail(item.responsavel);

      const comissao = calcularComissaoCongelada({
        valorOrcamento: Number(item.valor_orcamento || 0),
        valorComissaoAtual: item.valor_comissao,
        percentualComissaoAtual: item.percentual_comissao,
        vendedor,
      });

      const lucro =
        Number(item.valor_orcamento || 0) -
        Number(item.custo || 0) -
        Number(comissao.valor_comissao || 0);

      return {
        ...item,
        valor_comissao_calculado: comissao.valor_comissao,
        percentual_comissao_calculado: comissao.percentual_comissao,
        lucro_calculado: lucro,
      };
    })
    .filter((item) => {
      if (filtroVendedor !== "todos" && item.user_id !== filtroVendedor) return false;

      if (
        filtroTemperatura !== "todos" &&
        (item.temperatura || "morno") !== filtroTemperatura
      ) {
        return false;
      }

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const bate =
          item.cliente?.toLowerCase().includes(termo) ||
          item.tipo_servico?.toLowerCase().includes(termo) ||
          item.origem_lead?.toLowerCase().includes(termo) ||
          item.responsavel?.toLowerCase().includes(termo);

        if (!bate) return false;
      }

      return true;
    });

  return (
    <>
      <style jsx global>{`
        select {
          background-color: #1e293b !important;
          color: #ffffff !important;
        }

        select option {
          background-color: #0f172a !important;
          color: #ffffff !important;
        }

        input[type="date"] {
          color-scheme: dark;
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, rgba(59,130,246,0.12), transparent 35%), linear-gradient(180deg,#071427 0%, #0b1730 45%, #0f172a 100%)",
          padding: "40px",
          color: "white",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ marginBottom: 30 }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 8 }}>
            📊 Dashboard Financeiro
          </h1>

          <p style={{ color: "#94a3b8", fontSize: 15 }}>
            Acompanhe receita, conversão, carteira, temperatura e desempenho por vendedor.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 220px 220px",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: "0 16px",
              minHeight: 52,
            }}
          >
            <Search size={18} color="#67e8f9" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, origem, serviço ou responsável..."
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "white",
                fontSize: 14,
              }}
            />
          </div>

          <select
            value={role === "vendedor" ? user?.id || "todos" : filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            disabled={role === "vendedor"}
            style={selectStyle}
          >
            {role !== "vendedor" && (
              <option value="todos" style={optionStyle}>
                Todos vendedores
              </option>
            )}

            {vendedores
              .filter(
                (v) =>
                  v.role === "vendedor" || v.role === "admin" || v.role === "owner"
              )
              .map((v) => (
                <option
                  key={v.user_id || v.email}
                  value={v.user_id || ""}
                  style={optionStyle}
                >
                  {v.email}
                </option>
              ))}
          </select>

          <select
            value={filtroTemperatura}
            onChange={(e) => setFiltroTemperatura(e.target.value)}
            style={selectStyle}
          >
            <option value="todos" style={optionStyle}>
              Todas temperaturas
            </option>
            <option value="quente" style={optionStyle}>
              Quente
            </option>
            <option value="morno" style={optionStyle}>
              Morno
            </option>
            <option value="frio" style={optionStyle}>
              Frio
            </option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          {["Hoje", "7 Dias", "30 Dias", "Mes", "Ano", "Personalizado"].map((item) => (
            <button
              key={item}
              onClick={() => setFiltroPeriodo(item)}
              style={{
                padding: "10px 18px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                cursor: "pointer",
                background:
                  filtroPeriodo === item
                    ? "linear-gradient(90deg,#06b6d4,#3b82f6)"
                    : "rgba(255,255,255,0.06)",
                color: "white",
                fontWeight: 700,
                boxShadow:
                  filtroPeriodo === item
                    ? "0 8px 25px rgba(6,182,212,0.25)"
                    : "none",
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {filtroPeriodo === "Personalizado" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 30, flexWrap: "wrap" }}>
            <input
              type="date"
              value={dataInicioCustom}
              onChange={(e) => setDataInicioCustom(e.target.value)}
              style={inputDateStyle}
            />
            <input
              type="date"
              value={dataFimCustom}
              onChange={(e) => setDataFimCustom(e.target.value)}
              style={inputDateStyle}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
          <Metric
            icon={<DollarSign size={18} />}
            title="Receita Realizada"
            value={formatCurrency(receitaTotal)}
            subtitle={`${realizadosList.length} vendas concluídas`}
            glow="rgba(34,197,94,0.18)"
          />

          <Metric
            icon={<TrendingUp size={18} />}
            title="Lucro Total"
            value={formatCurrency(lucroTotal)}
            subtitle="Apenas vendas realizadas"
            glow="rgba(6,182,212,0.18)"
          />

          <Metric
            icon={<DollarSign size={18} />}
            title="Comissão Total"
            value={formatCurrency(comissaoTotal)}
            subtitle="Comissões acumuladas"
            glow="rgba(168,85,247,0.18)"
          />

          <Metric
            icon={<BarChart3 size={18} />}
            title="Ticket Médio"
            value={formatCurrency(ticketMedio)}
            subtitle="Média por venda"
            glow="rgba(59,130,246,0.18)"
          />

          <Metric
            icon={<Target size={18} />}
            title="Conversão"
            value={taxaConversao.toFixed(1) + "%"}
            subtitle={`${realizadosList.length} de ${baseConversao} oportunidades`}
            glow="rgba(250,204,21,0.18)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
          <Metric
            icon={<Users size={18} />}
            title="Total da Carteira"
            value={totalOrcamentos}
            subtitle="Leads ativos filtrados"
            glow="rgba(59,130,246,0.18)"
          />

          <Metric
            icon={<Flame size={18} />}
            title="Leads Quentes"
            value={leadsQuentes}
            subtitle="Maior chance de fechamento"
            glow="rgba(239,68,68,0.18)"
          />

          <Metric
            icon={<Clock3 size={18} />}
            title="Receita Potencial"
            value={formatCurrency(receitaPotencial)}
            subtitle="Lead + proposta enviada + aguardando"
            glow="rgba(234,179,8,0.18)"
          />

          <Metric
            icon={<TrendingUp size={18} />}
            title="Receita Confirmada"
            value={formatCurrency(receitaConfirmada)}
            subtitle="Proposta validada + andamento"
            glow="rgba(34,197,94,0.18)"
          />

          <Metric
            icon={<Snowflake size={18} />}
            title="Leads Frios"
            value={leadsFrios}
            subtitle="Precisam de mais aquecimento"
            glow="rgba(14,165,233,0.18)"
          />
        </div>

        <div
          style={{
            marginBottom: 50,
            background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 18px 45px rgba(0,0,0,0.28)",
          }}
        >
          <h3 style={{ fontSize: 18, marginBottom: 15, fontWeight: 700 }}>
            Taxa de Aprovação
          </h3>

          <div
            style={{
              position: "relative",
              height: 42,
              background: "#1e293b",
              borderRadius: 50,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${taxaConversao}%`,
                background: "linear-gradient(90deg,#7c3aed,#06b6d4,#22c55e)",
                borderRadius: 50,
                transition: "width 0.6s ease",
              }}
            />

            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>
                {taxaConversao.toFixed(1)}%
              </span>

              <span
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  marginTop: 4,
                  fontWeight: 500,
                }}
              >
                {realizadosList.length} de {baseConversao} propostas
              </span>
            </div>
          </div>
        </div>

        <ChartBlock title="Receita vs Lucro Mensal">
          <AreaChart data={graficoReceitaLucro}>
            <defs>
              <linearGradient id="receitaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="lucroFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#243246" />
            <XAxis dataKey="mes" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip formatter={(v: any) => formatCurrency(v)} />
            <Area
              type="monotone"
              dataKey="receita"
              stroke="#06b6d4"
              fill="url(#receitaFill)"
              strokeWidth={3}
            />
            <Area
              type="monotone"
              dataKey="lucro"
              stroke="#22c55e"
              fill="url(#lucroFill)"
              strokeWidth={3}
            />
          </AreaChart>
        </ChartBlock>

        <ChartBlock title="Conversão Mensal (%)">
          <LineChart data={graficoConversao}>
            <CartesianGrid stroke="#243246" />
            <XAxis dataKey="mes" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="conversao"
              stroke="#22c55e"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ChartBlock>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <ChartBlock title="Carteira: Ativos x Inativos">
            <PieChart>
              <Pie
                data={graficoCarteira}
                dataKey="valor"
                nameKey="name"
                outerRadius={100}
                label
              >
                {graficoCarteira.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={index === 0 ? "#22c55e" : "#ef4444"}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ChartBlock>

          <ChartBlock title="Temperatura dos Leads">
            <PieChart>
              <Pie
                data={graficoTemperatura}
                dataKey="valor"
                nameKey="name"
                outerRadius={100}
                label
              >
                {graficoTemperatura.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      index === 0 ? "#ef4444" : index === 1 ? "#eab308" : "#0ea5e9"
                    }
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ChartBlock>
        </div>

        <ChartBlock title="Distribuição por Status">
          <BarChart data={graficoStatus}>
            <CartesianGrid stroke="#243246" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
              {graficoStatus.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    index === 0
                      ? "#06b6d4"
                      : index === 1
                      ? "#22c55e"
                      : index === 2
                      ? "#7c3aed"
                      : "#ef4444"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartBlock>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <InfoBlock title="Top origens de lead">
            <div className="space-y-3">
              {resumoOrigem.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>Nenhuma origem encontrada.</p>
              ) : (
                resumoOrigem.map((origem: any) => (
                  <div
                    key={origem.origem}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{origem.origem}</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        {origem.total} leads
                      </div>
                    </div>

                    <div
                      style={{
                        color: "#67e8f9",
                        fontWeight: 700,
                      }}
                    >
                      {formatCurrency(origem.valor)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </InfoBlock>

          <InfoBlock title="Orçamentos recentes">
            <div className="space-y-3">
              {orcamentosRecentesFiltrados.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>Nenhum orçamento recente.</p>
              ) : (
                orcamentosRecentesFiltrados.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.cliente || "Sem cliente"}</div>
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        {item.tipo_servico || "Sem serviço"} •{" "}
                        {item.origem_lead || "Sem origem"}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                        {item.responsavel || "Sem responsável"}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#34d399", fontWeight: 700 }}>
                        {formatCurrency(Number(item.valor_orcamento || 0))}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </InfoBlock>
        </div>
      </div>
    </>
  );
}

function ChartBlock({ title, children }: any) {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))",
        padding: 30,
        borderRadius: 24,
        marginBottom: 40,
        boxShadow: "0 16px 42px rgba(0,0,0,0.30)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>{title}</h3>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function InfoBlock({ title, children }: any) {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))",
        padding: 24,
        borderRadius: 24,
        boxShadow: "0 16px 42px rgba(0,0,0,0.30)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <h3
        style={{
          marginBottom: 18,
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ icon, title, value, subtitle, glow }: any) {
  return (
    <div
      className="p-6 rounded-2xl border border-[#22314a] hover:scale-[1.02] transition-all duration-200"
      style={{
        background:
          "linear-gradient(135deg, rgba(17,24,39,0.92), rgba(15,23,42,0.96))",
        boxShadow: `0 12px 32px ${glow || "rgba(59,130,246,0.12)"}`,
      }}
    >
      <div className="flex justify-between text-gray-400 text-sm">
        <span>{title}</span>
        <span className="text-blue-400">{icon}</span>
      </div>

      <div className="mt-4 text-3xl font-bold text-cyan-400">{value}</div>

      <div className="mt-2 text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}

const selectStyle = {
  padding: "0 16px",
  minHeight: 52,
  borderRadius: 16,
  background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#ffffff",
  outline: "none",
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  MozAppearance: "none" as const,
};

const optionStyle = {
  backgroundColor: "#0f172a",
  color: "#ffffff",
};

const inputDateStyle = {
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "white",
  outline: "none",
};