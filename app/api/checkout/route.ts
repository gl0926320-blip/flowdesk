import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-01-28.clover",
    });

    const body = await req.json();
    const { userId, email } = body;

    console.log("📦 BODY RECEBIDO:", body);
    console.log("👤 USER ID RECEBIDO NO CHECKOUT:", userId);

    // 🔒 Validação obrigatória
    if (!userId) {
      return NextResponse.json(
        { error: "UserId não recebido no checkout" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email não recebido no checkout" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?canceled=true`,
      metadata: {
        userId: String(userId), // 👈 força string
      },
    });

    console.log("✅ Sessão criada:", session.id);

    return NextResponse.json({ url: session.url });

  } catch (err) {
    console.error("❌ Erro Stripe:", err);
    return NextResponse.json(
      { error: "Erro ao criar sessão Stripe" },
      { status: 500 }
    );
  }
}