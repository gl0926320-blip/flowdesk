"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Boxes,
  ClipboardList,
  Edit3,
  Loader2,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

type ProductStatus = "ativo" | "inativo";
type MovementType = "entrada" | "saida" | "ajuste";

type Product = {
  id: string;
  company_id: string;
  nome: string;
  sku: string;
  categoria: string | null;
  descricao: string | null;
  custo: number;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  unidade: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

type Movement = {
  id: string;
  company_id: string;
  produto_id: string;
  tipo: MovementType;
  quantidade: number;
  estoque_anterior: number;
  estoque_posterior: number;
  observacao: string | null;
  origem: string | null;
  created_at: string;
  produtos_estoque?: {
    nome: string;
    sku: string;
  } | null;
};

type ProductForm = {
  nome: string;
  sku: string;
  categoria: string;
  descricao: string;
  custo: string;
  precoVenda: string;
  estoqueAtual: string;
  estoqueMinimo: string;
  unidade: string;
  status: ProductStatus;
};

type MovementForm = {
  produtoId: string;
  tipo: MovementType;
  quantidade: string;
  observacao: string;
};

type MembershipRow = {
  company_id: string;
  role: string | null;
  status: string | null;
  can_access_estoque?: boolean | null;
  created_at?: string | null;
};

const initialProductForm: ProductForm = {
  nome: "",
  sku: "",
  categoria: "",
  descricao: "",
  custo: "",
  precoVenda: "",
  estoqueAtual: "",
  estoqueMinimo: "",
  unidade: "un",
  status: "ativo",
};

const initialMovementForm: MovementForm = {
  produtoId: "",
  tipo: "entrada",
  quantidade: "",
  observacao: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

function parseMoney(value: string) {
  if (!value) return 0;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInteger(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function getMarginPercent(custo: number, precoVenda: number) {
  if (!precoVenda || precoVenda <= 0) return 0;
  const lucro = precoVenda - custo;
  return (lucro / precoVenda) * 100;
}

function getProductHealth(product: Product) {
  if (product.status === "inativo") return "inativo";
  if (product.estoque_atual <= 0) return "zerado";
  if (product.estoque_atual <= product.estoque_minimo) return "baixo";
  return "saudavel";
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const inputClass =
  "h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-500/30";

const selectClass =
  "h-11 w-full rounded-2xl border border-white/10 bg-[#0F172A] px-3 text-sm text-white outline-none focus:border-cyan-500/30";

  const PRODUCTS_PER_PAGE = 10;

export default function EstoquePage() {
    const supabase = createClient();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [currentProductsPage, setCurrentProductsPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    "todos" | "ativo" | "inativo" | "baixo" | "zerado"
  >("todos");
  const [categoryFilter, setCategoryFilter] = useState("todas");

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);

    function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });

    window.clearTimeout((showToast as any)._timer);
    (showToast as any)._timer = window.setTimeout(() => {
      setToast(null);
    }, 2600);
  }

    const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  
  const [isAlertsCollapsed, setIsAlertsCollapsed] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const [isMovementsCollapsed, setIsMovementsCollapsed] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [movementForm, setMovementForm] =
    useState<MovementForm>(initialMovementForm);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      console.log("ESTOQUE user.id", user?.id);
      console.log("ESTOQUE user.email", user?.email);

      if (userError) throw userError;
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: membership, error: membershipError } = await supabase
        .from("company_users")
        .select("company_id, role, status, can_access_estoque, created_at")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<MembershipRow>();

      if (membershipError) throw membershipError;
      console.log("ESTOQUE membership selecionada", membership);
      console.log("ESTOQUE companyId selecionado", membership?.company_id);
      if (!membership?.company_id) {
        throw new Error("Empresa ativa não encontrada para este usuário.");
      }

      if (membership.can_access_estoque !== true) {
        throw new Error("Seu usuário não possui acesso ao módulo Estoque.");
      }

      setCompanyId(membership.company_id);

      await Promise.all([
        fetchProducts(membership.company_id),
        fetchMovements(membership.company_id),
      ]);
    } catch (error) {
      console.error("Erro ao carregar estoque:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o estoque.";
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts(activeCompanyId: string) {
    const { data, error } = await supabase
      .from("produtos_estoque")
      .select("*")
      .eq("company_id", activeCompanyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setProducts((data || []) as Product[]);
  }

  async function fetchMovements(activeCompanyId: string) {
    const { data, error } = await supabase
      .from("estoque_movimentacoes")
      .select(
        `
          *,
          produtos_estoque (
            nome,
            sku
          )
        `
      )
      .eq("company_id", activeCompanyId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    setMovements((data || []) as Movement[]);
  }

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(
        products
          .map((p) => p.categoria?.trim())
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b)))
      )
    );
    return unique as string[];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const term = search.trim().toLowerCase();

      const matchesSearch =
        !term ||
        product.nome.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        (product.categoria || "").toLowerCase().includes(term) ||
        (product.descricao || "").toLowerCase().includes(term);

      const health = getProductHealth(product);

      const matchesStatus =
        statusFilter === "todos"
          ? true
          : statusFilter === "ativo"
          ? product.status === "ativo"
          : statusFilter === "inativo"
          ? product.status === "inativo"
          : statusFilter === "baixo"
          ? health === "baixo"
          : statusFilter === "zerado"
          ? health === "zerado"
          : true;

      const matchesCategory =
        categoryFilter === "todas"
          ? true
          : product.categoria === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [products, search, statusFilter, categoryFilter]);

    useEffect(() => {
    setCurrentProductsPage(1);
  }, [search, statusFilter, categoryFilter]);


    const totalProductsPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  );

  const paginatedProducts = useMemo(() => {
    const start = (currentProductsPage - 1) * PRODUCTS_PER_PAGE;
    const end = start + PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, currentProductsPage]);

  const metrics = useMemo(() => {
    const ativos = products.filter((p) => p.status === "ativo");
    const zerados = products.filter((p) => getProductHealth(p) === "zerado");
    const baixos = products.filter((p) => getProductHealth(p) === "baixo");

    const totalItems = products.reduce((acc, product) => {
      return acc + product.estoque_atual;
    }, 0);

    const totalCost = products.reduce((acc, product) => {
      return acc + product.estoque_atual * Number(product.custo || 0);
    }, 0);

    const totalRevenuePotential = products.reduce((acc, product) => {
      return acc + product.estoque_atual * Number(product.preco_venda || 0);
    }, 0);

    const lucroPotencial = totalRevenuePotential - totalCost;

    return {
      totalProdutos: products.length,
      ativos: ativos.length,
      zerados: zerados.length,
      baixos: baixos.length,
      totalItems,
      totalCost,
      totalRevenuePotential,
      lucroPotencial,
    };
  }, [products]);

  const recentMovements = useMemo(() => {
    return [...movements].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [movements]);

  const visibleMovements = useMemo(() => {
    return showAllMovements ? recentMovements : recentMovements.slice(0, 2);
  }, [recentMovements, showAllMovements]);



    const alertProducts = useMemo(() => {
    return products
      .filter((p) => {
        const health = getProductHealth(p);
        return health === "baixo" || health === "zerado";
      })
      .sort((a, b) => a.estoque_atual - b.estoque_atual);
  }, [products]);

  const visibleAlertProducts = useMemo(() => {
    return showAllAlerts ? alertProducts : alertProducts.slice(0, 3);
  }, [alertProducts, showAllAlerts]);

  function resetProductForm() {
    setProductForm(initialProductForm);
    setEditingProductId(null);
  }

  function openNewProductModal() {
    resetProductForm();
    setIsProductModalOpen(true);
  }

  function openEditProductModal(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      nome: product.nome,
      sku: product.sku,
      categoria: product.categoria || "",
      descricao: product.descricao || "",
      custo: String(product.custo ?? 0),
      precoVenda: String(product.preco_venda ?? 0),
      estoqueAtual: String(product.estoque_atual ?? 0),
      estoqueMinimo: String(product.estoque_minimo ?? 0),
      unidade: product.unidade || "un",
      status: product.status,
    });
    setIsProductModalOpen(true);
  }

  function handleProductFormChange<K extends keyof ProductForm>(
    field: K,
    value: ProductForm[K]
  ) {
    setProductForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleMovementFormChange<K extends keyof MovementForm>(
    field: K,
    value: MovementForm[K]
  ) {
    setMovementForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSaveProduct() {
    if (!companyId) {
            showToast("error", "Empresa não identificada.");
      return;
    }

    if (!productForm.nome.trim()) {
            showToast("error", "Preencha o nome do produto.");
      return;
    }

    if (!productForm.sku.trim()) {
            showToast("error", "Preencha o SKU/código do produto.");
      return;
    }

    try {
      setSavingProduct(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const custo = parseMoney(productForm.custo);
      const precoVenda = parseMoney(productForm.precoVenda);
      const estoqueAtual = parseInteger(productForm.estoqueAtual);
      const estoqueMinimo = parseInteger(productForm.estoqueMinimo);

      if (precoVenda < custo) {
        const confirmLowerPrice = confirm(
          "O preço de venda está menor que o custo. Deseja salvar mesmo assim?"
        );
        if (!confirmLowerPrice) return;
      }

      const payload = {
        company_id: companyId,
        nome: productForm.nome.trim(),
        sku: productForm.sku.trim(),
        categoria: productForm.categoria.trim() || null,
        descricao: productForm.descricao.trim() || null,
        custo,
        preco_venda: precoVenda,
        estoque_atual: estoqueAtual,
        estoque_minimo: estoqueMinimo,
        unidade: productForm.unidade.trim() || "un",
        status: productForm.status,
        updated_by: user?.id || null,
      };

      if (editingProductId) {
        const { error } = await supabase
          .from("produtos_estoque")
          .update(payload)
          .eq("id", editingProductId)
          .eq("company_id", companyId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos_estoque").insert({
          ...payload,
          created_by: user?.id || null,
        });

        if (error) throw error;
      }

      await fetchProducts(companyId);
      setIsProductModalOpen(false);
      resetProductForm();
      showToast(
        "success",
        editingProductId ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso."
      );
    } catch (error: any) {
      console.error("Erro ao salvar produto:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        raw: error,
      });

      const message =
        error?.message ||
        error?.details ||
        error?.hint ||
        "Não foi possível salvar o produto.";

            showToast("error", message);
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeleteProduct(productId: string) {
    if (!companyId) {
           showToast("error", "Empresa não identificada.");
      return;
    }

    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const confirmed = confirm(
      `Deseja realmente excluir o produto "${product.nome}"?`
    );
    if (!confirmed) return;

    try {
      setDeletingProductId(productId);

      const { error } = await supabase
        .from("produtos_estoque")
        .delete()
        .eq("id", productId)
        .eq("company_id", companyId);

      if (error) throw error;

            await Promise.all([fetchProducts(companyId), fetchMovements(companyId)]);
      showToast("success", "Produto excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o produto.";
            showToast("error", message);
    } finally {
      setDeletingProductId(null);
    }
  }

  function openMovementModal(productId?: string) {
    setMovementForm({
      produtoId: productId || "",
      tipo: "entrada",
      quantidade: "",
      observacao: "",
    });
    setIsMovementModalOpen(true);
  }

  async function handleSaveMovement() {
    if (!companyId) {
            showToast("error", "Empresa não identificada.");
      return;
    }

    if (!movementForm.produtoId) {
            showToast("error", "Selecione um produto.");
      return;
    }

    const quantidade = parseInteger(movementForm.quantidade);

    if (!quantidade && movementForm.tipo !== "ajuste") {
            showToast("error", "Informe uma quantidade válida.");
      return;
    }

    const product = products.find((item) => item.id === movementForm.produtoId);

    if (!product) {
            showToast("error", "Produto não encontrado.");
      return;
    }

    try {
      setSavingMovement(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const estoqueAnterior = product.estoque_atual;
      let estoquePosterior = estoqueAnterior;

      if (movementForm.tipo === "entrada") {
        estoquePosterior = estoqueAnterior + quantidade;
      }

      if (movementForm.tipo === "saida") {
        estoquePosterior = estoqueAnterior - quantidade;
        if (estoquePosterior < 0) {
                    showToast("error", "Não é possível retirar mais do que o estoque atual.");
          return;
        }
      }

      if (movementForm.tipo === "ajuste") {
        const ajusteQuantidade = parseInteger(movementForm.quantidade);
        estoquePosterior = ajusteQuantidade;
      }

      const { error: productUpdateError } = await supabase
        .from("produtos_estoque")
        .update({
          estoque_atual: estoquePosterior,
          updated_by: user?.id || null,
        })
        .eq("id", product.id)
        .eq("company_id", companyId);

      if (productUpdateError) throw productUpdateError;

      const { error: movementInsertError } = await supabase
        .from("estoque_movimentacoes")
        .insert({
          company_id: companyId,
          produto_id: product.id,
          tipo: movementForm.tipo,
          quantidade:
            movementForm.tipo === "ajuste"
              ? estoquePosterior
              : parseInteger(movementForm.quantidade),
          estoque_anterior: estoqueAnterior,
          estoque_posterior: estoquePosterior,
          observacao: movementForm.observacao.trim() || null,
          origem: "manual",
          created_by: user?.id || null,
        });

      if (movementInsertError) throw movementInsertError;

           await Promise.all([fetchProducts(companyId), fetchMovements(companyId)]);

      setIsMovementModalOpen(false);
      setMovementForm(initialMovementForm);
      showToast("success", "Movimentação registrada com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar movimentação:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a movimentação.";
            showToast("error", message);
    } finally {
      setSavingMovement(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-white/70">
        <Loader2 size={20} className="animate-spin" />
        Carregando estoque...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <ShieldCheck size={14} />
              Módulo controlado por permissão
            </div>

            <h1 className="text-2xl font-semibold text-white md:text-3xl">
              Estoque FlowDesk
            </h1>

            <p className="mt-2 text-sm text-white/60 md:text-base">
              Controle real de produtos, custos, venda, margem, estoque mínimo e
              movimentações do banco.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={openNewProductModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              <Plus size={18} />
              Cadastrar produto
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Produtos cadastrados"
          value={String(metrics.totalProdutos)}
          subtitle={`${metrics.ativos} ativos no estoque`}
          icon={<Boxes size={20} />}
        />

        <MetricCard
          title="Itens em estoque"
          value={String(metrics.totalItems)}
          subtitle={`${metrics.zerados} zerados • ${metrics.baixos} em alerta`}
          icon={<Package size={20} />}
        />

        <MetricCard
          title="Valor em custo"
          value={formatCurrency(metrics.totalCost)}
          subtitle="Baseado no custo x quantidade"
          icon={<BadgeDollarSign size={20} />}
        />

        <MetricCard
          title="Lucro potencial"
          value={formatCurrency(metrics.lucroPotencial)}
          subtitle={`Receita potencial ${formatCurrency(
            metrics.totalRevenuePotential
          )}`}
          icon={<TrendingUp size={20} />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-[#0B1120] p-5">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Produtos do estoque
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Dados reais carregados do banco.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, SKU ou categoria..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-500/30"
                />
              </div>

        <select
  value={statusFilter}
  onChange={(e) =>
    setStatusFilter(
      e.target.value as
        | "todos"
        | "ativo"
        | "inativo"
        | "baixo"
        | "zerado"
    )
  }
  className={selectClass}
>
                <option value="todos">Todos os status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
                <option value="baixo">Estoque baixo</option>
                <option value="zerado">Zerados</option>
              </select>

             <select
  value={categoryFilter}
  onChange={(e) => setCategoryFilter(e.target.value)}
  className={selectClass}
>
                <option value="todas">Todas as categorias</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/[0.04]">
                  <tr className="text-left text-xs uppercase tracking-[0.12em] text-white/35">
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Custo</th>
                    <th className="px-4 py-3">Venda</th>
                    <th className="px-4 py-3">Lucro</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody>
                                    {paginatedProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-sm text-white/45"
                      >
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  ) : (
                                        paginatedProducts.map((product) => {
                      const lucro =
                        Number(product.preco_venda || 0) -
                        Number(product.custo || 0);
                      const margem = getMarginPercent(
                        Number(product.custo || 0),
                        Number(product.preco_venda || 0)
                      );
                      const health = getProductHealth(product);

                      return (
                        <tr
                          key={product.id}
                          className="border-t border-white/10 text-sm text-white/85"
                        >
                          <td className="px-4 py-4">
                            <div className="min-w-[220px]">
                              <div className="font-medium text-white">
                                {product.nome}
                              </div>
                              <div className="mt-1 text-xs text-white/35">
                                SKU: {product.sku}
                              </div>
                              {product.descricao && (
                                <div className="mt-1 line-clamp-2 text-xs text-white/45">
                                  {product.descricao}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-white/60">
                            {product.categoria || "—"}
                          </td>

                          <td className="px-4 py-4">
                            {formatCurrency(Number(product.custo || 0))}
                          </td>

                          <td className="px-4 py-4">
                            {formatCurrency(Number(product.preco_venda || 0))}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-medium">
                              {formatCurrency(lucro)}
                            </div>
                            <div className="text-xs text-emerald-300/80">
                              {margem.toFixed(1)}% margem
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-medium text-white">
                              {product.estoque_atual} {product.unidade}
                            </div>
                            <div className="text-xs text-white/35">
                              mínimo {product.estoque_minimo} {product.unidade}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2">
                              <span
                                className={classNames(
                                  "inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                                  product.status === "ativo"
                                    ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                                    : "bg-white/10 text-white/60 ring-white/15"
                                )}
                              >
                                {product.status === "ativo" ? "Ativo" : "Inativo"}
                              </span>

                              {health === "baixo" && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/20">
                                  <AlertTriangle size={12} />
                                  Estoque baixo
                                </span>
                              )}

                              {health === "zerado" && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 ring-1 ring-red-500/20">
                                  <AlertTriangle size={12} />
                                  Sem estoque
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openMovementModal(product.id)}
                                className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/15"
                              >
                                Movimentar
                              </button>

                              <button
                                onClick={() => openEditProductModal(product)}
                                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                                aria-label="Editar produto"
                              >
                                <Edit3 size={16} />
                              </button>

                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                disabled={deletingProductId === product.id}
                                className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                                aria-label="Excluir produto"
                              >
                                {deletingProductId === product.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        



                  {filteredProducts.length > PRODUCTS_PER_PAGE && (
            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-white/45">
                Mostrando{" "}
                <span className="text-white">
                  {(currentProductsPage - 1) * PRODUCTS_PER_PAGE + 1}
                </span>
                {" - "}
                <span className="text-white">
                  {Math.min(
                    currentProductsPage * PRODUCTS_PER_PAGE,
                    filteredProducts.length
                  )}
                </span>
                {" de "}
                <span className="text-white">{filteredProducts.length}</span> produtos
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentProductsPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentProductsPage === 1}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>

                {Array.from({ length: totalProductsPages }, (_, index) => index + 1)
                  .slice(
                    Math.max(0, currentProductsPage - 3),
                    Math.max(5, currentProductsPage + 2)
                  )
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentProductsPage(page)}
                      className={classNames(
                        "rounded-xl px-3 py-2 text-sm transition",
                        currentProductsPage === page
                          ? "bg-cyan-500 text-slate-950 font-semibold"
                          : "border border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
                      )}
                    >
                      {page}
                    </button>
                  ))}

                <button
                  onClick={() =>
                    setCurrentProductsPage((prev) =>
                      Math.min(totalProductsPages, prev + 1)
                    )
                  }
                  disabled={currentProductsPage === totalProductsPages}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
             </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0B1120] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Alertas do estoque
                </h3>
                <p className="mt-1 text-sm text-white/45">
                  Produtos críticos para reposição.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {alertProducts.length > 3 && !isAlertsCollapsed && (
                  <button
                    onClick={() => setShowAllAlerts((prev) => !prev)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    {showAllAlerts ? "Ver menos" : `Ver mais (${alertProducts.length})`}
                  </button>
                )}

                <button
                  onClick={() => setIsAlertsCollapsed((prev) => !prev)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label={isAlertsCollapsed ? "Expandir alertas" : "Recolher alertas"}
                >
                  <X
                    size={16}
                    className={classNames(
                      "transition-transform duration-200",
                      isAlertsCollapsed ? "rotate-45" : ""
                    )}
                  />
                </button>

                <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-300 ring-1 ring-amber-500/20">
                  <AlertTriangle size={20} />
                </div>
              </div>
            </div>

                        {!isAlertsCollapsed && (
              <div className="mt-5 space-y-3">
                {alertProducts.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                    Nenhum alerta crítico no momento.
                  </div>
                ) : (
                  <>
                    {visibleAlertProducts.map((product) => {
                      const health = getProductHealth(product);

                      return (
                        <div
                          key={product.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white">
                                {product.nome}
                              </div>
                              <div className="mt-1 text-xs text-white/35">
                                {product.sku} • {product.categoria || "Sem categoria"}
                              </div>
                            </div>

                            <span
                              className={classNames(
                                "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                                health === "zerado"
                                  ? "bg-red-500/10 text-red-300 ring-red-500/20"
                                  : "bg-amber-500/10 text-amber-300 ring-amber-500/20"
                              )}
                            >
                              {health === "zerado" ? "Sem estoque" : "Baixo"}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-white/55">Atual</span>
                            <span className="font-medium text-white">
                              {product.estoque_atual} {product.unidade}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="text-white/55">Mínimo</span>
                            <span className="font-medium text-white">
                              {product.estoque_minimo} {product.unidade}
                            </span>
                          </div>

                          <button
                            onClick={() => openMovementModal(product.id)}
                            className="mt-4 w-full rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/15"
                          >
                            Repor estoque
                          </button>
                        </div>
                      );
                    })}

                    {alertProducts.length > 3 && (
                      <div className="pt-1 text-center text-xs text-white/35">
                        Mostrando {visibleAlertProducts.length} de {alertProducts.length} alertas
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0B1120] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Últimas movimentações
                </h3>
                <p className="mt-1 text-sm text-white/45">
                  Histórico real do banco.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {recentMovements.length > 2 && !isMovementsCollapsed && (
                  <button
                    onClick={() => setShowAllMovements((prev) => !prev)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    {showAllMovements
                      ? "Ver menos"
                      : `Ver mais (${recentMovements.length})`}
                  </button>
                )}

                <button
                  onClick={() => openMovementModal()}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Nova movimentação
                </button>

                <button
                  onClick={() => setIsMovementsCollapsed((prev) => !prev)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label={
                    isMovementsCollapsed
                      ? "Expandir movimentações"
                      : "Recolher movimentações"
                  }
                >
                  <X
                    size={16}
                    className={classNames(
                      "transition-transform duration-200",
                      isMovementsCollapsed ? "rotate-45" : ""
                    )}
                  />
                </button>
              </div>
            </div>

            {!isMovementsCollapsed && (
              <div className="mt-5 space-y-3">
                {recentMovements.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                    Nenhuma movimentação registrada ainda.
                  </div>
                ) : (
                  <>
                    {visibleMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white">
                              {movement.produtos_estoque?.nome || "Produto"}
                            </div>
                            <div className="mt-1 text-xs text-white/35">
                              {formatDate(movement.created_at)}
                            </div>
                          </div>

                          <span
                            className={classNames(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                              movement.tipo === "entrada"
                                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                                : movement.tipo === "saida"
                                ? "bg-red-500/10 text-red-300 ring-red-500/20"
                                : "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20"
                            )}
                          >
                            {movement.tipo === "entrada" && <ArrowUp size={12} />}
                            {movement.tipo === "saida" && <ArrowDown size={12} />}
                            {movement.tipo === "ajuste" && <ClipboardList size={12} />}
                            {movement.tipo === "entrada"
                              ? "Entrada"
                              : movement.tipo === "saida"
                              ? "Saída"
                              : "Ajuste"}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl border border-white/10 bg-[#0F172A] px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-white/35">
                              Antes
                            </div>
                            <div className="mt-1 font-medium text-white">
                              {movement.estoque_anterior}
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-[#0F172A] px-3 py-2">
                            <div className="text-[11px] uppercase tracking-wide text-white/35">
                              Depois
                            </div>
                            <div className="mt-1 font-medium text-white">
                              {movement.estoque_posterior}
                            </div>
                          </div>
                        </div>

                        {movement.observacao && (
                          <div className="mt-3 text-sm text-white/55">
                            {movement.observacao}
                          </div>
                        )}
                      </div>
                    ))}

                    {recentMovements.length > 2 && (
                      <div className="pt-1 text-center text-xs text-white/35">
                        Mostrando {visibleMovements.length} de {recentMovements.length} movimentações
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {isProductModalOpen && (
        <Modal
          title={editingProductId ? "Editar produto" : "Cadastrar produto"}
          subtitle="Preencha as informações comerciais e operacionais do item."
          onClose={() => {
            setIsProductModalOpen(false);
            resetProductForm();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do produto">
              <input
                value={productForm.nome}
                onChange={(e) => handleProductFormChange("nome", e.target.value)}
                placeholder="Ex: Mouse sem fio"
                className={inputClass}
              />
            </Field>

            <Field label="SKU / Código">
              <input
                value={productForm.sku}
                onChange={(e) => handleProductFormChange("sku", e.target.value)}
                placeholder="Ex: FLOW-001"
                className={inputClass}
              />
            </Field>

            <Field label="Categoria">
              <input
                value={productForm.categoria}
                onChange={(e) =>
                  handleProductFormChange("categoria", e.target.value)
                }
                placeholder="Ex: Acessórios"
                className={inputClass}
              />
            </Field>

            <Field label="Unidade">
              <select
  value={productForm.unidade}
  onChange={(e) =>
    handleProductFormChange("unidade", e.target.value)
  }
  className={selectClass}
>
                <option value="un">Unidade</option>
                <option value="cx">Caixa</option>
                <option value="kg">Kg</option>
                <option value="pct">Pacote</option>
                <option value="lt">Litro</option>
              </select>
            </Field>

            <Field label="Preço de custo">
              <input
                value={productForm.custo}
                onChange={(e) => handleProductFormChange("custo", e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </Field>

            <Field label="Preço de venda">
              <input
                value={productForm.precoVenda}
                onChange={(e) =>
                  handleProductFormChange("precoVenda", e.target.value)
                }
                placeholder="0.00"
                className={inputClass}
              />
            </Field>

            <Field label="Estoque atual">
              <input
                value={productForm.estoqueAtual}
                onChange={(e) =>
                  handleProductFormChange("estoqueAtual", e.target.value)
                }
                placeholder="0"
                className={inputClass}
              />
            </Field>

            <Field label="Estoque mínimo">
              <input
                value={productForm.estoqueMinimo}
                onChange={(e) =>
                  handleProductFormChange("estoqueMinimo", e.target.value)
                }
                placeholder="0"
                className={inputClass}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Descrição">
                <textarea
                  value={productForm.descricao}
                  onChange={(e) =>
                    handleProductFormChange("descricao", e.target.value)
                  }
                  rows={4}
                  placeholder="Detalhes internos do produto..."
                  className={classNames(inputClass, "min-h-[110px] resize-none")}
                />
              </Field>
            </div>

            <Field label="Status">
         <select
  value={productForm.status}
  onChange={(e) =>
    handleProductFormChange(
      "status",
      e.target.value as ProductStatus
    )
  }
  className={selectClass}
>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </Field>

            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                Preview financeiro
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/55">Custo</span>
                  <span className="font-medium text-white">
                    {formatCurrency(parseMoney(productForm.custo))}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/55">Venda</span>
                  <span className="font-medium text-white">
                    {formatCurrency(parseMoney(productForm.precoVenda))}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/55">Lucro unitário</span>
                  <span className="font-medium text-emerald-300">
                    {formatCurrency(
                      parseMoney(productForm.precoVenda) -
                        parseMoney(productForm.custo)
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-white/55">Margem</span>
                  <span className="font-medium text-cyan-300">
                    {getMarginPercent(
                      parseMoney(productForm.custo),
                      parseMoney(productForm.precoVenda)
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => {
                setIsProductModalOpen(false);
                resetProductForm();
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
            >
              Cancelar
            </button>

            <button
              onClick={handleSaveProduct}
              disabled={savingProduct}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {savingProduct && <Loader2 size={16} className="animate-spin" />}
              {editingProductId ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </div>
        </Modal>
      )}

      {isMovementModalOpen && (
        <Modal
          title="Nova movimentação"
          subtitle="Entrada, saída ou ajuste de estoque do produto."
          onClose={() => {
            setIsMovementModalOpen(false);
            setMovementForm(initialMovementForm);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Produto">
              <select
  value={movementForm.produtoId}
  onChange={(e) =>
    handleMovementFormChange("produtoId", e.target.value)
  }
  className={selectClass}
>
                <option value="">Selecione um produto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.nome} • {product.sku}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tipo de movimentação">
             <select
  value={movementForm.tipo}
  onChange={(e) =>
    handleMovementFormChange(
      "tipo",
      e.target.value as MovementType
    )
  }
  className={selectClass}
>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </Field>

            <Field
              label={
                movementForm.tipo === "ajuste"
                  ? "Novo estoque final"
                  : "Quantidade"
              }
            >
              <input
                value={movementForm.quantidade}
                onChange={(e) =>
                  handleMovementFormChange("quantidade", e.target.value)
                }
                placeholder={movementForm.tipo === "ajuste" ? "Ex: 25" : "Ex: 5"}
                className={inputClass}
              />
            </Field>

            <div className="rounded-2xl border border-white/10 bg-[#0F172A] p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-white/35">
                Regras
              </div>
              <ul className="mt-3 space-y-2 text-sm text-white/55">
                <li>• Entrada soma ao estoque atual</li>
                <li>• Saída reduz o estoque atual</li>
                <li>• Ajuste redefine o estoque final</li>
              </ul>
            </div>

            <div className="md:col-span-2">
              <Field label="Observação">
                <textarea
                  value={movementForm.observacao}
                  onChange={(e) =>
                    handleMovementFormChange("observacao", e.target.value)
                  }
                  rows={4}
                  placeholder="Ex: reposição de fornecedor, acerto manual, venda interna..."
                  className={classNames(inputClass, "min-h-[110px] resize-none")}
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => {
                setIsMovementModalOpen(false);
                setMovementForm(initialMovementForm);
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] hover:text-white"
            >
              Cancelar
            </button>

            <button
              onClick={handleSaveMovement}
              disabled={savingMovement}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
            >
              {savingMovement && <Loader2 size={16} className="animate-spin" />}
              Salvar movimentação
            </button>
          </div>
        </Modal>
      )}

            {toast && (
        <div className="fixed right-5 top-5 z-[90]">
          <div
            className={classNames(
              "min-w-[280px] rounded-2xl border px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md",
              toast.type === "success"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/20 bg-red-500/10 text-red-200"
            )}
          >
            <div className="text-sm font-medium">
              {toast.type === "success" ? "Sucesso" : "Atenção"}
            </div>
            <div className="mt-1 text-sm opacity-90">{toast.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-white/75">{label}</div>
      {children}
    </label>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0B1120] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/45">{title}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{value}</h3>
          <p className="mt-2 text-xs text-white/35">{subtitle}</p>
        </div>

        <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300 ring-1 ring-cyan-500/20">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0B1120] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0B1120]/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm text-white/45">{subtitle}</p>
            </div>

            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Fechar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

       <div className="px-6 py-6 [color-scheme:dark]">{children}</div>
      </div>
    </div>
  );
}