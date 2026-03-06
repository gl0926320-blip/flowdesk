import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function normalizarWhatsapp(valor: string) {
  return valor.replace(/\D/g, "");
}

export default async function CampaignRedirectPage({ params }: PageProps) {
  const supabase = await createClient();
  const { slug } = await params;

  if (!slug) {
    return (
      <div style={{ padding: 40, color: "white", background: "#020617", minHeight: "100vh" }}>
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
      <div style={{ padding: 40, color: "white", background: "#020617", minHeight: "100vh" }}>
        <h1>Erro ao buscar campanha</h1>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ padding: 40, color: "white", background: "#020617", minHeight: "100vh" }}>
        <h1>Campanha não encontrada</h1>
        <p>Slug recebido: {slug}</p>
      </div>
    );
  }

  await supabase.from("campaign_clicks").insert({
  campaign_id: campaign.id,
  slug: campaign.slug
})

  if (campaign.target_type === "whatsapp") {
    const numero = normalizarWhatsapp(campaign.target_value || "");

    if (!numero) {
      return (
        <div style={{ padding: 40, color: "white", background: "#020617", minHeight: "100vh" }}>
          <h1>Número de WhatsApp inválido</h1>
          <pre>{JSON.stringify(campaign, null, 2)}</pre>
        </div>
      );
    }

    const mensagem = encodeURIComponent(
      `Olá! Vim através da campanha ${campaign.name}.`
    );

    redirect(`https://wa.me/${numero}?text=${mensagem}`);
  }

  if (campaign.target_type === "page") {
    const destino = campaign.target_value || "/";

    if (destino.startsWith("http://") || destino.startsWith("https://")) {
      redirect(destino);
    }

    return (
      <div style={{ padding: 40, color: "white", background: "#020617", minHeight: "100vh" }}>
        <h1>Destino inválido para campanha do tipo page</h1>
        <pre>{JSON.stringify(campaign, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, color: "white", background: "#020617", minHeight: "100vh" }}>
      <h1>Tipo de campanha inválido</h1>
      <pre>{JSON.stringify(campaign, null, 2)}</pre>
    </div>
  );
}