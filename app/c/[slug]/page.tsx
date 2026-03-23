import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    nome?: string;
    telefone?: string;
    email?: string;
    empresa?: string;
    equipe?: string;
  }>;
};

function normalizarWhatsapp(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 15);

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  if (numeros.length <= 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}${
    numeros.slice(11) ? " " + numeros.slice(11) : ""
  }`;
}

export default async function CampaignRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const supabase = await createClient();
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const nome = (resolvedSearchParams?.nome || "").trim();
  const telefone = normalizarWhatsapp(resolvedSearchParams?.telefone || "");
  const email = (resolvedSearchParams?.email || "").trim().toLowerCase();
  const empresa = (resolvedSearchParams?.empresa || "").trim();
  const equipe = (resolvedSearchParams?.equipe || "").trim();

  if (!slug) {
    return (
      <div
        style={{
          padding: 40,
          color: "white",
          background: "#020617",
          minHeight: "100vh",
        }}
      >
        Slug não informado.
      </div>
    );
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return (
      <div
        style={{
          padding: 40,
          color: "white",
          background: "#020617",
          minHeight: "100vh",
        }}
      >
        <h1>Erro ao buscar campanha</h1>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div
        style={{
          padding: 40,
          color: "white",
          background: "#020617",
          minHeight: "100vh",
        }}
      >
        <h1>Campanha não encontrada</h1>
        <p>Slug recebido: {slug}</p>
      </div>
    );
  }

  if (campaign.target_type === "whatsapp") {
    const numeroDestino = normalizarWhatsapp(campaign.target_value || "");

    if (!numeroDestino) {
      return (
        <div
          style={{
            padding: 40,
            color: "white",
            background: "#020617",
            minHeight: "100vh",
          }}
        >
          <h1>Número de WhatsApp inválido</h1>
          <pre>{JSON.stringify(campaign, null, 2)}</pre>
        </div>
      );
    }

    const veioCompletoDaLanding =
      nome.length >= 2 ||
      telefone.length >= 10 ||
      email.length > 3 ||
      empresa.length > 1;

    const formPreenchido = nome.length >= 2 && telefone.length >= 10;

    if (!veioCompletoDaLanding && !formPreenchido) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background:
              "radial-gradient(circle at top, #0f172a 0%, #020617 45%, #010409 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              borderRadius: 24,
              padding: 32,
              boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.22)",
                color: "#86efac",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 18,
              }}
            >
              Campanha ativa
            </div>

            <h1
              style={{
                fontSize: 30,
                lineHeight: 1.15,
                margin: 0,
                marginBottom: 12,
                fontWeight: 800,
              }}
            >
              {campaign.name || "Falar no WhatsApp"}
            </h1>

            <p
              style={{
                margin: 0,
                marginBottom: 24,
                color: "#cbd5e1",
                fontSize: 16,
                lineHeight: 1.6,
              }}
            >
              Antes de continuar, informe seus dados para a empresa te atender
              melhor no WhatsApp.
            </p>

            <form method="GET" style={{ display: "grid", gap: 16 }}>
              <input type="hidden" name="slug" value={slug} />

              <div style={{ display: "grid", gap: 8 }}>
                <label
                  htmlFor="nome"
                  style={{
                    fontSize: 14,
                    color: "#e2e8f0",
                    fontWeight: 600,
                  }}
                >
                  Seu nome
                </label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  placeholder="Digite seu nome"
                  required
                  minLength={2}
                  defaultValue={nome}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 14,
                    border: "1px solid rgba(148, 163, 184, 0.22)",
                    background: "rgba(15, 23, 42, 0.9)",
                    color: "white",
                    padding: "0 16px",
                    fontSize: 15,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label
                  htmlFor="telefone"
                  style={{
                    fontSize: 14,
                    color: "#e2e8f0",
                    fontWeight: 600,
                  }}
                >
                  Seu WhatsApp
                </label>
                <input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  placeholder="(62) 99999-9999"
                  required
                  minLength={10}
                  defaultValue={formatarTelefone(telefone)}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 14,
                    border: "1px solid rgba(148, 163, 184, 0.22)",
                    background: "rgba(15, 23, 42, 0.9)",
                    color: "white",
                    padding: "0 16px",
                    fontSize: 15,
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: 8,
                  height: 54,
                  borderRadius: 16,
                  border: "none",
                  background:
                    "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 16px 36px rgba(34, 197, 94, 0.28)",
                }}
              >
                Continuar no WhatsApp
              </button>
            </form>

            <p
              style={{
                marginTop: 16,
                marginBottom: 0,
                fontSize: 13,
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              Seus dados serão usados apenas para registrar seu atendimento e
              facilitar o retorno da empresa.
            </p>
          </div>
        </div>
      );
    }

    await supabase.from("campaign_clicks").insert({
      campaign_id: campaign.id,
      slug: campaign.slug,
    });

    const chaveTelefone = telefone || null;
    const chaveEmail = email || null;

    let leadExistente = null;

    if (chaveTelefone) {
      const { data } = await supabase
        .from("servicos")
        .select("id")
        .eq("company_id", campaign.company_id)
        .eq("campaign_id", campaign.id)
        .eq("telefone", chaveTelefone)
        .limit(1)
        .maybeSingle();

      leadExistente = data;
    }

    if (!leadExistente && chaveEmail) {
      const { data } = await supabase
        .from("servicos")
        .select("id")
        .eq("company_id", campaign.company_id)
        .eq("campaign_id", campaign.id)
        .ilike("observacoes", `%${chaveEmail}%`)
        .limit(1)
        .maybeSingle();

      leadExistente = data;
    }

    if (!leadExistente) {
      const responsavelEmail =
        typeof campaign.responsavel_email === "string" &&
        campaign.responsavel_email.trim()
          ? campaign.responsavel_email.trim().toLowerCase()
          : null;

      let responsavelUserId: string | null = null;

      if (responsavelEmail) {
        const { data: companyUser } = await supabase
          .from("company_users")
          .select("user_id, email")
          .eq("company_id", campaign.company_id)
          .eq("email", responsavelEmail)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle();

        responsavelUserId = companyUser?.user_id || null;
      }

      const descricaoPartes = [
        `Lead gerado automaticamente ao clicar no link da campanha "${campaign.name}".`,
        empresa ? `Empresa: ${empresa}` : null,
        equipe ? `Tamanho da equipe: ${equipe}` : null,
        email ? `E-mail: ${email}` : null,
      ].filter(Boolean);

      const observacoesPartes = [
        email ? `Email: ${email}` : null,
        empresa ? `Empresa: ${empresa}` : null,
        equipe ? `Equipe: ${equipe}` : null,
      ].filter(Boolean);

      const leadPayload: any = {
        cliente: nome || empresa || `Lead da campanha ${campaign.name}`,
        telefone: telefone || null,
        titulo: `Novo lead - ${campaign.name}`,
        descricao: descricaoPartes.join(" "),
        observacoes: observacoesPartes.join(" | ") || null,
        status: "lead",
        origem_lead: "Campanha WhatsApp",
        campaign_id: campaign.id,
        tracked_at: new Date().toISOString(),
        company_id: campaign.company_id,
        temperatura: "morno",
        ativo: true,
        responsavel: responsavelEmail,
        tipo_pessoa: "pj",
      };

      if (responsavelUserId) {
        leadPayload.user_id = responsavelUserId;
      }

      const { error: insertLeadError } = await supabase
        .from("servicos")
        .insert(leadPayload);

      if (insertLeadError) {
        console.error("Erro ao criar lead:", insertLeadError.message);
      }
    }

    const mensagemBase = [
      "Olá, quero entender como aplicar o FlowDesk no meu negócio.",
      nome ? `Nome: ${nome}` : null,
      email ? `Email: ${email}` : null,
      empresa ? `Empresa: ${empresa}` : null,
      equipe ? `Tamanho da equipe: ${equipe}` : null,
      telefone ? `WhatsApp: ${telefone}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const mensagem = encodeURIComponent(mensagemBase);

    redirect(`https://wa.me/${numeroDestino}?text=${mensagem}`);
  }

  if (campaign.target_type === "page") {
    await supabase.from("campaign_clicks").insert({
      campaign_id: campaign.id,
      slug: campaign.slug,
    });

    const destino = campaign.target_value || "/";

    if (destino.startsWith("http://") || destino.startsWith("https://")) {
      redirect(destino);
    }

    return (
      <div
        style={{
          padding: 40,
          color: "white",
          background: "#020617",
          minHeight: "100vh",
        }}
      >
        <h1>Destino inválido para campanha do tipo page</h1>
        <pre>{JSON.stringify(campaign, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 40,
        color: "white",
        background: "#020617",
        minHeight: "100vh",
      }}
    >
      <h1>Tipo de campanha inválido</h1>
      <pre>{JSON.stringify(campaign, null, 2)}</pre>
    </div>
  );
}