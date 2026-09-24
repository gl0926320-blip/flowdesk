import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const bridgeSecret =
  process.env.WHATSAPP_BRIDGE_SECRET;

function getAdmin() {
  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Supabase não configurado no servidor."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );
}

function normalizePhone(
  value: unknown
) {
  return String(
    value || ""
  ).replace(/\D/g, "");
}

function conversationStageToLeadStatus(
  stage?: string | null
) {
  switch (stage) {
    case "proposta_validada":
      return "qualificado";

    case "proposta_enviada":
    case "aguardando_cliente":
    case "andamento":
      return "negociacao";

    case "concluido":
      return "fechado";

    case "perdido":
      return "perdido";

    default:
      return "novo";
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const receivedSecret =
      request.headers.get(
        "x-flowdesk-secret"
      );

    if (
      !bridgeSecret ||
      receivedSecret !==
        bridgeSecret
    ) {
      return NextResponse.json(
        {
          error:
            "Não autorizado.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const type =
      String(
        body?.type || ""
      ).trim();

    const companyId =
      String(
        body?.companyId || ""
      ).trim();

    if (!companyId) {
      return NextResponse.json(
        {
          error:
            "companyId é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getAdmin();

    const now =
      new Date().toISOString();

    /*
     * CONECTADO
     */
    if (
      type === "ready"
    ) {
      const phone =
        normalizePhone(
          body?.phone
        );

      const {
        data: existing,
      } =
        await supabase
          .from(
            "whatsapp_connections"
          )
          .select("id")
          .eq(
            "company_id",
            companyId
          )
          .eq(
            "provider",
            "webjs"
          )
          .limit(1)
          .maybeSingle();

      const payload = {
        company_id:
          companyId,

        provider:
          "webjs",

        connection_name:
          "WhatsApp Principal",

        phone_number:
          phone
            ? `+${phone}`
            : null,

        status:
          "connected",

        updated_at:
          now,
      };

      if (
        existing?.id
      ) {
        await supabase
          .from(
            "whatsapp_connections"
          )
          .update(
            payload
          )
          .eq(
            "id",
            existing.id
          );
      } else {
        await supabase
          .from(
            "whatsapp_connections"
          )
          .insert({
            ...payload,

            created_at:
              now,
          });
      }

      return NextResponse.json({
        ok: true,
      });
    }

    /*
     * DESCONECTADO
     */
    if (
      type ===
      "disconnected"
    ) {
      await supabase
        .from(
          "whatsapp_connections"
        )
        .update({
          status:
            "disconnected",

          updated_at:
            now,
        })
        .eq(
          "company_id",
          companyId
        )
        .eq(
          "provider",
          "webjs"
        );

      return NextResponse.json({
        ok: true,
      });
    }

    /*
     * IGNORA OUTROS EVENTOS
     */
    if (
      type !== "message"
    ) {
      return NextResponse.json({
        ok: true,
      });
    }

    /*
     * MENSAGEM
     */
    const phone =
      normalizePhone(
        body?.phone
      );

    const lid =
      String(
        body?.lid || ""
      ).trim();

    const lidDigits =
      normalizePhone(
        lid
      );

    const text =
      String(
        body?.text || ""
      ).trim();

    const name =
      String(
        body?.name || ""
      ).trim() ||
      (
        phone
          ? `WhatsApp ${phone.slice(
              -4
            )}`
          : "Cliente WhatsApp"
      );

    const messageId =
      body?.messageId
        ? String(
            body.messageId
          )
        : null;

    const direction =
      body?.direction === "outbound"
        ? "outbound"
        : "inbound";

    const isOutbound =
      direction === "outbound";

    if (
      !phone ||
      !text
    ) {
      return NextResponse.json({
        ok: true,
      });
    }

    /*
     * EVITA MENSAGEM DUPLICADA
     * antes de alterar conversa/unread.
     */
    if (messageId) {
      const {
        data: duplicate,
      } =
        await supabase
          .from(
            "conversation_messages"
          )
          .select("id")
          .eq(
            "company_id",
            companyId
          )
          .eq(
            "status",
            `wa:${messageId}`
          )
          .limit(1)
          .maybeSingle();

      if (duplicate?.id) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
        });
      }
    }

    /*
     * BUSCA CONVERSA
     */
    const {
      data:
        conversationRows,

      error:
        conversationLookupError,
    } =
      await supabase
        .from(
          "conversations"
        )
        .select("*")
        .eq(
          "company_id",
          companyId
        );

    if (
      conversationLookupError
    ) {
      throw conversationLookupError;
    }

    /*
     * Primeiro tenta pelo telefone real.
     */
    let conversation =
      (
        conversationRows ||
        []
      ).find(
        (item) =>
          normalizePhone(
            item.client_phone
          ) === phone
      );

    /*
     * Se ainda existe conversa antiga
     * criada com o LID no lugar
     * do telefone, acha por ele.
     */
    if (
      !conversation &&
      lidDigits
    ) {
      conversation =
        (
          conversationRows ||
          []
        ).find(
          (item) =>
            normalizePhone(
              item.client_phone
            ) === lidDigits
        );
    }

    /*
     * NOVA CONVERSA
     */
    if (!conversation) {
      const {
        data: created,

        error:
          createError,
      } =
        await supabase
          .from(
            "conversations"
          )
          .insert({
            company_id:
              companyId,

            client_name:
              name,

            client_phone:
              `+${phone}`,

            client_email:
              null,

            subject:
              "WhatsApp",

            lead_source:
              "WhatsApp",

            status:
              "queue",

            stage:
              "lead",

            assigned_to:
              null,

            assigned_to_name:
              null,

            priority:
              "normal",

            last_message:
              text,

            last_message_at:
              now,

            unread_count:
              isOutbound
                ? 0
                : 1,

            tags: [
              "WhatsApp",
            ],

            temperature:
              "morno",

            notes:
              null,

            created_at:
              now,

            updated_at:
              now,
          })
          .select("*")
          .single();

      if (createError) {
        throw createError;
      }

      conversation =
        created;
    } else {
      /*
       * CORRIGE AUTOMATICAMENTE
       * TELEFONE QUE ESTAVA COM LID.
       */
      await supabase
        .from(
          "conversations"
        )
        .update({
          client_name:
            conversation.client_name ||
            name,

          client_phone:
            `+${phone}`,

          last_message:
            text,

          last_message_at:
            now,

          unread_count:
            isOutbound
              ? Number(
                  conversation.unread_count ||
                    0
                )
              : Number(
                  conversation.unread_count ||
                    0
                ) + 1,

          updated_at:
            now,
        })
        .eq(
          "id",
          conversation.id
        );

      conversation = {
        ...conversation,

        client_phone:
          `+${phone}`,

        last_message:
          text,

        last_message_at:
          now,
      };
    }

    /*
     * SALVA A MENSAGEM
     */
    const {
      error:
        messageError,
    } =
      await supabase
        .from(
          "conversation_messages"
        )
        .insert({
          conversation_id:
            conversation.id,

          company_id:
            companyId,

          sender_type:
            isOutbound
              ? "agent"
              : "client",

          sender_id:
            null,

          sender_name:
            isOutbound
              ? "Enviado pelo WhatsApp"
              : name,

          message:
            text,

          message_type:
            "text",

          direction,

          status:
            messageId
              ? `wa:${messageId}`
              : "received",

          created_at:
            now,
        });

    if (messageError) {
      throw messageError;
    }

    /*
     * LEADS
     */
    const {
      data:
        leadRows,

      error:
        leadLookupError,
    } =
      await supabase
        .from("leads")
        .select(
          "id, phone, name, status"
        )
        .eq(
          "company_id",
          companyId
        );

    if (
      leadLookupError
    ) {
      console.error(
        "[webjs/event] erro consultando leads:",
        leadLookupError
      );
    } else {
      /*
       * Procura lead pelo telefone real.
       */
      let existingLead =
        (
          leadRows || []
        ).find(
          (lead) =>
            normalizePhone(
              lead.phone
            ) === phone
        );

      /*
       * Procura também pelo LID antigo.
       */
      if (
        !existingLead &&
        lidDigits
      ) {
        existingLead =
          (
            leadRows || []
          ).find(
            (lead) =>
              normalizePhone(
                lead.phone
              ) ===
              lidDigits
          );
      }

      const leadStatus =
        conversationStageToLeadStatus(
          conversation.stage
        );

      /*
       * ATUALIZA LEAD EXISTENTE
       */
      if (
        existingLead?.id
      ) {
        await supabase
          .from("leads")
          .update({
            name:
              existingLead.name ||
              name,

            phone:
              `+${phone}`,

            source:
              "WhatsApp",

            status:
              leadStatus,

            notes:
              isOutbound
                ? `Última mensagem enviada pelo WhatsApp: ${text}`
                : `Última mensagem recebida pelo WhatsApp: ${text}`,

            updated_at:
              now,
          })
          .eq(
            "id",
            existingLead.id
          )
          .eq(
            "company_id",
            companyId
          );
      } else {
        /*
         * CRIA LEAD
         */
        await supabase
          .from("leads")
          .insert({
            company_id:
              companyId,

            name,

            phone:
              `+${phone}`,

            email:
              null,

            source:
              "WhatsApp",

            status:
              "novo",

            estimated_value:
              0,

            objective:
              null,

            notes:
              isOutbound
                ? `Lead criado automaticamente pelo WhatsApp. Última mensagem enviada: ${text}`
                : `Lead criado automaticamente pelo WhatsApp. Última mensagem recebida: ${text}`,

            created_at:
              now,

            updated_at:
              now,
          });
      }
    }

    return NextResponse.json({
      ok: true,

      conversationId:
        conversation.id,

      phone,

      lid:
        lid || null,
    });
  } catch (error) {
    console.error(
      "[whatsapp/webjs/event]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao processar mensagem do WhatsApp.",
      },
      {
        status: 500,
      }
    );
  }
}