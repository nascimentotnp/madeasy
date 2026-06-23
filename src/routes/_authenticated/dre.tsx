import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { AccessDenied } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({ meta: [{ title: "DRE e Projeção — Controle de Estoque" }] }),
  component: DrePage,
});

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PaidSaleItem = {
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: { cost_price: number | null } | null;
};
type PaidSale = {
  id: string;
  status: string;
  total: number;
  paid_at: string | null;
  created_at: string;
  sale_items: PaidSaleItem[];
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  status: "pendente" | "pago" | "cancelado";
  due_date: string | null;
  paid_at: string | null;
  category: string | null;
};

type ReceivableSale = {
  id: string;
  total: number;
  due_date: string | null;
  created_at: string;
  status: string;
  customers: { name: string } | null;
};

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function DrePage() {
  const { can, isLoading } = useMyRoles();
  const [ym, setYm] = useState(currentMonth());
  const { start, end } = useMemo(() => monthBounds(ym), [ym]);

  const salesQ = useQuery({
    queryKey: ["dre-sales", ym],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,status,total,paid_at,created_at,sale_items(quantity,unit_price,subtotal,products(cost_price))")
        .in("status", ["pago", "devolvida"])
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;
      return (data ?? []) as PaidSale[];
    },
    enabled: can.viewFinance,
  });

  const expensesQ = useQuery({
    queryKey: ["dre-expenses", ym],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("created_at", start)
        .lt("created_at", end);
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    enabled: can.viewFinance,
  });

  const futureExpensesQ = useQuery({
    queryKey: ["dre-future-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("status", "pendente")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    enabled: can.viewFinance,
  });

  const receivablesQ = useQuery({
    queryKey: ["dre-receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,total,due_date,created_at,status,customers(name)")
        .eq("status", "entregue")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as ReceivableSale[];
    },
    enabled: can.viewFinance,
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!can.viewFinance) return <AccessDenied message="Apenas o financeiro pode visualizar o DRE." />;

  const sales = salesQ.data ?? [];
  const paid = sales.filter((s) => s.status === "pago");
  const returned = sales.filter((s) => s.status === "devolvida");

  const grossRevenue = paid.reduce((s, x) => s + Number(x.total), 0);
  const returns = returned.reduce((s, x) => s + Number(x.total), 0);
  const netRevenue = grossRevenue - returns;

  const cogs = paid.reduce(
    (s, x) =>
      s +
      x.sale_items.reduce(
        (ss, it) => ss + Number(it.products?.cost_price ?? 0) * Number(it.quantity),
        0,
      ),
    0,
  );

  const grossProfit = netRevenue - cogs;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  const expenses = expensesQ.data ?? [];
  const paidExpenses = expenses.filter((e) => e.status === "pago");
  const opex = paidExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = grossProfit - opex;
  const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // Projection: next 30/60/90 days
  const today = new Date();
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };
  const futureExp = futureExpensesQ.data ?? [];
  const receivables = receivablesQ.data ?? [];
  const sumInRange = <T extends { amount?: number; total?: number; due_date: string | null }>(
    items: T[],
    days: number,
  ) => {
    const limit = inDays(days);
    return items
      .filter((i) => i.due_date && new Date(i.due_date) <= limit)
      .reduce((s, i) => s + Number(i.amount ?? i.total ?? 0), 0);
  };

  const exp30 = sumInRange(futureExp, 30);
  const exp60 = sumInRange(futureExp, 60);
  const exp90 = sumInRange(futureExp, 90);
  const rec30 = sumInRange(receivables, 30);
  const rec60 = sumInRange(receivables, 60);
  const rec90 = sumInRange(receivables, 90);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Wallet className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">DRE e Fluxo de Caixa Projetado</h1>
          </div>
          <Select value={ym} onValueChange={setYm}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }).map((_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                return <SelectItem key={v} value={v}>{d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Demonstrativo de Resultado (DRE)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <DreRow label="Receita bruta de vendas" value={grossRevenue} />
                <DreRow label="(−) Devoluções" value={-returns} muted />
                <DreRow label="Receita líquida" value={netRevenue} bold />
                <DreRow label="(−) Custo das mercadorias vendidas (CMV)" value={-cogs} muted />
                <DreRow label={`Lucro bruto (margem: ${grossMargin.toFixed(1)}%)`} value={grossProfit} bold positive={grossProfit >= 0} />
                <DreRow label="(−) Despesas operacionais (pagas)" value={-opex} muted />
                <DreRow
                  label={`Resultado líquido (margem: ${netMargin.toFixed(1)}%)`}
                  value={netProfit}
                  bold
                  positive={netProfit >= 0}
                />
              </TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground">
              Considera vendas pagas e devolvidas, despesas com status "pago" e custo médio dos produtos no momento da venda.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> A receber
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ProjRow label="Próximos 30 dias" value={rec30} />
              <ProjRow label="Próximos 60 dias" value={rec60} />
              <ProjRow label="Próximos 90 dias" value={rec90} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4 text-rose-600" /> A pagar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ProjRow label="Próximos 30 dias" value={exp30} expense />
              <ProjRow label="Próximos 60 dias" value={exp60} expense />
              <ProjRow label="Próximos 90 dias" value={exp90} expense />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo projetado</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: "30 dias", r: rec30, e: exp30 },
                  { label: "60 dias", r: rec60, e: exp60 },
                  { label: "90 dias", r: rec90, e: exp90 },
                ].map((row) => {
                  const bal = row.r - row.e;
                  return (
                    <TableRow key={row.label}>
                      <TableCell>{row.label}</TableCell>
                      <TableCell className="text-right text-emerald-700">{BRL(row.r)}</TableCell>
                      <TableCell className="text-right text-rose-700">−{BRL(row.e)}</TableCell>
                      <TableCell className={`text-right font-semibold ${bal >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {BRL(bal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Contas a pagar pendentes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {futureExp.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground text-sm">Nenhuma conta pendente</TableCell></TableRow>
                )}
                {futureExp.slice(0, 20).map((e) => {
                  const overdue = e.due_date && new Date(e.due_date) < today;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{e.category ?? "—"}</TableCell>
                      <TableCell className="text-sm">{e.due_date ? new Date(e.due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right">{BRL(Number(e.amount))}</TableCell>
                      <TableCell>{overdue && <Badge variant="destructive">Vencida</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vendas a receber</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Venda</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground text-sm">Nenhuma venda a receber</TableCell></TableRow>
                )}
                {receivables.slice(0, 20).map((r) => {
                  const overdue = r.due_date && new Date(r.due_date) < today;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.customers?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-sm">{r.due_date ? new Date(r.due_date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right">{BRL(Number(r.total))}</TableCell>
                      <TableCell>{overdue && <Badge variant="destructive">Vencida</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function DreRow({ label, value, bold, muted, positive }: { label: string; value: number; bold?: boolean; muted?: boolean; positive?: boolean }) {
  return (
    <TableRow className={bold ? "border-t-2" : ""}>
      <TableCell className={`${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""}`}>{label}</TableCell>
      <TableCell className={`text-right ${bold ? "font-semibold text-base" : ""} ${positive === false ? "text-rose-700" : positive === true ? "text-emerald-700" : ""}`}>
        {BRL(value)}
      </TableCell>
    </TableRow>
  );
}

function ProjRow({ label, value, expense }: { label: string; value: number; expense?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold ${expense ? "text-rose-700" : "text-emerald-700"}`}>
        {expense ? "−" : ""}{BRL(value)}
      </span>
    </div>
  );
}
