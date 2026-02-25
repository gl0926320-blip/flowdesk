"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Orcamento {
  id: string;
  cliente: string | null;
  valor_orcamento: number | null;
  status: string | null;
  created_at: string;
}

export default function OrcamentosPage() {
  const supabase = createClient();

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("all");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
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

    if (error) {
      console.error(error);
    } else {
      setOrcamentos(data || []);
    }

    setLoading(false);
  }

  // 🔥 FILTROS COMBINÁVEIS
  const filtrado = orcamentos.filter((o) => {
    // Cliente
    if (!(o.cliente || "").toLowerCase().includes(busca.toLowerCase())) {
      return false;
    }

    // Status
    if (statusFiltro !== "all" && o.status !== statusFiltro) {
      return false;
    }

    // Valor mínimo
    if (valorMin && (o.valor_orcamento || 0) < Number(valorMin)) {
      return false;
    }

    // Valor máximo
    if (valorMax && (o.valor_orcamento || 0) > Number(valorMax)) {
      return false;
    }

    // Período - Este mês
    if (periodo === "mes") {
      const now = new Date();
      const data = new Date(o.created_at);

      if (
        data.getMonth() !== now.getMonth() ||
        data.getFullYear() !== now.getFullYear()
      ) {
        return false;
      }
    }

    return true;
  });

  // 🔥 EXPORTAR CSV
  function exportCSV() {
    const headers = ["Cliente", "Valor", "Status", "Data"];

    const rows = filtrado.map((o) => [
      o.cliente,
      o.valor_orcamento,
      o.status,
      new Date(o.created_at).toLocaleDateString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "orcamentos.csv";
    a.click();
  }

  // 🔥 EXPORTAR EXCEL
  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      filtrado.map((o) => ({
        Cliente: o.cliente,
        Valor: o.valor_orcamento,
        Status: o.status,
        Data: new Date(o.created_at).toLocaleDateString(),
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orcamentos");
    XLSX.writeFile(wb, "orcamentos.xlsx");
  }

  // 🔥 EXPORTAR PDF
  function exportPDF() {
    const doc = new jsPDF();

    const tableData = filtrado.map((o) => [
      o.cliente,
      `R$ ${(o.valor_orcamento || 0).toFixed(2)}`,
      o.status,
      new Date(o.created_at).toLocaleDateString(),
    ]);

    autoTable(doc, {
      head: [["Cliente", "Valor", "Status", "Data"]],
      body: tableData,
    });

    doc.save("orcamentos.pdf");
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-6 text-center">Orçamentos</h1>

      {/* BUSCA */}
      <input
        type="text"
        placeholder="Buscar por cliente..."
        className="mb-6 p-3 w-full bg-gray-800 rounded outline-none focus:ring-2 focus:ring-purple-600 text-center"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {/* FILTROS */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        >
          <option value="all">Todos Status</option>
          <option value="aprovado">Aprovado</option>
          <option value="concluido">Concluído</option>
          <option value="proposta_enviada">Proposta Enviada</option>
          <option value="recusado">Recusado</option>
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

        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="p-3 bg-gray-800 rounded"
        >
          <option value="all">Todo período</option>
          <option value="mes">Este mês</option>
        </select>
      </div>

      {/* BOTÕES EXPORTAÇÃO */}
      <div className="flex gap-4 mb-4 justify-end">
        <button
          onClick={exportCSV}
          className="bg-blue-600 px-4 py-2 rounded hover:opacity-80"
        >
          CSV
        </button>

        <button
          onClick={exportExcel}
          className="bg-green-600 px-4 py-2 rounded hover:opacity-80"
        >
          Excel
        </button>

        <button
          onClick={exportPDF}
          className="bg-red-600 px-4 py-2 rounded hover:opacity-80"
        >
          PDF
        </button>
      </div>

      {/* TABELA */}
      <div className="bg-gray-900 rounded border border-gray-800 overflow-hidden">
        <table className="w-full table-fixed text-center border-collapse">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="p-4 w-1/4">Cliente</th>
              <th className="p-4 w-1/4">Valor</th>
              <th className="p-4 w-1/4">Status</th>
              <th className="p-4 w-1/4">Data</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : filtrado.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-gray-400">
                  Nenhum orçamento encontrado
                </td>
              </tr>
            ) : (
              filtrado.map((orcamento) => (
                <tr
                  key={orcamento.id}
                  className="border-t border-gray-800 hover:bg-gray-800/40 transition"
                >
                  <td className="p-4 truncate">
                    {orcamento.cliente || "Sem nome"}
                  </td>

                  <td className="p-4 font-semibold text-blue-400">
                    R$ {(orcamento.valor_orcamento || 0).toFixed(2)}
                  </td>

                  <td className="p-4 truncate">
                    {orcamento.status || "Sem status"}
                  </td>

                  <td className="p-4">
                    {new Date(
                      orcamento.created_at
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