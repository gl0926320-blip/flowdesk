import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const { userId, email } = await req.json();

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
        userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Erro Stripe:", err);
    return NextResponse.json(
      { error: "Erro ao criar sessão Stripe" },
      { status: 500 }
    );
  }
}