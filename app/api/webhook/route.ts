export const runtime = "nodejs";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text(); // 🔥 OBRIGATÓRIO ser text()

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("❌ Erro de assinatura:", err);
    return new NextResponse("Webhook error", { status: 400 });
  }

  try {
    switch (event.type) {
      // ✅ ASSINATURA CRIADA
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription") {
          const userId = session.metadata?.userId;

          if (userId) {
            await supabase
              .from("profiles")
              .update({
                plan: "pro",
                subscription_status: "active",
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
              })
              .eq("id", userId);

            console.log("✅ Plano ativado:", userId);
          }
        }
        break;
      }

      // 🔁 RENOVAÇÃO
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
          })
          .eq("stripe_customer_id", invoice.customer);

        console.log("🔁 Renovação confirmada");
        break;
      }

      // ❌ FALHA NO PAGAMENTO
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        await supabase
          .from("profiles")
          .update({
            plan: "free",
            subscription_status: "past_due",
          })
          .eq("stripe_customer_id", invoice.customer);

        console.log("⚠️ Pagamento falhou");
        break;
      }

      // ❌ CANCELAMENTO
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await supabase
          .from("profiles")
          .update({
            plan: "free",
            subscription_status: "canceled",
          })
          .eq("stripe_customer_id", subscription.customer);

        console.log("❌ Assinatura cancelada");
        break;
      }

      default:
        console.log("Evento ignorado:", event.type);
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error("❌ Erro interno webhook:", error);
    return new NextResponse("Webhook error", { status: 400 });
  }
}