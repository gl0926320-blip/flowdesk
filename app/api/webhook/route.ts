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
  const body = await req.text();
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

      // ✅ CHECKOUT COMPLETO → apenas salvar IDs
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription") {
          const userId = session.metadata?.userId;

          if (!userId) {
            console.error("❌ userId não encontrado no metadata");
            break;
          }

          await supabase
            .from("profiles")
            .update({
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            })
            .eq("id", userId);

          console.log("✅ IDs salvos no profile");
        }
        break;
      }

      // 🔥 FONTE OFICIAL DA ASSINATURA
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const status = subscription.status;
        const customerId = subscription.customer as string;

        let plan = "free";

        if (
          status === "active" ||
          status === "trialing" ||
          status === "past_due"
        ) {
          plan = "pro";
        }

        if (status === "canceled" || status === "unpaid") {
          plan = "free";
        }

        await supabase
          .from("profiles")
          .update({
            plan,
            subscription_status: status,
            stripe_subscription_id: subscription.id,
          })
          .eq("stripe_customer_id", customerId);

        console.log("🔄 Assinatura atualizada:", status);
        break;
      }

      // ❌ CANCELAMENTO DEFINITIVO
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await supabase
          .from("profiles")
          .update({
            plan: "free",
            subscription_status: "canceled",
          })
          .eq("stripe_customer_id", subscription.customer as string);

        console.log("❌ Assinatura cancelada");
        break;
      }

      // ⚠️ FALHA DE PAGAMENTO → não rebaixar plano
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        await supabase
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("stripe_customer_id", invoice.customer as string);

        console.log("⚠️ Pagamento falhou (past_due)");
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