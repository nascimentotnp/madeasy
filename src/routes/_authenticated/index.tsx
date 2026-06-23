import { createFileRoute, Link } from "@tanstack/react-router";
import { useMyRoles } from "@/hooks/use-my-roles";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { ArrowDown, ArrowUp, Package, Search, AlertTriangle, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Controle de Estoque" },
      { name: "description", content: "Painel informativo de controle de estoque com propostas de venda, clientes e caixa." },
    ],
  }),
  component: InventoryPage,
});

type Product = {
  id: string;
  name: string;
  model: string | null;
  size: string | null;
  sku: string | null;
  quantity: number;
  min_quantity: number;
  price: number;
  category: string | null;
  brand: string | null;
  color: string | null;
  barcode: string | null;
  cost_price: number;
  image_url: string | null;
};

type SaleStatus = "proposta" | "entregue" | "pago" | "devolvida";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  country: string;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

type Movement = {
  id: string;
  product_id: string;
  type: "in" | "out";
  quantity: number;
  note: string | null;
  created_at: string;
  returned_from_id: string | null;
  customer_id: string | null;
  status: SaleStatus | null;
  unit_price: number;
  products?: { name: string; model: string | null; size: string | null } | null;
  customers?: Customer | null;
};

type CountryCode = "BR" | "US" | "PT" | "AR";
const COUNTRIES: Record<CountryCode, {
  label: string;
  dial: string;
  phoneHint: string;
  phoneMaxDigits: number;
  postalLabel: string;
  postalMaxDigits: number;
}> = {
  BR: { label: "Brasil (+55)", dial: "+55", phoneHint: "DDD + número, ex: 21999999999", phoneMaxDigits: 11, postalLabel: "CEP", postalMaxDigits: 8 },
  US: { label: "EUA (+1)", dial: "+1", phoneHint: "Área + número, ex: 2125550123", phoneMaxDigits: 10, postalLabel: "ZIP", postalMaxDigits: 5 },
  PT: { label: "Portugal (+351)", dial: "+351", phoneHint: "9 dígitos, ex: 912345678", phoneMaxDigits: 9, postalLabel: "Código postal", postalMaxDigits: 7 },
  AR: { label: "Argentina (+54)", dial: "+54", phoneHint: "Área + número, ex: 1123456789", phoneMaxDigits: 10, postalLabel: "Código postal", postalMaxDigits: 8 },
};

type CashEntry = {
  id: string;
  movement_id: string;
  amount: number;
  description: string | null;
  created_at: string;
};

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const productLabel = (p?: { name: string; model?: string | null; size?: string | null } | null) =>
  p ? [p.name, p.model, p.size].filter(Boolean).join(" • ") : "—";

function useSignedImageUrl(path: string | null) {
  return useQuery({
    queryKey: ["product-image", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from("product-images")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

function ProductThumb({ path }: { path: string | null }) {
  const { data: url } = useSignedImageUrl(path);
  if (!path) return <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>;
  if (!url) return <div className="h-10 w-10 rounded bg-muted animate-pulse" />;
  return <img src={url} alt="" className="h-10 w-10 rounded object-cover" />;
}

function InventoryPage() {
  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const movementsQ = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select("*, products(name,model,size), customers(name,phone,country,cep,street,number,complement,neighborhood,city,state)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Movement[];
    },
  });

  const cashQ = useQuery({
    queryKey: ["cash_entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_entries").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CashEntry[];
    },
  });

  const products = productsQ.data ?? [];
  const customers = customersQ.data ?? [];
  const movements = movementsQ.data ?? [];
  const cashEntries = cashQ.data ?? [];

  const totalItems = products.reduce((s, p) => s + p.quantity, 0);
  const totalValue = products.reduce((s, p) => s + p.quantity * Number(p.price), 0);
  const lowStock = products.filter((p) => p.quantity <= p.min_quantity);
  const cashTotal = cashEntries.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Ações de gerenciamento movidas para suas respectivas páginas */}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Produtos" value={products.length.toString()} />
          <StatCard label="Itens em estoque" value={totalItems.toString()} />
          <StatCard label="Valor em estoque" value={formatBRL(totalValue)} />
          <StatCard label="Caixa (vendas pagas)" value={formatBRL(cashTotal)} />
        </div>

        {lowStock.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm">Estoque baixo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {lowStock.map((p) => p.name).join(", ")}
            </CardContent>
          </Card>
        )}

        <ProductsCard products={products} loading={productsQ.isLoading} />

        <SalesCard movements={movements} />

        <MovementsCard movements={movements} />

        <CustomersCard customers={customers} />

        <CashCard entries={cashEntries} movements={movements} />
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ProductsCard({
  products,
  loading,
}: {
  products: Product[];
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[];

  const filtered = products.filter((p) => {
    if (cat !== "all" && p.category !== cat) return false;
    if (brand !== "all" && p.brand !== brand) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const hay = [p.name, p.model, p.size, p.sku, p.barcode, p.category, p.brand, p.color]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Resumo de Produtos</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, SKU, barras..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas marcas</SelectItem>
                {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Cód. Barras</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  {loading ? "Carregando..." : products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto corresponde ao filtro"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell><ProductThumb path={p.image_url} /></TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.model ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.size ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{p.barcode ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {p.quantity <= p.min_quantity ? (
                    <Badge variant="destructive">{p.quantity}</Badge>
                  ) : (
                    <span>{p.quantity}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{formatBRL(Number(p.cost_price))}</TableCell>
                <TableCell className="text-right">{formatBRL(Number(p.price))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function statusBadge(status: SaleStatus | null) {
  if (status === "proposta")
    return <Badge variant="outline" className="border-amber-500 text-amber-700">Proposta</Badge>;
  if (status === "entregue")
    return <Badge className="bg-blue-600 hover:bg-blue-600">Entregue</Badge>;
  if (status === "pago")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>;
  if (status === "devolvida")
    return <Badge variant="outline" className="border-rose-500 text-rose-700">Devolvida</Badge>;
  return <span className="text-muted-foreground text-xs">—</span>;
}

function SalesCard({
  movements,
}: {
  movements: Movement[];
}) {
  const sales = movements.filter((m) => m.type === "out" && m.returned_from_id === null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendas Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhuma venda registrada
                </TableCell>
              </TableRow>
            )}
            {sales.map((m) => {
              const total = Number(m.unit_price) * m.quantity;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{productLabel(m.products)}</TableCell>
                  <TableCell>{m.customers?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">{m.quantity}</TableCell>
                  <TableCell className="text-right">{formatBRL(total)}</TableCell>
                  <TableCell>{statusBadge(m.status)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MovementsCard({
  movements,
}: {
  movements: Movement[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimentações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead>Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sem movimentações ainda
                </TableCell>
              </TableRow>
            )}
            {movements.map((m) => {
              const isReturnedSaida = m.type === "out" && movements.some((mv) => mv.returned_from_id === m.id);
              const isDevolucao = m.returned_from_id !== null;
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {productLabel(m.products)}
                    {isReturnedSaida && (
                      <Badge variant="outline" className="ml-2 text-xs">Devolvida</Badge>
                    )}
                    {isDevolucao && (
                      <Badge variant="outline" className="ml-2 text-xs">Devolução</Badge>
                    )}
                    {m.type === "out" && !isReturnedSaida && (
                      <span className="ml-2">{statusBadge(m.status)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.type === "in" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">
                        <ArrowDown className="mr-1 h-3 w-3" /> Entrada
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <ArrowUp className="mr-1 h-3 w-3" /> Saída
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{m.note ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CustomersCard({
  customers,
}: {
  customers: Customer[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clientes Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum cliente cadastrado
                </TableCell>
              </TableRow>
            )}
            {customers.map((c) => {
              const country = COUNTRIES[c.country as CountryCode];
              const dial = country?.dial ?? "";
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone ? `${dial} ${c.phone}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.cep ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.city ? `${c.city}${c.state ? "/" + c.state : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CashCard({ entries, movements }: { entries: CashEntry[]; movements: Movement[] }) {
  const movementById = new Map(movements.map((m) => [m.id, m]));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Caixa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhuma entrada de caixa ainda. Finalize uma venda para registrar.
                </TableCell>
              </TableRow>
            )}
            {entries.map((e) => {
              const mv = movementById.get(e.movement_id);
              return (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>{productLabel(mv?.products)}</TableCell>
                  <TableCell>{mv?.customers?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatBRL(Number(e.amount))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
