import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";

const ALLOWED_MASTER_EMAILS = ["genesismatheusdsl@gmail.com"];

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Faltam as envs NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createAdminClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltam as envs NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createAdminClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function onlyAllowedMaster(email?: string | null) {
  return !!email && ALLOWED_MASTER_EMAILS.includes(email.toLowerCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function formatDateShort(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return value;
  }
}

function money(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeRole(role?: string | null) {
  if (!role) return "sem role";
  return role;
}

function normalizeStatus(status?: string | null, isActive?: boolean | null) {
  if (status) return status;
  if (isActive === false) return "inativo";
  return "ativo";
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown) {
  return String(value || "");
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function contains(value: unknown, q: string) {
  return safeString(value).toLowerCase().includes(q.toLowerCase());
}

function getCheckboxValue(formData: FormData, name: string) {
  const values = formData.getAll(name).map(String);
  return values.includes("true") || values.includes("on");
}

async function ensureMasterAccess() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !onlyAllowedMaster(user.email)) {
    redirect("/dashboard");
  }

  return user;
}

type AuthUserLite = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
};

async function listAllAuthUsers(admin = getAdminSupabase()) {
  let page = 1;
  const perPage = 1000;
  const allUsers: AuthUserLite[] = [];

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const users = (data?.users || []) as AuthUserLite[];
    allUsers.push(...users);

    if (users.length < perPage) break;
    page += 1;
  }

  return allUsers;
}

async function findAuthUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const admin = getAdminSupabase();
  const allUsers = await listAllAuthUsers(admin);
  return allUsers.find((u) => normalizeEmail(u.email) === normalized) || null;
}

async function upsertCompanyMembership({
  companyId,
  email,
  userId,
  role,
  status,
  comissaoPercentual,
  canAccessAtendimento,
  canAccessCampanhas,
  canAccessEstoque,
}: {
  companyId: string;
  email?: string | null;
  userId?: string | null;
  role: string;
  status: string;
  comissaoPercentual: number;
  canAccessAtendimento: boolean;
  canAccessCampanhas: boolean;
  canAccessEstoque: boolean;
}) {
  const admin = getAdminSupabase();

  const normalizedEmail = normalizeEmail(email);
const payloadBase: Record<string, any> = {
  company_id: companyId,
  role,
  status,
  comissao_percentual: Number.isFinite(comissaoPercentual)
    ? comissaoPercentual
    : 0,
  can_access_atendimento: !!canAccessAtendimento,
  can_access_campanhas: !!canAccessCampanhas,
  can_access_estoque: !!canAccessEstoque,
  updated_at: new Date().toISOString(),
};

  if (userId) {
    const { data: existingByUser, error: findByUserError } = await admin
      .from("company_users")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (findByUserError) return { error: findByUserError };

    if (existingByUser?.id) {
      const { error } = await admin
        .from("company_users")
        .update({
          ...payloadBase,
          user_id: userId,
          email: normalizedEmail || null,
        })
        .eq("id", existingByUser.id);

      return { error };
    }

    if (normalizedEmail) {
      const { data: existingByEmail, error: findByEmailError } = await admin
        .from("company_users")
        .select("id")
        .eq("company_id", companyId)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (findByEmailError) return { error: findByEmailError };

      if (existingByEmail?.id) {
        const { error } = await admin
          .from("company_users")
          .update({
            ...payloadBase,
            user_id: userId,
            email: normalizedEmail,
          })
          .eq("id", existingByEmail.id);

        return { error };
      }
    }

    const { error } = await admin.from("company_users").insert({
      ...payloadBase,
      user_id: userId,
      email: normalizedEmail || null,
    });

    return { error };
  }

  if (!normalizedEmail) {
    return {
      error: {
        message: "E-mail inválido para vínculo pendente.",
      },
    };
  }

  const { data: existingByEmail, error: findByEmailError } = await admin
    .from("company_users")
    .select("id")
    .eq("company_id", companyId)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (findByEmailError) return { error: findByEmailError };

  if (existingByEmail?.id) {
    const { error } = await admin
      .from("company_users")
      .update({
        ...payloadBase,
        email: normalizedEmail,
        user_id: null,
      })
      .eq("id", existingByEmail.id);

    return { error };
  }

  const { error } = await admin.from("company_users").insert({
    ...payloadBase,
    email: normalizedEmail,
    user_id: null,
  });

  return { error };
}

async function ensureVendorLimit(companyId: string, userIdToIgnore?: string | null) {
  const admin = getAdminSupabase();

  const { data: company, error: companyError } = await admin
    .from("companies")
    .select("id, name, max_vendedores")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) return { error: companyError };

  const limit = Number(company?.max_vendedores || 0);

  if (limit <= 0) {
    return { ok: true };
  }

  let query = admin
    .from("company_users")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "vendedor")
    .eq("status", "ativo");

  if (userIdToIgnore) {
    query = query.neq("user_id", userIdToIgnore);
  }

  const { count, error: countError } = await query;

  if (countError) return { error: countError };

  if ((count || 0) >= limit) {
    return {
      error: {
        message: `Essa empresa já atingiu o limite de ${limit} vendedores ativos.`,
      },
    };
  }

  return { ok: true };
}

export default async function MasterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await ensureMasterAccess();
  const params = (await searchParams) || {};

  const ok = typeof params.ok === "string" ? params.ok : "";
  const error = typeof params.error === "string" ? params.error : "";

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const companyStatusFilter =
    typeof params.company_status === "string" ? params.company_status : "all";
  const userStatusFilter =
    typeof params.user_status === "string" ? params.user_status : "all";
  const planFilter = typeof params.plan === "string" ? params.plan : "all";
  const roleFilter = typeof params.role === "string" ? params.role : "all";
  const onlyEmpty =
    typeof params.only_empty === "string" ? params.only_empty === "1" : false;
  const onlyMasters =
    typeof params.only_masters === "string" ? params.only_masters === "1" : false;
  const sortCompanies =
    typeof params.sort_companies === "string" ? params.sort_companies : "recent";
  const sortUsers =
    typeof params.sort_users === "string" ? params.sort_users : "recent";

  const admin = getAdminSupabase();

  async function goWithMessage(type: "ok" | "error", message: string) {
    "use server";
    revalidatePath("/dashboard/master");
    redirect(`/dashboard/master?${type}=${encodeURIComponent(message)}`);
  }

  async function createCompanyAction(formData: FormData) {
    "use server";
    const me = await ensureMasterAccess();
    const admin = getAdminSupabase();

    const name = String(formData.get("name") || "").trim();
    const plan = String(formData.get("plan") || "free").trim();
    const isActive = formData.get("is_active") === "on";
    const maxVendedores = toNumber(formData.get("max_vendedores"), 0);
    const ownerEmail = normalizeEmail(formData.get("owner_email") || "");

    if (!name) {
      return goWithMessage("error", "Informe o nome da empresa.");
    }

    const { data: createdCompany, error } = await admin
      .from("companies")
      .insert({
        name,
        plan,
        is_active: isActive,
        max_vendedores: maxVendedores < 0 ? 0 : maxVendedores,
      })
      .select("*")
      .single();

    if (error || !createdCompany) {
      return goWithMessage("error", error?.message || "Erro ao criar empresa.");
    }

    const ownerToUse = ownerEmail || normalizeEmail(me.email);

    if (ownerToUse) {
      const authUser = await findAuthUserByEmail(ownerToUse);

const membership = await upsertCompanyMembership({
  companyId: createdCompany.id,
  email: ownerToUse,
  userId: authUser?.id || null,
  role: "owner",
  status: "ativo",
  comissaoPercentual: 0,
  canAccessAtendimento: true,
  canAccessCampanhas: true,
  canAccessEstoque: true,
});

      if (membership.error) {
        return goWithMessage(
          "error",
          `Empresa criada, mas falhou ao vincular owner: ${membership.error.message}`
        );
      }

      if (authUser?.id) {
        const { error: profileError } = await admin.from("profiles").upsert({
          id: authUser.id,
          email: ownerToUse,
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          return goWithMessage(
            "error",
            `Empresa criada, mas falhou ao atualizar profile do owner: ${profileError.message}`
          );
        }
      }
    }

    return goWithMessage("ok", "Empresa criada com owner inicial vinculado.");
  }

  async function updateCompanyAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const companyId = String(formData.get("company_id") || "");
    const name = String(formData.get("name") || "").trim();
    const plan = String(formData.get("plan") || "free").trim();
    const isActive = formData.get("is_active") === "on";
    const maxVendedores = toNumber(formData.get("max_vendedores"), 0);

    if (!companyId) {
      return goWithMessage("error", "Empresa inválida.");
    }

    const payload: Record<string, any> = {
      plan,
      is_active: isActive,
      max_vendedores: maxVendedores < 0 ? 0 : maxVendedores,
    };

    if (name) payload.name = name;

    const { error } = await admin
      .from("companies")
      .update(payload)
      .eq("id", companyId);

    if (error) {
      return goWithMessage("error", error.message);
    }

    return goWithMessage("ok", "Empresa atualizada.");
  }

  async function deactivateCompanyAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const companyId = String(formData.get("company_id") || "");

    if (!companyId) {
      return goWithMessage("error", "Empresa inválida.");
    }

    const { error } = await admin
      .from("companies")
      .update({ is_active: false })
      .eq("id", companyId);

    if (error) {
      return goWithMessage("error", error.message);
    }

    return goWithMessage("ok", "Empresa desativada.");
  }

  async function reactivateCompanyAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const companyId = String(formData.get("company_id") || "");

    if (!companyId) {
      return goWithMessage("error", "Empresa inválida.");
    }

    const { error } = await admin
      .from("companies")
      .update({ is_active: true })
      .eq("id", companyId);

    if (error) {
      return goWithMessage("error", error.message);
    }

    return goWithMessage("ok", "Empresa reativada.");
  }

  async function deleteCompanyAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const companyId = String(formData.get("company_id") || "");
    const confirmText = String(formData.get("confirm_text") || "").trim();

    if (!companyId) {
      return goWithMessage("error", "Empresa inválida.");
    }

    if (confirmText !== "EXCLUIR") {
      return goWithMessage("error", 'Digite EXCLUIR para confirmar a empresa.');
    }

    const [
      { count: userCount, error: usersErr },
      { count: servicesCount, error: servicesErr },
      { count: campaignsCount, error: campaignsErr },
    ] = await Promise.all([
      admin
        .from("company_users")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId),
      admin
        .from("servicos")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId),
      admin
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId),
    ]);

    if (usersErr || servicesErr || campaignsErr) {
      return goWithMessage("error", "Erro ao validar vínculos da empresa.");
    }

    if (
      (userCount || 0) > 0 ||
      (servicesCount || 0) > 0 ||
      (campaignsCount || 0) > 0
    ) {
      return goWithMessage(
        "error",
        "Não é possível excluir empresa com usuários, serviços ou campanhas vinculadas."
      );
    }

    const { error } = await admin.from("companies").delete().eq("id", companyId);

    if (error) {
      return goWithMessage("error", error.message);
    }

    return goWithMessage("ok", "Empresa excluída com sucesso.");
  }

  async function createUserAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const email = normalizeEmail(formData.get("email") || "");
    const password = String(formData.get("password") || "").trim();
    const companyId = String(formData.get("company_id") || "").trim();
    const role = String(formData.get("role") || "vendedor").trim();
    const isMaster = formData.get("is_master") === "on";
    const isActive = formData.get("is_active") === "on";
    const commissionRaw = String(formData.get("comissao_percentual") || "0").trim();
const canAccessAtendimento = getCheckboxValue(formData, "can_access_atendimento");
const canAccessCampanhas = getCheckboxValue(formData, "can_access_campanhas");
const canAccessEstoque = getCheckboxValue(formData, "can_access_estoque");

    const comissao = Number(commissionRaw || 0);

    if (!email) {
      return goWithMessage("error", "Informe o e-mail.");
    }

    if (!password || password.length < 6) {
      return goWithMessage("error", "A senha deve ter pelo menos 6 caracteres.");
    }

    if (!isMaster && !companyId) {
      return goWithMessage(
        "error",
        "Selecione uma empresa para usuário que não seja master."
      );
    }

    if (companyId && role === "vendedor" && isActive) {
      const vendorLimit = await ensureVendorLimit(companyId);
      if ("error" in vendorLimit && vendorLimit.error) {
        return goWithMessage("error", vendorLimit.error.message);
      }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        is_master: isMaster,
      },
    });

    if (createError || !created.user) {
      return goWithMessage(
        "error",
        createError?.message || "Não foi possível criar o usuário."
      );
    }

    const userId = created.user.id;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      is_active: isActive,
      is_master: isMaster,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      return goWithMessage("error", profileError.message);
    }

    if (companyId) {
const membership = await upsertCompanyMembership({
  companyId,
  email,
  userId,
  role,
  status: isActive ? "ativo" : "inativo",
  comissaoPercentual: Number.isFinite(comissao) ? comissao : 0,
canAccessAtendimento,
canAccessCampanhas,
canAccessEstoque,
});

      if (membership.error) {
        return goWithMessage("error", membership.error.message);
      }
    }

    return goWithMessage("ok", "Usuário criado com sucesso.");
  }

  async function assignUserToCompanyAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();

    const companyId = String(formData.get("company_id") || "").trim();
    const email = normalizeEmail(formData.get("email") || "");
    const role = String(formData.get("role") || "owner").trim();
    const status = String(formData.get("status") || "ativo").trim();
    const commission = toNumber(formData.get("comissao_percentual"), 0);
    const canAccessAtendimento = getCheckboxValue(formData, "can_access_atendimento");
const canAccessCampanhas = getCheckboxValue(formData, "can_access_campanhas");
const canAccessEstoque = getCheckboxValue(formData, "can_access_estoque");

    if (!companyId) {
      return goWithMessage("error", "Empresa inválida para associação.");
    }

    if (!email) {
      return goWithMessage("error", "Informe o e-mail para associar à empresa.");
    }

    const authUser = await findAuthUserByEmail(email);

    if (role === "vendedor" && status === "ativo") {
      const vendorLimit = await ensureVendorLimit(companyId, authUser?.id || null);
      if ("error" in vendorLimit && vendorLimit.error) {
        return goWithMessage("error", vendorLimit.error.message);
      }
    }

    if (authUser?.id) {
      const admin = getAdminSupabase();
      const { error: profileError } = await admin.from("profiles").upsert({
        id: authUser.id,
        email,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        return goWithMessage("error", profileError.message);
      }
    }

const membership = await upsertCompanyMembership({
  companyId,
  email,
  userId: authUser?.id || null,
  role,
  status,
  comissaoPercentual: commission,
  canAccessAtendimento,
  canAccessCampanhas,
  canAccessEstoque,
});

    if (membership.error) {
      return goWithMessage("error", membership.error.message);
    }

    return goWithMessage(
      "ok",
      authUser?.id
        ? "Usuário associado à empresa com sucesso."
        : "E-mail associado como vínculo pendente. Quando a pessoa entrar no sistema, poderá aceitar."
    );
  }

  async function updateUserAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const userId = String(formData.get("user_id") || "");
    const companyId = String(formData.get("company_id") || "");
    const role = String(formData.get("role") || "vendedor");
    const status = String(formData.get("status") || "ativo");
    const commissionRaw = String(formData.get("comissao_percentual") || "0").trim();
    const isMaster = formData.get("is_master") === "on";
    const isActive = formData.get("is_active") === "on";
    const canAccessAtendimento = getCheckboxValue(formData, "can_access_atendimento");
const canAccessCampanhas = getCheckboxValue(formData, "can_access_campanhas");
const canAccessEstoque = getCheckboxValue(formData, "can_access_estoque");

    if (!userId) {
      return goWithMessage("error", "Usuário inválido.");
    }

    if (companyId && role === "vendedor" && isActive && status === "ativo") {
      const vendorLimit = await ensureVendorLimit(companyId, userId);
      if ("error" in vendorLimit && vendorLimit.error) {
        return goWithMessage("error", vendorLimit.error.message);
      }
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        is_active: isActive,
        is_master: isMaster,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      return goWithMessage("error", profileError.message);
    }

    if (companyId) {
      const { error: companyUserError } = await admin
        .from("company_users")
.update({
  role,
  status,
  comissao_percentual: Number(commissionRaw || 0),
  can_access_atendimento: canAccessAtendimento,
  can_access_campanhas: canAccessCampanhas,
  can_access_estoque: canAccessEstoque,
  updated_at: new Date().toISOString(),
})
        .eq("user_id", userId)
        .eq("company_id", companyId);

      if (companyUserError) {
        return goWithMessage("error", companyUserError.message);
      }
    }

    return goWithMessage("ok", "Usuário atualizado.");
  }

  async function deactivateUserAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const userId = String(formData.get("user_id") || "");

    if (!userId) {
      return goWithMessage("error", "Usuário inválido.");
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      return goWithMessage("error", profileError.message);
    }

    const { error: companyUsersError } = await admin
      .from("company_users")
      .update({
        status: "inativo",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (companyUsersError) {
      return goWithMessage("error", companyUsersError.message);
    }

    return goWithMessage("ok", "Usuário desativado.");
  }

  async function reactivateUserAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const userId = String(formData.get("user_id") || "");

    if (!userId) {
      return goWithMessage("error", "Usuário inválido.");
    }

    const relationsRes = await admin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", userId);

    if (relationsRes.error) {
      return goWithMessage("error", relationsRes.error.message);
    }

    const relations = relationsRes.data || [];

    for (const relation of relations) {
      if (relation.role === "vendedor") {
        const vendorLimit = await ensureVendorLimit(relation.company_id, userId);
        if ("error" in vendorLimit && vendorLimit.error) {
          return goWithMessage("error", vendorLimit.error.message);
        }
      }
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      return goWithMessage("error", profileError.message);
    }

    const { error: companyUsersError } = await admin
      .from("company_users")
      .update({
        status: "ativo",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (companyUsersError) {
      return goWithMessage("error", companyUsersError.message);
    }

    return goWithMessage("ok", "Usuário reativado.");
  }

  async function removeUserFromCompanyAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const userId = String(formData.get("user_id") || "");
    const companyId = String(formData.get("company_id") || "");
    const email = normalizeEmail(formData.get("email") || "");

    if (!companyId) {
      return goWithMessage("error", "Dados inválidos para remoção.");
    }

    if (userId) {
      const { error } = await admin
        .from("company_users")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", companyId);

      if (error) {
        return goWithMessage("error", error.message);
      }

      return goWithMessage("ok", "Vínculo removido da empresa.");
    }

    if (email) {
      const { error } = await admin
        .from("company_users")
        .delete()
        .eq("email", email)
        .eq("company_id", companyId);

      if (error) {
        return goWithMessage("error", error.message);
      }

      return goWithMessage("ok", "Convite/vínculo pendente removido.");
    }

    return goWithMessage("error", "Dados inválidos para remoção.");
  }

  async function resetPasswordAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();

    const email = normalizeEmail(formData.get("email") || "");

    if (!email) {
      return goWithMessage("error", "E-mail inválido.");
    }

    const publicSb = getPublicSupabase();

    const { error } = await publicSb.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/reset-password`,
    });

    if (error) {
      return goWithMessage("error", error.message);
    }

    return goWithMessage("ok", "E-mail de redefinição enviado.");
  }

  async function deleteUserAction(formData: FormData) {
    "use server";
    await ensureMasterAccess();
    const admin = getAdminSupabase();

    const userId = String(formData.get("user_id") || "");
    const email = normalizeEmail(formData.get("email") || "");
    const confirmText = String(formData.get("confirm_text") || "").trim();

    if (!userId) {
      return goWithMessage("error", "Usuário inválido.");
    }

    if (onlyAllowedMaster(email)) {
      return goWithMessage(
        "error",
        "Seu usuário master principal não pode ser excluído por essa tela."
      );
    }

    if (confirmText !== "EXCLUIR") {
      return goWithMessage("error", 'Digite EXCLUIR para confirmar.');
    }

    const { error: companyUsersError } = await admin
      .from("company_users")
      .delete()
      .eq("user_id", userId);

    if (companyUsersError) {
      return goWithMessage(
        "error",
        `Company users: ${companyUsersError.message}`
      );
    }

    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      return goWithMessage("error", `Profiles: ${profileError.message}`);
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(
      userId,
      true
    );

    if (deleteAuthError) {
      return goWithMessage("error", `Auth delete: ${deleteAuthError.message}`);
    }

    return goWithMessage("ok", "Usuário removido da operação com sucesso.");
  }

  const [
    authUsersResult,
    profilesResult,
    companiesResult,
    companyUsersResult,
    servicosResult,
    campaignsResult,
  ] = await Promise.allSettled([
    listAllAuthUsers(admin),
    admin.from("profiles").select("*"),
    admin.from("companies").select("*").order("created_at", { ascending: false }),
    admin.from("company_users").select("*").order("created_at", { ascending: false }),
    admin.from("servicos").select("*"),
    admin.from("campaigns").select("*"),
  ]);

  const authUsers =
    authUsersResult.status === "fulfilled" ? authUsersResult.value : [];
  const profiles =
    profilesResult.status === "fulfilled" ? profilesResult.value.data || [] : [];
  const companies =
    companiesResult.status === "fulfilled" ? companiesResult.value.data || [] : [];
  const companyUsers =
    companyUsersResult.status === "fulfilled"
      ? companyUsersResult.value.data || []
      : [];
  const servicos =
    servicosResult.status === "fulfilled" ? servicosResult.value.data || [] : [];
  const campaigns =
    campaignsResult.status === "fulfilled" ? campaignsResult.value.data || [] : [];

  const authMap = new Map(authUsers.map((u: any) => [u.id, u]));
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
  const companyMap = new Map(companies.map((c: any) => [c.id, c]));

  function getRelationEmail(relation: any) {
    const authUser = relation?.user_id ? authMap.get(relation.user_id) : null;
    const profile = relation?.user_id ? profileMap.get(relation.user_id) : null;

    return profile?.email || authUser?.email || relation?.email || "—";
  }

  const mergedUsersRaw = authUsers
    .map((authUser: any) => {
      const profile = profileMap.get(authUser.id);
      const relations = companyUsers.filter((cu: any) => cu.user_id === authUser.id);

      return {
        id: authUser.id,
        email: authUser.email || profile?.email || "—",
        created_at: authUser.created_at || profile?.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        is_active: profile?.is_active ?? true,
        is_master: profile?.is_master ?? false,
        relations,
        profile,
      };
    })
    .filter((user: any) => user.profile || user.relations.length > 0);

  const orphanProfiles = profiles.filter((profile: any) => !authMap.has(profile.id));

  const companyStatsRaw = companies.map((company: any) => {
    const relatedUsers = companyUsers.filter((cu: any) => cu.company_id === company.id);
    const relatedServices = servicos.filter((s: any) => s.company_id === company.id);
    const relatedCampaigns = campaigns.filter((c: any) => c.company_id === company.id);

    const ownersRows = relatedUsers.filter((u: any) => u.role === "owner");
    const adminsRows = relatedUsers.filter((u: any) => u.role === "admin");
    const vendedoresRows = relatedUsers.filter((u: any) => u.role === "vendedor");

    const owners = ownersRows.length;
    const admins = adminsRows.length;
    const vendedores = vendedoresRows.length;

    const activeVendedores = relatedUsers.filter(
      (u: any) => u.role === "vendedor" && u.status === "ativo"
    ).length;

    const atendimentoLiberado = relatedUsers.filter(
      (u: any) => u.can_access_atendimento === true
    ).length;

    const campanhasLiberado = relatedUsers.filter(
      (u: any) => u.can_access_campanhas === true
    ).length;

    const estoqueLiberado = relatedUsers.filter(
  (u: any) => u.can_access_estoque === true
).length;

    const leads = relatedServices.filter((s: any) => s.status === "lead").length;
    const concluidos = relatedServices.filter((s: any) => s.status === "concluido").length;

    const receita = relatedServices.reduce((acc: number, item: any) => {
      const value =
        Number(item?.valor_final ?? item?.valor_total ?? item?.valor ?? 0) || 0;
      return acc + value;
    }, 0);

    const maxVendedores = Number(company?.max_vendedores || 0);
    const canDelete =
      relatedUsers.length === 0 &&
      relatedServices.length === 0 &&
      relatedCampaigns.length === 0;

    const billingStatus =
      company?.billing_status ||
      (company?.is_active === false
        ? "inativa"
        : company?.plan === "free"
        ? "free"
        : "ativa");

    const ownerEmails = Array.from(
      new Set(
        ownersRows
          .map((row: any) => getRelationEmail(row))
          .filter((email) => email && email !== "—")
      )
    );

    return {
      company,
      users: relatedUsers,
      owners,
      admins,
      vendedores,
      activeVendedores,
      atendimentoLiberado,
      campanhasLiberado,
      estoqueLiberado,
      servicesCount: relatedServices.length,
      leads,
      concluidos,
      campaignsCount: relatedCampaigns.length,
      receita,
      maxVendedores,
      canDelete,
      availableVendedores:
        maxVendedores > 0 ? Math.max(maxVendedores - activeVendedores, 0) : "ilimitado",
      billingStatus,
      paymentMethod: company?.payment_method || "—",
      nextBillingDate: company?.next_billing_date || null,
      lastPaymentDate: company?.last_payment_date || null,
      priceAmount: Number(company?.price_amount || 0),
      ownerEmails,
      hasOwner: ownerEmails.length > 0,
      activeMembers: relatedUsers.filter((u: any) => u.status === "ativo").length,
      pendingMembers: relatedUsers.filter((u: any) => u.status === "pending").length,
    };
  });

  let companyStats = companyStatsRaw.filter((item: any) => {
    const matchesQ =
      !q ||
      contains(item.company?.name, q) ||
      contains(item.company?.id, q) ||
      contains(item.company?.plan, q) ||
      item.users.some((u: any) => contains(getRelationEmail(u), q));

    const matchesPlan =
      planFilter === "all" || safeString(item.company?.plan) === planFilter;

    const matchesStatus =
      companyStatusFilter === "all" ||
      (companyStatusFilter === "active" && item.company?.is_active !== false) ||
      (companyStatusFilter === "inactive" && item.company?.is_active === false);

    const matchesEmpty = !onlyEmpty || item.canDelete;

    return matchesQ && matchesPlan && matchesStatus && matchesEmpty;
  });

  if (sortCompanies === "name") {
    companyStats = [...companyStats].sort((a, b) =>
      safeString(a.company?.name).localeCompare(safeString(b.company?.name), "pt-BR")
    );
  } else if (sortCompanies === "revenue") {
    companyStats = [...companyStats].sort((a, b) => b.receita - a.receita);
  } else if (sortCompanies === "users") {
    companyStats = [...companyStats].sort((a, b) => b.users.length - a.users.length);
  } else {
    companyStats = [...companyStats].sort(
      (a, b) =>
        new Date(b.company?.created_at || 0).getTime() -
        new Date(a.company?.created_at || 0).getTime()
    );
  }

  let mergedUsers = mergedUsersRaw.filter((user: any) => {
    const relation = user.relations?.[0];
    const relationRole = relation?.role || "";
    const company = relation ? companyMap.get(relation.company_id) : null;

    const matchesQ =
      !q ||
      contains(user.email, q) ||
      contains(user.id, q) ||
      contains(company?.name, q);

    const matchesUserStatus =
      userStatusFilter === "all" ||
      (userStatusFilter === "active" && user.is_active !== false) ||
      (userStatusFilter === "inactive" && user.is_active === false);

    const matchesRole =
      roleFilter === "all" ||
      relationRole === roleFilter ||
      (roleFilter === "master" && user.is_master === true);

    const matchesMasters = !onlyMasters || user.is_master === true;

    return matchesQ && matchesUserStatus && matchesRole && matchesMasters;
  });

  if (sortUsers === "email") {
    mergedUsers = [...mergedUsers].sort((a, b) =>
      safeString(a.email).localeCompare(safeString(b.email), "pt-BR")
    );
  } else if (sortUsers === "login") {
    mergedUsers = [...mergedUsers].sort(
      (a, b) =>
        new Date(b.last_sign_in_at || 0).getTime() -
        new Date(a.last_sign_in_at || 0).getTime()
    );
  } else {
    mergedUsers = [...mergedUsers].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }

  const latestCompanies = [...companyStatsRaw]
    .sort(
      (a, b) =>
        new Date(b.company?.created_at || 0).getTime() -
        new Date(a.company?.created_at || 0).getTime()
    )
    .slice(0, 8);

  const latestUsers = [...mergedUsersRaw]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .slice(0, 8);

  const mastersList = mergedUsersRaw.filter((u: any) => u.is_master === true);

  const totalReceita = companyStatsRaw.reduce((acc, item) => acc + item.receita, 0);
  const activeCompanies = companies.filter((c: any) => c.is_active !== false).length;
  const inactiveCompanies = companies.filter((c: any) => c.is_active === false).length;
  const emptyCompanies = companyStatsRaw.filter((c) => c.canDelete).length;

  const totalMasters = profiles.filter((p: any) => p.is_master === true).length;
  const activeUsers = profiles.filter((p: any) => p.is_active !== false).length;
  const inactiveUsers = profiles.filter((p: any) => p.is_active === false).length;

  const totalOwners = companyUsers.filter((u: any) => u.role === "owner").length;
  const totalAdmins = companyUsers.filter((u: any) => u.role === "admin").length;
  const totalVendedores = companyUsers.filter((u: any) => u.role === "vendedor").length;
  const totalLeads = servicos.filter((s: any) => s.status === "lead").length;
  const totalConcluidos = servicos.filter((s: any) => s.status === "concluido").length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0f172a_0%,#081126_35%,#030816_100%)] text-white">
      <div className="w-full px-4 py-8 md:px-8 2xl:px-12">
        <section className="mb-8 rounded-[30px] border border-cyan-500/15 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_25px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">
                Master Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl 2xl:text-5xl">
                Painel Master FlowDesk
              </h1>
              <p className="mt-3 text-sm text-white/65 md:text-base">
                Controle total da plataforma: empresas/clientes, usuários, masters,
                limites de vendedores, cobrança, operação comercial, campanhas,
                estoque, filtros e gestão detalhada por empresa.
              </p>
            </div>

            <div className="grid min-w-[300px] gap-3 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm">
              <div className="font-semibold text-emerald-300">Acesso liberado</div>
              <div className="text-white/85">{currentUser.email}</div>
              <div className="text-xs text-white/55">
                Usuário master autorizado da plataforma
              </div>
            </div>
          </div>

          {(ok || error) && (
            <div className="mt-5">
              {ok ? (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {ok}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <Card title="Empresas">
            <Big>{companies.length}</Big>
            <Small>{activeCompanies} ativas · {inactiveCompanies} inativas</Small>
          </Card>

          <Card title="Empresas vazias">
            <Big>{emptyCompanies}</Big>
            <Small>Podem ser excluídas</Small>
          </Card>

          <Card title="Usuários">
            <Big>{profiles.length}</Big>
            <Small>{activeUsers} ativos · {inactiveUsers} inativos</Small>
          </Card>

          <Card title="Masters">
            <Big>{totalMasters}</Big>
            <Small>{totalOwners} owners · {totalAdmins} admins</Small>
          </Card>

          <Card title="Vendedores">
            <Big>{totalVendedores}</Big>
            <Small>Vinculados nas empresas</Small>
          </Card>

          <Card title="Operação">
            <Big>{servicos.length}</Big>
            <Small>{totalLeads} leads · {totalConcluidos} concluídos</Small>
          </Card>

          <Card title="Campanhas">
            <Big>{campaigns.length}</Big>
            <Small>Rastreio ativo</Small>
          </Card>

          <Card title="Receita">
            <Big>{money(totalReceita)}</Big>
            <Small>Base nos serviços</Small>
          </Card>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 2xl:grid-cols-[420px_1fr_1fr]">
          <Panel title="Criar empresa">
            <form action={createCompanyAction} className="grid gap-3">
              <input
                name="name"
                placeholder="Nome da empresa"
                className={input}
                required
              />

              <select name="plan" className={input} defaultValue="free">
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="premium">premium</option>
                <option value="enterprise">enterprise</option>
              </select>

              <input
                name="max_vendedores"
                type="number"
                min="0"
                defaultValue="0"
                className={input}
                placeholder="Máximo de vendedores (0 = ilimitado)"
              />

              <input
                name="owner_email"
                type="email"
                defaultValue=""
                className={input}
                placeholder="E-mail do dono inicial (opcional)"
              />

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input type="checkbox" name="is_active" defaultChecked />
                Empresa ativa
              </label>

              <button className={buttonPrimary}>Criar empresa</button>
            </form>
          </Panel>

          <Panel title="Criar usuário / master">
            <form action={createUserAction} className="grid gap-3">
              <input
                name="email"
                type="email"
                placeholder="email@cliente.com"
                className={input}
                required
              />

              <input
                name="password"
                type="text"
                placeholder="Senha inicial"
                className={input}
                required
              />

              <select name="company_id" className={input} defaultValue="">
                <option value="">Sem empresa (para master)</option>
                {companies.map((company: any) => (
                  <option key={company.id} value={company.id}>
                    {company.name} {company.plan ? `· ${company.plan}` : ""}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select name="role" className={input} defaultValue="vendedor">
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="vendedor">vendedor</option>
                </select>

                <input
                  name="comissao_percentual"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Comissão %"
                  className={input}
                  defaultValue="0"
                />
              </div>

<div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
    Permissões de módulos
  </div>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="checkbox" name="can_access_atendimento" />
  Liberar Atendimento
</label>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="checkbox" name="can_access_campanhas" />
  Liberar Campanhas
</label>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="checkbox" name="can_access_estoque" />
  Liberar Estoque
</label>

<div className="text-[11px] text-white/45">
  As permissões abaixo são controladas manualmente pelo painel master.
</div>
</div>

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input type="checkbox" name="is_master" />
                Criar como master da plataforma
              </label>

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input type="checkbox" name="is_active" defaultChecked />
                Usuário ativo
              </label>

              <button className={buttonPrimary}>Criar usuário</button>
            </form>
          </Panel>

          <Panel title="Filtros do painel">
            <form className="grid gap-3" action="/dashboard/master">
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar empresa, usuário, e-mail, plano..."
                className={input}
              />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select name="plan" className={input} defaultValue={planFilter}>
                  <option value="all">Todos os planos</option>
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                  <option value="premium">premium</option>
                  <option value="enterprise">enterprise</option>
                </select>

                <select
                  name="company_status"
                  className={input}
                  defaultValue={companyStatusFilter}
                >
                  <option value="all">Empresas: todas</option>
                  <option value="active">Empresas ativas</option>
                  <option value="inactive">Empresas inativas</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  name="user_status"
                  className={input}
                  defaultValue={userStatusFilter}
                >
                  <option value="all">Usuários: todos</option>
                  <option value="active">Usuários ativos</option>
                  <option value="inactive">Usuários inativos</option>
                </select>

                <select name="role" className={input} defaultValue={roleFilter}>
                  <option value="all">Roles: todas</option>
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="vendedor">vendedor</option>
                  <option value="master">master</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select
                  name="sort_companies"
                  className={input}
                  defaultValue={sortCompanies}
                >
                  <option value="recent">Empresas: mais recentes</option>
                  <option value="name">Empresas: nome</option>
                  <option value="revenue">Empresas: receita</option>
                  <option value="users">Empresas: usuários</option>
                </select>

                <select name="sort_users" className={input} defaultValue={sortUsers}>
                  <option value="recent">Usuários: mais recentes</option>
                  <option value="email">Usuários: email</option>
                  <option value="login">Usuários: último login</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  name="only_empty"
                  value="1"
                  defaultChecked={onlyEmpty}
                />
                Mostrar só empresas vazias
              </label>

              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  name="only_masters"
                  value="1"
                  defaultChecked={onlyMasters}
                />
                Mostrar só usuários master
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button className={buttonSecondary}>Aplicar filtros</button>
                <a
                  href="/dashboard/master"
                  className={buttonTinyMutedLarge + " text-center"}
                >
                  Limpar filtros
                </a>
              </div>
            </form>
          </Panel>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 2xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
          <Panel title="Últimas empresas criadas">
            <div className="grid gap-3">
              {latestCompanies.length === 0 ? (
                <EmptyText>Nenhuma empresa encontrada.</EmptyText>
              ) : (
                latestCompanies.map((item: any) => (
                  <div
                    key={item.company.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{item.company.name}</div>
                        <div className="text-xs text-white/50">{item.company.id}</div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge>{item.company.plan || "sem plano"}</Badge>
                        <Badge tone={item.company.is_active === false ? "rose" : "emerald"}>
                          {item.company.is_active === false ? "inativa" : "ativa"}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <MiniInfo label="Criada em" value={formatDate(item.company.created_at)} />
                      <MiniInfo
                        label="Limite vendedores"
                        value={
                          item.maxVendedores > 0 ? String(item.maxVendedores) : "Ilimitado"
                        }
                      />
                    </div>

                   <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
  <MiniInfo
    label="Atendimento liberado"
    value={String(item.atendimentoLiberado)}
  />
  <MiniInfo
    label="Campanhas liberado"
    value={String(item.campanhasLiberado)}
  />
  <MiniInfo
    label="Estoque liberado"
    value={String(item.estoqueLiberado)}
  />
  <MiniInfo
    label="Dono"
    value={item.ownerEmails[0] || "sem owner definido"}
  />
</div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Últimos usuários criados">
            <div className="grid gap-3">
              {latestUsers.length === 0 ? (
                <EmptyText>Nenhum usuário encontrado.</EmptyText>
              ) : (
                latestUsers.map((user: any) => {
                  const firstRelation = user.relations?.[0];
                  const company = firstRelation
                    ? companyMap.get(firstRelation.company_id)
                    : null;

                  return (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{user.email}</div>
                          <div className="text-xs text-white/50">{user.id}</div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {user.is_master ? <Badge tone="purple">master</Badge> : null}
                          <Badge tone={user.is_active === false ? "rose" : "emerald"}>
                            {user.is_active === false ? "inativo" : "ativo"}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <MiniInfo label="Empresa" value={company?.name || "sem empresa"} />
                        <MiniInfo
                          label="Role"
                          value={normalizeRole(firstRelation?.role || "sem vínculo")}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
  <MiniInfo
    label="Atendimento"
    value={firstRelation?.can_access_atendimento ? "Liberado" : "Bloqueado"}
  />
  <MiniInfo
    label="Campanhas"
    value={firstRelation?.can_access_campanhas ? "Liberado" : "Bloqueado"}
  />
  <MiniInfo
    label="Estoque"
    value={firstRelation?.can_access_estoque ? "Liberado" : "Bloqueado"}
  />
</div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="Usuários master">
            <div className="grid gap-3">
              {mastersList.length === 0 ? (
                <EmptyText>Nenhum master encontrado.</EmptyText>
              ) : (
                mastersList.map((user: any) => (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="font-semibold text-white">{user.email}</div>
                    <div className="mt-1 text-xs text-white/50">{user.id}</div>
                    <div className="mt-2 text-xs text-white/60">
                      Criado em {formatDate(user.created_at)}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Último login {formatDate(user.last_sign_in_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </section>

        <section className="mb-8">
          <Panel title={`Empresas / clientes da plataforma (${companyStats.length})`}>
            <div className="grid gap-5">
              {companyStats.length === 0 ? (
                <EmptyText>Nenhuma empresa encontrada com os filtros atuais.</EmptyText>
              ) : (
                companyStats.map((item) => {
                  const company = item.company;

                  const selectedRelation = item.users?.[0] || null;
                  const selectedRelationEmail = selectedRelation ? getRelationEmail(selectedRelation) : "";

                  return (
                    <details
                      key={company.id}
                      className="group rounded-[28px] border border-white/10 bg-white/[0.04] p-4 open:border-cyan-500/20"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-2xl font-bold">{company.name}</h3>
                              <Badge>{company.plan || "sem plano"}</Badge>
                              <Badge tone={company.is_active === false ? "rose" : "emerald"}>
                                {company.is_active === false ? "inativa" : "ativa"}
                              </Badge>
                              {item.canDelete ? <Badge tone="amber">empresa vazia</Badge> : null}
                              <Badge tone="sky">{item.billingStatus}</Badge>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-white/65 md:grid-cols-6">
                              <span>Usuários: {item.users.length}</span>
                              <span>
                                Vendedores: {item.activeVendedores}/
                                {item.maxVendedores > 0 ? item.maxVendedores : "∞"}
                              </span>
                              <span>Leads: {item.leads}</span>
                              <span>Campanhas: {item.campaignsCount}</span>
                              <span>Receita: {money(item.receita)}</span>
                              <span>Dono: {item.ownerEmails[0] || "não definido"}</span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            Clique para ver detalhes e controles
                          </div>
                        </div>
                      </summary>

                      <div className="mt-5 grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="grid gap-4">
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <Info label="Usuários" value={String(item.users.length)} />
                            <Info label="Owners" value={String(item.owners)} />
                            <Info label="Admins" value={String(item.admins)} />
                            <Info label="Vendedores" value={String(item.vendedores)} />
                            <Info label="Usuários ativos" value={String(item.activeMembers)} />
                            <Info label="Pendentes" value={String(item.pendingMembers)} />
                            <Info label="Leads" value={String(item.leads)} />
                            <Info label="Campanhas" value={String(item.campaignsCount)} />
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <InfoCard
                              title="Receita mapeada"
                              value={money(item.receita)}
                              subtitle="Base nos serviços da empresa"
                            />
                            <InfoCard
                              title="Limite de vendedores"
                              value={
                                item.maxVendedores > 0
                                  ? String(item.maxVendedores)
                                  : "Ilimitado"
                              }
                              subtitle={`Disponível: ${item.availableVendedores}`}
                            />
                            <InfoCard
                              title="Cobrança"
                              value={safeString(item.billingStatus)}
                              subtitle={`Plano: ${safeString(company.plan || "sem plano")}`}
                            />
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <MiniInfo
                              label="Próxima fatura"
                              value={formatDateShort(item.nextBillingDate)}
                            />
                            <MiniInfo
                              label="Último pagamento"
                              value={formatDateShort(item.lastPaymentDate)}
                            />
                            <MiniInfo
                              label="Forma de pagamento"
                              value={safeString(item.paymentMethod || "—")}
                            />
                            <MiniInfo
                              label="Preço"
                              value={item.priceAmount > 0 ? money(item.priceAmount) : "—"}
                            />
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <MiniInfo
  label="Liberados em Atendimento"
  value={String(item.atendimentoLiberado)}
/>
<MiniInfo
  label="Liberados em Campanhas"
  value={String(item.campanhasLiberado)}
/>
<MiniInfo
  label="Liberados em Estoque"
  value={String(item.estoqueLiberado)}
/>
<MiniInfo
  label="Usuários ativos"
  value={String(item.activeMembers)}
/>
                            <MiniInfo
                              label="Pendentes"
                              value={String(item.pendingMembers)}
                            />
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                            <div>ID: {company.id}</div>
                            <div className="mt-1">Criada em: {formatDate(company.created_at)}</div>
                            <div className="mt-1">
                              Empresa ativa: {company.is_active === false ? "não" : "sim"}
                            </div>
                            <div className="mt-1">
                              Donos atuais:{" "}
                              {item.ownerEmails.length > 0
                                ? item.ownerEmails.join(", ")
                                : "nenhum owner definido"}
                            </div>
                          </div>

                          <PanelLite title="Associar usuário / dono à empresa">
                            <form action={assignUserToCompanyAction} className="grid gap-3">
                              <input type="hidden" name="company_id" value={company.id} />

<select
  name="email"
  className={input}
  defaultValue={selectedRelationEmail}
  required
>
  <option value="">Selecione um usuário da empresa</option>
  {item.users.map((relation: any) => {
    const relationEmail = getRelationEmail(relation);

    return (
      <option key={`${relation.company_id}-${relation.user_id || relation.email}`} value={relationEmail}>
        {relationEmail}
      </option>
    );
  })}
</select>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <select
  name="role"
  className={input}
  defaultValue={selectedRelation?.role || (item.hasOwner ? "admin" : "owner")}
>
                                  <option value="owner">owner</option>
                                  <option value="admin">admin</option>
                                  <option value="vendedor">vendedor</option>
                                </select>

                                <select
  name="status"
  className={input}
  defaultValue={selectedRelation?.status || "ativo"}
>
                                  <option value="ativo">ativo</option>
                                  <option value="inativo">inativo</option>
                                  <option value="pending">pending</option>
                                </select>

                          <input
  name="comissao_percentual"
  type="number"
  step="0.01"
  min="0"
  defaultValue={selectedRelation?.comissao_percentual ?? 0}
  className={input}
  placeholder="Comissão %"
/>
                              </div>

<div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
    Permissões de módulos
  </div>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="hidden" name="can_access_atendimento" value="false" />
  <input
    type="checkbox"
    name="can_access_atendimento"
    value="true"
    defaultChecked={selectedRelation?.can_access_atendimento === true}
  />
  Liberar Atendimento
</label>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="hidden" name="can_access_campanhas" value="false" />
  <input
    type="checkbox"
    name="can_access_campanhas"
    value="true"
    defaultChecked={selectedRelation?.can_access_campanhas === true}
  />
  Liberar Campanhas
</label>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="hidden" name="can_access_estoque" value="false" />
  <input
    type="checkbox"
    name="can_access_estoque"
    value="true"
    defaultChecked={selectedRelation?.can_access_estoque === true}
  />
  Liberar Estoque
</label>

<div className="text-[11px] text-white/45">
  As permissões abaixo são controladas manualmente pelo painel master.
</div>
</div>

                              <button className={buttonPrimary}>
                                Associar usuário à empresa
                              </button>
                            </form>
                          </PanelLite>

                          {item.users.length > 0 ? (
                            <div className="overflow-x-auto rounded-2xl border border-white/10">
                              <table className="min-w-full text-left text-sm">
                                <thead className="bg-white/5 text-white/60">
                                  <tr>
                                    <th className="px-3 py-3">Usuário</th>
                                    <th className="px-3 py-3">Role</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Comissão</th>
                                    <th className="px-3 py-3">Atendimento</th>
                                    <th className="px-3 py-3">Campanhas</th>
                                    <th className="px-3 py-3">Estoque</th>
                                    <th className="px-3 py-3">Master</th>
                                    <th className="px-3 py-3">Último login</th>
                                    <th className="px-3 py-3">Ações</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {item.users.map((relation: any) => {
                                    const authUser = relation.user_id
                                      ? authMap.get(relation.user_id)
                                      : null;
                                    const profile = relation.user_id
                                      ? profileMap.get(relation.user_id)
                                      : null;
                                    const relationEmail = getRelationEmail(relation);

                                    return (
                                      <tr
                                        key={`${relation.company_id}-${relation.user_id || relation.email || Math.random()}`}
                                        className="border-t border-white/10 align-top"
                                      >
                                        <td className="px-3 py-3">
                                          <div className="font-medium">{relationEmail}</div>
                                          <div className="text-xs text-white/50">
                                            {relation.user_id || "convite pendente"}
                                          </div>
                                        </td>

                                        <td className="px-3 py-3">
                                          {relation.role || "vendedor"}
                                        </td>

                                        <td className="px-3 py-3">
                                          {normalizeStatus(relation.status, profile?.is_active)}
                                        </td>

                                        <td className="px-3 py-3">
                                          {relation.comissao_percentual ?? 0}%
                                        </td>

                                        <td className="px-3 py-3">
  {relation.can_access_atendimento ? "Liberado" : "Bloqueado"}
</td>

<td className="px-3 py-3">
  {relation.can_access_campanhas ? "Liberado" : "Bloqueado"}
</td>

<td className="px-3 py-3">
  {relation.can_access_estoque ? "Liberado" : "Bloqueado"}
</td>

<td className="px-3 py-3">
  {profile?.is_master ? "Sim" : "Não"}
</td>
                                        <td className="px-3 py-3">
                                          <div>{formatDate(authUser?.last_sign_in_at)}</div>
                                          <div className="text-xs text-white/50">
                                            criado: {formatDate(authUser?.created_at)}
                                          </div>
                                        </td>

                                        <td className="px-3 py-3">
                                          <div className="grid gap-3">
                                            {relation.user_id ? (
                                              <>
                                                <form action={updateUserAction} className="grid gap-2">
                                                  <input
                                                    type="hidden"
                                                    name="user_id"
                                                    value={relation.user_id}
                                                  />
                                                  <input
                                                    type="hidden"
                                                    name="company_id"
                                                    value={relation.company_id}
                                                  />

                                                  <select
                                                    name="role"
                                                    defaultValue={relation.role || "vendedor"}
                                                    className={smallInput}
                                                  >
                                                    <option value="owner">owner</option>
                                                    <option value="admin">admin</option>
                                                    <option value="vendedor">vendedor</option>
                                                  </select>

                                                  <select
                                                    name="status"
                                                    defaultValue={normalizeStatus(
                                                      relation.status,
                                                      profile?.is_active
                                                    )}
                                                    className={smallInput}
                                                  >
                                                    <option value="ativo">ativo</option>
                                                    <option value="inativo">inativo</option>
                                                    <option value="bloqueado">bloqueado</option>
                                                    <option value="pending">pending</option>
                                                  </select>

                                                  <input
                                                    name="comissao_percentual"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    defaultValue={relation.comissao_percentual ?? 0}
                                                    className={smallInput}
                                                  />

                                                <label className="flex items-center gap-2 text-sm text-white/80">
  <input type="hidden" name="can_access_atendimento" value="false" />
  <input
    type="checkbox"
    name="can_access_atendimento"
    value="true"
    defaultChecked={selectedRelation?.can_access_atendimento === true}
  />
  Liberar Atendimento
</label>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="hidden" name="can_access_campanhas" value="false" />
  <input
    type="checkbox"
    name="can_access_campanhas"
    value="true"
    defaultChecked={selectedRelation?.can_access_campanhas === true}
  />
  Liberar Campanhas
</label>

<label className="flex items-center gap-2 text-sm text-white/80">
  <input type="hidden" name="can_access_estoque" value="false" />
  <input
    type="checkbox"
    name="can_access_estoque"
    value="true"
    defaultChecked={selectedRelation?.can_access_estoque === true}
  />
  Liberar Estoque
</label>

                                                  <label className="flex items-center gap-2 text-xs text-white/80">
                                                    <input
                                                      type="checkbox"
                                                      name="is_master"
                                                      defaultChecked={profile?.is_master === true}
                                                    />
                                                    master
                                                  </label>

                                                  <label className="flex items-center gap-2 text-xs text-white/80">
                                                    <input
                                                      type="checkbox"
                                                      name="is_active"
                                                      defaultChecked={profile?.is_active !== false}
                                                    />
                                                    ativo
                                                  </label>

                                                  <button className={buttonTiny}>
                                                    Salvar usuário
                                                  </button>
                                                </form>

                                                <div className="grid gap-2 md:grid-cols-2">
                                                  <form action={deactivateUserAction}>
                                                    <input
                                                      type="hidden"
                                                      name="user_id"
                                                      value={relation.user_id}
                                                    />
                                                    <button className={buttonWarningSmall}>
                                                      Desativar
                                                    </button>
                                                  </form>

                                                  <form action={reactivateUserAction}>
                                                    <input
                                                      type="hidden"
                                                      name="user_id"
                                                      value={relation.user_id}
                                                    />
                                                    <button className={buttonTinyMuted}>
                                                      Reativar
                                                    </button>
                                                  </form>
                                                </div>

                                                <form action={resetPasswordAction}>
                                                  <input
                                                    type="hidden"
                                                    name="email"
                                                    value={relationEmail}
                                                  />
                                                  <button className={buttonTinyMuted}>
                                                    Enviar reset
                                                  </button>
                                                </form>
                                              </>
                                            ) : (
                                              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                                                Convite pendente. Esse e-mail ainda não está vinculado a um
                                                auth user.
                                              </div>
                                            )}

                                            <form action={removeUserFromCompanyAction}>
                                              <input
                                                type="hidden"
                                                name="user_id"
                                                value={relation.user_id || ""}
                                              />
                                              <input
                                                type="hidden"
                                                name="company_id"
                                                value={relation.company_id}
                                              />
                                              <input
                                                type="hidden"
                                                name="email"
                                                value={relationEmail}
                                              />
                                              <button className={buttonTinyDanger}>
                                                Remover da empresa
                                              </button>
                                            </form>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">
                              Essa empresa ainda não possui usuários vinculados. Use o bloco
                              "Associar usuário / dono à empresa" acima para definir o owner
                              e os demais perfis.
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3">
                          <form action={updateCompanyAction} className="grid gap-3">
                            <input type="hidden" name="company_id" value={company.id} />

                            <input
                              name="name"
                              defaultValue={company.name || ""}
                              className={input}
                              placeholder="Nome da empresa"
                            />

                            <select
                              name="plan"
                              className={input}
                              defaultValue={company.plan || "free"}
                            >
                              <option value="free">free</option>
                              <option value="pro">pro</option>
                              <option value="premium">premium</option>
                              <option value="enterprise">enterprise</option>
                            </select>

                            <input
                              name="max_vendedores"
                              type="number"
                              min="0"
                              defaultValue={company.max_vendedores ?? 0}
                              className={input}
                              placeholder="Máximo de vendedores"
                            />

                            <label className="flex items-center gap-2 text-sm text-white/80">
                              <input
                                type="checkbox"
                                name="is_active"
                                defaultChecked={company.is_active !== false}
                              />
                              Empresa ativa
                            </label>

                            <button className={buttonSecondary}>Salvar empresa</button>
                          </form>

                          <div className="grid gap-2 md:grid-cols-2">
                            <form action={deactivateCompanyAction}>
                              <input type="hidden" name="company_id" value={company.id} />
                              <button className={buttonWarning}>Desativar</button>
                            </form>

                            <form action={reactivateCompanyAction}>
                              <input type="hidden" name="company_id" value={company.id} />
                              <button className={buttonTinyMutedLarge}>Reativar</button>
                            </form>
                          </div>

                          <form action={deleteCompanyAction} className="grid gap-2">
                            <input type="hidden" name="company_id" value={company.id} />
                            <input
                              name="confirm_text"
                              placeholder="Digite EXCLUIR"
                              className={input}
                            />
                            <button
                              className={item.canDelete ? buttonDanger : buttonDangerDisabled}
                              disabled={!item.canDelete}
                            >
                              Excluir empresa
                            </button>
                            <p className="text-[11px] text-white/45">
                              Só funciona para empresa sem usuários, serviços e campanhas.
                            </p>
                          </form>
                        </div>
                      </div>
                    </details>
                  );
                })
              )}
            </div>
          </Panel>
        </section>

        <section className="mb-8">
          <Panel title={`Usuários da plataforma (${mergedUsers.length})`}>
            <div className="grid gap-4">
              {mergedUsers.length === 0 ? (
                <EmptyText>Nenhum usuário encontrado com os filtros atuais.</EmptyText>
              ) : (
                mergedUsers.map((user: any) => {
                  const firstRelation = user.relations?.[0];
                  const company = firstRelation
                    ? companyMap.get(firstRelation.company_id)
                    : null;

                  return (
                    <details
                      key={user.id}
                      className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 open:border-cyan-500/20"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold">{user.email}</h3>

                              {user.is_master ? <Badge tone="purple">master</Badge> : null}

                              <Badge tone={user.is_active === false ? "rose" : "emerald"}>
                                {user.is_active === false ? "inativo" : "ativo"}
                              </Badge>

                              {user.email_confirmed_at ? (
                                <Badge tone="sky">email confirmado</Badge>
                              ) : (
                                <Badge tone="amber">email pendente</Badge>
                              )}
                            </div>

                            <div className="mt-2 text-sm text-white/60">
                              {company?.name || "sem empresa vinculada"} ·{" "}
                              {normalizeRole(firstRelation?.role || "sem vínculo")}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            Clique para ver detalhes e controles
                          </div>
                        </div>
                      </summary>

                      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
                        <div>
                          <div className="grid gap-1 text-sm text-white/70">
                            <div>ID: {user.id}</div>
                            <div>Último login: {formatDate(user.last_sign_in_at)}</div>
                            <div>Criado em: {formatDate(user.created_at)}</div>
                            <div>
                              Empresa principal: {company?.name || "sem empresa vinculada"}
                            </div>
                            <div>
                              Role principal:{" "}
                              {normalizeRole(firstRelation?.role || "sem vínculo")}
                            </div>
                            <div>
                              Atendimento:{" "}
                              {firstRelation?.can_access_atendimento ? "Liberado" : "Bloqueado"}
                            </div>
                            <div>
                              Campanhas:{" "}
                              {firstRelation?.can_access_campanhas ? "Liberado" : "Bloqueado"}
                            </div>
                          </div>

                          {user.relations?.length > 1 ? (
                            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                              Atenção: esse usuário possui {user.relations.length} vínculos
                              com empresas.
                            </div>
                          ) : null}
                        </div>

                        <div className="grid gap-3">
                          <form action={resetPasswordAction} className="grid gap-2">
                            <input type="hidden" name="email" value={user.email} />
                            <button className={buttonSecondary}>Enviar reset</button>
                          </form>

                          <form action={deactivateUserAction} className="grid gap-2">
                            <input type="hidden" name="user_id" value={user.id} />
                            <button className={buttonWarning}>Desativar usuário</button>
                          </form>

                          <form action={reactivateUserAction} className="grid gap-2">
                            <input type="hidden" name="user_id" value={user.id} />
                            <button className={buttonTinyMutedLarge}>Reativar usuário</button>
                          </form>
                        </div>

                        <div>
                          <form action={deleteUserAction} className="grid gap-2">
                            <input type="hidden" name="user_id" value={user.id} />
                            <input type="hidden" name="email" value={user.email} />

                            <label className="text-xs text-white/60">
                              Excluir usuário teste
                            </label>

                            <input
                              name="confirm_text"
                              placeholder="Digite EXCLUIR"
                              className={input}
                            />

                            <button className={buttonDanger}>Excluir usuário</button>

                            <p className="text-[11px] text-white/45">
                              Remove profile, vínculos e oculta da operação do FlowDesk.
                            </p>
                          </form>
                        </div>
                      </div>
                    </details>
                  );
                })
              )}
            </div>
          </Panel>
        </section>

        {orphanProfiles.length > 0 ? (
          <section className="mb-8">
            <Panel title="Perfis órfãos detectados">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {orphanProfiles.map((profile: any) => (
                  <div
                    key={profile.id}
                    className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"
                  >
                    <div className="font-medium">{profile.email || "sem e-mail"}</div>
                    <div className="mt-1 text-sm text-white/70">ID: {profile.id}</div>
                    <div className="mt-1 text-sm text-white/70">
                      Ativo: {profile.is_active === false ? "não" : "sim"} · Master:
                      {profile.is_master === true ? " sim" : " não"}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function PanelLite({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      {children}
    </div>
  );
}

function Big({ children }: { children: ReactNode }) {
  return <div className="text-3xl font-bold">{children}</div>;
}

function Small({ children }: { children: ReactNode }) {
  return <div className="mt-2 text-sm text-white/60">{children}</div>;
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function InfoCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
      <div className="text-white/50">{title}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-white/55">{subtitle}</div> : null}
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "emerald" | "rose" | "amber" | "purple" | "sky";
}) {
  const styles =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "rose"
      ? "bg-rose-500/15 text-rose-300"
      : tone === "amber"
      ? "bg-amber-500/15 text-amber-300"
      : tone === "purple"
      ? "bg-purple-500/15 text-purple-300"
      : tone === "sky"
      ? "bg-sky-500/15 text-sky-300"
      : "bg-white/10 text-white/70";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {children}
    </span>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">
      {children}
    </div>
  );
}

const input =
  "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30";

const smallInput =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none";

const buttonPrimary =
  "rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90";

const buttonSecondary =
  "rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90";

const buttonDanger =
  "rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90";

const buttonDangerDisabled =
  "rounded-2xl bg-rose-500/40 px-4 py-3 text-sm font-semibold text-white/70 cursor-not-allowed";

const buttonWarning =
  "rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90";

const buttonWarningSmall =
  "rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90";

const buttonTiny =
  "rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90";

const buttonTinyMuted =
  "rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15";

const buttonTinyMutedLarge =
  "rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15";

const buttonTinyDanger =
  "rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90";