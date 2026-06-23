import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ScrollText, Eye } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { AccessDenied } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Auditoria — Controle de Estoque" }] }),
  component: AuditPage,
});

type AuditEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  user_email: string | null;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  products: "Produto",
  sales: "Venda",
  sale_items: "Item de venda",
  customers: "Cliente",
  movements: "Movimentação",
  expenses: "Despesa",
  purchase_orders: "Pedido de compra",
  purchase_items: "Item de compra",
  suppliers: "Fornecedor",
  user_roles: "Permissão",
  inventory_adjustments: "Ajuste de inventário",
};

function actionBadge(a: AuditEntry["action"]) {
  if (a === "INSERT") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Criação</Badge>;
  if (a === "UPDATE") return <Badge className="bg-blue-600 hover:bg-blue-600">Edição</Badge>;
  return <Badge variant="destructive">Exclusão</Badge>;
}

function AuditPage() {
  const { can, isLoading } = useMyRoles();
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const auditQ = useQuery({
    queryKey: ["audit_log", tableFilter, actionFilter],
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
    enabled: can.viewAudit,
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!can.viewAudit) return <AccessDenied message="Apenas administradores podem visualizar a auditoria." />;

  const entries = auditQ.data ?? [];
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? entries.filter((e) =>
        [e.user_email, e.record_id, JSON.stringify(e.new_data ?? e.old_data ?? "")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : entries;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <ScrollText className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Auditoria</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de alterações (últimas 500)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as tabelas</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas operações</SelectItem>
                  <SelectItem value="INSERT">Criação</SelectItem>
                  <SelectItem value="UPDATE">Edição</SelectItem>
                  <SelectItem value="DELETE">Exclusão</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar por email, ID ou conteúdo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-60"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Data/hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Campos alterados</TableHead>
                  <TableHead className="text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {auditQ.isLoading ? "Carregando..." : "Nenhum registro"}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{e.user_email ?? "—"}</TableCell>
                    <TableCell className="text-sm">{TABLE_LABELS[e.table_name] ?? e.table_name}</TableCell>
                    <TableCell>{actionBadge(e.action)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.changed_fields?.length ? e.changed_fields.join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DetailsDialog entry={e} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function DetailsDialog({ entry }: { entry: AuditEntry }) {
  const renderJson = (obj: Record<string, unknown> | null) =>
    obj ? JSON.stringify(obj, null, 2) : "—";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {TABLE_LABELS[entry.table_name] ?? entry.table_name} · {entry.action}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="text-muted-foreground">
            {new Date(entry.created_at).toLocaleString("pt-BR")} · {entry.user_email ?? "sistema"}
          </div>
          {entry.action === "UPDATE" && entry.changed_fields && entry.changed_fields.length > 0 && (
            <div>
              <div className="font-semibold mb-1">Campos alterados</div>
              <div className="rounded-md border divide-y">
                {entry.changed_fields.map((f) => (
                  <div key={f} className="grid grid-cols-3 gap-2 p-2">
                    <div className="font-mono text-muted-foreground">{f}</div>
                    <div className="font-mono text-rose-700 break-all">
                      {JSON.stringify(entry.old_data?.[f] ?? null)}
                    </div>
                    <div className="font-mono text-emerald-700 break-all">
                      {JSON.stringify(entry.new_data?.[f] ?? null)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {entry.action === "INSERT" && (
            <div>
              <div className="font-semibold mb-1">Dados criados</div>
              <pre className="rounded-md border bg-muted/30 p-3 overflow-auto">{renderJson(entry.new_data)}</pre>
            </div>
          )}
          {entry.action === "DELETE" && (
            <div>
              <div className="font-semibold mb-1">Dados removidos</div>
              <pre className="rounded-md border bg-muted/30 p-3 overflow-auto">{renderJson(entry.old_data)}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
