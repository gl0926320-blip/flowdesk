import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_COLUMNS = [
  "lead",
  "proposta_enviada",
  "aguardando_cliente",
  "proposta_validada",
  "andamento",
  "concluido",
  "perdido",
] as const;

type FlowIAContext = {
  companyId: string | null;
  metrics: {
    totalLeads: number;
    concluidos: number;
    perdidos: number;
    leadsQuentes: number;
    receitaPotencial: number;
    receitaConfirmada: number;
    receitaRealizada: number;
    conversao: number;
  };
  byStatus: Record<string, number>;
  topResponsaveis: Array<{
    responsavel: string;
    total: number;
    concluidos: number;
    receita: number;
  }>;
  recentLeads: Array<{
    cliente: string;
    status: string;
    temperatura: string | null;
    valor_orcamento: number;
    responsavel: string | null;
    origem_lead: string | null;
    created_at: string;
  }>;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function buildSystemPrompt(dbContext: FlowIAContext) {
  return `
Você é a FlowIA, assistente oficial do CRM FlowDesk.

IDENTIDADE
- Responda sempre em português do Brasil.
- Seja objetiva, clara, útil e com tom profissional.
- Não invente dados.
- Quando não houver dado suficiente, diga isso claramente.
- Quando o usuário pedir análise, use os dados reais recebidos no contexto.
- Quando o usuário pedir explicação funcional, ensine com base nas regras do FlowDesk.

SOBRE O FLOWDESK
O FlowDesk é um CRM comercial focado em operação de vendas, leads, pipeline, orçamentos, vendas, comissões, equipe, campanhas, atendimento e inteligência comercial.

CONCEITOS IMPORTANTES DO FLOWDESK
- Lead: contato ou oportunidade comercial ainda não fechada.
- Temperatura: frio, morno, quente.
- Status do funil:
  - lead
  - proposta_enviada
  - aguardando_cliente
  - proposta_validada
  - andamento
  - concluido
  - perdido
- Receita potencial: soma de leads em lead, proposta_enviada, aguardando_cliente.
- Receita confirmada: soma de proposta_validada e andamento.
- Receita realizada: soma de concluido.
- Conversão: concluídos / base comercial elegível.
- O sistema pode registrar histórico/follow-up por lead.
- O sistema possui orçamentos com itens, valor_orcamento, responsável, origem, temperatura e observações.
- O sistema registra motivo de perda quando um lead é marcado como perdido.
- O sistema pode gerar relatórios, resumos operacionais e sugestões comerciais.

COMO VOCÊ DEVE RESPONDER
- Para dúvidas conceituais, explique de forma simples.
- Para pedidos de análise, use primeiro os dados reais abaixo.
- Para pedidos de relatório, gere um relatório executivo curto, com insights e próximos passos.
- Quando fizer análise, sempre que possível organize assim:
  1. Resumo
  2. Principais números
  3. Insights
  4. Próximos passos
- Não diga que acessou tabelas internas; apenas responda como assistente do sistema.
- Se o usuário pedir algo fora do escopo do contexto recebido, diga que ainda não tem aquele dado específico em tempo real.

DADOS REAIS ATUAIS DO CRM
Empresa atual: ${dbContext.companyId || "não identificada"}

Métricas:
- Total de leads: ${dbContext.metrics.totalLeads}
- Concluídos: ${dbContext.metrics.concluidos}
- Perdidos: ${dbContext.metrics.perdidos}
- Leads quentes: ${dbContext.metrics.leadsQuentes}
- Receita potencial: ${formatCurrency(dbContext.metrics.receitaPotencial)}
- Receita confirmada: ${formatCurrency(dbContext.metrics.receitaConfirmada)}
- Receita realizada: ${formatCurrency(dbContext.metrics.receitaRealizada)}
- Conversão atual: ${dbContext.metrics.conversao.toFixed(1)}%

Leads por status:
${Object.entries(dbContext.byStatus)
  .map(([status, count]) => `- ${status}: ${count}`)
  .join("\n")}

Top responsáveis:
${
  dbContext.topResponsaveis.length
    ? dbContext.topResponsaveis
        .map(
          (r) =>
            `- ${r.responsavel}: ${r.total} leads, ${r.concluidos} concluídos, ${formatCurrency(r.receita)} em receita`
        )
        .join("\n")
    : "- Sem dados"
}

Leads recentes:
${
  dbContext.recentLeads.length
    ? dbContext.recentLeads
        .map(
          (lead) =>
            `- ${lead.cliente} | status=${lead.status} | temperatura=${lead.temperatura || "-"} | valor=${formatCurrency(Number(lead.valor_orcamento || 0))} | responsável=${lead.responsavel || "-"} | origem=${lead.origem_lead || "-"}`
        )
        .join("\n")
    : "- Sem leads recentes"
}

IMPORTANTE
- Quando o usuário perguntar “o que é lead”, “o que é pipeline”, “o que é receita potencial”, etc, explique como isso funciona no FlowDesk.
- Quando o usuário pedir “gere um relatório”, “analise meus leads”, “como está minha conversão”, “me dê insights”, use os dados acima.
- Seja prática, sem enrolar.
`.trim();
}

async function getCompanyContext(companyId: string): Promise<FlowIAContext> {
  const { data: leads, error } = await supabaseAdmin
    .from("servicos")
    .select(
      "id, cliente, status, temperatura, valor_orcamento, responsavel, origem_lead, created_at"
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar dados do CRM: ${error.message}`);
  }

  const items = leads || [];

  const byStatus: Record<string, number> = {};
  for (const status of STATUS_COLUMNS) {
    byStatus[status] = items.filter((i) => i.status === status).length;
  }

  const STATUS_POTENCIAL = ["lead", "proposta_enviada", "aguardando_cliente"];
  const STATUS_CONFIRMADA = ["proposta_validada", "andamento"];
  const STATUS_REALIZADA = ["concluido"];

  const receitaPotencial = items
    .filter((i) => STATUS_POTENCIAL.includes(i.status))
    .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

  const receitaConfirmada = items
    .filter((i) => STATUS_CONFIRMADA.includes(i.status))
    .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

  const receitaRealizada = items
    .filter((i) => STATUS_REALIZADA.includes(i.status))
    .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

  const concluidos = items.filter((i) => i.status === "concluido").length;
  const perdidos = items.filter((i) => i.status === "perdido").length;
  const leadsQuentes = items.filter((i) => i.temperatura === "quente").length;

  const baseConversao = items.filter((i) =>
    [
      "lead",
      "proposta_enviada",
      "aguardando_cliente",
      "proposta_validada",
      "andamento",
      "concluido",
    ].includes(i.status)
  ).length;

  const conversao =
    baseConversao > 0 ? (concluidos / baseConversao) * 100 : 0;

  const responsavelMap = new Map<
    string,
    { responsavel: string; total: number; concluidos: number; receita: number }
  >();

  for (const item of items) {
    const nome = item.responsavel || "Sem responsável";

    if (!responsavelMap.has(nome)) {
      responsavelMap.set(nome, {
        responsavel: nome,
        total: 0,
        concluidos: 0,
        receita: 0,
      });
    }

    const current = responsavelMap.get(nome)!;
    current.total += 1;

    if (item.status === "concluido") {
      current.concluidos += 1;
      current.receita += Number(item.valor_orcamento || 0);
    }
  }

  const topResponsaveis = Array.from(responsavelMap.values())
    .sort((a, b) => b.receita - a.receita || b.total - a.total)
    .slice(0, 5);

  const recentLeads = items.slice(0, 8).map((item) => ({
    cliente: item.cliente || "Sem nome",
    status: item.status || "lead",
    temperatura: item.temperatura || null,
    valor_orcamento: Number(item.valor_orcamento || 0),
    responsavel: item.responsavel || null,
    origem_lead: item.origem_lead || null,
    created_at: item.created_at,
  }));

  return {
    companyId,
    metrics: {
      totalLeads: items.length,
      concluidos,
      perdidos,
      leadsQuentes,
      receitaPotencial,
      receitaConfirmada,
      receitaRealizada,
      conversao,
    },
    byStatus,
    topResponsaveis,
    recentLeads,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message?.trim();
    const companyId = body?.companyId?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Mensagem é obrigatória." },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId é obrigatório para consultar o CRM." },
        { status: 400 }
      );
    }

    const dbContext = await getCompanyContext(companyId);
    const systemPrompt = buildSystemPrompt(dbContext);

    const stream = await openai.responses.create({
      model: "gpt-5-mini",
      stream: true,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              controller.enqueue(encoder.encode(event.delta));
            }

            if (event.type === "response.completed") {
              break;
            }
          }
        } catch (error: any) {
          controller.enqueue(
            encoder.encode(
              `\n\n[Erro ao gerar resposta: ${error?.message || "erro desconhecido"}]`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("FlowIA error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Erro interno da FlowIA.",
      },
      { status: 500 }
    );
  }
}