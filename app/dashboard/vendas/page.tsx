"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface Venda {
  id: string;
  cliente: string;
  status: string;
  valor_orcamento: number;
  created_at: string;
  forma_pagamento: string;
  percentual_comissao: number;
  valor_comissao: number;
  telefone: string;
  email: string;
  tipo_servico: string;
  ativo: boolean;
}

export default function VendasPage() {
  const supabase = createClient();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("30");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [selectedVenda, setSelectedVenda] = useState<Venda | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("status", "concluido")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setVendas(data || []);
    setLoading(false);
  }

  function filtrarPorPeriodo(data: string) {
    const hoje = new Date();
    const dataVenda = new Date(data);

    if (periodo === "hoje") {
      return dataVenda.toDateString() === hoje.toDateString();
    }

    if (periodo === "7") {
      const seteDias = new Date();
      seteDias.setDate(hoje.getDate() - 7);
      return dataVenda >= seteDias;
    }

    if (periodo === "30") {
      const trintaDias = new Date();
      trintaDias.setDate(hoje.getDate() - 30);
      return dataVenda >= trintaDias;
    }

    if (periodo === "mes") {
      return (
        dataVenda.getMonth() === hoje.getMonth() &&
        dataVenda.getFullYear() === hoje.getFullYear()
      );
    }

    if (periodo === "custom" && dataInicio && dataFim) {
      return (
        dataVenda >= new Date(dataInicio) &&
        dataVenda <= new Date(dataFim)
      );
    }

    return true;
  }

  const vendasFiltradas = vendas.filter((v) => {
    return (
      v.cliente?.toLowerCase().includes(busca.toLowerCase()) &&
      filtrarPorPeriodo(v.created_at)
    );
  });

  const totalVendas = vendasFiltradas.reduce(
    (acc, v) => acc + Number(v.valor_orcamento || 0),
    0
  );

  const totalComissao = vendasFiltradas.reduce(
    (acc, v) => acc + Number(v.valor_comissao || 0),
    0
  );

  const ticketMedio =
    vendasFiltradas.length > 0
      ? totalVendas / vendasFiltradas.length
      : 0;

  const meta = 50000;
  const progresso = totalVendas ? (totalVendas / meta) * 100 : 0;

  function limparFiltros() {
    setBusca("");
    setPeriodo("30");
    setDataInicio("");
    setDataFim("");
  }

  if (loading) {
    return <div className="p-6 text-white">Carregando vendas...</div>;
  }

  return (
    <div className="p-6 text-white min-h-screen bg-gradient-to-b from-[#0f172a] to-[#0b1120]">
      <h1 className="text-3xl font-bold mb-6">💰 Vendas</h1>

      {/* CARDS */}
      <div className="grid md:grid-cols-5 gap-4 mb-8">
        <Card titulo="Total Vendas" valor={totalVendas.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} cor="bg-blue-600" />
        <Card titulo="Total Comissão" valor={totalComissao.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} cor="bg-purple-600" />
        <Card titulo="Quantidade" valor={vendasFiltradas.length.toString()} cor="bg-orange-600" />
        <Card titulo="Ticket Médio" valor={ticketMedio.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} cor="bg-indigo-600" />
        <Card titulo="Meta 50k" valor={`${progresso.toFixed(1)}%`} cor="bg-green-600" />
      </div>

      {/* FILTROS */}
      <div className="bg-[#111827] p-4 rounded-xl mb-6 grid md:grid-cols-5 gap-4">
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="bg-[#1f2937] p-2 rounded"
        />

        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="bg-[#1f2937] p-2 rounded"
        >
          <option value="hoje">Hoje</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="mes">Este mês</option>
          <option value="custom">Personalizado</option>
        </select>

        {periodo === "custom" && (
          <>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-[#1f2937] p-2 rounded"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-[#1f2937] p-2 rounded"
            />
          </>
        )}

        <button
          onClick={limparFiltros}
          className="bg-red-600 hover:bg-red-700 rounded p-2"
        >
          Limpar
        </button>
      </div>

      {/* TABELA */}
      <div className="bg-[#111827] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#1f2937]">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3">Serviço</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Pagamento</th>
              <th className="p-3">Data</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vendasFiltradas.map((v) => (
              <tr key={v.id} className="border-t border-gray-700 hover:bg-[#1a2233]">
                <td className="p-3">{v.cliente}</td>
                <td className="p-3">{v.tipo_servico}</td>
                <td className="p-3">
                  {Number(v.valor_orcamento).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
                </td>
                <td className="p-3">{v.forma_pagamento}</td>
                <td className="p-3">
                  {new Date(v.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="p-3">
                  <button
                    onClick={() => setSelectedVenda(v)}
                    className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL MELHORADO */}
      {selectedVenda && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSelectedVenda(null)}
        >
          <div
            className="bg-[#0f172a] w-full max-w-2xl rounded-2xl shadow-2xl p-8 relative animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedVenda(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-2">
              📄 Detalhes da Venda
            </h2>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Cliente" value={selectedVenda.cliente} />
              <Info label="Telefone" value={selectedVenda.telefone} />
              <Info label="Email" value={selectedVenda.email} />
              <Info label="Serviço" value={selectedVenda.tipo_servico} />
              <Info
                label="Valor"
                value={Number(selectedVenda.valor_orcamento).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
              />
              <Info label="Forma Pagamento" value={selectedVenda.forma_pagamento} />
              <Info
                label="Comissão"
                value={Number(selectedVenda.valor_comissao || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
              />
              <Info
                label="Data"
                value={new Date(selectedVenda.created_at).toLocaleDateString("pt-BR")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ titulo, valor, cor }: any) {
  return (
    <div className={`${cor} p-4 rounded-xl shadow-lg`}>
      <p className="text-sm opacity-80">{titulo}</p>
      <h2 className="text-2xl font-bold">{valor}</h2>
    </div>
  );
}

function Info({ label, value }: any) {
  return (
    <div className="bg-[#1e293b] p-3 rounded-lg">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="font-semibold">{value || "-"}</p>
    </div>
  );
}