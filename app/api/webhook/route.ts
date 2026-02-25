import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔥 SERVICE ROLE
);

export async function POST(req: Request) {
  const body = await req.text();

  // ✅ CORREÇÃO NEXT 16 (headers agora é async)
  const headersList = await headers();
  const sig = headersList.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Erro webhook:", err);
    return new NextResponse("Webhook error", { status: 400 });
  }

  // ✅ PAGAMENTO INICIAL CONFIRMADO
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;

    if (userId) {
      await supabase
        .from("profiles")
        .update({
          plan: "pro",
          subscription_status: "active",
          stripe_customer_id: session.customer,
        })
        .eq("id", userId);

      console.log("Plano ativado para usuário:", userId);
    }
  }

  // 🔁 PAGAMENTO RECORRENTE CONFIRMADO
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;

    await supabase
      .from("profiles")
      .update({
        subscription_status: "active",
      })
      .eq("stripe_customer_id", invoice.customer);

    console.log("Assinatura renovada:", invoice.customer);
  }

  // ❌ PAGAMENTO FALHOU
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;

    await supabase
      .from("profiles")
      .update({
        plan: "free",
        subscription_status: "past_due",
      })
      .eq("stripe_customer_id", invoice.customer);

    console.log("Pagamento falhou:", invoice.customer);
  }

  // ❌ ASSINATURA CANCELADA
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    await supabase
      .from("profiles")
      .update({
        plan: "free",
        subscription_status: "canceled",
      })
      .eq("stripe_customer_id", subscription.customer);

    console.log("Assinatura cancelada:", subscription.customer);
  }

  return NextResponse.json({ received: true });
}