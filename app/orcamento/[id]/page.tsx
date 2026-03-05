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

  const dataCriacaoObj = data.created_at ? new Date(data.created_at) : null

  const dataCriacao = dataCriacaoObj
    ? dataCriacaoObj.toLocaleDateString("pt-BR")
    : "—"

  // Expiração (7 dias)
  const diasExpiracao = 7

  let diasRestantes = null

  if (dataCriacaoObj) {
    const hoje = new Date()
    const diff = Math.floor(
      (hoje.getTime() - dataCriacaoObj.getTime()) /
      (1000 * 60 * 60 * 24)
    )

    diasRestantes = diasExpiracao - diff
  }

  const mensagemAprovar = encodeURIComponent(
`Olá! Acabei de APROVAR o orçamento.

Cliente: ${data.cliente}
Valor: ${valorFormatado}
Código: #${data.id.slice(0,6)}

Enviado pelo FlowDesk`
  )

  const whatsappAprovar = `https://wa.me/5562994693465?text=${mensagemAprovar}`

  const whatsappDuvida = `https://wa.me/5562994693465?text=${encodeURIComponent(
`Olá! Tenho uma dúvida sobre o orçamento.

Cliente: ${data.cliente}
Código: #${data.id.slice(0,6)}`
)}`

  const whatsappRecusa = `https://wa.me/5562994693465?text=${encodeURIComponent(
`Olá! Analisei o orçamento mas não tenho interesse no momento.

Cliente: ${data.cliente}
Código: #${data.id.slice(0,6)}`
)}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center p-6">

      <div className="w-full max-w-xl">

        {/* HEADER */}

        <div className="text-center mb-8">

          <h1 className="text-2xl font-bold text-gray-800">
            FlowDesk
          </h1>

          <p className="text-sm text-gray-500">
            Proposta Comercial
          </p>

        </div>

        {/* CARD */}

        <div className="bg-white rounded-2xl shadow-xl border p-10">

          {/* TOP */}

          <div className="flex justify-between items-center mb-6">

            <div>

              <h2 className="text-2xl font-semibold text-gray-800">
                Orçamento
              </h2>

              <p className="text-sm text-gray-400">
                Código #{data.id.slice(0,6)}
              </p>

            </div>

            <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">
              Disponível
            </span>

          </div>

          <hr className="mb-6"/>

          {/* CLIENTE */}

          <div className="mb-6">

            <p className="text-sm text-gray-500">
              Cliente
            </p>

            <p className="text-lg font-semibold text-gray-800">
              {data.cliente}
            </p>

          </div>

          {/* DATA */}

          <div className="mb-6">

            <p className="text-sm text-gray-500">
              Emitido em
            </p>

            <p className="text-sm font-medium text-gray-700">
              {dataCriacao}
            </p>

          </div>

          {/* VALOR */}

          <div className="mb-8">

            <p className="text-sm text-gray-500">
              Valor total
            </p>

            <p className="text-4xl font-bold text-purple-600">
              {valorFormatado}
            </p>

          </div>

          {/* ALERTA EXPIRAÇÃO */}

          {diasRestantes !== null && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded-lg text-center">

              {diasRestantes > 0
                ? `Este orçamento expira em ${diasRestantes} dias`
                : `Este orçamento pode estar expirado`
              }

            </div>
          )}

          {/* DETALHES */}

          <details className="mb-8 bg-gray-50 border rounded-lg p-4">

            <summary className="cursor-pointer font-medium text-gray-700">
              Ver detalhes do serviço
            </summary>

            <div className="mt-4 space-y-4 text-sm text-gray-700">

              <div>
                <p className="text-gray-500 text-xs">
                  Tipo de serviço
                </p>

                <p className="font-medium">
                  {data.tipo_servico || "—"}
                </p>
              </div>

              <div>
                <p className="text-gray-500 text-xs">
                  Descrição
                </p>

                <p className="font-medium">
                  {data.descricao || "Sem descrição"}
                </p>
              </div>

            </div>

          </details>

          {/* AÇÕES PRINCIPAIS */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            <a
              href={whatsappAprovar}
              target="_blank"
              className="text-center bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium"
            >
              Aprovar orçamento
            </a>

            <BotaoPDF data={data} />

          </div>

          {/* RESPOSTAS RÁPIDAS */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <a
              href={whatsappDuvida}
              target="_blank"
              className="text-center bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Tirar uma dúvida
            </a>

            <a
              href={whatsappRecusa}
              target="_blank"
              className="text-center bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Não tenho interesse
            </a>

          </div>

          {/* VALIDADE */}

          <p className="text-xs text-gray-400 mt-6 text-center">
            Este orçamento pode sofrer alterações após 7 dias.
          </p>

        </div>

        {/* FOOTER */}

        <p className="text-center text-xs text-gray-400 mt-6">
          Orçamento gerado com FlowDesk
        </p>

      </div>

    </div>
  )
}