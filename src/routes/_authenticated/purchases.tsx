import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, Plus, ClipboardList, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { AccessDenied } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Compras — Controle de Estoque" }] }),
  component: PurchasesPage,
});

const formatBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; sku: string | null; cost_price: number | null };
type PurchaseOrder = {
  id: string;
  supplier_id: string;
  status: "draft" | "received" | "cancelled";
  order_date: string;
  received_at: string | null;
  total: number;
  notes: string | null;
  created_at: string;
  suppliers: { name: string } | null;
};
type DraftItem = { product_id: string; quantity: number; unit_cost: number };

function PurchasesPage() {
  const { can, isLoading } = useMyRoles();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const suppliersQ = useQuery({
    queryKey: ["suppliers", "list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !isLoading && can.managePurchases,
  });

  const productsQ = useQuery({
    queryKey: ["products", "list-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku, cost_price").order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !isLoading && can.managePurchases,
  });

  const ordersQ = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name)")
        .order("order_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !isLoading && can.managePurchases,
  });

  const total = useMemo(
    () => items.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0),
    [items],
  );

  const createMut = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Selecione um fornecedor");
      const valid = items.filter((i) => i.product_id && i.quantity > 0 && i.unit_cost >= 0);
      if (valid.length === 0) throw new Error("Adicione pelo menos um item");

      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert({ supplier_id: supplierId, notes: notes || null })
        .select("id")
        .single();
      if (error) throw error;

      const rows = valid.map((i) => ({
        purchase_order_id: po.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      }));
      const { error: iErr } = await supabase.from("purchase_items").insert(rows);
      if (iErr) throw iErr;
    },
    onSuccess: () => {
      toast.success("Pedido criado");
      setOpen(false);
      setSupplierId("");
      setNotes("");
      setItems([]);
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const receiveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "received" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido recebido — estoque atualizado");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido cancelado");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!can.managePurchases) return <AccessDenied message="Apenas admin, financeiro ou estoquista." />;

  const products = productsQ.data ?? [];
  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((arr) => [...arr, { product_id: "", quantity: 1, unit_cost: 0 }]);

  return (
    <div className="min-h-screen bg-muted/30">
      <Toaster richColors />
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" />Compras</h1>
              <p className="text-sm text-muted-foreground">Pedidos a fornecedores — ao receber, atualiza o estoque</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Novo pedido</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Novo pedido de compra</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Fornecedor *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {(suppliersQ.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Total estimado</Label>
                    <div className="h-9 flex items-center font-bold text-lg">{formatBRL(total)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Itens</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addItem}>
                      <Plus className="mr-1 h-3 w-3" />Adicionar item
                    </Button>
                  </div>
                  {items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum item. Clique em "Adicionar item".</p>
                  )}
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6 space-y-1">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={it.product_id}
                          onValueChange={(v) => {
                            const p = products.find((pp) => pp.id === v);
                            updateItem(idx, {
                              product_id: v,
                              unit_cost: it.unit_cost || Number(p?.cost_price ?? 0),
                            });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}{p.sku ? ` (${p.sku})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Custo unit.</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.unit_cost}
                          onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" size="sm" variant="ghost"
                          onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>Criar pedido</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main className="container mx-auto py-6 px-4">
        <Card>
          <CardHeader><CardTitle>Pedidos de compra</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Recebido em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ordersQ.data ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{new Date(o.order_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{o.suppliers?.name ?? "—"}</TableCell>
                    <TableCell>
                      {o.status === "draft" && <Badge variant="outline">Rascunho</Badge>}
                      {o.status === "received" && <Badge className="bg-emerald-600">Recebido</Badge>}
                      {o.status === "cancelled" && <Badge variant="destructive">Cancelado</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(o.total))}</TableCell>
                    <TableCell>{o.received_at ? new Date(o.received_at).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-right">
                      {o.status === "draft" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (confirm("Confirmar recebimento? Estoque e custo médio serão atualizados.")) {
                              receiveMut.mutate(o.id);
                            }
                          }}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (confirm("Cancelar este pedido?")) cancelMut.mutate(o.id);
                          }}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(ordersQ.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum pedido.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
