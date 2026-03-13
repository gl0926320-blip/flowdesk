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

    const userMessage = String(body?.message || "").trim();

    if (!userMessage && messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Mensagem não enviada." }),
        { status: 400 }
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
      {
        role: "user",
        content: userMessage,
      },
    ];

    console.log("FlowIA conectando em:", OLLAMA_BASE_URL);

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: finalMessages,
        stream: true,
        options: {
          temperature: 0.2,
          num_predict: 200,
          top_p: 0.9,
        },
      }),
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text().catch(() => "");
      console.error("Erro Ollama:", errorText);

      return new Response(
        JSON.stringify({
          error: "Não foi possível conectar a FlowIA ao Ollama.",
        }),
        { status: 500 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse.body!.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter(Boolean);

            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);

                if (parsed?.message?.content) {
                  controller.enqueue(
                    new TextEncoder().encode(parsed.message.content)
                  );
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("Erro streaming:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Erro FlowIA:", error);

    return new Response(
      JSON.stringify({
        error: "Erro interno ao processar a FlowIA.",
      }),
      { status: 500 }
    );
  }
}