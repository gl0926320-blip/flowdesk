import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!mode || !token) {
    return new NextResponse("Missing params", { status: 400 });
  }

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("id, verify_token, status")
    .eq("verify_token", token)
    .maybeSingle();

  if (mode === "subscribe" && connection) {
    return new NextResponse(challenge || "ok", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entries = body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        const value = change?.value;

        const metadata = value?.metadata;
        const phoneNumberId = metadata?.phone_number_id;

        if (!phoneNumberId) continue;

        const { data: connection } = await supabase
          .from("whatsapp_connections")
          .select("id, company_id")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();

        if (!connection) continue;

        const messages = value?.messages || [];
        const statuses = value?.statuses || [];

        for (const msg of messages) {
          const from = msg?.from;
          const text = msg?.text?.body || "[mensagem não textual]";
          const externalMessageId = msg?.id;

          if (!from) continue;

          let { data: conversation } = await supabase
            .from("conversations")
            .select("*")
            .eq("company_id", connection.company_id)
            .eq("client_phone", from)
            .maybeSingle();

          if (!conversation) {
            const { data: createdConversation } = await supabase
              .from("conversations")
              .insert({
                company_id: connection.company_id,
                whatsapp_connection_id: connection.id,
                client_phone: from,
                client_name: from,
                lead_source: "WhatsApp",
                status: "queue",
                last_message: text,
                last_message_at: new Date().toISOString(),
                unread_count: 1,
                updated_at: new Date().toISOString(),
              })
              .select("*")
              .single();

            conversation = createdConversation;
          } else {
            await supabase
              .from("conversations")
              .update({
                last_message: text,
                last_message_at: new Date().toISOString(),
                unread_count: Number(conversation.unread_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);
          }

          if (conversation) {
            await supabase.from("conversation_messages").insert({
              conversation_id: conversation.id,
              company_id: connection.company_id,
              sender_type: "client",
              sender_name: conversation.client_name || "Cliente",
              message: text,
              message_type: "text",
              external_message_id: externalMessageId,
              direction: "inbound",
              status: "received",
            });
          }
        }

        for (const status of statuses) {
          const externalMessageId = status?.id;
          const deliveryStatus = status?.status;

          if (!externalMessageId || !deliveryStatus) continue;

          await supabase
            .from("conversation_messages")
            .update({
              status: deliveryStatus,
            })
            .eq("external_message_id", externalMessageId);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}