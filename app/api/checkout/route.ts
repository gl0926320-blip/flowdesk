import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-01-28.clover",
    });

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const { userId, email } = body;

    console.log("📦 BODY RECEBIDO:", body);

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

    // 🔎 Buscar profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, subscription_status")
      .eq("id", userId)
      .single();

    // 🚫 Se já for Pro ativo → manda pro Portal
    if (
      profile?.stripe_customer_id &&
      profile?.subscription_status === "active"
    ) {
      console.log("⚠️ Usuário já ativo, redirecionando para portal");

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
      });

      return NextResponse.json({ url: portalSession.url });
    }

    // 🟣 Criar checkout novo
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
        userId: String(userId),
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