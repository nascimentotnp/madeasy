import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myRoles } from "@/lib/admin.functions";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type Capabilities = {
  viewStock: boolean;
  editProduct: boolean;
  adjustInventory: boolean;
  rawMovement: boolean;
  editCustomer: boolean;
  createSale: boolean;
  markSalePaid: boolean;
  viewFinance: boolean;
  viewReports: boolean;
  manageUsers: boolean;
  manageSuppliers: boolean;
  managePurchases: boolean;
  viewAudit: boolean;
};

function deriveCaps(roles: AppRole[]): Capabilities {
  const has = (r: AppRole) => roles.includes(r);
  const admin = has("admin");
  return {
    viewStock: admin || has("vendedor") || has("financeiro") || has("estoquista"),
    editProduct: admin || has("estoquista"),
    adjustInventory: admin || has("estoquista"),
    rawMovement: admin || has("estoquista"),
    editCustomer: admin || has("vendedor"),
    createSale: admin || has("vendedor"),
    markSalePaid: admin || has("financeiro"),
    viewFinance: admin || has("financeiro"),
    viewReports: admin || has("financeiro"),
    manageUsers: admin,
    manageSuppliers: admin || has("financeiro"),
    managePurchases: admin || has("financeiro") || has("estoquista"),
    viewAudit: admin,
  };
}

export function useMyRoles() {
  const fetchMyRoles = useServerFn(myRoles);
  const q = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchMyRoles({ data: undefined }),
    staleTime: 5 * 60 * 1000,
  });
  const roles = (q.data ?? []) as AppRole[];
  return {
    roles,
    isLoading: q.isLoading,
    can: deriveCaps(roles),
    isAdmin: roles.includes("admin"),
  };
}
