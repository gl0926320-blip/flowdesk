"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Users,
  DollarSign,
  TrendingUp,
  Medal,
  Crown,
  Calendar,
  Target,
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
};

export default function EquipePage() {
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<Servico[]>([]);
  const [periodo, setPeriodo] = useState("Hoje")
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

 const { data, error } = await supabase
  .from("servicos")
  .select(`
    id,
    responsavel,
    valor_orcamento,
    valor_comissao,
    percentual_comissao,
    status,
    created_at,
    ativo
  `)
  .eq("user_id", userData.user.id)
  .eq("status", "concluido")
  .eq("ativo", true);

    if (!error) setData(data || []);
    setLoading(false);
  }

  // 🔎 FILTRO DE DATA
  const filtered = useMemo(() => {
    const now = new Date();

    return data.filter((item) => {
      const d = new Date(item.created_at);

      if (periodo === "Hoje") {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const fim = new Date();
  fim.setHours(23, 59, 59, 999);

  return d >= inicio && d <= fim;
}

      if (periodo === "7 Dias") {
        const past = new Date();
        past.setDate(now.getDate() - 7);
        return d >= past;
      }

      if (periodo === "30 Dias") {
        const past = new Date();
        past.setDate(now.getDate() - 30);
        return d >= past;
      }

      if (periodo === "Mês")
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );

      if (periodo === "manual" && dataInicio && dataFim) {
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        return d >= inicio && d <= fim;
      }

      return true;
    });
  }, [data, periodo, dataInicio, dataFim]);

  // 📊 AGREGAÇÃO INTELIGENTE
  const equipeStats = useMemo(() => {
    const map: any = {};

    filtered.forEach((item) => {
      let nome = item.responsavel?.trim() || "Não definido";

      if (!map[nome]) {
        map[nome] = {
          vendas: 0,
          faturamento: 0,
          comissao: 0,
        };
      }


map[nome].vendas++;
map[nome].faturamento += Number(item.valor_orcamento) || 0;

let valorComissao = item.valor_comissao;

if (!valorComissao && item.valor_orcamento && item.percentual_comissao) {
  valorComissao =
    (item.valor_orcamento * item.percentual_comissao) / 100;
}

map[nome].comissao += valorComissao || 0;
    });

    return Object.entries(map)
      .map(([nome, stats]: any) => ({
        nome,
        ...stats,

        ticketMedio:
          stats.vendas > 0
            ? stats.faturamento / stats.vendas
            : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [filtered]);

  const totalFaturamento = equipeStats.reduce(
    (acc, item) => acc + item.faturamento,
    0
  );

  const melhor = equipeStats[0];

  return (
    <div className="space-y-10 text-white">

      <div>
        <h1 className="text-4xl font-bold text-cyan-400 flex items-center gap-3">
          <Users />
          Central da Equipe
        </h1>
        <p className="text-white/40">
          Ranking estratégico e inteligência comercial
        </p>
      </div>

      {/* FILTROS */}
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
        <div className="flex gap-3">
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/10"
          />
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/10"
          />
        </div>
      )}

      {/* RESUMO */}
      <div className="grid md:grid-cols-2 gap-6">

        <StatCard
          icon={<DollarSign />}
          title="Faturamento"
          value={totalFaturamento.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
})}
        />

        <StatCard
          icon={<Target />}
          title="Vendedores Ativos"
          value={equipeStats.length}
        />

      </div>

      {/* RANKING VISUAL */}
      <div className="space-y-4">
        {equipeStats.map((item, index) => {
          const porcentagem =
            totalFaturamento > 0
              ? (item.faturamento / totalFaturamento) * 100
              : 0;

          return (
            <div
              key={item.nome}
              className="bg-[#0f172a] p-6 rounded-2xl border border-white/10"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  {index === 0 && <Crown className="text-yellow-400" />}
                  {item.nome}
                </div>
                <div className="text-cyan-400 font-bold">
                  {item.faturamento.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
})}
                </div>
              </div>

              <div className="w-full bg-white/10 h-2 rounded-full mt-4">
                <div
                  className="bg-cyan-500 h-2 rounded-full"
                  style={{ width: `${porcentagem}%` }}
                />
              </div>

              <div className="grid grid-cols-3 text-sm text-white/60 mt-4">
                <span>Vendas: {item.vendas}</span>
                <span>
  Ticket Médio: {item.ticketMedio.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })}
</span>
                <span>
                  Comissão: {item.comissao.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
})}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, title, value }: any) {
  return (
    <div className="bg-gradient-to-br from-[#0f172a] to-[#111827] p-6 rounded-2xl border border-white/10">
      <div className="flex justify-between text-white/50">
        <span>{title}</span>
        <span className="text-cyan-400">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-cyan-400 mt-3">
        {value}
      </div>
    </div>
  );
}