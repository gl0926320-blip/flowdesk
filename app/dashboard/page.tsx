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
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

export default function Dashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");
  const [dataInicioCustom, setDataInicioCustom] = useState("");
  const [dataFimCustom, setDataFimCustom] = useState("");

  const [todosServicos, setTodosServicos] = useState<any[]>([]);
  const [orcamentosRecentes, setOrcamentosRecentes] = useState<any[]>([]);

  function getDataInicio(periodo: string) {
    const agora = new Date();
    switch (periodo) {
      case "hoje":
        return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      case "7dias":
        const sete = new Date();
        sete.setDate(agora.getDate() - 7);
        return sete;
      case "30dias":
        const trinta = new Date();
        trinta.setDate(agora.getDate() - 30);
        return trinta;
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
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);
      setLoadingUser(false);

      let query = supabase
        .from("servicos")
        .select("*")
        .eq("user_id", user.id)
       

      if (filtroPeriodo === "custom" && dataInicioCustom && dataFimCustom) {
        query = query
          .gte("created_at", new Date(dataInicioCustom).toISOString())
          .lte("created_at", new Date(dataFimCustom).toISOString());
      } else {
        const dataInicio = getDataInicio(filtroPeriodo);
        if (dataInicio) {
          query = query.gte("created_at", dataInicio.toISOString());
        }
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setTodosServicos(data);
        setOrcamentosRecentes(data.slice(0, 5));
      }
    }

    checkUser();
  }, [router, filtroPeriodo, dataInicioCustom, dataFimCustom]);

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  if (loadingUser) {
    return <div style={{ padding: 40, color: "white" }}>Carregando...</div>;
  }

  const servicosAtivos = todosServicos.filter(s => s.ativo === true);
const servicosInativos = todosServicos.filter(s => s.ativo === false);

const servicosFiltrados = servicosAtivos; // DASH considera só ativos
const statusCount = {
  lead: servicosFiltrados.filter(s => s.status === "lead").length,
  proposta_enviada: servicosFiltrados.filter(s => s.status === "proposta_enviada").length,
  aguardando_cliente: servicosFiltrados.filter(s => s.status === "aguardando_cliente").length,
  proposta_validada: servicosFiltrados.filter(s => s.status === "proposta_validada").length,
  andamento: servicosFiltrados.filter(s => s.status === "andamento").length,
  concluido: servicosFiltrados.filter(s => s.status === "concluido").length,
};
  const totalOrcamentos = servicosFiltrados.length;

  const aprovadosList = servicosFiltrados.filter(o =>
  ["concluido"].includes(o.status)
  );

  const pendentesList = servicosFiltrados.filter(o =>
    ["lead","proposta_enviada","aguardando_cliente","andamento"].includes(o.status)
  );

  const recusadosList = servicosFiltrados.filter(o =>
    ["recusado","cancelado"].includes(o.status)
  );

  const receitaTotal = aprovadosList.reduce(
    (acc, item) => acc + Number(item.valor_orcamento || 0), 0
  );

  const lucroTotal = aprovadosList.reduce((acc, item) => {
  const receita = Number(item.valor_orcamento || 0);
  const custo = Number(item.custo || 0);
  const comissao = Number(item.valor_comissao || 0);
  return acc + (receita - custo - comissao);
}, 0);

  const comissaoTotal = aprovadosList.reduce(
    (acc, item) => acc + Number(item.valor_comissao || 0), 0
  );

  const receitaLiquida = receitaTotal - comissaoTotal;

  const ticketMedio =
    aprovadosList.length > 0 ? receitaTotal / aprovadosList.length : 0;

  const taxaConversao =
    totalOrcamentos > 0
      ? (aprovadosList.length / totalOrcamentos) * 100
      : 0;
  const graficoTaxaAprovacao = [
  { name: "Aprovação", valor: Number(taxaConversao.toFixed(1)) }
];
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const receitaPorMes:any = {};
  const lucroPorMes:any = {};
  const conversaoPorMes:any = {};
  const totalPorMes:any = {};
  const aprovadosPorMes:any = {};

  servicosFiltrados.forEach((item) => {
    const mes = new Date(item.created_at).getMonth();

    totalPorMes[mes] = (totalPorMes[mes] || 0) + 1;

    if (item.status === "concluido") {
      const receita = Number(item.valor_orcamento || 0);
      const custo = Number(item.custo || 0);

      receitaPorMes[mes] = (receitaPorMes[mes] || 0) + receita;
      const comissao = Number(item.valor_comissao || 0);

lucroPorMes[mes] =
  (lucroPorMes[mes] || 0) + (receita - custo - comissao);
      aprovadosPorMes[mes] = (aprovadosPorMes[mes] || 0) + 1;
    }
  });

  const graficoReceitaLucro = meses.map((mes,index)=>({
    mes,
    receita: receitaPorMes[index] || 0,
    lucro: lucroPorMes[index] || 0
  }));

  const graficoConversao = meses.map((mes,index)=>({
    mes,
    conversao:
      totalPorMes[index] > 0
        ? ((aprovadosPorMes[index] || 0) / totalPorMes[index]) * 100
        : 0
  }));

  const graficoStatus = [
    { name:"Aprovados", valor:aprovadosList.length },
    { name:"Pendentes", valor:pendentesList.length },
    { name:"Recusados", valor:recusadosList.length }
  ];
const graficoCarteira = [
  { name: "Ativos", valor: servicosAtivos.length },
  { name: "Inativos", valor: servicosInativos.length }
];
  const cores = ["#7c3aed","#22c55e","#ef4444"];

  return (
    <div style={{
      minHeight:"100vh",
      background:"#0f172a",
      padding:"40px",
      color:"white",
      fontFamily:"Inter, sans-serif"
    }}>

      <h1 style={{ fontSize:32, fontWeight:700, marginBottom:30 }}>
        📊 Dashboard Financeiro
      </h1>

      {/* FILTROS (MANTIDOS) */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:30 }}>
        {["hoje","7dias","30dias","mes","ano","custom"].map((item)=>(
          <button
            key={item}
            onClick={()=>setFiltroPeriodo(item)}
            style={{
              padding:"8px 16px",
              borderRadius:10,
              border:"1px solid rgba(255,255,255,0.1)",
              cursor:"pointer",
              background:filtroPeriodo===item?"#7c3aed":"#1e293b",
              color:"white",
              fontWeight:600
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {filtroPeriodo==="custom" && (
        <div style={{ display:"flex", gap:10, marginBottom:30 }}>
          <input type="date" value={dataInicioCustom} onChange={(e)=>setDataInicioCustom(e.target.value)} />
          <input type="date" value={dataFimCustom} onChange={(e)=>setDataFimCustom(e.target.value)} />
        </div>
      )}

      {/* CARDS MELHORADOS */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))",
        gap:20,
        marginBottom:40
      }}>
        <Card title="Receita Realizada" value={formatCurrency(receitaTotal)} />
        <Card title="Lucro Total" value={formatCurrency(lucroTotal)} />
        <Card title="Receita Líquida" value={formatCurrency(receitaLiquida)} />
        <Card title="Comissão Total" value={formatCurrency(comissaoTotal)} />
        <Card title="Ticket Médio" value={formatCurrency(ticketMedio)} />
        <Card title="Conversão" value={taxaConversao.toFixed(1)+"%"} />
        <Card title="Pendentes" value={pendentesList.length} />
        <Card title="Recusados" value={recusadosList.length} />
      </div>

      {/* STATUS DO PIPELINE */}
<div style={{
  display:"grid",
  gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))",
  gap:20,
  marginBottom:60
}}>
  <Card title="Leads" value={statusCount.lead} />
  <Card title="Propostas Enviadas" value={statusCount.proposta_enviada} />
  <Card title="Aguardando Cliente" value={statusCount.aguardando_cliente} />
  <Card title="Propostas Validadas" value={statusCount.proposta_validada} />
  <Card title="Em Andamento" value={statusCount.andamento} />
  <Card title="Concluídos" value={statusCount.concluido} />
</div>

      {/* INDICADOR PRINCIPAL - TAXA DE APROVAÇÃO */}
<div style={{
  marginBottom: 50
}}>
  <h3 style={{
    fontSize: 18,
    marginBottom: 15,
    fontWeight: 600
  }}>
    Taxa de Aprovação
  </h3>

  <div style={{
    position: "relative",
    height: 40,
    background: "#1e293b",
    borderRadius: 50,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
  }}>
    <div style={{
      height: "100%",
      width: `${taxaConversao}%`,
      background: "linear-gradient(90deg,#7c3aed,#22c55e)",
      borderRadius: 50,
      transition: "width 0.6s ease"
    }} />

    {/* TEXTO CENTRAL */}
<div style={{
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center"
}}>
  <span style={{
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 1
  }}>
    {taxaConversao.toFixed(1)}%
  </span>

  <span style={{
    fontSize: 12,
    opacity: 0.65,
    marginTop: 4,
    fontWeight: 500
  }}>
    {aprovadosList.length} de {totalOrcamentos} propostas
  </span>
</div>
  </div>
</div>

      {/* RECEITA vs LUCRO */}
      <ChartBlock title="Receita vs Lucro Mensal">
        <AreaChart data={graficoReceitaLucro}>
          <CartesianGrid stroke="#1e293b"/>
          <XAxis dataKey="mes" stroke="#94a3b8"/>
          <YAxis stroke="#94a3b8"/>
          <Tooltip formatter={(v:any)=>formatCurrency(v)}/>
          <Area type="monotone" dataKey="receita" stroke="#7c3aed" fill="#7c3aed33"/>
          <Area type="monotone" dataKey="lucro" stroke="#22c55e" fill="#22c55e33"/>
        </AreaChart>
      </ChartBlock>

      <ChartBlock title="Conversão Mensal (%)">
        <LineChart data={graficoConversao}>
          <CartesianGrid stroke="#1e293b"/>
          <XAxis dataKey="mes" stroke="#94a3b8"/>
          <YAxis stroke="#94a3b8"/>
          <Tooltip/>
          <Line type="monotone" dataKey="conversao" stroke="#22c55e" strokeWidth={3}/>
        </LineChart>
      </ChartBlock>

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
        <Cell key={index} fill={index === 0 ? "#22c55e" : "#ef4444"} />
      ))}
    </Pie>
    <Tooltip />
    <Legend />
  </PieChart>
</ChartBlock>

      <ChartBlock title="Distribuição Status">
        <BarChart data={graficoStatus}>
          <CartesianGrid stroke="#1e293b"/>
          <XAxis dataKey="name" stroke="#94a3b8"/>
          <YAxis stroke="#94a3b8"/>
          <Tooltip/>
          <Bar dataKey="valor" fill="#7c3aed"/>
        </BarChart>
      </ChartBlock>
      

    </div>
    
  );
  }

function Card({ title, value }: any) {
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: any) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateY = ((x / rect.width) - 0.5) * 20; // esquerda/direita
    const rotateX = -((y / rect.height) - 0.5) * 20; // cima/baixo

    setRotate({ x: rotateX, y: rotateY });
  }

  function resetRotate() {
    setRotate({ x: 0, y: 0 });
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={resetRotate}
      style={{
        background: "linear-gradient(145deg,#1e293b,#0f172a)",
        padding: 25,
        borderRadius: 20,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        transform: `
          perspective(1000px)
          rotateX(${rotate.x}deg)
          rotateY(${rotate.y}deg)
          scale3d(1.03,1.03,1.03)
        `,
        boxShadow: `
          0 20px 40px rgba(0,0,0,0.6),
          0 0 40px rgba(124,58,237,0.15)
        `,
        cursor: "pointer"
      }}
    >
      <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>
        {title}
      </p>

      <h2 style={{ fontSize: 26, fontWeight: 800 }}>
        {value}
      </h2>
    </div>
  );
}

function ChartBlock({ title, children }: any) {
  return (
    <div style={{
      background:"#1e293b",
      padding:30,
      borderRadius:20,
      marginBottom:40,
      boxShadow:"0 10px 40px rgba(0,0,0,0.3)"
    }}>
      <h3 style={{ marginBottom:20, fontSize:18 }}>{title}</h3>
      <div style={{ width:"100%", height:320 }}>
        <ResponsiveContainer>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}