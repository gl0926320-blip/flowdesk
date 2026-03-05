import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"
import BotaoPDF from "./BotaoPDF"

export default async function OrcamentoPublico({
  params,
}: {
  params: Promise<{ id: string }>
}) {

  const { id } = await params

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) {
    return notFound()
  }

  const valorFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(data.valor_orcamento)

  const mensagem = encodeURIComponent(
    `Olá! Acabei de APROVAR o orçamento no FlowDesk.\n\nCliente: ${data.cliente}\nValor: ${valorFormatado}\nCódigo: #${data.id.slice(0,6)}`
  )

  const whatsappLink = `https://wa.me/5562994693465?text=${mensagem}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex justify-center items-center p-6">

      <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-xl border">

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            Orçamento
          </h1>

          <span className="text-gray-400 text-sm">
            #{data.id.slice(0,6)}
          </span>
        </div>

        <hr className="mb-6"/>

        <div className="space-y-6">

          <div>
            <p className="text-gray-500 text-sm">
              Cliente
            </p>

            <p className="text-xl font-semibold text-gray-800">
              {data.cliente}
            </p>
          </div>

          <div>
            <p className="text-gray-500 text-sm">
              Valor total
            </p>

            <p className="text-4xl font-bold text-purple-600">
              {valorFormatado}
            </p>
          </div>

        </div>

        <div className="mt-10 flex flex-wrap gap-4">

          <a
            href={whatsappLink}
            target="_blank"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium"
          >
            Aprovar orçamento
          </a>

          <BotaoPDF data={data} />

        </div>

        <p className="text-xs text-gray-400 mt-8 text-center">
          Orçamento gerado pelo FlowDesk
        </p>

      </div>

    </div>
  )
}