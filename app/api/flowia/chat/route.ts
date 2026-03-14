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

type LeadRecord = {
  id: string;
  cliente: string | null;
  titulo: string | null;
  descricao: string | null;
  status: string | null;
  temperatura: string | null;
  valor_orcamento: number | null;
  responsavel: string | null;
  origem_lead: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  updated_at: string | null;
  created_at: string | null;
  data_entrada: string | null;
  data_fechamento: string | null;
  motivo_perda: string | null;
  ativo: boolean | null;
};

type FlowIAContext = {
  companyId: string | null;
  companyName: string | null;
  metrics: {
    totalLeads: number;
    concluidos: number;
    perdidos: number;
    leadsQuentes: number;
    leadsMornos: number;
    leadsFrios: number;
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
  allLeads: LeadRecord[];
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function buildSystemPrompt(dbContext: FlowIAContext) {
  const allLeadsText = dbContext.allLeads.length
    ? dbContext.allLeads
        .map((lead, index) => {
          return [
            `${index + 1}. ${lead.cliente || lead.titulo || "Sem nome"}`,
            `status=${lead.status || "-"}`,
            `temperatura=${lead.temperatura || "-"}`,
            `valor=${formatCurrency(Number(lead.valor_orcamento || 0))}`,
            `responsável=${lead.responsavel || "-"}`,
            `origem=${lead.origem_lead || "-"}`,
            `telefone=${lead.telefone || "-"}`,
            `email=${lead.email || "-"}`,
            `último_contato=${formatDate(lead.ultimo_contato)}`,
            `próxima_ação=${lead.proxima_acao || "-"}`,
            `data_entrada=${formatDate(lead.data_entrada || lead.created_at)}`,
            `atualizado_em=${formatDate(lead.updated_at)}`,
            `fechamento=${formatDate(lead.data_fechamento)}`,
            `motivo_perda=${lead.motivo_perda || "-"}`,
            `ativo=${lead.ativo === false ? "não" : "sim"}`,
            `observações=${lead.observacoes || "-"}`,
          ].join(" | ");
        })
        .join("\n")
    : "- Sem leads";

  return `
Você é a FlowIA, assistente oficial do CRM FlowDesk.

IDENTIDADE
- Responda sempre em português do Brasil.
- Seja clara, profissional, útil e objetiva.
- Nunca invente números, nomes, status ou campos.
- Use apenas os dados reais fornecidos abaixo.
- Quando não houver dado suficiente, diga claramente.
- Quando o usuário pedir detalhes de todos os leads, liste TODOS os leads disponíveis no contexto.
- Não diga que só tem dados de 8 leads se o contexto trouxer mais do que isso.
- Não diga que faltam dados se eles estiverem no contexto.
- Não diga apenas o UUID da empresa se o nome estiver disponível no contexto.

SOBRE O FLOWDESK
O FlowDesk é um CRM comercial focado em operação de vendas, leads, pipeline, orçamentos, vendas, comissões, equipe, campanhas, atendimento e inteligência comercial.

REGRAS DE RESPOSTA
- Para perguntas simples, responda direto.
- Para perguntas como “quantos leads eu tenho”, responda só o número e um resumo curto.
- Para perguntas como “me mostra o detalhe”, liste os leads com nome, status, temperatura, valor, responsável e origem.
- Para perguntas como “temos leads aguardando mais de 7 dias?”, use data_entrada, updated_at, created_at ou ultimo_contato como referência temporal mais útil disponível.
- Para perguntas sobre empresa do usuário, use o nome da empresa atual.
- Para perguntas sobre frio, morno, quente, lead, pipeline, receita potencial etc, explique como funciona no FlowDesk.
- Para relatórios, use a estrutura:
  1. Resumo
  2. Principais números
  3. Insights
  4. Próximos passos
- Evite responder com “posso fazer isso agora?” sem antes entregar o que o usuário pediu.
- Evite resposta genérica e vaga.
- Evite despejar texto desnecessário.
- Se o usuário pedir exportação Excel/CSV, primeiro entregue os dados organizados ou diga exatamente o que pode ser exportado.

DADOS REAIS DO CRM
Empresa atual:
- ID: ${dbContext.companyId || "-"}
- Nome: ${dbContext.companyName || "-"}

Métricas:
- Total de leads: ${dbContext.metrics.totalLeads}
- Concluídos: ${dbContext.metrics.concluidos}
- Perdidos: ${dbContext.metrics.perdidos}
- Leads quentes: ${dbContext.metrics.leadsQuentes}
- Leads mornos: ${dbContext.metrics.leadsMornos}
- Leads frios: ${dbContext.metrics.leadsFrios}
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

LISTA COMPLETA DOS LEADS:
${allLeadsText}

IMPORTANTE FINAL
- Quando o usuário pedir detalhes dos leads, use a LISTA COMPLETA DOS LEADS.
- Não esconda leads.
- Não limite a resposta aos primeiros 8.
- Se o usuário pedir todos os leads, traga todos.
- Se o usuário pedir o nome da empresa, responda com o nome.
`.trim();
}

async function getCompanyContext(companyId: string): Promise<FlowIAContext> {
  const [{ data: leads, error: leadsError }, { data: company, error: companyError }] =
    await Promise.all([
      supabaseAdmin
        .from("servicos")
        .select(`
          id,
          cliente,
          titulo,
          descricao,
          status,
          temperatura,
          valor_orcamento,
          responsavel,
          origem_lead,
          telefone,
          email,
          observacoes,
          ultimo_contato,
          proxima_acao,
          updated_at,
          created_at,
          data_entrada,
          data_fechamento,
          motivo_perda,
          ativo
        `)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("companies")
        .select("id, nome")
        .eq("id", companyId)
        .maybeSingle(),
    ]);

  if (leadsError) {
    throw new Error(`Erro ao buscar dados do CRM: ${leadsError.message}`);
  }

  if (companyError) {
    console.error("Erro ao buscar empresa:", companyError.message);
  }

  const items = (leads || []) as LeadRecord[];

  const byStatus: Record<string, number> = {};
  for (const status of STATUS_COLUMNS) {
    byStatus[status] = items.filter((i) => i.status === status).length;
  }

  const STATUS_POTENCIAL = ["lead", "proposta_enviada", "aguardando_cliente"];
  const STATUS_CONFIRMADA = ["proposta_validada", "andamento"];
  const STATUS_REALIZADA = ["concluido"];

  const receitaPotencial = items
    .filter((i) => i.status && STATUS_POTENCIAL.includes(i.status))
    .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

  const receitaConfirmada = items
    .filter((i) => i.status && STATUS_CONFIRMADA.includes(i.status))
    .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

  const receitaRealizada = items
    .filter((i) => i.status && STATUS_REALIZADA.includes(i.status))
    .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

  const concluidos = items.filter((i) => i.status === "concluido").length;
  const perdidos = items.filter((i) => i.status === "perdido").length;
  const leadsQuentes = items.filter((i) => i.temperatura === "quente").length;
  const leadsMornos = items.filter((i) => i.temperatura === "morno").length;
  const leadsFrios = items.filter((i) => i.temperatura === "frio").length;

  const baseConversao = items.filter((i) =>
    ["lead", "proposta_enviada", "aguardando_cliente", "proposta_validada", "andamento", "concluido"].includes(
      i.status || ""
    )
  ).length;

  const conversao = baseConversao > 0 ? (concluidos / baseConversao) * 100 : 0;

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

  return {
    companyId,
    companyName: (company as any)?.nome || null,
    metrics: {
      totalLeads: items.length,
      concluidos,
      perdidos,
      leadsQuentes,
      leadsMornos,
      leadsFrios,
      receitaPotencial,
      receitaConfirmada,
      receitaRealizada,
      conversao,
    },
    byStatus,
    topResponsaveis,
    allLeads: items,
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