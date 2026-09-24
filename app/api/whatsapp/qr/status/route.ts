import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const companyId =
      request.nextUrl.searchParams.get("companyId")?.trim() || "";

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
      `${cleanBridgeUrl}/sessions/${encodeURIComponent(
        companyId
      )}/status`,
      {
        method: "GET",

        headers: {
          "x-flowdesk-secret":
            bridgeSecret,
        },

        cache: "no-store",
      }
    );

    const result =
      await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            result?.error ||
            "Não foi possível consultar o WhatsApp.",
        },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      status:
        result?.status || "idle",

      qrCode:
        result?.qrCode || null,

      phone:
        result?.phone || null,

      message:
        result?.message || "",
    });
  } catch (error) {
    console.error(
      "[QR STATUS] Erro:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao consultar WhatsApp.",
      },
      {
        status: 500,
      }
    );
  }
}