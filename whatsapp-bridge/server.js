require("dotenv").config();

const express = require("express");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();

app.use(
  express.json({
    limit: "2mb",
  })
);

const PORT = Number(process.env.PORT || 3100);

const SECRET =
  process.env.WHATSAPP_BRIDGE_SECRET ||
  "minha-chave-flowdesk-123";

const FLOWDESK_APP_URL = String(
  process.env.FLOWDESK_APP_URL ||
    "http://localhost:3000"
).replace(/\/$/, "");

const sessions = new Map();
const identityCache = new Map();

/*
 * Evita que a mesma requisição seja enviada
 * mais de uma vez ao WhatsApp.
 */
const sentRequests = new Map();
const SEND_DUPLICATE_WINDOW = 15000;

/*
 * Marca envios iniciados pelo FlowDesk para que o evento
 * message_create não grave a mesma mensagem novamente.
 */
const flowdeskPendingOutgoing = new Map();
const FLOWDESK_OUTGOING_WINDOW = 8000;

function outgoingTextKey(companyId, text) {
  return `${companyId}:${String(text || "").trim()}`;
}

function markFlowDeskOutgoing(companyId, text) {
  const key = outgoingTextKey(companyId, text);

  flowdeskPendingOutgoing.set(
    key,
    Date.now()
  );

  setTimeout(() => {
    const createdAt =
      flowdeskPendingOutgoing.get(key);

    if (
      createdAt &&
      Date.now() - createdAt >=
        FLOWDESK_OUTGOING_WINDOW
    ) {
      flowdeskPendingOutgoing.delete(
        key
      );
    }
  }, FLOWDESK_OUTGOING_WINDOW + 1000);
}

function isFlowDeskOutgoing(
  companyId,
  text
) {
  const key =
    outgoingTextKey(
      companyId,
      text
    );

  const createdAt =
    flowdeskPendingOutgoing.get(
      key
    );

  return Boolean(
    createdAt &&
      Date.now() - createdAt <
        FLOWDESK_OUTGOING_WINDOW
  );
}

function requireSecret(
  req,
  res,
  next
) {
  const received =
    req.headers[
      "x-flowdesk-secret"
    ];

  if (
    !received ||
    received !== SECRET
  ) {
    return res
      .status(401)
      .json({
        error:
          "Não autorizado.",
      });
  }

  next();
}

function cleanCompanyId(value) {
  return String(value || "")
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    );
}

function normalizePhone(value) {
  return String(
    value || ""
  ).replace(/\D/g, "");
}

function serializedId(value) {
  if (!value) {
    return "";
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return (
    value?._serialized ||
    value?.id?._serialized ||
    String(value || "")
  );
}

function getIdentityMap(
  companyId
) {
  if (
    !identityCache.has(
      companyId
    )
  ) {
    identityCache.set(
      companyId,
      new Map()
    );
  }

  return identityCache.get(
    companyId
  );
}

function rememberIdentity(
  companyId,
  identity
) {
  if (!identity) {
    return;
  }

  const map =
    getIdentityMap(
      companyId
    );

  const lid =
    serializedId(
      identity.lid
    );

  const pn =
    serializedId(
      identity.pn
    );

  const phone =
    normalizePhone(
      identity.phone ||
        pn
    );

  const lidDigits =
    normalizePhone(lid);

  const pnDigits =
    normalizePhone(pn);

  const normalized = {
    lid:
      lid || null,

    pn:
      pn || null,

    phone:
      phone ||
      pnDigits ||
      null,
  };

  if (lid) {
    map.set(
      lid,
      normalized
    );
  }

  if (lidDigits) {
    map.set(
      lidDigits,
      normalized
    );
  }

  if (pn) {
    map.set(
      pn,
      normalized
    );
  }

  if (pnDigits) {
    map.set(
      pnDigits,
      normalized
    );
  }

  if (phone) {
    map.set(
      phone,
      normalized
    );
  }
}

async function resolveLidAndPhone(
  client,
  userId
) {
  const raw =
    String(
      userId || ""
    ).trim();

  if (!raw) {
    return null;
  }

  try {
    const result =
      await client
        .getContactLidAndPhone([
          raw,
        ]);

    const first =
      Array.isArray(result)
        ? result[0]
        : null;

    if (
      first?.lid ||
      first?.pn
    ) {
      return {
        lid:
          serializedId(
            first.lid
          ) || null,

        pn:
          serializedId(
            first.pn
          ) || null,

        phone:
          normalizePhone(
            first.pn
          ) || null,
      };
    }
  } catch (error) {
    console.warn(
      `[bridge] getContactLidAndPhone falhou para ${raw}:`,
      error?.message ||
        error
    );
  }

  return null;
}

async function resolveIncomingIdentity(
  client,
  message,
  contact
) {
  const remoteId =
    String(
      message?.from || ""
    );

  /*
   * PRIMEIRO:
   * tenta converter
   * LID -> telefone real.
   */
  const mapping =
    await resolveLidAndPhone(
      client,
      remoteId
    );

  if (
    mapping?.phone
  ) {
    return {
      ...mapping,
      remoteId,
    };
  }

  /*
   * Contato tradicional @c.us
   */
  const contactId =
    serializedId(
      contact?.id
    );

  const cUsId =
    remoteId.endsWith(
      "@c.us"
    )
      ? remoteId
      : contactId.endsWith(
          "@c.us"
        )
      ? contactId
      : "";

  if (cUsId) {
    return {
      lid: null,

      pn:
        cUsId,

      phone:
        normalizePhone(
          cUsId
        ),

      remoteId,
    };
  }

  /*
   * Algumas versões
   * retornam contact.number.
   */
  const contactNumber =
    normalizePhone(
      contact?.number
    );

  if (
    contactNumber
  ) {
    return {
      lid:
        remoteId.endsWith(
          "@lid"
        )
          ? remoteId
          : null,

      pn:
        `${contactNumber}@c.us`,

      phone:
        contactNumber,

      remoteId,
    };
  }

  /*
   * NÃO usa número do LID
   * como telefone real.
   */
  return {
    lid:
      remoteId.endsWith(
        "@lid"
      )
        ? remoteId
        : null,

    pn:
      null,

    phone:
      null,

    remoteId,
  };
}

async function resolveOutgoingIdentity(
  client,
  companyId,
  suppliedValue
) {
  const map =
    getIdentityMap(
      companyId
    );

  const raw =
    String(
      suppliedValue || ""
    ).trim();

  const digits =
    normalizePhone(
      raw
    );

  /*
   * 1 - CACHE
   */
  const cached =
    map.get(raw) ||
    map.get(digits);

  if (
    cached?.lid ||
    cached?.pn
  ) {
    return cached;
  }

  /*
   * 2 - BANCO PODE TER
   * SALVADO LID ANTIGO
   * COMO TELEFONE.
   */
  if (digits) {
    const lidCandidate =
      `${digits}@lid`;

    const byLid =
      await resolveLidAndPhone(
        client,
        lidCandidate
      );

    if (
      byLid?.lid ||
      byLid?.pn
    ) {
      rememberIdentity(
        companyId,
        byLid
      );

      return byLid;
    }
  }

  /*
   * 3 - TENTA COMO
   * TELEFONE NORMAL
   */
  if (digits) {
    const phoneCandidate =
      `${digits}@c.us`;

    const byPhone =
      await resolveLidAndPhone(
        client,
        phoneCandidate
      );

    if (
      byPhone?.lid ||
      byPhone?.pn
    ) {
      rememberIdentity(
        companyId,
        byPhone
      );

      return byPhone;
    }
  }

  /*
   * 4 - FALLBACK
   */
  if (
    digits &&
    digits.length <= 13
  ) {
    return {
      lid:
        null,

      pn:
        `${digits}@c.us`,

      phone:
        digits,
    };
  }

  return null;
}

async function notifyFlowDesk(
  payload
) {
  try {
    const response =
      await fetch(
        `${FLOWDESK_APP_URL}/api/whatsapp/webjs/event`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-flowdesk-secret":
              SECRET,
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    if (
      !response.ok
    ) {
      const result =
        await response.text();

      console.error(
        "[bridge] FlowDesk retornou erro:",
        response.status,
        result
      );
    }
  } catch (error) {
    console.error(
      "[bridge] erro ao chamar FlowDesk:",
      error
    );
  }
}

function getPhoneFromClient(
  client
) {
  const wid =
    client?.info?.wid
      ?._serialized ||
    "";

  return normalizePhone(
    wid
  );
}

function createSession(
  companyId
) {
  const cleanId =
    cleanCompanyId(
      companyId
    );

  if (!cleanId) {
    throw new Error(
      "companyId inválido."
    );
  }

  const existing =
    sessions.get(
      cleanId
    );

  if (existing) {
    return existing;
  }

  const state = {
    companyId:
      cleanId,

    status:
      "starting",

    qrCode:
      null,

    phone:
      null,

    message:
      "Inicializando WhatsApp...",

    client:
      null,
  };

  const client =
    new Client({
      authStrategy:
        new LocalAuth({
          clientId:
            `flowdesk-${cleanId}`,

          dataPath:
            "./.wwebjs_auth",
        }),

      puppeteer: {
        headless:
          true,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    });

  state.client =
    client;

  sessions.set(
    cleanId,
    state
  );

  getIdentityMap(
    cleanId
  );

  /*
   * QR CODE
   */
  client.on(
    "qr",

    async (qr) => {
      try {
        state.qrCode =
          await QRCode
            .toDataURL(
              qr,
              {
                width:
                  320,

                margin:
                  2,
              }
            );

        state.status =
          "qr";

        state.message =
          "QR Code pronto. Escaneie pelo WhatsApp.";

        console.log(
          `[bridge] QR gerado para ${cleanId}`
        );
      } catch (error) {
        console.error(
          "[bridge] erro QR:",
          error
        );

        state.status =
          "error";

        state.message =
          "Erro ao gerar QR Code.";
      }
    }
  );

  /*
   * AUTENTICADO
   */
  client.on(
    "authenticated",

    () => {
      state.status =
        "authenticated";

      state.qrCode =
        null;

      state.message =
        "QR lido. Autenticando...";

      console.log(
        `[bridge] empresa ${cleanId} autenticada`
      );
    }
  );

  /*
   * PRONTO
   */
  client.on(
    "ready",

    async () => {
      state.status =
        "connected";

      state.qrCode =
        null;

      state.phone =
        getPhoneFromClient(
          client
        );

      state.message =
        "WhatsApp conectado com sucesso.";

      console.log(
        `[bridge] WhatsApp conectado: ${state.phone}`
      );

      await notifyFlowDesk({
        type:
          "ready",

        companyId:
          cleanId,

        phone:
          state.phone,
      });
    }
  );

  /*
   * ==========================================
   * MENSAGEM RECEBIDA DO CLIENTE
   * ==========================================
   */
  client.on(
    "message",

    async (message) => {
      try {
        const remoteId =
          String(
            message?.from ||
              ""
          );

        if (
          !remoteId
        ) {
          return;
        }

        if (
          remoteId.endsWith(
            "@g.us"
          ) ||
          remoteId ===
            "status@broadcast"
        ) {
          return;
        }

        const text =
          String(
            message.body ||
              ""
          ).trim();

        if (!text) {
          return;
        }

        const contact =
          await message
            .getContact()
            .catch(
              () => null
            );

        const identity =
          await resolveIncomingIdentity(
            client,
            message,
            contact
          );

        if (
          !identity?.phone
        ) {
          console.error(
            "[bridge] mensagem recebida, mas não consegui converter LID para telefone:",
            {
              remoteId,

              contactId:
                serializedId(
                  contact?.id
                ),

              contactNumber:
                contact?.number ||
                null,
            }
          );

          return;
        }

        rememberIdentity(
          cleanId,
          identity
        );

        const phone =
          identity.phone;

        const name =
          contact?.pushname ||
          contact?.name ||
          contact?.shortName ||
          `WhatsApp ${phone.slice(
            -4
          )}`;

        const messageId =
          message?.id
            ?._serialized ||
          String(
            message?.id ||
              ""
          );

        console.log(
          "[bridge] mensagem recebida"
        );

        console.log(
          `  LID: ${
            identity.lid ||
            "—"
          }`
        );

        console.log(
          `  PN: ${
            identity.pn ||
            "—"
          }`
        );

        console.log(
          `  Telefone real: ${phone}`
        );

        console.log(
          `  Texto: ${text}`
        );

        await notifyFlowDesk({
          type:
            "message",

          direction:
            "inbound",

          companyId:
            cleanId,

          phone,

          name,

          text,

          messageId,

          lid:
            identity.lid,

          pn:
            identity.pn,

          remoteId,
        });
      } catch (error) {
        console.error(
          "[bridge] erro mensagem recebida:",
          error
        );
      }
    }
  );

  /*
   * ==========================================
   * MENSAGEM ENVIADA MANUALMENTE
   * PELO WHATSAPP
   * ==========================================
   *
   * Ex:
   * celular ou WhatsApp Web.
   */
  client.on(
    "message_create",

    async (message) => {
      try {
        /*
         * Só mensagens criadas
         * pela conta conectada.
         */
        if (
          !message?.fromMe
        ) {
          return;
        }

        const text =
          String(
            message.body ||
              ""
          ).trim();

        if (!text) {
          return;
        }

        /*
         * Se a mensagem foi iniciada
         * pelo próprio FlowDesk,
         * ela já será salva pela
         * rota /messages/send.
         *
         * Portanto ignoramos aqui.
         */
        if (
          isFlowDeskOutgoing(
            cleanId,
            text
          )
        ) {
          console.log(
            `[bridge] message_create do FlowDesk ignorado: ${text}`
          );

          return;
        }

        /*
         * Em mensagem enviada
         * pelo próprio usuário,
         * usamos message.to.
         */
        const remoteId =
          String(
            message?.to ||
              message?.id
                ?.remote ||
              ""
          ).trim();

        if (
          !remoteId ||
          remoteId.endsWith(
            "@g.us"
          ) ||
          remoteId ===
            "status@broadcast"
        ) {
          return;
        }

        /*
         * Resolve LID -> número real.
         */
        let identity =
          await resolveLidAndPhone(
            client,
            remoteId
          );

        /*
         * Fallback caso não consiga
         * mapear pela função LID.
         */
        if (!identity) {
          const digits =
            normalizePhone(
              remoteId
            );

          if (digits) {
            identity = {
              lid:
                remoteId.endsWith(
                  "@lid"
                )
                  ? remoteId
                  : null,

              pn:
                remoteId.endsWith(
                  "@c.us"
                )
                  ? remoteId
                  : `${digits}@c.us`,

              phone:
                digits,
            };
          }
        }

        if (
          !identity?.phone
        ) {
          console.warn(
            "[bridge] mensagem enviada manualmente, mas não consegui identificar o contato:",
            remoteId
          );

          return;
        }

        rememberIdentity(
          cleanId,
          identity
        );

        const phone =
          identity.phone;

        const contact =
          await message
            .getContact()
            .catch(
              () => null
            );

        const messageId =
          message?.id
            ?._serialized ||
          String(
            message?.id ||
              ""
          );

        const name =
          contact?.pushname ||
          contact?.name ||
          contact?.shortName ||
          `WhatsApp ${phone.slice(
            -4
          )}`;

        console.log(
          "[bridge] mensagem enviada manualmente pelo WhatsApp"
        );

        console.log(
          `  Telefone real: ${phone}`
        );

        console.log(
          `  Remote ID: ${remoteId}`
        );

        console.log(
          `  Texto: ${text}`
        );

        /*
         * Envia ao FlowDesk
         * como OUTBOUND.
         */
        await notifyFlowDesk({
          type:
            "message",

          direction:
            "outbound",

          companyId:
            cleanId,

          phone,

          name,

          text,

          messageId,

          lid:
            identity.lid ||
            null,

          pn:
            identity.pn ||
            null,

          remoteId,
        });
      } catch (error) {
        console.error(
          "[bridge] erro ao capturar mensagem enviada manualmente:",
          error
        );
      }
    }
  );

  /*
   * FALHA DE AUTENTICAÇÃO
   */
  client.on(
    "auth_failure",

    (message) => {
      console.error(
        "[bridge] auth_failure:",
        message
      );

      state.status =
        "error";

      state.message =
        "Falha na autenticação do WhatsApp.";
    }
  );

  /*
   * DESCONECTADO
   */
  client.on(
    "disconnected",

    async (reason) => {
      console.log(
        "[bridge] desconectado:",
        reason
      );

      state.status =
        "disconnected";

      state.qrCode =
        null;

      state.phone =
        null;

      state.message =
        "WhatsApp desconectado.";

      identityCache.delete(
        cleanId
      );

      await notifyFlowDesk({
        type:
          "disconnected",

        companyId:
          cleanId,

        reason:
          String(
            reason ||
              ""
          ),
      });
    }
  );

  client
    .initialize()
    .catch(
      (error) => {
        console.error(
          "[bridge] initialize:",
          error
        );

        state.status =
          "error";

        state.message =
          error instanceof Error
            ? error.message
            : "Erro ao iniciar WhatsApp.";
      }
    );

  return state;
}

/*
 * ==========================================
 * HEALTH
 * ==========================================
 */
app.get(
  "/health",

  (req, res) => {
    res.json({
      ok:
        true,

      service:
        "flowdesk-whatsapp-bridge",
    });
  }
);

/*
 * ==========================================
 * INICIAR SESSÃO
 * ==========================================
 */
app.post(
  "/sessions/start",

  requireSecret,

  async (req, res) => {
    try {
      const companyId =
        req.body
          ?.companyId;

      if (!companyId) {
        return res
          .status(400)
          .json({
            error:
              "companyId é obrigatório.",
          });
      }

      const session =
        createSession(
          companyId
        );

      return res.json({
        ok:
          true,

        status:
          session.status,

        qrCode:
          session.qrCode,

        phone:
          session.phone,

        message:
          session.message,
      });
    } catch (error) {
      console.error(
        "[bridge] start:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Erro ao iniciar sessão.",
        });
    }
  }
);

/*
 * ==========================================
 * STATUS DA SESSÃO
 * ==========================================
 */
app.get(
  "/sessions/:companyId/status",

  requireSecret,

  (req, res) => {
    try {
      const companyId =
        cleanCompanyId(
          req.params
            .companyId
        );

      let session =
        sessions.get(
          companyId
        );

      if (!session) {
        session =
          createSession(
            companyId
          );
      }

      return res.json({
        ok:
          true,

        status:
          session.status,

        qrCode:
          session.qrCode,

        phone:
          session.phone,

        message:
          session.message,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Erro ao consultar sessão.",
        });
    }
  }
);

/*
 * ==========================================
 * ENVIO DE MENSAGEM
 * ==========================================
 */
app.post(
  "/messages/send",

  requireSecret,

  async (req, res) => {
    try {
      const companyId =
        cleanCompanyId(
          req.body
            ?.companyId
        );

      const suppliedPhone =
        String(
          req.body
            ?.phone ||
            ""
        ).trim();

      const text =
        String(
          req.body
            ?.text ||
            ""
        ).trim();

      const requestId =
        String(
          req.body
            ?.requestId ||
            ""
        ).trim();

      if (
        !companyId ||
        !suppliedPhone ||
        !text
      ) {
        return res
          .status(400)
          .json({
            error:
              "companyId, phone e text são obrigatórios.",
          });
      }

      /*
       * TRAVA:
       * mesma requestId
       * não envia novamente.
       */
      if (
        requestId &&
        sentRequests.has(
          requestId
        )
      ) {
        const previous =
          sentRequests.get(
            requestId
          );

        console.log(
          `[bridge] request duplicada bloqueada: ${requestId}`
        );

        return res.json({
          ok:
            true,

          duplicate:
            true,

          status:
            "sent",

          messageId:
            previous
              ?.messageId ||
            null,

          via:
            previous?.via ||
            null,
        });
      }

      const session =
        sessions.get(
          companyId
        );

      if (
        !session ||
        session.status !==
          "connected"
      ) {
        return res
          .status(409)
          .json({
            error:
              "WhatsApp da empresa não está conectado.",
          });
      }

      const client =
        session.client;

      /*
       * Resolve número e LID.
       */
      const identity =
        await resolveOutgoingIdentity(
          client,
          companyId,
          suppliedPhone
        );

      if (!identity) {
        return res
          .status(422)
          .json({
            error:
              "Não consegui identificar o telefone/LID deste contato. Peça para o cliente enviar uma nova mensagem e tente novamente.",
          });
      }

      rememberIdentity(
        companyId,
        identity
      );

      console.log(
        "[bridge] identidade encontrada:",
        {
          phone:
            identity.phone ||
            null,

          lid:
            identity.lid ||
            null,

          pn:
            identity.pn ||
            null,

          requestId:
            requestId ||
            null,
        }
      );

      /*
       * Guarda request enviada.
       */
      function rememberSentRequest(
        messageId,
        via
      ) {
        if (!requestId) {
          return;
        }

        sentRequests.set(
          requestId,
          {
            messageId:
              messageId ||
              null,

            via:
              via ||
              null,

            createdAt:
              Date.now(),
          }
        );

        setTimeout(() => {
          const current =
            sentRequests.get(
              requestId
            );

          if (
            current &&
            Date.now() -
              Number(
                current.createdAt ||
                  0
              ) >=
              SEND_DUPLICATE_WINDOW
          ) {
            sentRequests.delete(
              requestId
            );
          }
        }, SEND_DUPLICATE_WINDOW + 1000);
      }

      /*
       * Marca ANTES do sendMessage.
       *
       * Assim o message_create
       * não salva novamente
       * uma mensagem enviada
       * pelo FlowDesk.
       */
      markFlowDeskOutgoing(
        companyId,
        text
      );

      /*
       * ======================================
       * TENTATIVA 1 - LID
       * ======================================
       */
      if (
        identity.lid
      ) {
        try {
          console.log(
            `[bridge] tentando envio pelo LID: ${identity.lid}`
          );

          const sent =
            await client
              .sendMessage(
                identity.lid,
                text
              );

          const messageId =
            sent?.id
              ?._serialized ||
            String(
              sent?.id ||
                ""
            );

          rememberSentRequest(
            messageId,
            "lid"
          );

          console.log(
            `[bridge] ✅ enviado UMA VEZ pelo LID: ${identity.lid}`
          );

          /*
           * IMPORTANTE:
           * encerra aqui.
           *
           * NÃO continua para PN
           * nem fallback.
           */
          return res.json({
            ok:
              true,

            status:
              "sent",

            via:
              "lid",

            requestId:
              requestId ||
              null,

            phone:
              identity.phone ||
              null,

            lid:
              identity.lid,

            pn:
              identity.pn ||
              null,

            messageId,
          });
        } catch (error) {
          console.warn(
            "[bridge] envio por LID falhou:",
            error?.message ||
              error
          );
        }
      }

      /*
       * ======================================
       * TENTATIVA 2 - PN
       * ======================================
       *
       * Só chega aqui se LID falhou.
       */
      if (
        identity.pn
      ) {
        try {
          console.log(
            `[bridge] tentando envio pelo PN: ${identity.pn}`
          );

          const sent =
            await client
              .sendMessage(
                identity.pn,
                text
              );

          const messageId =
            sent?.id
              ?._serialized ||
            String(
              sent?.id ||
                ""
            );

          rememberSentRequest(
            messageId,
            "pn"
          );

          console.log(
            `[bridge] ✅ enviado UMA VEZ pelo PN: ${identity.pn}`
          );

          return res.json({
            ok:
              true,

            status:
              "sent",

            via:
              "pn",

            requestId:
              requestId ||
              null,

            phone:
              identity.phone ||
              null,

            lid:
              identity.lid ||
              null,

            pn:
              identity.pn,

            messageId,
          });
        } catch (error) {
          console.warn(
            "[bridge] envio por PN falhou:",
            error?.message ||
              error
          );
        }
      }

      /*
       * ======================================
       * TENTATIVA 3 - FALLBACK
       * ======================================
       *
       * Só chega aqui se
       * LID e PN falharam.
       */
      const realPhone =
        normalizePhone(
          identity.phone ||
            suppliedPhone
        );

      if (!realPhone) {
        flowdeskPendingOutgoing.delete(
          outgoingTextKey(
            companyId,
            text
          )
        );

        return res
          .status(422)
          .json({
            error:
              "Telefone do cliente inválido.",
          });
      }

      const fallbackId =
        `${realPhone}@c.us`;

      try {
        console.log(
          `[bridge] tentando fallback: ${fallbackId}`
        );

        const sent =
          await client
            .sendMessage(
              fallbackId,
              text
            );

        const messageId =
          sent?.id
            ?._serialized ||
          String(
            sent?.id ||
              ""
          );

        rememberSentRequest(
          messageId,
          "fallback"
        );

        console.log(
          `[bridge] ✅ enviado UMA VEZ pelo fallback: ${fallbackId}`
        );

        return res.json({
          ok:
            true,

          status:
            "sent",

          via:
            "fallback",

          requestId:
            requestId ||
            null,

          phone:
            realPhone,

          lid:
            identity.lid ||
            null,

          pn:
            identity.pn ||
            null,

          messageId,
        });
      } catch (error) {
        console.error(
          "[bridge] todos os métodos de envio falharam:",
          error
        );

        /*
         * Como falhou,
         * remove marcação.
         */
        flowdeskPendingOutgoing.delete(
          outgoingTextKey(
            companyId,
            text
          )
        );

        return res
          .status(500)
          .json({
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível enviar a mensagem.",
          });
      }
    } catch (error) {
      console.error(
        "[bridge] erro geral de envio:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : "Erro ao enviar mensagem.",
        });
    }
  }
);

app.listen(
  PORT,
  "0.0.0.0",

  () => {
    console.log(
      `FlowDesk WhatsApp Bridge rodando na porta ${PORT}`
    );

    console.log(
      `Eventos serão enviados para ${FLOWDESK_APP_URL}`
    );
  }
);