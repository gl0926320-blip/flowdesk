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
  user_id: string | null;
  titulo: string | null;
  descricao: string | null;
  status: string | null;
  created_at: string | null;
  numero_os: string | null;
  cliente: string | null;
  tipo_servico: string | null;
  valor_orcamento: number | null;
  custo: number | null;
  data_abertura: string | null;
  data_orcamento: string | null;
  origem_lead: string | null;
  tipo_pessoa: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
  forma_pagamento: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  updated_at: string | null;
  entrega: string | null;
  itens: unknown;
  ativo: boolean | null;
  ultima_compra: string | null;
  data_entrada: string | null;
  vendedor_id: string | null;
  percentual_comissao: number | null;
  valor_comissao: number | null;
  comissao_paga: boolean | null;
  company_id: string | null;
  temperatura: string | null;
  campaign_id: string | null;
  campaign_slug: string | null;
  tracked_at: string | null;
  data_fechamento: string | null;
  criado_por: string | null;
  criado_por_email: string | null;
  motivo_perda: string | null;
};

type SellerSummary = {
  responsavel: string;
  total: number;
  concluidos: number;
  perdidos: number;
  receita: number;
  comissao: number;
};

type CampaignSummary = {
  nome: string;
  total: number;
  receita: number;
};

type PaymentSummary = {
  forma: string;
  total: number;
  receita: number;
};

type FlowIAContext = {
  companyId: string | null;
  companyName: string | null;
  plan: string;
  userId: string | null;
  userEmail: string | null;
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
    custoTotalConcluido: number;
    lucroRealizado: number;
    comissaoTotal: number;
    comissaoPagaTotal: number;
    ticketMedio: number;
    conversao: number;
    aguardandoCliente: number;
    andamento: number;
    propostaValidada: number;
    semProximaAcao: number;
  };
  byStatus: Record<string, number>;
  topResponsaveis: SellerSummary[];
  topCampanhas: CampaignSummary[];
  topPagamentos: PaymentSummary[];
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

type AuthUserContext = {
  userId: string | null;
  userEmail: string | null;
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
  return lead.cliente || lead.titulo || lead.numero_os || "Sem nome";
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

function normalizeText(value?: string | null) {
  return (value || "").trim();
}

function getCampaignDisplayName(lead: LeadRecord) {
  return (
    normalizeText(lead.campaign_slug) ||
    normalizeText(lead.origem_lead) ||
    "Sem campanha"
  );
}

function getResponsavelDisplayName(lead: LeadRecord) {
  return (
    normalizeText(lead.responsavel) ||
    normalizeText(lead.criado_por_email) ||
    "Sem responsável"
  );
}

async function getAuthenticatedUserFromRequest(
  req: Request
): Promise<AuthUserContext> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    return {
      userId: null,
      userEmail: null,
    };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return {
      userId: null,
      userEmail: null,
    };
  }

  return {
    userId: data.user.id,
    userEmail: data.user.email || null,
  };
}

async function getPlanForUser(userId: string | null, companyId: string | null) {
  let companyPlan: string | null = null;
  let profilePlan: string | null = null;

  if (companyId) {
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("plan")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      console.error("Erro ao buscar plan da company:", companyError.message);
    }

    companyPlan =
      (companyData as { plan?: string | null } | null)?.plan || null;
  }

  if (userId) {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao buscar plan do profile:", profileError.message);
    }

    profilePlan =
      (profileData as { plan?: string | null } | null)?.plan || null;
  }

  return (companyPlan || profilePlan || "free").toLowerCase();
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

function buildDefaultActions(plan: string): ActionButton[] {
  const actions: ActionButton[] = [
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

  if (plan === "free") {
    actions.push({
      id: "upgrade",
      label: "Ver plano com IA",
      prompt: "Explique os benefícios da FlowIA nos planos pagos.",
      variant: "ghost",
    });
  }

  return actions;
}

function buildLeadCards(leads: LeadRecord[], limit = 6): LeadCard[] {
  return leads.slice(0, limit).map((lead) => ({
    id: `card-${lead.id}`,
    leadId: lead.id,
    title: getLeadDisplayName(lead),
    status: lead.status || "-",
    temperatura: lead.temperatura || "-",
    valor: formatCurrency(Number(lead.valor_orcamento || 0)),
    responsavel: getResponsavelDisplayName(lead),
    origem: lead.origem_lead || lead.campaign_slug || "-",
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

  if (msg.includes("pipeline")) {
    return "pipeline_summary";
  }

  if (msg.includes("assinatura") || msg.includes("plano")) {
    return "subscription_summary";
  }

  if (msg.includes("campanha")) {
    return "campaign_summary";
  }

  if (msg.includes("comissão") || msg.includes("comissao")) {
    return "commission_summary";
  }

  if (msg.includes("cliente") || msg.includes("clientes")) {
    return "customers_summary";
  }

  if (
    msg.includes("equipe") ||
    msg.includes("vendedor") ||
    msg.includes("responsável") ||
    msg.includes("responsavel")
  ) {
    return "team_summary";
  }

  if (
    msg.includes("forma de pagamento") ||
    msg.includes("pagamento") ||
    msg.includes("pix") ||
    msg.includes("cartão") ||
    msg.includes("cartao") ||
    msg.includes("boleto")
  ) {
    return "payment_summary";
  }

  if (
    msg.includes("perdido") ||
    msg.includes("perdidos") ||
    msg.includes("motivo de perda") ||
    msg.includes("motivos de perda")
  ) {
    return "loss_summary";
  }

  if (
    msg.includes("comissão paga") ||
    msg.includes("comissao paga") ||
    msg.includes("comissão pendente") ||
    msg.includes("comissao pendente")
  ) {
    return "commission_status_summary";
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
            `custo=${formatCurrency(Number(lead.custo || 0))}`,
            `responsável=${getResponsavelDisplayName(lead)}`,
            `origem=${lead.origem_lead || "-"}`,
            `campanha=${lead.campaign_slug || "-"}`,
            `forma_pagamento=${lead.forma_pagamento || "-"}`,
            `telefone=${lead.telefone || "-"}`,
            `email=${lead.email || "-"}`,
            `último_contato=${formatDate(lead.ultimo_contato)}`,
            `próxima_ação=${lead.proxima_acao || "-"}`,
            `data_entrada=${formatDate(lead.data_entrada || lead.created_at)}`,
            `atualizado_em=${formatDate(lead.updated_at)}`,
            `fechamento=${formatDate(lead.data_fechamento)}`,
            `valor_comissão=${formatCurrency(Number(lead.valor_comissao || 0))}`,
            `percentual_comissão=${lead.percentual_comissao ?? 0}%`,
            `comissão_paga=${lead.comissao_paga ? "sim" : "não"}`,
            `motivo_perda=${lead.motivo_perda || "-"}`,
            `ativo=${lead.ativo === false ? "não" : "sim"}`,
            `observações=${lead.observacoes || "-"}`,
          ].join(" | ")
        )
        .join("\n")
    : "- Sem leads";

  return `
Você é a FlowIA, assistente oficial do CRM FlowDesk.

REGRAS CRÍTICAS
- Responda SEMPRE em português do Brasil.
- Você existe para responder APENAS dentro do contexto do sistema FlowDesk e dos dados reais da empresa atual.
- Nunca transforme a resposta em explicação genérica de internet.
- Se o usuário perguntar algo amplo como "o que é assinatura", "o que é pipeline", "o que é campanha", "o que é comissão", "o que é cliente", interprete SEMPRE como funcionalidade, aba, módulo ou contexto do FlowDesk.
- Se a informação pedida não existir nos dados recebidos, diga isso claramente.
- Nunca invente nomes, números, métricas, status, planos, cobranças, clientes, equipes, campos ou resultados.
- Nunca responda como assistente geral.
- Se a pergunta fugir do escopo do CRM FlowDesk, responda educadamente que você atua no contexto do sistema e da empresa atual.
- Priorize o nome da empresa. Só cite ID quando realmente for útil.
- Não esconda leads se o contexto já trouxer todos.
- Se o usuário pedir detalhes de todos os leads, liste TODOS.
- Não use frases vagas como "posso ajudar com..." antes de responder o pedido principal.
- Quando houver dados suficientes, responda diretamente.
- Quando não houver dados suficientes, deixe isso explícito.

ESTILO
- Seja clara, objetiva, elegante e com cara de copilot premium.
- Respostas curtas para perguntas simples.
- Respostas estruturadas para relatórios e análises.
- Quando listar leads, use blocos organizados.
- Quando fizer análise, prefira:
  1. Resumo
  2. Principais números
  3. Oportunidades
  4. Próximos passos

SOBRE O FLOWDESK
O FlowDesk é um CRM comercial focado em leads, pipeline, orçamentos, vendas, comissões, campanhas, atendimento e inteligência comercial.

CONTEXTO DE ACESSO
- Plano atual: ${dbContext.plan}
- Empresa atual: ${dbContext.companyName || "-"}

DADOS REAIS DO CRM
Empresa atual:
- Nome: ${dbContext.companyName || "-"}
- ID: ${dbContext.companyId || "-"}
- Plano: ${dbContext.plan}

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
- Custo total concluído: ${formatCurrency(dbContext.metrics.custoTotalConcluido)}
- Lucro realizado: ${formatCurrency(dbContext.metrics.lucroRealizado)}
- Comissão total: ${formatCurrency(dbContext.metrics.comissaoTotal)}
- Comissão paga: ${formatCurrency(dbContext.metrics.comissaoPagaTotal)}
- Ticket médio: ${formatCurrency(dbContext.metrics.ticketMedio)}
- Conversão atual: ${dbContext.metrics.conversao.toFixed(1)}%
- Aguardando cliente: ${dbContext.metrics.aguardandoCliente}
- Em andamento: ${dbContext.metrics.andamento}
- Proposta validada: ${dbContext.metrics.propostaValidada}
- Sem próxima ação: ${dbContext.metrics.semProximaAcao}

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
            `- ${r.responsavel}: ${r.total} leads, ${r.concluidos} concluídos, ${r.perdidos} perdidos, ${formatCurrency(r.receita)} em receita, ${formatCurrency(r.comissao)} em comissão`
        )
        .join("\n")
    : "- Sem dados"
}

Top campanhas:
${
  dbContext.topCampanhas.length
    ? dbContext.topCampanhas
        .map(
          (c) => `- ${c.nome}: ${c.total} lead(s), ${formatCurrency(c.receita)} em receita`
        )
        .join("\n")
    : "- Sem dados"
}

Formas de pagamento:
${
  dbContext.topPagamentos.length
    ? dbContext.topPagamentos
        .map(
          (p) => `- ${p.forma}: ${p.total} registro(s), ${formatCurrency(p.receita)} em receita`
        )
        .join("\n")
    : "- Sem dados"
}

LISTA COMPLETA DOS LEADS:
${allLeadsText}
`.trim();
}

async function getCompanyContext(
  companyId: string,
  authUser: AuthUserContext
): Promise<FlowIAContext> {
  const [
    { data: leads, error: leadsError },
    { data: company, error: companyError },
  ] = await Promise.all([
    supabaseAdmin
      .from("servicos")
      .select(`
        id,
        user_id,
        titulo,
        descricao,
        status,
        created_at,
        numero_os,
        cliente,
        tipo_servico,
        valor_orcamento,
        custo,
        data_abertura,
        data_orcamento,
        origem_lead,
        tipo_pessoa,
        cpf,
        cnpj,
        telefone,
        email,
        responsavel,
        forma_pagamento,
        ultimo_contato,
        proxima_acao,
        observacoes,
        updated_at,
        entrega,
        itens,
        ativo,
        ultima_compra,
        data_entrada,
        vendedor_id,
        percentual_comissao,
        valor_comissao,
        comissao_paga,
        company_id,
        temperatura,
        campaign_id,
        campaign_slug,
        tracked_at,
        data_fechamento,
        criado_por,
        criado_por_email,
        motivo_perda
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("companies")
      .select("id, nome, name")
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

  const concluidosItems = items.filter((i) => i.status === "concluido");

  const receitaRealizada = concluidosItems.reduce(
    (acc, i) => acc + Number(i.valor_orcamento || 0),
    0
  );

  const custoTotalConcluido = concluidosItems.reduce(
    (acc, i) => acc + Number(i.custo || 0),
    0
  );

  const comissaoTotal = items.reduce(
    (acc, i) => acc + Number(i.valor_comissao || 0),
    0
  );

  const comissaoPagaTotal = items
    .filter((i) => i.comissao_paga === true)
    .reduce((acc, i) => acc + Number(i.valor_comissao || 0), 0);

  const lucroRealizado =
    receitaRealizada - custoTotalConcluido - comissaoPagaTotal;

  const concluidos = concluidosItems.length;
  const perdidos = items.filter((i) => i.status === "perdido").length;
  const leadsQuentes = items.filter((i) => i.temperatura === "quente").length;
  const leadsMornos = items.filter((i) => i.temperatura === "morno").length;
  const leadsFrios = items.filter((i) => i.temperatura === "frio").length;
  const aguardandoCliente = items.filter(
    (i) => i.status === "aguardando_cliente"
  ).length;
  const andamento = items.filter((i) => i.status === "andamento").length;
  const propostaValidada = items.filter(
    (i) => i.status === "proposta_validada"
  ).length;
  const semProximaAcao = items.filter(
    (i) =>
      !normalizeText(i.proxima_acao) &&
      i.status !== "concluido" &&
      i.status !== "perdido"
  ).length;

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
  const ticketMedio = concluidos > 0 ? receitaRealizada / concluidos : 0;

  const responsavelMap = new Map<string, SellerSummary>();

  for (const item of items) {
    const nome = getResponsavelDisplayName(item);

    if (!responsavelMap.has(nome)) {
      responsavelMap.set(nome, {
        responsavel: nome,
        total: 0,
        concluidos: 0,
        perdidos: 0,
        receita: 0,
        comissao: 0,
      });
    }

    const current = responsavelMap.get(nome)!;
    current.total += 1;
    current.comissao += Number(item.valor_comissao || 0);

    if (item.status === "concluido") {
      current.concluidos += 1;
      current.receita += Number(item.valor_orcamento || 0);
    }

    if (item.status === "perdido") {
      current.perdidos += 1;
    }
  }

  const topResponsaveis = Array.from(responsavelMap.values())
    .sort((a, b) => b.receita - a.receita || b.total - a.total)
    .slice(0, 5);

  const campaignMap = new Map<string, CampaignSummary>();

  for (const item of items) {
    const nome = getCampaignDisplayName(item);

    if (!campaignMap.has(nome)) {
      campaignMap.set(nome, {
        nome,
        total: 0,
        receita: 0,
      });
    }

    const current = campaignMap.get(nome)!;
    current.total += 1;

    if (item.status === "concluido") {
      current.receita += Number(item.valor_orcamento || 0);
    }
  }

  const topCampanhas = Array.from(campaignMap.values())
    .sort((a, b) => b.receita - a.receita || b.total - a.total)
    .slice(0, 5);

  const paymentMap = new Map<string, PaymentSummary>();

  for (const item of items) {
    const forma = normalizeText(item.forma_pagamento) || "Não informado";

    if (!paymentMap.has(forma)) {
      paymentMap.set(forma, {
        forma,
        total: 0,
        receita: 0,
      });
    }

    const current = paymentMap.get(forma)!;
    current.total += 1;

    if (item.status === "concluido") {
      current.receita += Number(item.valor_orcamento || 0);
    }
  }

  const topPagamentos = Array.from(paymentMap.values())
    .sort((a, b) => b.receita - a.receita || b.total - a.total)
    .slice(0, 5);

  const plan = await getPlanForUser(authUser.userId, companyId);

  const companyRow = company as
    | {
        nome?: string | null;
        name?: string | null;
      }
    | null;

  return {
    companyId,
    companyName: companyRow?.nome || companyRow?.name || null,
    plan,
    userId: authUser.userId,
    userEmail: authUser.userEmail,
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
      custoTotalConcluido,
      lucroRealizado,
      comissaoTotal,
      comissaoPagaTotal,
      ticketMedio,
      conversao,
      aguardandoCliente,
      andamento,
      propostaValidada,
      semProximaAcao,
    },
    byStatus,
    topResponsaveis,
    topCampanhas,
    topPagamentos,
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
      text: `Empresa atual: ${ctx.companyName || "sem nome cadastrado"}.\n\nPlano atual: ${ctx.plan}.\nID da empresa: ${ctx.companyId || "-"}.`,
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "subscription_summary") {
    return {
      text: [
        `A aba Assinatura do seu FlowDesk está vinculada à empresa ${ctx.companyName || "sem nome cadastrado"}.`,
        "",
        `Plano atual: ${ctx.plan}`,
        `ID da empresa: ${ctx.companyId || "-"}`,
        "",
        `Nesta rota eu consigo confirmar o plano atual da empresa.`,
        `Não estou carregando aqui detalhes de cobrança Stripe, renovação automática ou faturas externas.`,
        "",
        `O que eu consigo afirmar com segurança agora:`,
        `- empresa: ${ctx.companyName || "-"}`,
        `- plano: ${ctx.plan}`,
        `- leads totais: ${ctx.metrics.totalLeads}`,
        `- receita realizada: ${formatCurrency(ctx.metrics.receitaRealizada)}`,
      ].join("\n"),
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "campaign_summary") {
    const top = ctx.topCampanhas;

    return {
      text: top.length
        ? [
            `Resumo de campanhas/origens da empresa ${ctx.companyName || "-"}.`,
            "",
            ...top.map(
              (c, index) =>
                `${index + 1}. ${c.nome}\n` +
                `Leads: ${c.total} • Receita concluída: ${formatCurrency(c.receita)}`
            ),
            "",
            `Observação: esse resumo foi gerado com base em campaign_slug e origem_lead da tabela servicos.`,
          ].join("\n")
        : `Não encontrei dados suficientes de campanhas na empresa ${ctx.companyName || "-"}.`,
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "commission_summary") {
    return {
      text: [
        `Resumo de comissão — ${ctx.companyName || "-"}`,
        "",
        `Comissão total registrada: ${formatCurrency(ctx.metrics.comissaoTotal)}`,
        `Comissão marcada como paga: ${formatCurrency(ctx.metrics.comissaoPagaTotal)}`,
        `Receita realizada: ${formatCurrency(ctx.metrics.receitaRealizada)}`,
        `Lucro realizado estimado após custo e comissão paga: ${formatCurrency(ctx.metrics.lucroRealizado)}`,
        "",
        `Top responsáveis por comissão:`,
        ...ctx.topResponsaveis.slice(0, 5).map(
          (r) =>
            `- ${r.responsavel}: ${formatCurrency(r.comissao)} em comissão`
        ),
      ].join("\n"),
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "commission_status_summary") {
    const pendente = ctx.metrics.comissaoTotal - ctx.metrics.comissaoPagaTotal;

    return {
      text: [
        `Status de comissão — ${ctx.companyName || "-"}`,
        "",
        `Comissão total: ${formatCurrency(ctx.metrics.comissaoTotal)}`,
        `Comissão paga: ${formatCurrency(ctx.metrics.comissaoPagaTotal)}`,
        `Comissão pendente estimada: ${formatCurrency(pendente)}`,
      ].join("\n"),
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "customers_summary") {
    const uniqueCustomers = new Set(
      allLeads
        .map((lead) => normalizeText(lead.cliente) || normalizeText(lead.telefone))
        .filter(Boolean)
    ).size;

    return {
      text: [
        `Resumo de clientes — ${ctx.companyName || "-"}`,
        "",
        `Base aproximada de clientes/leads únicos: ${uniqueCustomers}`,
        `Leads totais registrados: ${ctx.metrics.totalLeads}`,
        `Concluídos: ${ctx.metrics.concluidos}`,
        `Perdidos: ${ctx.metrics.perdidos}`,
        "",
        `Observação: este resumo usa os registros existentes em servicos.`,
      ].join("\n"),
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "team_summary") {
    const responsaveis = ctx.topResponsaveis;

    return {
      text: responsaveis.length
        ? [
            `Resumo de equipe/responsáveis da empresa ${ctx.companyName || "-"}.`,
            "",
            ...responsaveis.map(
              (r, index) =>
                `${index + 1}. ${r.responsavel}\n` +
                `Total de leads: ${r.total} • Concluídos: ${r.concluidos} • Perdidos: ${r.perdidos} • Receita: ${formatCurrency(r.receita)} • Comissão: ${formatCurrency(r.comissao)}`
            ),
          ].join("\n")
        : `Não encontrei dados suficientes de responsáveis/equipe no contexto atual da empresa ${ctx.companyName || "-"}.`,
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "payment_summary") {
    return {
      text: [
        `Resumo de formas de pagamento — ${ctx.companyName || "-"}`,
        "",
        ...ctx.topPagamentos.map(
          (p, index) =>
            `${index + 1}. ${p.forma}\n` +
            `Registros: ${p.total} • Receita concluída: ${formatCurrency(p.receita)}`
        ),
      ].join("\n"),
      actions: buildDefaultActions(ctx.plan),
      insights,
    };
  }

  if (intent === "loss_summary") {
    const lost = allLeads.filter((lead) => lead.status === "perdido");
    const reasonMap = new Map<string, number>();

    for (const lead of lost) {
      const reason = normalizeText(lead.motivo_perda) || "Sem motivo informado";
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    }

    const reasons = Array.from(reasonMap.entries()).sort((a, b) => b[1] - a[1]);

    return {
      text: [
        `Resumo de perdas — ${ctx.companyName || "-"}`,
        "",
        `Total de perdidos: ${ctx.metrics.perdidos}`,
        "",
        `Principais motivos:`,
        ...(reasons.length
          ? reasons.map(([reason, total]) => `- ${reason}: ${total}`)
          : ["- Nenhum motivo informado"]),
      ].join("\n"),
      actions: buildDefaultActions(ctx.plan),
      insights,
      leadCards: buildLeadCards(lost, 6),
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
              `Responsável: ${getResponsavelDisplayName(lead)} • Origem: ${lead.origem_lead || "-"}\n` +
              `Campanha: ${lead.campaign_slug || "-"} • Forma pagamento: ${lead.forma_pagamento || "-"}\n` +
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
          `Responsável: ${getResponsavelDisplayName(lead)} • Temperatura: ${lead.temperatura || "-"} • Valor: ${formatCurrency(Number(lead.valor_orcamento || 0))}\n` +
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
          prompt:
            "Gere um plano de follow-up para os leads aguardando_cliente há mais de 7 dias.",
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
              `Responsável: ${getResponsavelDisplayName(lead)} • Origem: ${lead.origem_lead || "-"}\n` +
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
        `Sem próxima ação: ${ctx.metrics.semProximaAcao}`,
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
        `Plano atual: ${ctx.plan}`,
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
        `- Lucro realizado: ${formatCurrency(ctx.metrics.lucroRealizado)}`,
        `- Comissão total: ${formatCurrency(ctx.metrics.comissaoTotal)}`,
        `- Ticket médio: ${formatCurrency(ctx.metrics.ticketMedio)}`,
        `- Leads quentes: ${ctx.metrics.leadsQuentes}`,
        `- Leads mornos: ${ctx.metrics.leadsMornos}`,
        `- Leads frios: ${ctx.metrics.leadsFrios}`,
        "",
        `3. Oportunidades`,
        `- ${awaiting} lead(s) em aguardando_cliente merecem follow-up prioritário`,
        `- ${ctx.metrics.semProximaAcao} lead(s) estão sem próxima ação definida`,
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
            lead.status === "aguardando_cliente" ||
            lead.temperatura === "quente"
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

    const authUser = await getAuthenticatedUserFromRequest(req);
    const ctx = await getCompanyContext(companyId, authUser);
    const intent = classifyIntent(message);
    const deterministic = buildDeterministicResponse(intent, ctx);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const meta = {
            type: "meta",
            insights: deterministic?.insights || buildQuickInsights(ctx),
            actions: deterministic?.actions || buildDefaultActions(ctx.plan),
            leadCards: deterministic?.leadCards || [],
            plan: ctx.plan,
            companyName: ctx.companyName,
            companyId: ctx.companyId,
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
          const errorMessage =
            error instanceof Error ? error.message : "erro desconhecido";

          controller.enqueue(
            encoder.encode(
              encodeLine({
                type: "delta",
                text: `Erro ao gerar resposta: ${errorMessage}`,
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

    const errorMessage =
      error instanceof Error ? error.message : "Erro interno da FlowIA.";

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
