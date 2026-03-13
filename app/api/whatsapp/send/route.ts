import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, text, userId, userName } = body;

    if (!conversationId || !text) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("*, whatsapp_connections(*)")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    }

    const connection = Array.isArray(conversation.whatsapp_connections)
      ? conversation.whatsapp_connections[0]
      : conversation.whatsapp_connections;

    if (!connection?.phone_number_id || !connection?.access_token) {
      return NextResponse.json({ error: "WhatsApp não configurado" }, { status: 400 });
    }

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${connection.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.client_phone,
          type: "text",
          text: {
            body: text,
          },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: result?.error?.message || "Erro ao enviar mensagem" },
        { status: 500 }
      );
    }

    const externalMessageId = result?.messages?.[0]?.id || null;

    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      company_id: conversation.company_id,
      sender_type: "agent",
      sender_id: userId || null,
      sender_name: userName || "Atendente",
      message: text,
      message_type: "text",
      external_message_id: externalMessageId,
      direction: "outbound",
      status: "sent",
    });

    await supabase
      .from("conversations")
      .update({
        status: conversation.status === "queue" ? "in_progress" : conversation.status,
        assigned_to: conversation.assigned_to || userId || null,
        assigned_to_name: conversation.assigned_to_name || userName || "Atendente",
        last_message: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Send error:", error);
    return NextResponse.json({ error: "Falha no envio" }, { status: 500 });
  }
}