import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

if (!mpAccessToken) {
  throw new Error("MERCADO_PAGO_ACCESS_TOKEN ausente.");
}

const mp = new MercadoPagoConfig({
  accessToken: mpAccessToken,
});

const BASE_PRICE = 149.9;
const EXTRA_USER_PRICE = 89.9;
const USERS_INCLUDED = 1;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CreateCheckoutBody = {
  companyId?: string;
  company_id?: string;

  companyName?: string;
  company_name?: string;

  userEmail?: string;
  user_email?: string;

  users?: number | string;
  userCount?: number | string;
  user_count?: number | string;
};

function isValidUuid(value?: string | null) {
  if (!value || typeof value !== "string") {
    return false;
  }

  return UUID_REGEX.test(value.trim());
}

function normalizeUsers(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  const users = Math.floor(parsed);

  if (users < 1) {
    return 1;
  }

  /*
   * Limite de segurança.
   * Pode aumentar depois se quiser.
   */
  if (users > 100) {
    return 100;
  }

  return users;
}

function calculateSubscription(users: number) {
  const normalizedUsers = Math.max(1, users);

  const extraUsers = Math.max(
    0,
    normalizedUsers - USERS_INCLUDED
  );

  const extraUsersTotal =
    extraUsers * EXTRA_USER_PRICE;

  const total =
    BASE_PRICE + extraUsersTotal;

  /*
   * Evita problemas de ponto flutuante.
   * Exemplo:
   * 149.9 + 89.9
   */
  const normalizedTotal =
    Math.round(total * 100) / 100;

  return {
    users: normalizedUsers,
    usersIncluded: USERS_INCLUDED,
    extraUsers,
    basePrice: BASE_PRICE,
    extraUserPrice: EXTRA_USER_PRICE,
    extraUsersTotal:
      Math.round(extraUsersTotal * 100) / 100,
    total: normalizedTotal,
  };
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function POST(request: Request) {
  console.log(
    "[FlowDesk create-checkout] POST iniciado"
  );

  try {
    const body =
      (await request.json()) as CreateCheckoutBody;

    console.log(
      "[FlowDesk create-checkout] body recebido:",
      {
        companyId:
          body.companyId ||
          body.company_id ||
          null,

        companyName:
          body.companyName ||
          body.company_name ||
          null,

        userEmail:
          body.userEmail ||
          body.user_email ||
          null,

        users:
          body.users ||
          body.userCount ||
          body.user_count ||
          null,
      }
    );

    /*
     * -----------------------------------------
     * EMPRESA
     * -----------------------------------------
     */

    const companyId =
      body.companyId ||
      body.company_id ||
      "";

    if (!companyId) {
      return NextResponse.json(
        {
          error:
            "companyId é obrigatório.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isValidUuid(companyId)) {
      return NextResponse.json(
        {
          error:
            "companyId inválido.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -----------------------------------------
     * DADOS DO CLIENTE
     * -----------------------------------------
     */

    const companyName =
      body.companyName ||
      body.company_name ||
      "Empresa";

    const userEmail =
      body.userEmail ||
      body.user_email ||
      "";

    /*
     * -----------------------------------------
     * USUÁRIOS
     * -----------------------------------------
     */

    const users = normalizeUsers(
      body.users ??
        body.userCount ??
        body.user_count ??
        1
    );

    /*
     * IMPORTANTE:
     *
     * O frontend NÃO escolhe preço.
     *
     * O preço é calculado aqui.
     */

    const subscription =
      calculateSubscription(users);

    console.log(
      "[FlowDesk create-checkout] assinatura calculada:",
      subscription
    );

    /*
     * -----------------------------------------
     * URLs
     * -----------------------------------------
     */

    const baseUrl = getBaseUrl();

    const successUrl =
      `${baseUrl}/dashboard/billing?payment=success`;

    const pendingUrl =
      `${baseUrl}/dashboard/billing?payment=pending`;

    const failureUrl =
      `${baseUrl}/dashboard/billing?payment=failure`;

    const webhookUrl =
      `${baseUrl}/api/mercadopago/webhook`;

    /*
     * -----------------------------------------
     * MERCADO PAGO
     * -----------------------------------------
     */

    const preference =
      new Preference(mp);

    /*
     * Criamos 2 itens:
     *
     * 1 - assinatura base
     * 2 - usuários adicionais
     *
     * Se houver somente 1 usuário,
     * mandamos apenas o plano base.
     */

    const items: Array<{
      id: string;
      title: string;
      description: string;
      quantity: number;
      currency_id: string;
      unit_price: number;
    }> = [
      {
        id: "flowdesk-base",
        title: "FlowDesk Completo",
        description:
          "Assinatura mensal FlowDesk - 1 usuário incluído",
        quantity: 1,
        currency_id: "BRL",
        unit_price: BASE_PRICE,
      },
    ];

    /*
     * Adiciona usuários extras
     * somente se existirem.
     */

    if (subscription.extraUsers > 0) {
      items.push({
        id: "flowdesk-extra-user",
        title:
          "Usuário adicional FlowDesk",
        description:
          "Usuário adicional da assinatura FlowDesk",
        quantity:
          subscription.extraUsers,
        currency_id: "BRL",
        unit_price:
          EXTRA_USER_PRICE,
      });
    }

    /*
     * External reference identificando
     * claramente assinatura FlowDesk.
     */

    const externalReference =
      `flowdesk_subscription:${companyId}:${Date.now()}`;

    console.log(
      "[FlowDesk create-checkout] criando preferência:",
      {
        companyId,
        companyName,
        users:
          subscription.users,
        extraUsers:
          subscription.extraUsers,
        total:
          subscription.total,
        externalReference,
        webhookUrl,
      }
    );

    const result =
      await preference.create({
        body: {
          items,

          payer: userEmail
            ? {
                email:
                  userEmail.trim(),
              }
            : undefined,

          back_urls: {
            success:
              successUrl,
            pending:
              pendingUrl,
            failure:
              failureUrl,
          },

          auto_return:
            "approved",

          external_reference:
            externalReference,

          metadata: {
            checkout_type:
              "flowdesk_subscription",

            company_id:
              companyId,

            company_name:
              companyName,

            system_name:
              "FlowDesk",

            billing_cycle:
              "monthly",

            users:
              subscription.users,

            users_included:
              subscription.usersIncluded,

            extra_users:
              subscription.extraUsers,

            base_price:
              subscription.basePrice,

            extra_user_price:
              subscription.extraUserPrice,

            extra_users_total:
              subscription.extraUsersTotal,

            total_amount:
              subscription.total,
          },

          notification_url:
            webhookUrl,

          statement_descriptor:
            "FLOWDESK",
        },
      });

    console.log(
      "[FlowDesk create-checkout] preferência criada:",
      {
        preferenceId:
          result.id ?? null,

        initPoint:
          result.init_point ??
          null,

        sandboxInitPoint:
          result.sandbox_init_point ??
          null,

        companyId,

        users:
          subscription.users,

        total:
          subscription.total,
      }
    );

    /*
     * -----------------------------------------
     * RESPOSTA PARA O FRONTEND
     * -----------------------------------------
     */

    return NextResponse.json({
      ok: true,

      id:
        result.id ?? null,

      preferenceId:
        result.id ?? null,

      initPoint:
        result.init_point ?? null,

      sandboxInitPoint:
        result.sandbox_init_point ??
        null,

      subscription: {
        users:
          subscription.users,

        usersIncluded:
          subscription.usersIncluded,

        extraUsers:
          subscription.extraUsers,

        basePrice:
          subscription.basePrice,

        extraUserPrice:
          subscription.extraUserPrice,

        extraUsersTotal:
          subscription.extraUsersTotal,

        total:
          subscription.total,
      },
    });
  } catch (error: unknown) {
    console.error(
      "[FlowDesk create-checkout] erro:",
      error
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erro interno ao criar checkout do FlowDesk.";

    return NextResponse.json(
      {
        ok: false,
        error:
          errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}