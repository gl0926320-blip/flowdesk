import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const recentMessages = new Map<string, number>();

const DUPLICATE_WINDOW = 5000;

function getAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase não configurado no servidor."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function normalizePhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function buildDuplicateKey(
  conversationId: string,
  text: string
) {
  return `${conversationId}:${text.trim()}`;
}

function isDuplicateMessage(
  conversationId: string,
  text: string
) {
  const key =
    buildDuplicateKey(
      conversationId,
      text
    );

  const now = Date.now();

  const lastTime =
    recentMessages.get(key);

  if (
    lastTime &&
    now - lastTime <
      DUPLICATE_WINDOW
  ) {
    return true;
  }

  recentMessages.set(
    key,
    now
  );

  setTimeout(() => {
    const current =
      recentMessages.get(key);

    if (
      current &&
      Date.now() - current >=
        DUPLICATE_WINDOW
    ) {
      recentMessages.delete(key);
    }
  }, DUPLICATE_WINDOW + 1000);

  return false;
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const conversationId =
      String(
        body?.conversationId || ""
      ).trim();

    const text =
      String(
        body?.text || ""
      ).trim();

    const userId =
      body?.userId
        ? String(body.userId)
        : null;

    const userName =
      String(
        body?.userName ||
          "Atendente"
      );

    const userEmail =
      String(
        body?.userEmail || ""
      );

    if (
      !conversationId ||
      !text
    ) {
      return NextResponse.json(
        {
          error:
            "conversationId e text são obrigatórios.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * PRIMEIRA TRAVA DE DUPLICIDADE.
     *
     * Se a mesma conversa tentar
     * enviar exatamente o mesmo texto
     * várias vezes em menos de 5s,
     * só a primeira segue.
     */
    if (
      isDuplicateMessage(
        conversationId,
        text
      )
    ) {
      console.log(
        "[webjs/send] duplicidade bloqueada:",
        {
          conversationId,
          text,
        }
      );

      return NextResponse.json({
        ok: true,
        duplicate: true,
      });
    }

    const bridgeUrl =
      process.env
        .FLOWDESK_WHATSAPP_BRIDGE_URL
        ?.replace(/\/$/, "");

    const bridgeSecret =
      process.env
        .WHATSAPP_BRIDGE_SECRET;

    if (
      !bridgeUrl ||
      !bridgeSecret
    ) {
      recentMessages.delete(
        buildDuplicateKey(
          conversationId,
          text
        )
      );

      return NextResponse.json(
        {
          error:
            "Bridge do WhatsApp não configurado.",
        },
        {
          status: 500,
        }
      );
    }

    const supabase =
      getAdmin();

    /*
     * BUSCA A CONVERSA
     */
    const {
      data: conversation,
      error:
        conversationError,
    } =
      await supabase
        .from("conversations")
        .select(
          "id, company_id, client_phone, status, assigned_to, assigned_to_name"
        )
        .eq(
          "id",
          conversationId
        )
        .maybeSingle();

    if (
      conversationError ||
      !conversation
    ) {
      recentMessages.delete(
        buildDuplicateKey(
          conversationId,
          text
        )
      );

      return NextResponse.json(
        {
          error:
            "Conversa não encontrada.",
        },
        {
          status: 404,
        }
      );
    }

    const phone =
      normalizePhone(
        conversation.client_phone
      );

    if (!phone) {
      recentMessages.delete(
        buildDuplicateKey(
          conversationId,
          text
        )
      );

      return NextResponse.json(
        {
          error:
            "Telefone do cliente inválido.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ID ÚNICO DESTA REQUISIÇÃO.
     *
     * Vai para o bridge e serve
     * como segunda proteção contra
     * mensagem duplicada.
     */
    const requestId =
      `${conversationId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

    console.log(
      "[webjs/send] enviando mensagem:",
      {
        requestId,
        conversationId,
        companyId:
          conversation.company_id,
        phone,
        text,
      }
    );

    /*
     * ENVIA PARA O BRIDGE
     */
    const bridgeResponse =
      await fetch(
        `${bridgeUrl}/messages/send`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-flowdesk-secret":
              bridgeSecret,
          },

          body:
            JSON.stringify({
              companyId:
                conversation.company_id,

              phone,

              text,

              requestId,
            }),

          cache: "no-store",
        }
      );

    const bridgeResult =
      await bridgeResponse
        .json()
        .catch(() => null);

    if (!bridgeResponse.ok) {
      /*
       * Se realmente falhou,
       * permite tentar novamente
       * imediatamente.
       */
      recentMessages.delete(
        buildDuplicateKey(
          conversationId,
          text
        )
      );

      return NextResponse.json(
        {
          error:
            bridgeResult?.error ||
            "Não foi possível enviar a mensagem pelo WhatsApp.",
        },
        {
          status:
            bridgeResponse.status,
        }
      );
    }

    /*
     * Se o bridge já identificou
     * esta chamada como duplicada,
     * não salva novamente no Supabase.
     */
    if (
      bridgeResult?.duplicate
    ) {
      console.log(
        "[webjs/send] bridge bloqueou duplicidade:",
        requestId
      );

      return NextResponse.json({
        ok: true,
        duplicate: true,
      });
    }

    const now =
      new Date().toISOString();

    /*
     * SALVA UMA ÚNICA VEZ
     * NO HISTÓRICO.
     */
    const {
      error:
        saveMessageError,
    } =
      await supabase
        .from(
          "conversation_messages"
        )
        .insert({
          conversation_id:
            conversation.id,

          company_id:
            conversation.company_id,

          sender_type:
            "agent",

          sender_id:
            userId,

          sender_name:
            userName,

          message:
            text,

          message_type:
            "text",

          direction:
            "outbound",

          status:
            "sent",

          created_at:
            now,
        });

    if (
      saveMessageError
    ) {
      console.error(
        "[webjs/send] mensagem enviada no WhatsApp, mas falhou ao salvar:",
        saveMessageError
      );
    }

    /*
     * ATUALIZA A CONVERSA.
     *
     * Se ainda estiver na fila,
     * passa para atendimento.
     */
    const nextStatus =
      conversation.status ===
      "queue"
        ? "in_progress"
        : conversation.status;

    await supabase
      .from("conversations")
      .update({
        status:
          nextStatus,

        assigned_to:
          conversation.assigned_to ||
          userId ||
          null,

        assigned_to_name:
          conversation.assigned_to_name ||
          userName ||
          "Atendente",

        last_message:
          text,

        last_message_at:
          now,

        updated_at:
          now,
      })
      .eq(
        "id",
        conversation.id
      );

    console.log(
      "[webjs/send] mensagem concluída:",
      {
        requestId,
        conversationId,
        messageId:
          bridgeResult?.messageId ||
          null,
        user:
          userEmail ||
          userName,
      }
    );

    return NextResponse.json({
      ok: true,

      requestId,

      messageId:
        bridgeResult?.messageId ||
        null,
    });
  } catch (error) {
    console.error(
      "[whatsapp/webjs/send]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao enviar mensagem.",
      },
      {
        status: 500,
      }
    );
  }
}