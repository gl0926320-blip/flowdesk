"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  const [orcamentosRecentes, setOrcamentosRecentes] = useState<any[]>([]);

  const [graficoMensal, setGraficoMensal] = useState<any[]>([]);
  const [graficoStatus, setGraficoStatus] = useState<any[]>([]);

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

      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setTotalOrcamentos(data.length);
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
  }, [router]);

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

  if (loadingUser) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Carregando...</h2>
      </div>
    );
  }

  const taxaAprovacao =
    totalOrcamentos > 0
      ? ((aprovados / totalOrcamentos) * 100).toFixed(1)
      : "0";

  const ticketMedio =
    aprovados > 0 ? (receitaTotal / aprovados).toFixed(2) : "0.00";

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
        <DashboardCard title="Total de Serviços" value={totalOrcamentos} />
        <DashboardCard title="Receita Total" value={`R$ ${receitaTotal.toFixed(2)}`} />
        <DashboardCard title="Receita no Mês" value={`R$ ${receitaMes.toFixed(2)}`} />
        <DashboardCard title="Ticket Médio" value={`R$ ${ticketMedio}`} />
        <DashboardCard title="Aprovados" value={aprovados} />
        <DashboardCard title="Pendentes" value={pendentes} />
        <DashboardCard title="Recusados" value={recusados} />
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

        {orcamentosRecentes.length === 0 ? (
          <p>Nenhum serviço ainda.</p>
        ) : (
          orcamentosRecentes.map((orc) => (
            <div
              key={orc.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span>{orc.titulo || "Sem título"}</span>
              <span>R$ {Number(orc.valor_orcamento || 0).toFixed(2)}</span>
              <span>{orc.status}</span>
            </div>
          ))
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