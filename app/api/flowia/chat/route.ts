import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `
Você é a FlowIA, assistente de inteligência do CRM FlowDesk.

Você ajuda usuários a analisar:

- leads
- vendas
- pipeline
- conversão
- atividades comerciais

Sempre responda em português.
Se for dado numérico, explique de forma clara.
`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, companyId } = body

    if (!message || !companyId) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    }

    /* =========================
       BUSCAR DADOS DO CRM
    ==========================*/

    const { data: leads } = await supabase
      .from("servicos")
      .select("*")
      .eq("company_id", companyId)

    const { data: atividades } = await supabase
      .from("lead_atividades")
      .select("*")
      .eq("company_id", companyId)

    /* =========================
       MÉTRICAS
    ==========================*/

    const totalLeads = leads?.length || 0

    const concluidos =
      leads?.filter((l) => l.status === "concluido").length || 0

    const receita = leads
      ?.filter((l) => l.status === "concluido")
      .reduce((acc, l) => acc + Number(l.valor_orcamento || 0), 0)

    const conversao =
      totalLeads > 0 ? ((concluidos / totalLeads) * 100).toFixed(1) : "0"

    const pipeline = {
      lead: leads?.filter((l) => l.status === "lead").length || 0,
      proposta: leads?.filter((l) => l.status === "proposta_enviada").length || 0,
      aguardando: leads?.filter((l) => l.status === "aguardando_cliente").length || 0,
      validada: leads?.filter((l) => l.status === "proposta_validada").length || 0,
      andamento: leads?.filter((l) => l.status === "andamento").length || 0,
      concluido: leads?.filter((l) => l.status === "concluido").length || 0,
      perdido: leads?.filter((l) => l.status === "perdido").length || 0,
    }

    const contextoCRM = {
      total_leads: totalLeads,
      vendas_concluidas: concluidos,
      receita_total: receita,
      taxa_conversao: conversao,
      pipeline,
      leads,
      atividades,
    }

    /* =========================
       GPT
    ==========================*/

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "system",
          content: `Dados atuais do CRM: ${JSON.stringify(contextoCRM).slice(0,12000)}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    })

    const reply = completion.choices[0].message.content

    return NextResponse.json({ reply })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: "Erro FlowIA" },
      { status: 500 }
    )
  }
}