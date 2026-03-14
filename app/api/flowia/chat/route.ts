import { NextRequest } from "next/server";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL!;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "phi3:mini";

const FLOWDESK_CONTEXT = `
Você é a FlowIA, assistente do FlowDesk.
Responda em português do Brasil.
Seja objetiva, útil e profissional.
Nunca invente dados.
Ajude com dúvidas sobre CRM, pipeline, vendas, atendimento e módulos do sistema.
Se a pergunta for simples, responda de forma curta.
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

    const userMessage =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!userMessage && !messages.length) {
      return Response.json({ error: "Mensagem não enviada." }, { status: 400 });
    }

    const safeMessages = messages.filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m.content === "string" &&
        ["system", "user", "assistant"].includes(m.role)
    );

    const recentMessages = safeMessages.slice(-2);

    const conversationContext = recentMessages
      .map((msg) => {
        if (msg.role === "user") return `Usuário: ${msg.content}`;
        if (msg.role === "assistant") return `FlowIA: ${msg.content}`;
        return "";
      })
      .filter(Boolean)
      .join("\n");

    const prompt = `
${FLOWDESK_CONTEXT}

Contexto recente:
${conversationContext || "Sem contexto anterior."}

Pergunta atual do usuário:
${userMessage || recentMessages.at(-1)?.content || ""}

Responda agora:
`.trim();

    console.log("[FlowIA] Conectando em:", OLLAMA_BASE_URL);
    console.log("[FlowIA] Modelo:", OLLAMA_MODEL);
    console.log("[FlowIA] Histórico usado:", recentMessages.length);

    const startedAt = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    let ollamaResponse: Response;

    try {
      ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          keep_alive: "30m",
          options: {
            temperature: 0.1,
            num_predict: 60,
            top_p: 0.8,
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

    const reply =
      typeof parsed?.response === "string" ? parsed.response.trim() : "";

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