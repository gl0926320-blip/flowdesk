import { createClient } from "@/lib/supabase-server"
import { notFound } from "next/navigation"

export default async function OrcamentoPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient() // 👈 AQUI

  const { data, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !data) {
    return notFound()
  }

  return (
    <div>
      <h1>Ordem de Serviço</h1>
      <p>Cliente: {data.cliente}</p>
      <p>Valor: {data.valor_orcamento}</p>
    </div>
  )
}