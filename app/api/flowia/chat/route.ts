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

type ActionButton = {
  id: string;
  label: string;
  prompt: string;
  variant?: "primary" | "secondary" | "ghost";
};

type InsightCard = {
  id: string;
  title: string;
  value: string;
  tone?: "cyan" | "green" | "yellow" | "red";
};

type LeadCard = {
  id: string;
  leadId: string;
  title: string;
  status: string;
  temperatura: string;
  valor: string;
  responsavel: string;
  origem: string;
  subtitle?: string;
  prompt: string;
};

type AssistantPayload = {
  text: string;
  actions?: ActionButton[];
  insights?: InsightCard[];
  leadCards?: LeadCard[];
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
  return date.toLocaleDateString("pt-BR");
}

function getLeadDisplayName(lead: LeadRecord) {
  return lead.cliente || lead.titulo || "Sem nome";
}

function getReferenceDate(lead: LeadRecord) {
  return (
    lead.data_entrada ||
    lead.updated_at ||
    lead.ultimo_contato ||
    lead.created_at ||
    null
  );
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function buildQuickInsights(ctx: FlowIAContext): InsightCard[] {
  return [
    {
      id: "total",
      title: "Leads totais",
      value: String(ctx.metrics.totalLeads),
      tone: "cyan",
    },
    {
      id: "quentes",
      title: "Leads quentes",
      value: String(ctx.metrics.leadsQuentes),
      tone: "yellow",
    },
    {
      id: "conversao",
      title: "Conversão",
      value: `${ctx.metrics.conversao.toFixed(1)}%`,
      tone: "green",
    },
    {
      id: "receita",
      title: "Receita realizada",
      value: formatCurrency(ctx.metrics.receitaRealizada),
      tone: "cyan",
    },
  ];
}

function buildDefaultActions(): ActionButton[] {
  return [
    {
      id: "all-leads",
      label: "Ver todos os leads",
      prompt: "Me mostra o detalhe completo de todos os leads.",
      variant: "primary",
    },
    {
      id: "report",
      label: "Gerar relatório",
      prompt: "Gere um relatório executivo completo do meu CRM.",
      variant: "secondary",
    },
    {
      id: "awaiting",
      label: "Aguardando cliente",
      prompt: "Me mostre os leads em aguardando_cliente.",
      variant: "ghost",
    },
    {
      id: "hot",
      label: "Leads quentes",
      prompt: "Me mostre os leads quentes e o que devo fazer com eles.",
      variant: "ghost",
    },
  ];
}

function buildLeadCards(leads: LeadRecord[], limit = 6): LeadCard[] {
  return leads.slice(0, limit).map((lead) => ({
    id: `card-${lead.id}`,
    leadId: lead.id,
    title: getLeadDisplayName(lead),
    status: lead.status || "-",
    temperatura: lead.temperatura || "-",
    valor: formatCurrency(Number(lead.valor_orcamento || 0)),
    responsavel: lead.responsavel || "-",
    origem: lead.origem_lead || "-",
    subtitle:
      lead.proxima_acao ||
      lead.observacoes ||
      lead.telefone ||
      lead.email ||
      "Sem observações registradas",
    prompt: `Me mostre detalhes do lead ${getLeadDisplayName(lead)}.`,
  }));
}

function classifyIntent(message: string) {
  const msg = message.toLowerCase().trim();

  if (
    msg.includes("quantos leads") ||
    msg === "total de leads" ||
    msg === "quantos leads eu tenho"
  ) {
    return "lead_count";
  }

  if (
    msg.includes("nome da empresa") ||
    msg.includes("qual empresa") ||
    msg.includes("empresa atual")
  ) {
    return "company_name";
  }

  if (
    msg.includes("todos os leads") ||
    msg.includes("detalhe dos leads") ||
    msg.includes("detalhe completo") ||
    msg.includes("status de cada um") ||
    msg.includes("lista completa")
  ) {
    return "all_leads";
  }

  if (
    msg.includes("aguardando mais de 7") ||
    msg.includes("há mais de 7 dias") ||
    msg.includes("mais de 7 dias")
  ) {
    return "awaiting_7_days";
  }

  if (
    msg.includes("leads quentes") ||
    msg === "quente" ||
    msg.includes("quais são os leads quentes")
  ) {
    return "hot_leads";
  }

  if (
    msg.includes("relatório") ||
    msg.includes("analise") ||
    msg.includes("análise") ||
    msg.includes("o que preciso melhorar") ||
    msg.includes("insights")
  ) {
    return "report";
  }

  if (msg.includes("pipeline") && !msg.includes("o que é pipeline")) {
    return "pipeline_summary";
  }

  return "llm";
}

function buildSystemPrompt(dbContext: FlowIAContext) {
  const allLeadsText = dbContext.allLeads.length
    ? dbContext.allLeads
        .map((lead, index) =>
          [
            `${index + 1}. ${getLeadDisplayName(lead)}`,
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
          ].join(" | ")
        )
        .join("\n")
    : "- Sem leads";

  return `
Você é a FlowIA, assistente oficial do CRM FlowDesk.

IDENTIDADE
- Responda sempre em português do Brasil.
- Seja clara, confiante, elegante, útil e objetiva.
- Nunca invente números, nomes, status ou campos.
- Use apenas os dados reais fornecidos abaixo.
- Não esconda leads se o contexto já trouxer todos.
- Se o usuário pedir detalhes de todos os leads, liste TODOS.
- Não responda de forma genérica se houver dados suficientes.
- Não use frases vagas como "posso ajudar com..." antes de responder o pedido principal.

ESTILO DE RESPOSTA
- Respostas curtas para perguntas simples.
- Respostas estruturadas para relatórios e análises.
- Quando listar leads, use blocos organizados.
- Quando fizer análise, prefira:
  1. Resumo
  2. Principais números
  3. Oportunidades
  4. Próximos passos
- Não despeje texto demais sem necessidade.
- Use linguagem natural e profissional, estilo copilot de CRM premium.

SOBRE O FLOWDESK
O FlowDesk é um CRM comercial focado em leads, pipeline, orçamentos, vendas, comissões, campanhas, atendimento e inteligência comercial.

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
    [
      "lead",
      "proposta_enviada",
      "aguardando_cliente",
      "proposta_validada",
      "andamento",
      "concluido",
    ].includes(i.status || "")
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
    companyName: (company as { nome?: string } | null)?.nome || null,
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

function buildDeterministicResponse(
  intent: string,
  ctx: FlowIAContext
): AssistantPayload | null {
  const allLeads = ctx.allLeads;
  const insights = buildQuickInsights(ctx);

  if (intent === "lead_count") {
    return {
      text: `Você tem ${ctx.metrics.totalLeads} leads no total.\n\nQuentes: ${ctx.metrics.leadsQuentes} • Mornos: ${ctx.metrics.leadsMornos} • Frios: ${ctx.metrics.leadsFrios}\nConcluídos: ${ctx.metrics.concluidos} • Perdidos: ${ctx.metrics.perdidos}\nReceita realizada: ${formatCurrency(ctx.metrics.receitaRealizada)} • Conversão: ${ctx.metrics.conversao.toFixed(1)}%`,
      actions: [
        {
          id: "show-all",
          label: "Ver detalhe dos leads",
          prompt: "Me mostra o detalhe completo de todos os leads.",
          variant: "primary",
        },
        {
          id: "show-hot",
          label: "Ver leads quentes",
          prompt: "Me mostre os leads quentes.",
          variant: "secondary",
        },
        {
          id: "show-report",
          label: "Gerar relatório",
          prompt: "Gere um relatório executivo do meu CRM.",
          variant: "ghost",
        },
      ],
      insights,
    };
  }

  if (intent === "company_name") {
    return {
      text: `Você faz parte da empresa ${ctx.companyName || "sem nome cadastrado"}.\n\nID da empresa: ${ctx.companyId || "-"}.`,
      actions: buildDefaultActions(),
      insights,
    };
  }

  if (intent === "all_leads") {
    const ordered = [...allLeads].sort((a, b) =>
      getLeadDisplayName(a).localeCompare(getLeadDisplayName(b), "pt-BR")
    );

    const text = ordered.length
      ? ordered
          .map(
            (lead, index) =>
              `${index + 1}. ${getLeadDisplayName(lead)}\n` +
              `Status: ${lead.status || "-"} • Temperatura: ${lead.temperatura || "-"} • Valor: ${formatCurrency(Number(lead.valor_orcamento || 0))}\n` +
              `Responsável: ${lead.responsavel || "-"} • Origem: ${lead.origem_lead || "-"}\n` +
              `Telefone: ${lead.telefone || "-"} • Email: ${lead.email || "-"}\n` +
              `Próxima ação: ${lead.proxima_acao || "-"}`
          )
          .join("\n\n")
      : "Não há leads cadastrados.";

    return {
      text,
      actions: [
        {
          id: "awaiting",
          label: "Só aguardando cliente",
          prompt: "Me mostre apenas os leads em aguardando_cliente.",
          variant: "primary",
        },
        {
          id: "lost",
          label: "Só perdidos",
          prompt: "Me mostre os leads perdidos e seus motivos.",
          variant: "secondary",
        },
      ],
      insights,
      leadCards: buildLeadCards(ordered, 8),
    };
  }

  if (intent === "awaiting_7_days") {
    const delayed = allLeads.filter((lead) => {
      if (lead.status !== "aguardando_cliente") return false;
      const ref = getReferenceDate(lead);
      const diff = daysSince(ref);
      return diff != null && diff > 7;
    });

    if (!delayed.length) {
      return {
        text: `Não encontrei leads em "aguardando_cliente" há mais de 7 dias com base nas datas disponíveis no CRM.`,
        actions: [
          {
            id: "all-awaiting",
            label: "Ver aguardando cliente",
            prompt: "Me mostre todos os leads em aguardando_cliente.",
            variant: "primary",
          },
        ],
        insights,
      };
    }

    const text = [
      `Encontrei ${delayed.length} lead(s) em "aguardando_cliente" há mais de 7 dias:`,
      "",
      ...delayed.map((lead, index) => {
        const ref = getReferenceDate(lead);
        const diff = daysSince(ref);
        return (
          `${index + 1}. ${getLeadDisplayName(lead)}\n` +
          `Responsável: ${lead.responsavel || "-"} • Temperatura: ${lead.temperatura || "-"} • Valor: ${formatCurrency(Number(lead.valor_orcamento || 0))}\n` +
          `Referência de data: ${formatDate(ref)} • Há ${diff} dias`
        );
      }),
      "",
      "Recomendação: priorize follow-up imediato nesses leads e registre próxima ação para cada um.",
    ].join("\n");

    return {
      text,
      actions: [
        {
          id: "create-followup",
          label: "Gerar plano de follow-up",
          prompt: "Gere um plano de follow-up para os leads aguardando_cliente há mais de 7 dias.",
          variant: "primary",
        },
      ],
      insights,
      leadCards: buildLeadCards(delayed, 6),
    };
  }

  if (intent === "hot_leads") {
    const hot = allLeads.filter((lead) => lead.temperatura === "quente");

    const text = hot.length
      ? [
          `Você tem ${hot.length} lead(s) quente(s).`,
          "",
          ...hot.map(
            (lead, index) =>
              `${index + 1}. ${getLeadDisplayName(lead)}\n` +
              `Status: ${lead.status || "-"} • Valor: ${formatCurrency(Number(lead.valor_orcamento || 0))}\n` +
              `Responsável: ${lead.responsavel || "-"} • Origem: ${lead.origem_lead || "-"}\n` +
              `Próxima ação: ${lead.proxima_acao || "-"}`
          ),
          "",
          "Recomendação: priorize contato imediato e tentativa de avanço de etapa nesses leads.",
        ].join("\n")
      : "Você não tem leads quentes no momento.";

    return {
      text,
      actions: [
        {
          id: "next-steps-hot",
          label: "O que fazer com eles",
          prompt: "Me diga o que devo fazer agora com meus leads quentes.",
          variant: "primary",
        },
        {
          id: "full-report",
          label: "Gerar análise",
          prompt: "Analise meus leads quentes e me diga prioridades.",
          variant: "secondary",
        },
      ],
      insights,
      leadCards: buildLeadCards(hot, 6),
    };
  }

  if (intent === "pipeline_summary") {
    return {
      text: [
        `📊 Pipeline atual da ${ctx.companyName || "empresa"}`,
        "",
        ...Object.entries(ctx.byStatus).map(
          ([status, count]) => `- ${status}: ${count}`
        ),
        "",
        `Receita potencial: ${formatCurrency(ctx.metrics.receitaPotencial)}`,
        `Receita confirmada: ${formatCurrency(ctx.metrics.receitaConfirmada)}`,
        `Receita realizada: ${formatCurrency(ctx.metrics.receitaRealizada)}`,
        `Conversão: ${ctx.metrics.conversao.toFixed(1)}%`,
      ].join("\n"),
      actions: [
        {
          id: "awaiting-pipeline",
          label: "Ver gargalos",
          prompt: "Me mostre os gargalos do meu pipeline.",
          variant: "primary",
        },
        {
          id: "report-pipeline",
          label: "Relatório do pipeline",
          prompt: "Gere um relatório executivo do meu pipeline.",
          variant: "secondary",
        },
      ],
      insights,
    };
  }

  if (intent === "report") {
    const awaiting = ctx.byStatus["aguardando_cliente"] || 0;

    return {
      text: [
        `Resumo executivo — ${ctx.companyName || "FlowDesk"}`,
        "",
        `1. Resumo`,
        `- ${ctx.metrics.totalLeads} leads no total`,
        `- ${ctx.metrics.concluidos} concluído(s) e ${ctx.metrics.perdidos} perdido(s)`,
        `- Conversão atual de ${ctx.metrics.conversao.toFixed(1)}%`,
        "",
        `2. Principais números`,
        `- Receita potencial: ${formatCurrency(ctx.metrics.receitaPotencial)}`,
        `- Receita confirmada: ${formatCurrency(ctx.metrics.receitaConfirmada)}`,
        `- Receita realizada: ${formatCurrency(ctx.metrics.receitaRealizada)}`,
        `- Leads quentes: ${ctx.metrics.leadsQuentes}`,
        `- Leads mornos: ${ctx.metrics.leadsMornos}`,
        `- Leads frios: ${ctx.metrics.leadsFrios}`,
        "",
        `3. Oportunidades`,
        `- ${awaiting} lead(s) em aguardando_cliente merecem follow-up prioritário`,
        `- Receita potencial ainda está baixa frente ao total da base`,
        `- Vale acelerar leads quentes e revisar perdidos`,
        "",
        `4. Próximos passos`,
        `- Priorizar follow-up dos quentes e aguardando_cliente`,
        `- Revisar motivos de perda`,
        `- Aumentar geração de proposta_validada e andamento`,
      ].join("\n"),
      actions: [
        {
          id: "awaiting-action",
          label: "Ver leads parados",
          prompt: "Me mostre os leads que precisam de atenção imediata.",
          variant: "primary",
        },
        {
          id: "lost-action",
          label: "Analisar perdidos",
          prompt: "Analise meus leads perdidos e os motivos.",
          variant: "secondary",
        },
      ],
      insights,
      leadCards: buildLeadCards(
        allLeads.filter(
          (lead) =>
            lead.status === "aguardando_cliente" || lead.temperatura === "quente"
        ),
        6
      ),
    };
  }

  return null;
}

function encodeLine(data: unknown) {
  return `${JSON.stringify(data)}\n`;
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

    const ctx = await getCompanyContext(companyId);
    const intent = classifyIntent(message);
    const deterministic = buildDeterministicResponse(intent, ctx);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const meta = {
            type: "meta",
            insights: deterministic?.insights || buildQuickInsights(ctx),
            actions: deterministic?.actions || buildDefaultActions(),
            leadCards: deterministic?.leadCards || [],
          };

          controller.enqueue(encoder.encode(encodeLine(meta)));

          if (deterministic) {
            const chunks = deterministic.text.match(/.{1,80}(\s|$)|.+$/g) || [
              deterministic.text,
            ];

            for (const chunk of chunks) {
              controller.enqueue(
                encoder.encode(encodeLine({ type: "delta", text: chunk }))
              );
              await new Promise((r) => setTimeout(r, 20));
            }

            controller.enqueue(encoder.encode(encodeLine({ type: "done" })));
            return;
          }

          const systemPrompt = buildSystemPrompt(ctx);

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

          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              controller.enqueue(
                encoder.encode(encodeLine({ type: "delta", text: event.delta }))
              );
            }

            if (event.type === "response.completed") {
              break;
            }
          }

          controller.enqueue(encoder.encode(encodeLine({ type: "done" })));
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "erro desconhecido";

          controller.enqueue(
            encoder.encode(
              encodeLine({
                type: "delta",
                text: `Erro ao gerar resposta: ${message}`,
              })
            )
          );
          controller.enqueue(encoder.encode(encodeLine({ type: "done" })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("FlowIA error:", error);

    const message =
      error instanceof Error ? error.message : "Erro interno da FlowIA.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}