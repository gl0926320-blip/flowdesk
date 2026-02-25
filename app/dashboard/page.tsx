"use client";

import { useEffect, useState } from "react";
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
} from "recharts";

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [totalOrcamentos, setTotalOrcamentos] = useState(0);
  const [receitaTotal, setReceitaTotal] = useState(0);
  const [receitaMes, setReceitaMes] = useState(0);
  const [aprovados, setAprovados] = useState(0);
  const [pendentes, setPendentes] = useState(0);
  const [recusados, setRecusados] = useState(0);
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");
  const [filters, setFilters] = useState({
  status: "all",
  tipo_servico: "all",
  cliente: "all",
  minValue: "",
  maxValue: "",
});
  const [orcamentosRecentes, setOrcamentosRecentes] = useState<any[]>([]);
  const [todosServicos, setTodosServicos] = useState<any[]>([]);

  const [graficoMensal, setGraficoMensal] = useState<any[]>([]);
  const [graficoStatus, setGraficoStatus] = useState<any[]>([]);

  function getDataInicio(periodo: string) {
  const agora = new Date();

  switch (periodo) {
    case "hoje":
      return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    case "semana":
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(agora.getDate() - 7);
      return seteDiasAtras;

    case "mes":
      return new Date(agora.getFullYear(), agora.getMonth(), 1);

    case "ano":
      return new Date(agora.getFullYear(), 0, 1);

    default:
      return null;
  }
}

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);
      setLoadingUser(false);

      let query = supabase
  .from("servicos")
  .select("*")
  .eq("user_id", user.id);

const dataInicio = getDataInicio(filtroPeriodo);

if (dataInicio) {
  query = query.gte("data_abertura", dataInicio.toISOString());
}

const { data, error } = await query.order("data_abertura", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setTodosServicos(data);
        setOrcamentosRecentes(data.slice(0, 5));

        const aprovadosList = data.filter(
          (o) =>
            o.status === "aprovado" ||
            o.status === "proposta_validada" ||
            o.status === "concluido"
        );

        const pendentesList = data.filter(
          (o) =>
            o.status === "lead" ||
            o.status === "proposta_enviada" ||
            o.status === "aguardando_cliente" ||
            o.status === "andamento"
        );

        const recusadosList = data.filter(
          (o) => o.status === "recusado" || o.status === "cancelado"
        );

        setAprovados(aprovadosList.length);
        setPendentes(pendentesList.length);
        setRecusados(recusadosList.length);

        const total = aprovadosList.reduce(
          (acc, item) => acc + Number(item.valor_orcamento || 0),
          0
        );

        setReceitaTotal(total);

        const mesAtual = new Date().getMonth();
        const anoAtual = new Date().getFullYear();

        const receitaMesAtual = aprovadosList
          .filter((o) => {
            const dataOrc = new Date(o.created_at);
            return (
              
              dataOrc.getMonth() === mesAtual &&
              dataOrc.getFullYear() === anoAtual
            );
          })
          .reduce(
            (acc, item) => acc + Number(item.valor_orcamento || 0),
            0
          );

        setReceitaMes(receitaMesAtual);

        const meses = [
          "Jan","Fev","Mar","Abr","Mai","Jun",
          "Jul","Ago","Set","Out","Nov","Dez"
        ];

        const receitaPorMes: any = {};

        aprovadosList.forEach((o) => {
          const dataOrc = new Date(o.created_at);
          const mes = dataOrc.getMonth();
          receitaPorMes[mes] =
            (receitaPorMes[mes] || 0) + Number(o.valor_orcamento || 0);
        });

        const graficoLinha = meses.map((mes, index) => ({
          mes,
          receita: receitaPorMes[index] || 0,
        }));

        setGraficoMensal(graficoLinha);

        setGraficoStatus([
          { name: "Aprovados", valor: aprovadosList.length },
          { name: "Pendentes", valor: pendentesList.length },
          { name: "Recusados", valor: recusadosList.length },
        ]);
      }
    }

    checkUser();
  }, [router, filtroPeriodo]);

async function handleUpgrade() {
  if (!user) return;

  try {
    setLoadingCheckout(true);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
      }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Erro ao criar sessão Stripe");
      setLoadingCheckout(false);
    }
  } catch (err) {
    console.error(err);
    alert("Erro inesperado");
    setLoadingCheckout(false);
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  router.push("/login");
  router.refresh();
}

  if (loadingUser) {
    return (
    
      <div style={{ padding: 40 }}>
        <h2>Carregando...</h2>
      </div>
    );
  }

  

  const ticketMedio =
    aprovados > 0 ? (receitaTotal / aprovados).toFixed(2) : "0.00";
  // 🔥 FILTROS COMBINÁVEIS
const servicosFiltrados = todosServicos.filter((item) => {

  if (filters.status !== "all" && item.status !== filters.status) {
    return false;
  }

  if (
    filters.tipo_servico !== "all" &&
    item.tipo_servico !== filters.tipo_servico
  ) {
    return false;
  }

  if (filters.cliente !== "all" && item.cliente !== filters.cliente) {
    return false;
  }

  if (
    filters.minValue &&
    Number(item.valor_orcamento) < Number(filters.minValue)
  ) {
    return false;
  }

  if (
    filters.maxValue &&
    Number(item.valor_orcamento) > Number(filters.maxValue)
  ) {
    return false;
  }

  return true;
}); 

  

  const totalOrcamentosFiltrados = servicosFiltrados.length;

const aprovadosList = servicosFiltrados.filter(
  (o) =>
    o.status === "aprovado" ||
    o.status === "proposta_validada" ||
    o.status === "concluido"
);
const taxaAprovacao =
  totalOrcamentosFiltrados > 0
    ? ((aprovadosList.length / totalOrcamentosFiltrados) * 100).toFixed(1)
    : "0";
const pendentesList = servicosFiltrados.filter(
  (o) =>
    o.status === "lead" ||
    o.status === "proposta_enviada" ||
    o.status === "aguardando_cliente" ||
    o.status === "andamento"
);

const recusadosList = servicosFiltrados.filter(
  (o) => o.status === "recusado" || o.status === "cancelado"
);

const receitaTotalFiltrada = aprovadosList.reduce(
  (acc, item) => acc + Number(item.valor_orcamento || 0),
  0
);

const mesAtual = new Date().getMonth();
const anoAtual = new Date().getFullYear();

const receitaMesFiltrada = aprovadosList
  .filter((o) => {
    const dataOrc = new Date(o.created_at);
    return (
      dataOrc.getMonth() === mesAtual &&
      dataOrc.getFullYear() === anoAtual
    );
  })
  .reduce(
    (acc, item) => acc + Number(item.valor_orcamento || 0),
    0
  );
  return (
    
    <div style={{ padding: 40 }}>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <h1 style={{ fontSize: 28 }}>Dashboard</h1>
        <select
  value={filtroPeriodo}
  onChange={(e) => setFiltroPeriodo(e.target.value)}
  style={{
    padding: "8px 12px",
    borderRadius: 8,
    background: "#111827",
    color: "white",
    border: "1px solid rgba(255,255,255,0.1)",
    marginLeft: 20,
  }}
>
  <option value="hoje">Hoje</option>
  <option value="semana">Últimos 7 dias</option>
  <option value="mes">Este mês</option>
  <option value="ano">Este ano</option>
  <option value="todos">Todos</option>
</select>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span>
            Logado como: <strong>{user.email}</strong>
          </span>
        
          <button
            onClick={handleUpgrade}
            disabled={loadingCheckout}
            style={{
              padding: "10px 18px",
              background: "#6b21a8",
              color: "white",
              borderRadius: 8,
              cursor: "pointer",
              border: "none",
              fontWeight: "bold",
            }}
          >
            {loadingCheckout ? "Redirecionando..." : "🚀 Assinar Plano Pro"}
          </button>
          <button
  onClick={handleLogout}
  style={{
    padding: "10px 18px",
    background: "#dc2626",
    color: "white",
    borderRadius: 8,
    cursor: "pointer",
    border: "none",
    fontWeight: "bold",
  }}
>
  Sair
</button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          marginBottom: 40,
        }}
      >
        <DashboardCard title="Total de Serviços" value={totalOrcamentosFiltrados} />
        <DashboardCard title="Receita Total" value={`R$ ${receitaTotalFiltrada.toFixed(2)}`} />
        <DashboardCard title="Receita no Mês" value={`R$ ${receitaMesFiltrada.toFixed(2)}`} />
        <DashboardCard title="Ticket Médio" value={`R$ ${ticketMedio}`} />
        <DashboardCard title="Aprovados" value={aprovadosList.length} />
        <DashboardCard title="Pendentes" value={pendentesList.length} />
        <DashboardCard title="Recusados" value={recusadosList.length} />
      </div>

      <div style={{
        background: "#0B1120",
        padding: 30,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        marginBottom: 30,
      }}>
        <h3>Taxa de Aprovação</h3>
        <p style={{ marginBottom: 10 }}>{taxaAprovacao}%</p>
        <div style={{
          background: "#1f2937",
          height: 10,
          borderRadius: 5,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${taxaAprovacao}%`,
            background: "#6b21a8",
            height: "100%",
          }} />
        </div>
      </div>

      <div style={{
        background: "#0B1120",
        padding: 30,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <h3 style={{ marginBottom: 20 }}>Serviços Recentes</h3>

        {orcamentosRecentes.length === 0 && (
  <p>Nenhum serviço ainda.</p>
)}

{orcamentosRecentes.length > 0 && (
  <>
    <div
      style={{
        display: "flex",
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        fontSize: 13,
        fontWeight: 600,
        color: "#9ca3af",
      }}
    >
      <div style={{ flex: 1 }}>Serviço</div>
      <div style={{ width: 120, textAlign: "right" }}>
        Valor do Serviço
      </div>
      <div style={{ width: 160, textAlign: "right" }}>
        Status do Pedido
      </div>
    </div>

    {orcamentosRecentes.map((orc) => (
      <div
        key={orc.id}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 0",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          gap: 20,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {orc.descricao || "Sem descrição"}
        </div>

        <div
          style={{
            width: 120,
            textAlign: "right",
            fontWeight: "bold",
          }}
        >
          R$ {Number(orc.valor_orcamento || 0).toFixed(2)}
        </div>

        <div
          style={{
            width: 160,
            textAlign: "right",
            color: "#9ca3af",
          }}
        >
          {orc.status}
        </div>
      </div>
    ))}
  </>
)}
      </div>

      <div
        style={{
          marginTop: 40,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: 30,
        }}
      >
        <div style={{
          background: "#0B1120",
          padding: 30,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          height: 350,
        }}>
          <h3 style={{ marginBottom: 20 }}>Receita por Mês</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={graficoMensal}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="mes" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="receita"
                stroke="#6b21a8"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{
          background: "#0B1120",
          padding: 30,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          height: 350,
        }}>
          <h3 style={{ marginBottom: 20 }}>Status dos Serviços</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={graficoStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="valor" fill="#6b21a8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value }: any) {
  return (
    
    <div
      style={{
        background: "#0B1120",
        padding: 20,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <p style={{ fontSize: 14, color: "#9ca3af" }}>{title}</p>
      <h2 style={{ fontSize: 22, fontWeight: "bold", marginTop: 8 }}>
        {value}
      </h2>
    </div>
  );
}