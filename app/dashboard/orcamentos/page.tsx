"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Orcamento {
  id: string;
  numero_os: string | null;
  cliente: string | null;
  tipo_servico: string | null;
  valor_orcamento: number | null;
  custo: number | null;
  responsavel: string | null;
  origem_lead: string | null;
  status: string | null;
  data_orcamento: string | null;
  created_at: string;
}

export default function OrcamentosPage() {
  const supabase = createClient();

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("all");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [periodo, setPeriodo] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrcamentos();
  }, []);

  async function fetchOrcamentos() {
    setLoading(true);

    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setOrcamentos(data || []);
    setLoading(false);
  }

  function limparFiltros() {
    setBusca("");
    setStatusFiltro("all");
    setValorMin("");
    setValorMax("");
    setDataInicio("");
    setDataFim("");
    setPeriodo("all");
  }

  const filtrado = orcamentos.filter((o) => {
    if (!(o.cliente || "").toLowerCase().includes(busca.toLowerCase()))
      return false;

    if (statusFiltro !== "all" && o.status !== statusFiltro)
      return false;

    if (valorMin && (o.valor_orcamento || 0) < Number(valorMin))
      return false;

    if (valorMax && (o.valor_orcamento || 0) > Number(valorMax))
      return false;

    const dataRef = new Date(o.data_orcamento || o.created_at);

    if (periodo === "mes") {
      const now = new Date();
      if (
        dataRef.getMonth() !== now.getMonth() ||
        dataRef.getFullYear() !== now.getFullYear()
      )
        return false;
    }

    if (dataInicio && dataRef < new Date(dataInicio))
      return false;

    if (dataFim && dataRef > new Date(dataFim + "T23:59:59"))
      return false;

    return true;
  });

  function exportCSV() {
    const headers = [
      "OS",
      "Cliente",
      "Serviço",
      "Valor",
      "Custo",
      "Responsável",
      "Origem",
      "Status",
      "Data",
    ];

    const rows = filtrado.map((o) => [
      o.numero_os,
      o.cliente,
      o.tipo_servico,
      o.valor_orcamento,
      o.custo,
      o.responsavel,
      o.origem_lead,
      o.status,
      new Date(
        o.data_orcamento || o.created_at
      ).toLocaleDateString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orcamentos.csv";
    link.click();
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      filtrado.map((o) => ({
        OS: o.numero_os,
        Cliente: o.cliente,
        Serviço: o.tipo_servico,
        Valor: o.valor_orcamento,
        Custo: o.custo,
        Responsável: o.responsavel,
        Origem: o.origem_lead,
        Status: o.status,
        Data: new Date(
          o.data_orcamento || o.created_at
        ).toLocaleDateString(),
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orcamentos");
    XLSX.writeFile(wb, "orcamentos.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF();

    const rows = filtrado.map((o) => [
      o.numero_os,
      o.cliente,
      o.tipo_servico,
      `R$ ${(o.valor_orcamento || 0).toFixed(2)}`,
      `R$ ${(o.custo || 0).toFixed(2)}`,
      o.status,
      new Date(
        o.data_orcamento || o.created_at
      ).toLocaleDateString(),
    ]);

    autoTable(doc, {
      head: [["OS", "Cliente", "Serviço", "Valor", "Custo", "Status", "Data"]],
      body: rows,
    });

    doc.save("orcamentos.pdf");
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-6 text-center">Orçamentos</h1>

      <input
        type="text"
        placeholder="Buscar cliente..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-6 p-3 w-full bg-gray-800 rounded text-center"
      />

      {/* FILTROS */}
      <div className="grid md:grid-cols-6 gap-4 mb-6">
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        >
          <option value="all">Todos Status</option>
          <option value="lead">Lead</option>
          <option value="proposta_enviada">Proposta Enviada</option>
          <option value="proposta_validada">Proposta Validada</option>
          <option value="andamento">Andamento</option>
          <option value="concluido">Concluído</option>
        </select>

        <input
          type="number"
          placeholder="Valor mínimo"
          value={valorMin}
          onChange={(e) => setValorMin(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        />

        <input
          type="number"
          placeholder="Valor máximo"
          value={valorMax}
          onChange={(e) => setValorMax(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        />

        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        />

        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        />

        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        >
          <option value="all">Todo período</option>
          <option value="mes">Este mês</option>
        </select>
      </div>

      {/* BOTÕES */}
      <div className="flex flex-wrap justify-between gap-4 mb-4">
        <button
          onClick={limparFiltros}
          className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition"
        >
          Limpar Filtros
        </button>

        <div className="flex gap-4">
          <button
            onClick={exportCSV}
            className="bg-blue-600 px-4 py-2 rounded"
          >
            CSV
          </button>

          <button
            onClick={exportExcel}
            className="bg-green-600 px-4 py-2 rounded"
          >
            Excel
          </button>

          <button
            onClick={exportPDF}
            className="bg-red-600 px-4 py-2 rounded"
          >
            PDF
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-gray-900 rounded border border-gray-800 overflow-auto">
        <table className="w-full text-sm text-center">
          <thead className="bg-gray-800">
            <tr>
              <th className="p-3">OS</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Serviço</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Custo</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Status</th>
              <th className="p-3">Data</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-6">
                  Carregando...
                </td>
              </tr>
            ) : filtrado.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-gray-400">
                  Nenhum orçamento encontrado
                </td>
              </tr>
            ) : (
              filtrado.map((o) => (
                <tr key={o.id} className="border-t border-gray-800">
                  <td className="p-3">{o.numero_os}</td>
                  <td className="p-3">{o.cliente}</td>
                  <td className="p-3">{o.tipo_servico}</td>
                  <td className="p-3 text-blue-400 font-semibold">
                    R$ {(o.valor_orcamento || 0).toFixed(2)}
                  </td>
                  <td className="p-3 text-red-400">
                    R$ {(o.custo || 0).toFixed(2)}
                  </td>
                  <td className="p-3">{o.responsavel}</td>
                  <td className="p-3">{o.origem_lead}</td>
                  <td className="p-3">{o.status}</td>
                  <td className="p-3">
                    {new Date(
                      o.data_orcamento || o.created_at
                    ).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}