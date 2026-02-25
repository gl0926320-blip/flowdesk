"use client"
export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser";

interface Cliente {
  nome: string
  total_servicos: number
  total_orcado: number
  total_custo: number
  total_lucro: number
}

export default function ClientesPage() {
  const supabase = createClient();
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClientes()
  }, [])

  async function fetchClientes() {
    setLoading(true)

    const { data, error } = await supabase
      .from("servicos")
      .select("*")

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    const agrupado: { [key: string]: Cliente } = {}

    data?.forEach((servico: any) => {
      const nomeCliente = servico.cliente || "Sem nome"

      if (!agrupado[nomeCliente]) {
        agrupado[nomeCliente] = {
          nome: nomeCliente,
          total_servicos: 0,
          total_orcado: 0,
          total_custo: 0,
          total_lucro: 0
        }
      }

      const valor = Number(servico.valor_orcamento) || 0
      const custo = Number(servico.custo) || 0

      agrupado[nomeCliente].total_servicos += 1
      agrupado[nomeCliente].total_orcado += valor
      agrupado[nomeCliente].total_custo += custo
      agrupado[nomeCliente].total_lucro += (valor - custo)
    })

    const lista = Object.values(agrupado)

    // ordenar por quem mais gerou receita
    lista.sort((a, b) => b.total_orcado - a.total_orcado)

    setClientes(lista)
    setLoading(false)
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-6">Clientes</h1>

      <input
        type="text"
        placeholder="Buscar cliente..."
        className="mb-6 p-2 w-full bg-gray-800 rounded outline-none focus:ring-2 focus:ring-purple-600"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="bg-gray-900 rounded overflow-hidden border border-gray-800">
        <table className="w-full text-left">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3 text-center">Serviços</th>
              <th className="p-3 text-right">Total Orçado</th>
              <th className="p-3 text-right">Custo</th>
              <th className="p-3 text-right">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Carregando clientes...
                </td>
              </tr>
            ) : clientesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              clientesFiltrados.map((cliente, index) => (
                <tr
                  key={index}
                  className="border-t border-gray-800 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3 font-medium">{cliente.nome}</td>
                  <td className="p-3 text-center">
                    {cliente.total_servicos}
                  </td>
                  <td className="p-3 text-right text-blue-400">
                    R$ {cliente.total_orcado.toFixed(2)}
                  </td>
                  <td className="p-3 text-right text-red-400">
                    R$ {cliente.total_custo.toFixed(2)}
                  </td>
                  <td className="p-3 text-right text-green-400 font-semibold">
                    R$ {cliente.total_lucro.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}