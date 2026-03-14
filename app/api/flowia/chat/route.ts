import { NextRequest } from "next/server";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL!;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";

const FLOWDESK_CONTEXT = `
Você é a FlowIA, assistente oficial do CRM FlowDesk.

Regras:
- Responda em português do Brasil.
- Seja clara, objetiva e profissional.
- Nunca invente dados do CRM.
- Prefira respostas curtas e úteis.
- Se a pergunta for simples, responda de forma simples.

Sobre o FlowDesk:
CRM comercial focado em vendas, pipeline, atendimento e inteligência comercial.

Módulos:
Dashboard, Leads, Carteira, Pipeline, Atendimento, Orçamentos, Vendas,
Comissões, Campanhas, Clientes, Empresas, Equipe, Assinatura e FlowIA.

Pipeline:
lead → proposta enviada → aguardando cliente → proposta validada → andamento → concluído → perdido.
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
      return Response.json({ error: "Mensagem não enviada." }, { status: 400 });
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
      ...safeMessages.slice(-4),
    ];

    console.log("[FlowIA] Conectando em:", OLLAMA_BASE_URL);
    console.log("[FlowIA] Modelo:", OLLAMA_MODEL);
    console.log("[FlowIA] Histórico enviado:", finalMessages.length);

    const startedAt = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let ollamaResponse: Response;

    try {
      ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: finalMessages,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 120,
            top_p: 0.9,
          },
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const rawText = await ollamaResponse.text();

    if (!ollamaResponse.ok) {
      console.error("[FlowIA] Erro Ollama:", rawText);

      return Response.json(
        { error: "Não foi possível conectar a FlowIA ao Ollama." },
        { status: 500 }
      );
    }

    let parsed: any = null;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[FlowIA] Falha ao converter resposta do Ollama:", rawText);

      return Response.json(
        { error: "Resposta inválida recebida da FlowIA." },
        { status: 500 }
      );
    }

    const reply = parsed?.message?.content?.trim();

    console.log("[FlowIA] Tempo total:", Date.now() - startedAt, "ms");

    if (!reply) {
      return Response.json(
        { error: "A FlowIA não retornou conteúdo." },
        { status: 500 }
      );
    }

    return Response.json({ reply });
  } catch (error) {
    console.error("[FlowIA] Erro interno:", error);

    const message =
      error instanceof Error && error.name === "AbortError"
        ? "A FlowIA demorou demais para responder."
        : "Erro interno ao processar a FlowIA.";

    return Response.json({ error: message }, { status: 500 });
  }
}