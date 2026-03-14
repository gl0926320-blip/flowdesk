import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.message) {
      return NextResponse.json(
        { error: "Mensagem é obrigatória" },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Você é a FlowIA, assistente inteligente do CRM FlowDesk. Ajude usuários a entender vendas, leads, pipeline e funcionamento do sistema.",
        },
        {
          role: "user",
          content: body.message,
        },
      ],
    });

    const reply = response.output_text;

    return NextResponse.json({
      reply,
    });
  } catch (error) {
    console.error("FlowIA error:", error);

    return NextResponse.json(
      { error: "Erro interno da FlowIA" },
      { status: 500 }
    );
  }
}