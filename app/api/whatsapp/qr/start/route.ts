import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const companyId = String(body?.companyId || "").trim();

    if (!companyId) {
      return NextResponse.json(
        {
          error: "companyId é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    const bridgeUrl =
      process.env.FLOWDESK_WHATSAPP_BRIDGE_URL;

    const bridgeSecret =
      process.env.WHATSAPP_BRIDGE_SECRET;

    if (!bridgeUrl) {
      return NextResponse.json(
        {
          error:
            "FLOWDESK_WHATSAPP_BRIDGE_URL não configurado.",
        },
        {
          status: 500,
        }
      );
    }

    if (!bridgeSecret) {
      return NextResponse.json(
        {
          error:
            "WHATSAPP_BRIDGE_SECRET não configurado.",
        },
        {
          status: 500,
        }
      );
    }

    const cleanBridgeUrl =
      bridgeUrl.replace(/\/$/, "");

    const response = await fetch(
      `${cleanBridgeUrl}/sessions/start`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "x-flowdesk-secret":
            bridgeSecret,
        },

        body: JSON.stringify({
          companyId,
          connectionName:
            "WhatsApp Principal",
        }),

        cache: "no-store",
      }
    );

    const result =
      await response.json().catch(() => null);

    if (!response.ok) {
      console.error(
        "[QR START] Erro do bridge:",
        result
      );

      return NextResponse.json(
        {
          error:
            result?.error ||
            "Não foi possível iniciar o WhatsApp.",
        },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      status:
        result?.status || "starting",

      qrCode:
        result?.qrCode || null,

      phone:
        result?.phone || null,

      message:
        result?.message ||
        "Sessão iniciada.",
    });
  } catch (error) {
    console.error(
      "[QR START] Erro:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao iniciar WhatsApp.",
      },
      {
        status: 500,
      }
    );
  }
}