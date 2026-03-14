import { NextRequest } from "next/server";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL!;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";

const FLOWDESK_CONTEXT = `
Você é a FlowIA, assistente oficial do CRM FlowDesk.

Identidade:
- Seu nome é FlowIA.
- Você responde em português do Brasil.
- Seu papel é ajudar usuários a usar o FlowDesk.
- Seja clara, objetiva e profissional.
- Nunca invente dados do CRM.

Sobre o FlowDesk:
CRM comercial focado em vendas, pipeline, atendimento e inteligência comercial.

Módulos:
Dashboard, Leads, Carteira, Pipeline, Atendimento, Orçamentos, Vendas,
Comissões, Campanhas, Clientes, Empresas, Equipe, Assinatura e FlowIA.

Regras:
- Leads podem ser: frio, morno ou quente.
- Pipeline: lead → proposta enviada → aguardando cliente → proposta validada → andamento → concluído → perdido.
- Evite respostas muito longas.
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

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "Mensagem não enviada." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const safeMessages = messages.filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m.content === "string" &&
        ["system", "user", "assistant"].includes(m.role)
    );

    const finalMessages: ChatMessage[] = [
      {
        role: "system",
        content: FLOWDESK_CONTEXT,
      },
      ...safeMessages.slice(-8),
    ];

    console.log("[FlowIA] Conectando em:", OLLAMA_BASE_URL);
    console.log("[FlowIA] Modelo:", OLLAMA_MODEL);
    console.log("[FlowIA] Histórico enviado:", finalMessages.length);

    const startedAt = Date.now();

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
          temperature: 0.2,
          num_predict: 200,
          top_p: 0.9,
        },
      }),
    });

    const rawText = await ollamaResponse.text();

    if (!ollamaResponse.ok) {
      console.error("[FlowIA] Erro Ollama:", rawText);

      return new Response(
        JSON.stringify({
          error: "Não foi possível conectar a FlowIA ao Ollama.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    let parsed: any = null;

    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      console.error("[FlowIA] Falha ao converter resposta do Ollama:", rawText);
      return new Response(
        JSON.stringify({
          error: "Resposta inválida recebida da FlowIA.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const reply = parsed?.message?.content?.trim();

    console.log("[FlowIA] Tempo total:", Date.now() - startedAt, "ms");

    if (!reply) {
      return new Response(
        JSON.stringify({
          error: "A FlowIA não retornou conteúdo.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        reply,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[FlowIA] Erro interno:", error);

    return new Response(
      JSON.stringify({
        error: "Erro interno ao processar a FlowIA.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}