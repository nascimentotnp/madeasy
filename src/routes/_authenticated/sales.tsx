import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, ShoppingCart, Trash2, CheckCircle2, Truck, Search, History, FileText, MessageCircle, Undo2, Tag } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { downloadSalePdf, buildWhatsAppLink } from "@/lib/sale-pdf";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [{ title: "Vendas — Controle de Estoque" }],
  }),
  component: SalesPage,
});

type Product = {
  id: string;
  name: string;
  model: string | null;
  size: string | null;
  barcode: string | null;
  quantity: number;
  price: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  country: string;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
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

type SaleStatus = "proposta" | "entregue" | "pago" | "devolvida";

type SaleItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: { name: string; model: string | null; size: string | null } | null;
};

type Sale = {
  id: string;
  customer_id: string | null;
  status: SaleStatus;
  discount: number;
  total: number;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  customers: Customer | null;
  sale_items: SaleItem[];
};

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const productLabel = (p?: { name: string; model: string | null; size: string | null } | null) =>
  p ? [p.name, p.model, p.size].filter(Boolean).join(" • ") : "—";

function statusBadge(s: SaleStatus) {
  if (s === "proposta") return <Badge variant="outline" className="border-amber-500 text-amber-700">Proposta</Badge>;
  if (s === "entregue") return <Badge className="bg-blue-600 hover:bg-blue-600">Entregue</Badge>;
  if (s === "devolvida") return <Badge variant="outline" className="border-rose-500 text-rose-700">Devolvida</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pago</Badge>;
}

function SalesPage() {
  const qc = useQueryClient();
  const { can } = useMyRoles();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,name,phone").order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const salesQ = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, customers(*), sale_items(*, products(name,model,size))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const sales = salesQ.data ?? [];
  const products = productsQ.data ?? [];
  const customers = customersQ.data ?? [];

  const filtered = statusFilter === "all" ? sales : sales.filter((s) => s.status === statusFilter);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
    qc.invalidateQueries({ queryKey: ["cash_entries"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <ShoppingCart className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Vendas</h1>
          </div>
          {can.createSale && <NewSaleDialog products={products} customers={customers} onDone={invalidate} />}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Todas as vendas</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="proposta">Propostas</SelectItem>
                <SelectItem value="entregue">Entregues</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
                <SelectItem value="devolvida">Devolvidas</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {salesQ.isLoading ? "Carregando..." : "Nenhuma venda"}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{s.customers?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{s.sale_items.length}</TableCell>
                    <TableCell className="text-right font-medium">{formatBRL(Number(s.total))}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <SaleDetailsDialog sale={s} />
                        <Button size="sm" variant="ghost" title="Baixar PDF" onClick={() => downloadSalePdf(s)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Enviar no WhatsApp" asChild>
                          <a href={buildWhatsAppLink(s)} target="_blank" rel="noreferrer">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        </Button>
                        {s.customers && <PrintLabelButton sale={s} />}
                        {s.status === "proposta" && (
                          <AdvanceStatusButton sale={s} to="entregue" onDone={invalidate} />
                        )}
                        {s.status === "entregue" && (
                          <AdvanceStatusButton sale={s} to="pago" onDone={invalidate} />
                        )}
                        {(s.status === "entregue" || s.status === "pago") && can.markSalePaid && (
                          <ReturnSaleButton sale={s} onDone={invalidate} />
                        )}
                        {s.status === "proposta" && (
                          <DeleteSaleButton id={s.id} onDone={invalidate} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <CustomerHistoryCard sales={sales} customers={customers} />
      </main>
    </div>
  );
}

function CustomerHistoryCard({ sales, customers }: { sales: Sale[]; customers: Customer[] }) {
  const [customerId, setCustomerId] = useState<string>("");
  const customerSales = sales.filter((s) => s.customer_id === customerId);
  const total = customerSales.reduce((s, sa) => s + Number(sa.total), 0);
  const paidSales = customerSales.filter((s) => s.status === "pago");
  const ticketMedio = paidSales.length > 0 ? paidSales.reduce((s, sa) => s + Number(sa.total), 0) / paidSales.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" /> Histórico do cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger className="w-full md:w-96">
            <SelectValue placeholder="Selecione um cliente para ver o histórico" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {customerId && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Total comprado</div>
                <div className="text-2xl font-semibold">{formatBRL(total)}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Nº de vendas</div>
                <div className="text-2xl font-semibold">{customerSales.length}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Ticket médio (pagas)</div>
                <div className="text-2xl font-semibold">{formatBRL(ticketMedio)}</div>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerSales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {s.sale_items.map((it) => productLabel(it.products)).join(", ")}
                    </TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-right">{formatBRL(Number(s.total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type CartItem = { product: Product; quantity: number; unit_price: number };

function NewSaleDialog({
  products, customers, onDone,
}: { products: Product[]; customers: Customer[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");

  const reset = () => {
    setCustomerId(""); setDiscount("0"); setNotes(""); setCart([]); setSearch("");
  };

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return false;
    const needle = search.trim().toLowerCase();
    return [p.name, p.model, p.size, p.barcode].filter(Boolean).join(" ").toLowerCase().includes(needle);
  }).slice(0, 8);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === p.id);
      if (existing) {
        return prev.map((c) => c.product.id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product: p, quantity: 1, unit_price: Number(p.price) }];
    });
    setSearch("");
  };

  const handleBarcodeEnter = (code: string) => {
    const found = products.find((p) => p.barcode === code);
    if (found) {
      addToCart(found);
      toast.success(`+ ${productLabel(found)}`);
    } else {
      // tenta busca por nome
      const byName = products.find((p) =>
        [p.name, p.model, p.size].filter(Boolean).join(" ").toLowerCase().includes(code.toLowerCase()),
      );
      if (byName) addToCart(byName);
      else toast.error("Produto não encontrado");
    }
  };

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const m = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Adicione ao menos um item");
      if (!customerId) throw new Error("Selecione um cliente");
      for (const item of cart) {
        if (item.quantity > item.product.quantity) {
          throw new Error(`Estoque insuficiente para ${productLabel(item.product)} (disponível: ${item.product.quantity})`);
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sale, error: saleErr } = await supabase.from("sales").insert({
        customer_id: customerId,
        discount: Number(discount || 0),
        notes: notes.trim() || null,
        user_id: user?.id ?? null,
      }).select("id").single();
      if (saleErr) throw saleErr;

      const items = cart.map((c) => ({
        sale_id: sale.id,
        product_id: c.product.id,
        quantity: c.quantity,
        unit_price: c.unit_price,
      }));
      const { error: itemsErr } = await supabase.from("sale_items").insert(items);
      if (itemsErr) {
        await supabase.from("sales").delete().eq("id", sale.id);
        throw itemsErr;
      }
    },
    onSuccess: () => {
      toast.success("Venda criada");
      setOpen(false);
      reset();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" /> Nova venda</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova venda — carrinho</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Adicionar produto (digite nome ou bipe código)</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (search.trim()) handleBarcodeEnter(search.trim());
                  }
                }}
                placeholder="Buscar..."
                className="pl-8"
              />
            </div>
            {filteredProducts.length > 0 && (
              <div className="rounded-md border bg-popover divide-y">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                  >
                    <span>{productLabel(p)}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatBRL(Number(p.price))} • {p.quantity} em estoque
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-20">Qtd.</TableHead>
                  <TableHead className="w-28 text-right">Preço un.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground text-sm">Carrinho vazio</TableCell></TableRow>
                )}
                {cart.map((item, idx) => (
                  <TableRow key={item.product.id}>
                    <TableCell className="text-sm">{productLabel(item.product)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        max={item.product.quantity}
                        value={item.quantity}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value) || 1);
                          setCart((prev) => prev.map((c, i) => i === idx ? { ...c, quantity: v } : c));
                        }}
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setCart((prev) => prev.map((c, i) => i === idx ? { ...c, unit_price: v } : c));
                        }}
                        className="h-8 w-24 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right">{formatBRL(item.quantity * item.unit_price)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Desconto (R$)</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Observação</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
            <div className="text-sm text-muted-foreground">
              Subtotal: <span className="text-foreground">{formatBRL(subtotal)}</span>
              {Number(discount || 0) > 0 && <> · Desconto: <span className="text-foreground">−{formatBRL(Number(discount))}</span></>}
            </div>
            <div className="text-lg font-semibold">{formatBRL(total)}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || cart.length === 0 || !customerId}>
            {m.isPending ? "Salvando..." : "Criar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaleDetailsDialog({ sale }: { sale: Sale }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">Ver</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Venda — {sale.customers?.name ?? "Sem cliente"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {new Date(sale.created_at).toLocaleString("pt-BR")} · {statusBadge(sale.status)}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Preço un.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.sale_items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{productLabel(it.products)}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatBRL(Number(it.unit_price))}</TableCell>
                  <TableCell className="text-right">{formatBRL(Number(it.subtotal))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {Number(sale.discount) > 0 && (
            <div className="text-sm text-muted-foreground text-right">Desconto: −{formatBRL(Number(sale.discount))}</div>
          )}
          <div className="text-right text-lg font-semibold">Total: {formatBRL(Number(sale.total))}</div>
          {sale.notes && <div className="text-sm text-muted-foreground">{sale.notes}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdvanceStatusButton({ sale, to, onDone }: { sale: Sale; to: SaleStatus; onDone: () => void }) {
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales").update({ status: to }).eq("id", sale.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(to === "pago" ? "Marcada como paga" : "Marcada como entregue"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant={to === "pago" ? "default" : "outline"} onClick={() => m.mutate()} disabled={m.isPending}>
      {to === "pago" ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <Truck className="mr-1 h-4 w-4" />}
      {to === "pago" ? "Marcar pago" : "Entregar"}
    </Button>
  );
}

function DeleteSaleButton({ id, onDone }: { id: string; onDone: () => void }) {
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Venda removida"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant="ghost" onClick={() => m.mutate()} disabled={m.isPending}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function ReturnSaleButton({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales").update({ status: "devolvida" }).eq("id", sale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda devolvida — estoque e caixa atualizados");
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Registrar devolução">
          <Undo2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar devolução</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p>Confirmar a devolução desta venda?</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>Os produtos voltam para o estoque automaticamente</li>
            {sale.status === "pago" && <li>Será lançado um estorno de {formatBRL(Number(sale.total))} no caixa</li>}
            <li>A operação não pode ser desfeita</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Processando..." : "Confirmar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrintLabelButton({ sale }: { sale: Sale }) {
  const [open, setOpen] = useState(false);
  const c = sale.customers;
  if (!c) return null;

  const country = COUNTRIES[c.country as CountryCode];
  const dial = country?.dial ?? "";
  const addressLine = [c.street, c.number].filter(Boolean).join(", ");
  const cityLine = [c.city, c.state].filter(Boolean).join(" - ");
  const orderRef = sale.id.slice(0, 8).toUpperCase();

  const print = () => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta — Pedido #${esc(orderRef)}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 16px; }
        .etiqueta { border: 2px dashed #333; padding: 16px; max-width: 360px; }
        h2 { margin: 0 0 4px; font-size: 18px; }
        .row { margin: 4px 0; font-size: 14px; }
        .label { color: #666; font-size: 11px; text-transform: uppercase; }
        .order-ref { font-size: 15px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px; }
        .products { margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 13px; }
      </style></head><body><div class="etiqueta">
        <div class="order-ref">PEDIDO: # ${esc(orderRef)}</div>
        <div class="label">Destinatário</div>
        <h2>${esc(c.name)}</h2>
        <div class="row">${esc(dial)} ${esc(c.phone)}</div>
        ${addressLine ? `<div class="row">${esc(addressLine)}</div>` : ""}
        ${c.complement ? `<div class="row">${esc(c.complement)}</div>` : ""}
        ${c.neighborhood ? `<div class="row">${esc(c.neighborhood)}</div>` : ""}
        ${cityLine ? `<div class="row">${esc(cityLine)}</div>` : ""}
        ${c.cep ? `<div class="row"><span class="label">${esc(country?.postalLabel ?? "CEP")}:</span> ${esc(c.cep)}</div>` : ""}
        <div class="products">
          <div class="label">Itens do Pedido</div>
          ${sale.sale_items.map(it => `<div>${esc(productLabel(it.products))} — ${it.quantity} un.</div>`).join("")}
        </div>
      </div>
      <script>window.print();</script>
      </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    w.location.href = URL.createObjectURL(blob);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Imprimir etiqueta de entrega">
          <Tag className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Etiqueta de entrega
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border-2 border-dashed border-foreground/40 p-4 space-y-1.5">
          <div className="text-sm font-bold border-b pb-2 mb-2">
            PEDIDO: #{orderRef}
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Destinatário</div>
          <div className="text-lg font-semibold">{c.name}</div>
          <div className="text-sm">{dial} {c.phone}</div>
          {addressLine && <div className="text-sm">{addressLine}</div>}
          {c.complement && <div className="text-sm text-muted-foreground">{c.complement}</div>}
          {c.neighborhood && <div className="text-sm">{c.neighborhood}</div>}
          {cityLine && <div className="text-sm">{cityLine}</div>}
          {c.cep && (
            <div className="text-sm">
              <span className="text-muted-foreground">{country?.postalLabel ?? "CEP"}:</span> {c.cep}
            </div>
          )}
          <div className="border-t pt-3 mt-3 space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Itens do Pedido</div>
            {sale.sale_items.map((it) => (
              <div key={it.id} className="text-sm font-medium">
                {productLabel(it.products)} x {it.quantity}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          <Button onClick={print}>Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
