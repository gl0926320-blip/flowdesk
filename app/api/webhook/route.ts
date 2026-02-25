import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    // 🔥 Instancia tudo DENTRO da função
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.text();

    const headersList = await headers();
    const sig = headersList.get("stripe-signature");

    if (!sig) {
      return new NextResponse("Missing signature", { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // ✅ PAGAMENTO INICIAL
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

        console.log("Plano ativado:", userId);
      }
    }

    // 🔁 RENOVAÇÃO
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;

      await supabase
        .from("profiles")
        .update({ subscription_status: "active" })
        .eq("stripe_customer_id", invoice.customer);
    }

    // ❌ FALHA
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;

      await supabase
        .from("profiles")
        .update({
          plan: "free",
          subscription_status: "past_due",
        })
        .eq("stripe_customer_id", invoice.customer);
    }

    // ❌ CANCELAMENTO
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from("profiles")
        .update({
          plan: "free",
          subscription_status: "canceled",
        })
        .eq("stripe_customer_id", subscription.customer);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("Erro webhook:", err);
    return new NextResponse("Webhook error", { status: 400 });
  }
}