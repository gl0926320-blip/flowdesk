"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Copy,
  Link2,
  Plus,
  Megaphone,
  Search,
  RefreshCcw,
  Download,
  Trash2,
  Power,
  Mail,
} from "lucide-react";

type Campaign = {
  id: string;
  company_id: string;
  name: string;
  source: string;
  slug: string;
  target_type: string;
  target_value: string | null;
  responsavel_email: string | null;
  is_active: boolean;
  created_at: string;
  campaign_clicks?: { count: number }[];
};

const SOURCE_OPTIONS = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site" },
  { value: "outro", label: "Outro" },
];

const TARGET_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "page", label: "Página/URL" },
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function isValidEmail(email: string) {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function CampanhasPage() {
  const supabase = createClient();
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [source, setSource] = useState("meta_ads");
  const [targetType, setTargetType] = useState("whatsapp");
  const [targetValue, setTargetValue] = useState("");
  const [slug, setSlug] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");

  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [toast, setToast] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  function showToast(message: string) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast(message);

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  async function loadCampaigns() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: companyUser, error: companyError } = await supabase
        .from("company_users")
        .select("company_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();

      if (companyError) {
        console.error("Erro ao buscar company_id:", companyError.message);
        setLoading(false);
        return;
      }

      if (!companyUser?.company_id) {
        console.error("Usuário sem vínculo ativo com empresa.");
        setLoading(false);
        return;
      }

      setCompanyId(companyUser.company_id);

      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          campaign_clicks(count)
        `)
        .eq("company_id", companyUser.company_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar campanhas:", error.message);
      } else {
        setCampaigns((data || []) as Campaign[]);
      }
    } catch (error) {
      console.error("Erro inesperado ao carregar campanhas:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (!name) {
      setSlug("");
      return;
    }
    setSlug(slugify(name));
  }, [name]);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();

    if (!companyId) {
      alert("Empresa não encontrada.");
      return;
    }

    if (!name.trim()) {
      alert("Digite o nome da campanha.");
      return;
    }

    if (!slug.trim()) {
      alert("Slug inválido.");
      return;
    }

    if (!targetValue.trim()) {
      alert("Preencha o destino da campanha.");
      return;
    }

    if (!isValidEmail(responsavelEmail)) {
      alert("Digite um e-mail válido para o responsável.");
      return;
    }

    try {
      setSaving(true);

      const { data: existingSlug } = await supabase
        .from("campaigns")
        .select("id")
        .eq("company_id", companyId)
        .eq("slug", slug)
        .maybeSingle();

      if (existingSlug) {
        alert("Já existe uma campanha com esse slug. Altere o nome ou slug.");
        setSaving(false);
        return;
      }

      const payload = {
        company_id: companyId,
        name: name.trim(),
        source,
        slug: slug.trim(),
        target_type: targetType,
        target_value: targetValue.trim(),
        responsavel_email: responsavelEmail.trim() || null,
        is_active: true,
      };

      const { error } = await supabase.from("campaigns").insert(payload);

      if (error) {
        console.error("Erro ao criar campanha:", error.message);
        alert(
          "Erro ao criar campanha. Verifique se a coluna responsavel_email foi criada na tabela campaigns."
        );
        setSaving(false);
        return;
      }

      setName("");
      setSource("meta_ads");
      setTargetType("whatsapp");
      setTargetValue("");
      setSlug("");
      setResponsavelEmail("");

      await loadCampaigns();
      showToast("Campanha criada com sucesso.");
    } catch (error) {
      console.error("Erro inesperado ao criar campanha:", error);
      alert("Erro inesperado ao criar campanha.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(campaign: Campaign) {
    if (!companyId) return;

    try {
      setActionLoadingId(campaign.id);

      const { error } = await supabase
        .from("campaigns")
        .update({ is_active: !campaign.is_active })
        .eq("id", campaign.id)
        .eq("company_id", companyId);

      if (error) {
        console.error("Erro ao alterar status:", error.message);
        alert("Não foi possível alterar o status da campanha.");
        return;
      }

      await loadCampaigns();
      showToast(
        campaign.is_active
          ? "Campanha inativada com sucesso."
          : "Campanha ativada com sucesso."
      );
    } catch (error) {
      console.error("Erro inesperado ao alterar status:", error);
      alert("Erro inesperado ao alterar status.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteCampaign(campaign: Campaign) {
    if (!companyId) return;

    if (campaign.is_active) {
      alert("Inative a campanha antes de excluir.");
      return;
    }

    const confirmar = window.confirm(
      `Deseja excluir a campanha "${campaign.name}"? Essa ação não pode ser desfeita.`
    );

    if (!confirmar) return;

    try {
      setActionLoadingId(campaign.id);

      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaign.id)
        .eq("company_id", companyId);

      if (error) {
        console.error("Erro ao excluir campanha:", error.message);
        alert("Não foi possível excluir a campanha.");
        return;
      }

      await loadCampaigns();
      showToast("Campanha excluída com sucesso.");
    } catch (error) {
      console.error("Erro inesperado ao excluir campanha:", error);
      alert("Erro inesperado ao excluir campanha.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Link copiado para a área de transferência.");
    } catch {
      showToast("Não foi possível copiar o link.");
    }
  }

  function handleExportCampaigns() {
    const rows = [
      [
        "Nome",
        "Origem",
        "Responsável",
        "Slug",
        "Tipo de destino",
        "Destino",
        "Status",
        "Cliques",
        "Criada em",
        "Link rastreável",
      ],
      ...filteredCampaigns.map((campaign) => [
        campaign.name,
        campaign.source,
        campaign.responsavel_email || "",
        campaign.slug,
        campaign.target_type,
        campaign.target_value || "",
        campaign.is_active ? "Ativa" : "Inativa",
        String(campaign.campaign_clicks?.[0]?.count || 0),
        formatDate(campaign.created_at),
        `${baseUrl}/c/${campaign.slug}`,
      ]),
    ];

    downloadCsv("campanhas-flowdesk.csv", rows);
    showToast("CSV exportado com sucesso.");
  }

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const term = search.toLowerCase().trim();

      const matchesSearch =
        !term ||
        campaign.name.toLowerCase().includes(term) ||
        campaign.slug.toLowerCase().includes(term) ||
        campaign.target_value?.toLowerCase().includes(term) ||
        campaign.responsavel_email?.toLowerCase().includes(term);

      const matchesSource =
        filterSource === "todos" || campaign.source === filterSource;

      const matchesStatus =
        filterStatus === "todos" ||
        (filterStatus === "ativas" && campaign.is_active) ||
        (filterStatus === "inativas" && !campaign.is_active);

      return matchesSearch && matchesSource && matchesStatus;
    });
  }, [campaigns, search, filterSource, filterStatus]);

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((item) => item.is_active).length;
  const inactiveCampaigns = campaigns.filter((item) => !item.is_active).length;
  const totalClicks = campaigns.reduce(
    (acc, item) => acc + (item.campaign_clicks?.[0]?.count || 0),
    0
  );

  return (
    <div className="p-6 md:p-8 text-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Megaphone size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Campanhas</h1>
            <p className="text-sm text-gray-400">
              Crie links rastreáveis, acompanhe cliques e gerencie campanhas da
              empresa logada.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={loadCampaigns}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm flex items-center gap-2"
          >
            <RefreshCcw size={16} />
            Atualizar
          </button>

          <button
            onClick={handleExportCampaigns}
            disabled={filteredCampaigns.length === 0}
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
          <div className="text-sm text-gray-400">Total de campanhas</div>
          <div className="text-2xl font-bold mt-2">{totalCampaigns}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
          <div className="text-sm text-gray-400">Campanhas ativas</div>
          <div className="text-2xl font-bold mt-2 text-emerald-400">
            {activeCampaigns}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
          <div className="text-sm text-gray-400">Campanhas inativas</div>
          <div className="text-2xl font-bold mt-2 text-red-400">
            {inactiveCampaigns}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
          <div className="text-sm text-gray-400">Cliques totais</div>
          <div className="text-2xl font-bold mt-2 text-cyan-400">
            {totalClicks}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Nova campanha</h2>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Nome da campanha
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Meta Ads Março"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Origem
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-xl bg-[#0f172a] border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-500"
                >
                  {SOURCE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Tipo de destino
                </label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  className="w-full rounded-xl bg-[#0f172a] border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-500"
                >
                  {TARGET_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Destino
                </label>
                <input
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder={
                    targetType === "whatsapp"
                      ? "Ex: 5511999999999"
                      : "Ex: https://seusite.com/pagina"
                  }
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Responsável (e-mail)
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    type="email"
                    value={responsavelEmail}
                    onChange={(e) => setResponsavelEmail(e.target.value)}
                    placeholder="Ex: vendedor@empresa.com"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Esse responsável ficará vinculado à campanha para rastrear os
                  leads dela.
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">Slug</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="meta-ads-marco"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
                <p className="text-xs text-gray-500 mt-2 break-all">
                  Link final: {baseUrl || "https://seu-dominio.com"}/c/
                  {slug || "slug-da-campanha"}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 transition px-4 py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Plus size={18} />
                {saving ? "Salvando..." : "Criar campanha"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Filtros</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Buscar
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome, slug, destino ou responsável"
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Origem
                </label>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="w-full rounded-xl bg-[#0f172a] border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="todos">Todas</option>
                  {SOURCE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-xl bg-[#0f172a] border border-white/10 px-4 py-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="todos">Todos</option>
                  <option value="ativas">Ativas</option>
                  <option value="inativas">Inativas</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-lg">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold">Campanhas cadastradas</h2>
              <div className="text-sm text-gray-400">
                Exibindo {filteredCampaigns.length} de {campaigns.length}
              </div>
            </div>

            {loading ? (
              <div className="text-sm text-gray-400">
                Carregando campanhas...
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-sm text-gray-400">
                Nenhuma campanha encontrada com os filtros aplicados.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCampaigns.map((campaign) => {
                  const trackingLink = `${baseUrl}/c/${campaign.slug}`;
                  const clicks = campaign.campaign_clicks?.[0]?.count || 0;
                  const isActionLoading = actionLoadingId === campaign.id;

                  return (
                    <div
                      key={campaign.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white">
                              {campaign.name}
                            </h3>

                            <span className="text-xs px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                              {campaign.source}
                            </span>

                            <span
                              className={`text-xs px-2 py-1 rounded-full border ${
                                campaign.is_active
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                                  : "border-red-500/30 bg-red-500/10 text-red-300"
                              }`}
                            >
                              {campaign.is_active ? "Ativa" : "Inativa"}
                            </span>

                            <span className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 text-gray-300">
                              {campaign.target_type === "whatsapp"
                                ? "WhatsApp"
                                : "Página/URL"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="text-gray-400">
                              Slug:{" "}
                              <span className="text-gray-200">
                                {campaign.slug}
                              </span>
                            </div>

                            <div className="text-gray-400">
                              Cliques:{" "}
                              <span className="text-white">{clicks}</span>
                            </div>

                            <div className="text-gray-400 break-all">
                              Destino:{" "}
                              <span className="text-gray-200">
                                {campaign.target_value || "-"}
                              </span>
                            </div>

                            <div className="text-gray-400">
                              Criada em:{" "}
                              <span className="text-gray-200">
                                {formatDate(campaign.created_at)}
                              </span>
                            </div>

                            <div className="text-gray-400 break-all md:col-span-2">
                              Responsável:{" "}
                              <span className="text-gray-200">
                                {campaign.responsavel_email || "-"}
                              </span>
                            </div>
                          </div>

                          <div className="text-sm text-gray-400 break-all">
                            Link rastreável:{" "}
                            <span className="text-emerald-300">
                              {trackingLink}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button
                            onClick={() => copyToClipboard(trackingLink)}
                            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm flex items-center gap-2 h-fit"
                          >
                            <Copy size={16} />
                            Copiar link
                          </button>

                          <button
                            onClick={() => handleToggleActive(campaign)}
                            disabled={isActionLoading}
                            className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20 transition px-4 py-2 text-sm flex items-center gap-2 h-fit disabled:opacity-60"
                          >
                            <Power size={16} />
                            {campaign.is_active ? "Inativar" : "Ativar"}
                          </button>

                          <button
                            onClick={() => handleDeleteCampaign(campaign)}
                            disabled={isActionLoading || campaign.is_active}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition px-4 py-2 text-sm flex items-center gap-2 h-fit disabled:opacity-40"
                          >
                            <Trash2 size={16} />
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-0 rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-lg">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Link2 size={18} className="text-emerald-400" />
              Como usar
            </h2>

            <div className="text-sm text-gray-400 space-y-2">
              <p>1. Crie a campanha com nome, origem, destino e responsável.</p>
              <p>2. Copie o link rastreável gerado pelo FlowDesk.</p>
              <p>3. Use esse link no anúncio, bio, botão ou campanha.</p>
              <p>4. Cada clique no link será contabilizado automaticamente.</p>
              <p>5. Os leads dessa campanha poderão ser vinculados ao responsável.</p>
              <p>6. Para exclusão, primeiro inative a campanha.</p>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>

  );
}