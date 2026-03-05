import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"

export default async function OrcamentoPublico({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !data) {
    return notFound()
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Orçamento</h1>
      <hr />
      <p><strong>Cliente:</strong> {data.cliente}</p>
      <p><strong>Valor:</strong> R$ {data.valor_orcamento}</p>
    </div>
  )
}