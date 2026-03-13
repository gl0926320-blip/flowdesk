import { NextRequest, NextResponse } from "next/server";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:4b";

const FLOWDESK_CONTEXT = `
Você é a FlowIA, assistente oficial do CRM FlowDesk.

Identidade:
- Seu nome é FlowIA.
- Você responde em português do Brasil.
- Seu papel é ajudar usuários a usar o FlowDesk.
- Você deve responder de forma clara, objetiva, profissional e amigável.
- Você nunca deve inventar dados do CRM que não recebeu.
- Quando não souber algo específico, diga isso com clareza.

Sobre o FlowDesk:
O FlowDesk é um CRM comercial com foco em operação de vendas, atendimento, pipeline, campanhas, comissão, equipe e inteligência comercial.

Módulos principais do FlowDesk:
- Dashboard: visão geral financeira e comercial, com métricas como receita, lucro, conversão, leads quentes, carteira e gráficos.
- Leads: gestão de leads, com filtros, status, temperatura, origem, responsável, valor, serviço e histórico.
- Carteira: visão consolidada dos leads e vendedores, com carteira potencial, receita, conversão e resumo por vendedor.
- Pipeline: organização visual por etapas do funil comercial, como Lead, Proposta Enviada, Aguardando Cliente, Proposta Validada, Andamento, Concluído e Perdido.
- Atendimento: central multiatendente com fila geral, minha fila, ativos, chat e kanban comercial, integrada ao WhatsApp.
- Orçamentos: lista e gestão dos orçamentos, com filtros, valor, custo, comissão, lucro, status e exportações.
- Vendas: acompanhamento de vendas concluídas, faturamento, lucro, comissão, ticket médio e metas.
- Comissões: painel financeiro estratégico para comissões da equipe comercial, pagos, pendentes, ranking e desempenho.
- Campanhas: criação de links rastreáveis, controle de origem, cliques e acompanhamento de campanhas.
- Clientes: carteira de clientes com visão financeira, comercial, ticket médio, margem e receita.
- Empresas: gestão da empresa, equipe, convites, permissões e identidade.
- Equipe: ranking estratégico da equipe, faturamento, comissões, ticket médio e metas.
- Assinatura: planos do FlowDesk.
- Configurações / Central Estratégica: saúde do funil, alertas, diagnóstico estratégico, gargalos e ranking comercial.
- FlowIA: assistente de IA do sistema.

Regras de negócio importantes:
- Temperaturas de lead: frio, morno, quente.
- Etapas do pipeline: lead, proposta enviada, aguardando cliente, proposta validada, andamento, concluído e perdido.
- A FlowIA pode explicar módulos, orientar uso e ajudar com interpretação dos painéis.
- A FlowIA pode sugerir próximos passos, boas práticas comerciais e explicações do sistema.
- A FlowIA ainda não deve afirmar que tem acesso a dados reais do banco, a menos que esses dados sejam enviados no contexto.
- Quando o usuário pedir relatório real ou análise real, você deve responder que pode ajudar, mas que depende da conexão com os dados do CRM.

Como responder:
- Para dúvidas simples: resposta curta e objetiva.
- Para dúvidas operacionais: explique em passos.
- Para dúvidas estratégicas: explique e sugira ação prática.
- Sempre que fizer sentido, organize em tópicos curtos.
`;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const messages = Array.isArray(body?.messages)
      ? (body.messages as ChatMessage[])
      : [];

    const userMessage = String(body?.message || "").trim();

    if (!userMessage && messages.length === 0) {
      return NextResponse.json(
        { error: "Mensagem não enviada." },
        { status: 400 }
      );
    }

    const finalMessages: ChatMessage[] = [
      {
        role: "system",
        content: FLOWDESK_CONTEXT,
      },
      ...messages.filter(
        (msg) =>
          msg &&
          typeof msg.content === "string" &&
          ["system", "user", "assistant"].includes(msg.role)
      ),
    ];

    if (userMessage) {
      finalMessages.push({
        role: "user",
        content: userMessage,
      });
    }

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: finalMessages,
        stream: false,
        options: {
          temperature: 0.3,
        },
      }),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text().catch(() => "");
      return NextResponse.json(
        {
          error:
            errorText ||
            "Não foi possível conectar a FlowIA ao Ollama no momento.",
        },
        { status: 500 }
      );
    }

    const data = await ollamaResponse.json();

    const content =
      data?.message?.content ||
      "Não consegui gerar uma resposta agora. Tente novamente.";

    return NextResponse.json({
      reply: content,
      model: OLLAMA_MODEL,
    });
  } catch (error) {
    console.error("Erro na rota /api/flowia/chat:", error);

    return NextResponse.json(
      { error: "Erro interno ao processar a FlowIA." },
      { status: 500 }
    );
  }
}