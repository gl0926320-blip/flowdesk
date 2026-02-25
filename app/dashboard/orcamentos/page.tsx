"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser";

interface Orcamento {
  id: string
  cliente: string | null
  valor_orcamento: number | null
  status: string | null
  created_at: string
}

export default function OrcamentosPage() {
  const supabase = createClient();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [busca, setBusca] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrcamentos()
  }, [])

  async function fetchOrcamentos() {
    setLoading(true)

    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
    } else {
      setOrcamentos(data || [])
    }

    setLoading(false)
  }

  const filtrado = orcamentos.filter((o) =>
    (o.cliente || "")
      .toLowerCase()
      .includes(busca.toLowerCase())
  )

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-6">Orçamentos</h1>

      <input
        type="text"
        placeholder="Buscar por cliente..."
        className="mb-4 p-2 w-full bg-gray-800 rounded outline-none focus:ring-2 focus:ring-purple-600"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div className="bg-gray-900 rounded overflow-hidden border border-gray-800">
        <table className="w-full text-left">
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3 text-right">Valor</th>
              <th className="p-3">Status</th>
              <th className="p-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : filtrado.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400">
                  Nenhum orçamento encontrado
                </td>
              </tr>
            ) : (
              filtrado.map((orcamento) => (
                <tr
                  key={orcamento.id}
                  className="border-t border-gray-800 hover:bg-gray-800/40 transition"
                >
                  <td className="p-3 font-medium">
                    {orcamento.cliente || "Sem nome"}
                  </td>

                  <td className="p-3 text-right text-blue-400">
                    R$ {(orcamento.valor_orcamento || 0).toFixed(2)}
                  </td>

                  <td className="p-3">
                    {orcamento.status || "Sem status"}
                  </td>

                  <td className="p-3">
                    {new Date(orcamento.created_at).toLocaleDateString()}
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