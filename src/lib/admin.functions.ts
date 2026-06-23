import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const APP_ROLES: AppRole[] = ["admin", "vendedor", "financeiro", "estoquista"];

function generatePassword(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

async function ensureAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Erro ao verificar permissões");
  if (!data) throw new Error("Acesso negado: apenas administradores");
}

// ─── Bootstrap (no auth) — only works if no admin exists ───────────────────
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        fullName: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("Bootstrap já realizado");

    const password = generatePassword();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Falha ao criar usuário");

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleErr.message);
    }
    return { email: data.email, password };
  });

export const bootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { needsBootstrap: (count ?? 0) === 0 };
});

// ─── Admin-only fns ────────────────────────────────────────────────────────
export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const { data: roles, error: rErr } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (rErr) throw new Error(rErr.message);
    const byUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      byUser.set(r.user_id, arr);
    }
    return users.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      fullName: (u.user_metadata?.full_name as string | undefined) ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      roles: byUser.get(u.id) ?? [],
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        fullName: z.string().trim().min(1).max(120),
        roles: z.array(z.enum(APP_ROLES as [AppRole, ...AppRole[]])).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = generatePassword();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    const rows = data.roles.map((role) => ({ user_id: created.user!.id, role }));
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert(rows);
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(rErr.message);
    }
    return { email: data.email, password };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = generatePassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw new Error(error.message);
    return { password };
  });

export const updateUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        roles: z.array(z.enum(APP_ROLES as [AppRole, ...AppRole[]])).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.roles.includes("admin")) {
      throw new Error("Você não pode remover seu próprio papel de admin");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const rows = data.roles.map((role) => ({ user_id: data.userId, role }));
    const { error } = await supabaseAdmin.from("user_roles").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { role: AppRole }) => r.role);
  });
