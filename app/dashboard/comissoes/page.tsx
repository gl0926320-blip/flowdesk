"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  DollarSign,
  Trophy,
  TrendingUp,
  Clock,
  Calendar,
  Medal,
  Target,
  Percent,
  BarChart3,
} from "lucide-react";

type Servico = {
  id: string;
  responsavel: string | null;
  valor_comissao: number | null;
  percentual_comissao: number | null;
  valor_orcamento: number | null;
  created_at: string;
  comissao_paga: boolean | null;
  status: string;
};

export default function ComissoesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<Servico[]>([]);
  const [periodo, setPeriodo] = useState("hoje");
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .eq("status", "concluido");

    if (!error) setData(data || []);
    setLoading(false);
  }

  async function marcarComoPaga(id: string) {
    await supabase
      .from("servicos")
      .update({ comissao_paga: true })
      .eq("id", id);

    fetchData();
  }

  // 💰 Gera comissão automática se necessário
  const dataComComissao = useMemo(() => {
    return data.map((item) => {
      let valor = item.valor_comissao;

      if (!valor && item.valor_orcamento && item.percentual_comissao) {
        valor =
          (item.valor_orcamento * item.percentual_comissao) / 100;
      }

      return {
        ...item,
        valor_comissao: valor || 0,
        percentual_comissao: item.percentual_comissao || 0,
      };
    });
  }, [data]);

  // 📅 FILTRO
  const filtered = useMemo(() => {
    const now = new Date();

    return dataComComissao.filter((item) => {
      const date = new Date(item.created_at);

      if (dataSelecionada) {
        const selected = new Date(dataSelecionada);
        return (
          date.getDate() === selected.getDate() &&
          date.getMonth() === selected.getMonth() &&
          date.getFullYear() === selected.getFullYear()
        );
      }

      if (periodo === "hoje") {
        return (
          date.getDate() === now.getDate() &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }

      if (periodo === "7dias") {
        return date >= new Date(now.getTime() - 7 * 86400000);
      }

      if (periodo === "30dias") {
        return date >= new Date(now.getTime() - 30 * 86400000);
      }

      if (periodo === "mes") {
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }

      return true;
    });
  }, [dataComComissao, periodo, dataSelecionada]);

  // 📊 MÉTRICAS GERAIS
  const totalComissao = filtered.reduce(
    (acc, item) => acc + item.valor_comissao,
    0
  );

  const totalPaga = filtered
    .filter((i) => i.comissao_paga)
    .reduce((acc, item) => acc + item.valor_comissao, 0);

  const totalPendente = totalComissao - totalPaga;

  const percentualPago =
    totalComissao > 0
      ? Math.round((totalPaga / totalComissao) * 100)
      : 0;

  const percentualMedio =
    filtered.length > 0
      ? filtered.reduce(
          (acc, item) => acc + (item.percentual_comissao || 0),
          0
        ) / filtered.length
      : 0;

  // 🏆 Ranking avançado
  const ranking = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        quantidade: number;
      }
    > = {};

    filtered.forEach((item) => {
      const nome = item.responsavel || "Sem responsável";

      if (!map[nome]) {
        map[nome] = { total: 0, quantidade: 0 };
      }

      map[nome].total += item.valor_comissao;
      map[nome].quantidade += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        total: data.total,
        quantidade: data.quantidade,
        ticketMedio:
          data.quantidade > 0
            ? data.total / data.quantidade
            : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const topSeller = ranking[0];

  return (
    <div className="space-y-10 text-white">

      <div>
        <h1 className="text-4xl font-bold text-cyan-400">
          Central de Comissões
        </h1>
        <p className="text-white/50">
          Painel financeiro estratégico da equipe
        </p>
      </div>

      {/* FILTROS */}
      <div className="flex gap-3 flex-wrap">
        {["hoje", "7dias", "30dias", "mes"].map((p) => (
          <button
            key={p}
            onClick={() => {
              setPeriodo(p);
              setDataSelecionada(null);
            }}
            className={`px-4 py-2 rounded-xl text-sm transition ${
              periodo === p
                ? "bg-cyan-500 text-black font-bold"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Calendar size={18} />
        <input
          type="date"
          value={dataSelecionada || ""}
          onChange={(e) => {
            setDataSelecionada(e.target.value);
            setPeriodo("custom");
          }}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20"
        />
      </div>

      {/* CARDS */}
      <div className="grid md:grid-cols-5 gap-6">

        <MegaCard title="Total Comissão" value={totalComissao} icon={<DollarSign />} />
        <MegaCard title="Comissão Paga" value={totalPaga} icon={<TrendingUp />} />
        <MegaCard title="Comissão Pendente" value={totalPendente} icon={<Clock />} />
        <MegaCard title="% Pago" value={`${percentualPago}%`} icon={<Target />} />
        <MegaCard title="% Médio Comissão" value={`${percentualMedio.toFixed(1)}%`} icon={<Percent />} />

      </div>

      {/* TOP SELLER */}
      {topSeller && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-cyan-500/10 border border-yellow-400/20 p-6 rounded-3xl">
          <div className="flex items-center gap-3 text-yellow-400">
            <Medal />
            <span className="text-lg font-bold">
              Melhor Performance
            </span>
          </div>

          <div className="mt-3 text-2xl font-bold">
            {topSeller.name}
          </div>

          <div className="text-cyan-400 font-semibold">
            R$ {topSeller.total.toFixed(2)}
          </div>

          <div className="text-sm text-white/60 mt-1">
            {topSeller.quantidade} vendas • Ticket médio R$ {topSeller.ticketMedio.toFixed(2)}
          </div>
        </div>
      )}

      {/* RANKING */}
      <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/10">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Trophy className="text-yellow-400" size={18} />
          Ranking Estratégico
        </h2>

        <div className="space-y-6">
          {ranking.map((item, index) => {
            const percent =
              totalComissao > 0
                ? (item.total / totalComissao) * 100
                : 0;

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
                    R$ {item.total.toFixed(2)}
                  </span>
                </div>

                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                  <div
                    className="h-3 bg-gradient-to-r from-yellow-400 to-cyan-400"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="text-xs text-white/50 flex justify-between">
                  <span>
                    {item.quantidade} vendas
                  </span>
                  <span>
                    {percent.toFixed(1)}% participação
                  </span>
                  <span>
                    Ticket médio: R$ {item.ticketMedio.toFixed(2)}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* LISTA DETALHADA */}
      <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/10">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <BarChart3 size={18} />
          Detalhamento de Comissões
        </h2>

        <div className="space-y-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white/5 rounded-xl flex justify-between items-center"
            >
              <div>
                <div className="font-semibold">
                  {item.responsavel || "Sem responsável"}
                </div>
                <div className="text-xs text-white/50">
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
                <div className="text-xs text-cyan-400">
                  {item.percentual_comissao}% de comissão
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-cyan-400">
                  R$ {item.valor_comissao.toFixed(2)}
                </div>
                <div className="text-xs text-white/50">
                  Sobre R$ {(item.valor_orcamento || 0).toFixed(2)}
                </div>

                {!item.comissao_paga && (
                  <button
                    onClick={() => marcarComoPaga(item.id)}
                    className="mt-2 text-xs px-3 py-1 rounded-lg bg-green-500 text-black font-semibold"
                  >
                    Marcar como paga
                  </button>
                )}

                {item.comissao_paga && (
                  <div className="text-green-400 text-xs mt-1">
                    Comissão paga
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function MegaCard({ title, value, icon }: any) {
  return (
    <div className="bg-gradient-to-br from-[#0f172a] to-[#111827] p-6 rounded-3xl border border-white/10">
      <div className="flex justify-between text-sm text-white/50">
        <span>{title}</span>
        <span className="text-cyan-400">{icon}</span>
      </div>
      <div className="mt-4 text-3xl font-bold text-cyan-400">
        {typeof value === "number"
          ? `R$ ${value.toFixed(2)}`
          : value}
      </div>
    </div>
  );
}