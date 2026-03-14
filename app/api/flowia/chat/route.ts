import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {

  try {

    const body = await req.json()

    if (!body.message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "Você é a FlowIA, assistente do CRM FlowDesk."
        },
        {
          role: "user",
          content: body.message
        }
      ]
    })

    const reply = completion.choices[0].message.content

    return NextResponse.json({
      reply
    })

  } catch (error) {

    console.error("FlowIA error:", error)

    return NextResponse.json(
      { error: "Erro interno da FlowIA" },
      { status: 500 }
    )
  }
}