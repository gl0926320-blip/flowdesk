"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface Cliente {
  nome: string;
  total_servicos: number;
  total_orcado: number;
  total_custo: number;
  total_lucro: number;
  ultima_compra: string | null;
  telefone: string | null;
  email: string | null;
  tipo_pessoa: string | null;
}

export default function ClientesPage() {
  const supabase = createClient();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    fetchClientes();
  }, []);

  async function fetchClientes() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .eq("user_id", userData.user.id);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const agrupado: { [key: string]: Cliente } = {};

    data?.forEach((servico: any) => {
      const nomeCliente = servico.cliente || "Sem nome";

      if (!agrupado[nomeCliente]) {
        agrupado[nomeCliente] = {
          nome: nomeCliente,
          total_servicos: 0,
          total_orcado: 0,
          total_custo: 0,
          total_lucro: 0,
          ultima_compra: servico.created_at || null,
          telefone: servico.telefone || null,
          email: servico.email || null,
          tipo_pessoa: servico.tipo_pessoa || null,
        };
      }

      const valor = Number(servico.valor_orcamento) || 0;
      const custo = Number(servico.custo) || 0;

      agrupado[nomeCliente].total_servicos += 1;
      agrupado[nomeCliente].total_orcado += valor;
      agrupado[nomeCliente].total_custo += custo;
      agrupado[nomeCliente].total_lucro += valor - custo;

      if (
        servico.created_at &&
        new Date(servico.created_at) >
          new Date(agrupado[nomeCliente].ultima_compra || 0)
      ) {
        agrupado[nomeCliente].ultima_compra = servico.created_at;
      }
    });

    const lista = Object.values(agrupado);

    lista.sort((a, b) => b.total_orcado - a.total_orcado);

    setClientes(lista);
    setLoading(false);
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const totalClientes = clientes.length;
  const receitaTotal = clientes.reduce((acc, c) => acc + c.total_orcado, 0);
  const lucroTotal = clientes.reduce((acc, c) => acc + c.total_lucro, 0);

  return (
    <div className="p-6 text-white min-h-screen bg-gradient-to-b from-[#0f172a] to-[#0b1120]">
      <h1 className="text-3xl font-bold mb-6">👥 Clientes</h1>

      {/* CARDS RESUMO */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card titulo="Total Clientes" valor={totalClientes.toString()} cor="bg-blue-600" />
        <Card
          titulo="Receita Gerada"
          valor={receitaTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          cor="bg-purple-600"
        />
        <Card
          titulo="Lucro Total"
          valor={lucroTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          cor="bg-green-600"
        />
      </div>

      <input
        type="text"
        placeholder="Buscar cliente..."
        className="mb-6 p-3 w-full bg-[#1f2937] rounded-xl outline-none focus:ring-2 focus:ring-purple-600"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {/* TABELA */}
      <div className="bg-[#111827] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#1f2937] text-gray-300">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3 text-center">Serviços</th>
              <th className="p-3 text-right">Receita</th>
              <th className="p-3 text-right">Lucro</th>
              <th className="p-3 text-right">Margem</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">
                  Carregando clientes...
                </td>
              </tr>
            ) : clientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              clientesFiltrados.map((cliente, index) => {
                const margem =
                  cliente.total_orcado > 0
                    ? (cliente.total_lucro / cliente.total_orcado) * 100
                    : 0;

                return (
                  <tr
                    key={index}
                    className="border-t border-gray-700 hover:bg-[#1a2233] transition"
                  >
                    <td className="p-3 font-medium">{cliente.nome}</td>
                    <td className="p-3 text-center">
                      {cliente.total_servicos}
                    </td>
                    <td className="p-3 text-right text-blue-400">
                      {cliente.total_orcado.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-3 text-right text-green-400 font-semibold">
                      {cliente.total_lucro.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="p-3 text-right">
                      {margem.toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedCliente(cliente)}
                        className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {selectedCliente && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSelectedCliente(null)}
        >
          <div
            className="bg-[#0f172a] w-full max-w-xl rounded-2xl shadow-2xl p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCliente(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-6 border-b border-gray-700 pb-2">
              📄 Detalhes do Cliente
            </h2>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Nome" value={selectedCliente.nome} />
              <Info label="Tipo Pessoa" value={selectedCliente.tipo_pessoa} />
              <Info label="Telefone" value={selectedCliente.telefone} />
              <Info label="Email" value={selectedCliente.email} />
              <Info
                label="Total Serviços"
                value={selectedCliente.total_servicos}
              />
              <Info
                label="Última Compra"
                value={
                  selectedCliente.ultima_compra
                    ? new Date(
                        selectedCliente.ultima_compra
                      ).toLocaleDateString("pt-BR")
                    : "-"
                }
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