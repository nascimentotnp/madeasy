import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  ArrowLeft, Download, Printer, TrendingUp, Package, DollarSign, AlertTriangle,
} from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { AccessDenied } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Relatórios — Estoque" },
      { name: "description", content: "Dashboard, curva ABC e exportação de relatórios." },
    ],
  }),
  component: ReportsPage,
});

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 70% 50%))",
  "hsl(var(--chart-3, 280 65% 60%))",
  "hsl(var(--chart-4, 30 80% 55%))",
  "hsl(var(--chart-5, 150 60% 45%))",
  "hsl(var(--muted-foreground))",
];

type Product = {
  id: string; name: string; sku: string | null;
  quantity: number; min_quantity: number; price: number; cost_price: number;
  category: string | null; brand: string | null;
};

type Movement = {
  id: string; product_id: string; type: "in" | "out"; quantity: number;
  unit_price: number; created_at: string; status: string | null;
  products?: { name: string; sku: string | null; category: string | null } | null;
};

function toCSV(rows: Array<Record<string, unknown>>, filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(";")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { can, isLoading } = useMyRoles();
  const today = new Date();
  const def = new Date(today); def.setDate(def.getDate() - 30);
  const [from, setFrom] = useState(def.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  if (isLoading) return null;
  if (!can.viewReports) return <AccessDenied message="Apenas admin ou financeiro." />;

  const productsQ = useQuery({
    queryKey: ["reports", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const movementsQ = useQuery({
    queryKey: ["reports", "movements", from, to],
    queryFn: async () => {
      const start = new Date(from + "T00:00:00").toISOString();
      const end = new Date(to + "T23:59:59").toISOString();
      const { data, error } = await supabase
        .from("movements")
        .select("*, products(name, sku, category)")
        .gte("created_at", start).lte("created_at", end)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Movement[];
    },
  });

  const products = productsQ.data ?? [];
  const movements = movementsQ.data ?? [];

  // KPIs
  const sales = movements.filter((m) => m.type === "out" && m.status === "pago");
  const revenue = sales.reduce((s, m) => s + Number(m.unit_price) * m.quantity, 0);
  const unitsSold = sales.reduce((s, m) => s + m.quantity, 0);
  const stockValue = products.reduce((s, p) => s + p.quantity * Number(p.price), 0);
  const lowStock = products.filter((p) => p.quantity <= p.min_quantity).length;

  // Sales by day
  const salesByDay = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; units: number }>();
    for (const m of sales) {
      const d = m.created_at.slice(0, 10);
      const cur = map.get(d) ?? { date: d, revenue: 0, units: 0 };
      cur.revenue += Number(m.unit_price) * m.quantity;
      cur.units += m.quantity;
      map.set(d, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; units: number }>();
    for (const m of sales) {
      const key = m.product_id;
      const name = m.products?.name ?? "—";
      const cur = map.get(key) ?? { name, revenue: 0, units: 0 };
      cur.revenue += Number(m.unit_price) * m.quantity;
      cur.units += m.quantity;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales]);

  // Stock by category
  const stockByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const cat = p.category || "Sem categoria";
      map.set(cat, (map.get(cat) ?? 0) + p.quantity * Number(p.price));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [products]);

  // ABC curve: based on revenue in period
  const abc = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku: string | null; revenue: number; units: number }>();
    for (const m of sales) {
      const p = products.find((x) => x.id === m.product_id);
      const cur = map.get(m.product_id) ?? {
        id: m.product_id,
        name: p?.name ?? m.products?.name ?? "—",
        sku: p?.sku ?? m.products?.sku ?? null,
        revenue: 0, units: 0,
      };
      cur.revenue += Number(m.unit_price) * m.quantity;
      cur.units += m.quantity;
      map.set(m.product_id, cur);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const total = arr.reduce((s, x) => s + x.revenue, 0) || 1;
    let acc = 0;
    return arr.map((x) => {
      acc += x.revenue;
      const pct = (acc / total) * 100;
      const share = (x.revenue / total) * 100;
      const klass: "A" | "B" | "C" = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
      return { ...x, share, accumulated: pct, klass };
    });
  }, [sales, products]);

  const abcSummary = useMemo(() => {
    const groups = { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>;
    const rev = { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>;
    for (const r of abc) { groups[r.klass]++; rev[r.klass] += r.revenue; }
    return { groups, rev };
  }, [abc]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Button></Link>
            <h1 className="text-xl font-semibold">Relatórios & Dashboard</h1>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <Card className="print:hidden">
          <CardContent className="flex flex-wrap items-end gap-4 pt-6">
            <div>
              <Label>De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="ml-auto flex gap-2">
              <Select onValueChange={(v) => {
                const d = new Date();
                if (v === "7") d.setDate(d.getDate() - 7);
                if (v === "30") d.setDate(d.getDate() - 30);
                if (v === "90") d.setDate(d.getDate() - 90);
                if (v === "365") d.setDate(d.getDate() - 365);
                setFrom(d.toISOString().slice(0, 10));
                setTo(new Date().toISOString().slice(0, 10));
              }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Período rápido" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <KPI icon={<DollarSign className="h-4 w-4" />} label="Receita (pago)" value={formatBRL(revenue)} />
          <KPI icon={<TrendingUp className="h-4 w-4" />} label="Unidades vendidas" value={unitsSold.toString()} />
          <KPI icon={<Package className="h-4 w-4" />} label="Valor em estoque" value={formatBRL(stockValue)} />
          <KPI icon={<AlertTriangle className="h-4 w-4" />} label="Itens em baixa" value={lowStock.toString()} />
        </div>

        <Tabs defaultValue="charts">
          <TabsList className="print:hidden">
            <TabsTrigger value="charts">Gráficos</TabsTrigger>
            <TabsTrigger value="abc">Curva ABC</TabsTrigger>
            <TabsTrigger value="exports">Exportar</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Receita por dia</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Line type="monotone" dataKey="revenue" stroke={COLORS[0]} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Top 10 produtos (receita)</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                      <Bar dataKey="revenue" fill={COLORS[0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Estoque por categoria</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stockByCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                        {stockByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="abc" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <ABCSummary klass="A" count={abcSummary.groups.A} revenue={abcSummary.rev.A} total={revenue} />
              <ABCSummary klass="B" count={abcSummary.groups.B} revenue={abcSummary.rev.B} total={revenue} />
              <ABCSummary klass="C" count={abcSummary.groups.C} revenue={abcSummary.rev.C} total={revenue} />
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Curva ABC — período selecionado</CardTitle>
                <Button size="sm" variant="outline" onClick={() => toCSV(
                  abc.map((r) => ({
                    classe: r.klass, produto: r.name, sku: r.sku ?? "",
                    unidades: r.units, receita: r.revenue.toFixed(2),
                    participacao_pct: r.share.toFixed(2), acumulado_pct: r.accumulated.toFixed(2),
                  })), `curva-abc-${from}-${to}.csv`,
                )}>
                  <Download className="mr-1 h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Classe</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Unidades</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Participação</TableHead>
                      <TableHead className="text-right">Acumulado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abc.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant={r.klass === "A" ? "default" : r.klass === "B" ? "secondary" : "outline"}>{r.klass}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>{r.name}</div>
                          {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                        </TableCell>
                        <TableCell className="text-right">{r.units}</TableCell>
                        <TableCell className="text-right">{formatBRL(r.revenue)}</TableCell>
                        <TableCell className="text-right">{r.share.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{r.accumulated.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                    {abc.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem vendas no período</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exports" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Exportar dados (CSV)</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Button variant="outline" onClick={() => toCSV(
                  products.map((p) => ({
                    nome: p.name, sku: p.sku ?? "", categoria: p.category ?? "",
                    marca: p.brand ?? "", quantidade: p.quantity, minimo: p.min_quantity,
                    preco: Number(p.price).toFixed(2), custo: Number(p.cost_price).toFixed(2),
                    valor_estoque: (p.quantity * Number(p.price)).toFixed(2),
                  })), `produtos-${new Date().toISOString().slice(0, 10)}.csv`,
                )}>
                  <Download className="mr-2 h-4 w-4" /> Produtos / Inventário
                </Button>
                <Button variant="outline" onClick={() => toCSV(
                  movements.map((m) => ({
                    data: m.created_at, tipo: m.type, status: m.status ?? "",
                    produto: m.products?.name ?? "", sku: m.products?.sku ?? "",
                    quantidade: m.quantity, preco_unit: Number(m.unit_price).toFixed(2),
                    total: (Number(m.unit_price) * m.quantity).toFixed(2),
                  })), `movimentacoes-${from}-${to}.csv`,
                )}>
                  <Download className="mr-2 h-4 w-4" /> Movimentações
                </Button>
                <Button variant="outline" onClick={() => toCSV(
                  sales.map((m) => ({
                    data: m.created_at, produto: m.products?.name ?? "",
                    quantidade: m.quantity, preco: Number(m.unit_price).toFixed(2),
                    total: (Number(m.unit_price) * m.quantity).toFixed(2),
                  })), `vendas-pagas-${from}-${to}.csv`,
                )}>
                  <Download className="mr-2 h-4 w-4" /> Vendas pagas
                </Button>
                <Button variant="outline" onClick={() => toCSV(
                  products.filter((p) => p.quantity <= p.min_quantity).map((p) => ({
                    nome: p.name, sku: p.sku ?? "", quantidade: p.quantity,
                    minimo: p.min_quantity, faltam: Math.max(0, p.min_quantity - p.quantity),
                  })), `estoque-baixo-${new Date().toISOString().slice(0, 10)}.csv`,
                )}>
                  <Download className="mr-2 h-4 w-4" /> Estoque em baixa
                </Button>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              Dica: use <strong>Imprimir / PDF</strong> no topo para gerar um relatório visual em PDF dos gráficos e da curva ABC.
            </p>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ABCSummary({ klass, count, revenue, total }: { klass: "A" | "B" | "C"; count: number; revenue: number; total: number }) {
  const pct = total > 0 ? (revenue / total) * 100 : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant={klass === "A" ? "default" : klass === "B" ? "secondary" : "outline"}>Classe {klass}</Badge>
          <span className="text-sm font-normal text-muted-foreground">{count} produtos</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{formatBRL(revenue)}</div>
        <div className="text-sm text-muted-foreground">{pct.toFixed(1)}% da receita</div>
      </CardContent>
    </Card>
  );
}
