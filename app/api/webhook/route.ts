import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: true,
      message: "Webhook desativado. Stripe não é mais utilizado neste projeto.",
    },
    { status: 200 }
  );
}