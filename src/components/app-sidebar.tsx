import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Package, ShoppingCart, DollarSign, BarChart3, UserCog, LogOut, ShieldAlert, Truck, ClipboardList, ScrollText, Wallet, LayoutDashboard, Users } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useMyRoles } from "@/hooks/use-my-roles";
import type { Capabilities } from "@/hooks/use-my-roles";

type NavItem = {
  title: string;
  url: "/" | "/products" | "/customers" | "/sales" | "/finance" | "/reports" | "/users" | "/suppliers" | "/purchases" | "/audit" | "/dre";
  icon: React.ComponentType<{ className?: string }>;
  visible: (c: Capabilities) => boolean;
};

const items: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, visible: () => true },
  { title: "Produtos", url: "/products", icon: Package, visible: (c) => c.viewStock },
  { title: "Clientes", url: "/customers", icon: Users, visible: () => true },
  { title: "Vendas", url: "/sales", icon: ShoppingCart, visible: (c) => c.createSale || c.markSalePaid },
  { title: "Compras", url: "/purchases", icon: ClipboardList, visible: (c) => c.managePurchases },
  { title: "Fornecedores", url: "/suppliers", icon: Truck, visible: (c) => c.manageSuppliers },
  { title: "Financeiro", url: "/finance", icon: DollarSign, visible: (c) => c.viewFinance },
  { title: "DRE / Projeção", url: "/dre", icon: Wallet, visible: (c) => c.viewFinance },
  { title: "Relatórios", url: "/reports", icon: BarChart3, visible: (c) => c.viewReports },
  { title: "Auditoria", url: "/audit", icon: ScrollText, visible: (c) => c.viewAudit },
  { title: "Usuários", url: "/users", icon: UserCog, visible: (c) => c.manageUsers },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { can } = useMyRoles();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const visible = items.filter((i) => i.visible(can));

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold group-data-[collapsible=icon]:hidden">Estoque</span>
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <NotificationsBell />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            {message ?? "Você não tem permissão para acessar esta área. Solicite ao administrador."}
          </p>
          <Link to="/">
            <Button variant="outline" size="sm">Voltar ao estoque</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
