import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, Search, Trash2, Pencil, Package, AlertTriangle } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [{ title: "Produtos — Controle de Estoque" }],
  }),
  component: ProductsPage,
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

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const productLabel = (p?: { name: string; model?: string | null; size?: string | null } | null) =>
  p ? [p.name, p.model, p.size].filter(Boolean).join(" • ") : "—";

async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

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

function ProductsPage() {
  const qc = useQueryClient();
  const { can } = useMyRoles();

  const productsQ = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
  };

  const products = productsQ.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Produtos</h1>
          </div>
          {can.editProduct && <NewProductDialog onCreated={invalidate} />}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <ProductsCard products={products} loading={productsQ.isLoading} onDone={invalidate} />
      </main>
    </div>
  );
}

function ProductsCard({
  products,
  loading,
  onDone,
}: {
  products: Product[];
  loading: boolean;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const { can } = useMyRoles();

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
          <CardTitle>Catálogo de Produtos</CardTitle>
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
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
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
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can.editProduct && (
                      <>
                        <NewProductDialog product={p} onCreated={onDone} />
                        <InventoryAdjustmentDialog product={p} onDone={onDone} />
                        <DeleteProductButton id={p.id} onDone={onDone} />
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewProductDialog({
  product,
  onCreated,
}: {
  product?: Product;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [sizeValue, setSizeValue] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [minQuantity, setMinQuantity] = useState("0");
  const [price, setPrice] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || "");
      setModel(product.model || "");
      setSizeValue(product.size || "");
      setSku(product.sku || "");
      setQuantity(String(product.quantity || 0));
      setMinQuantity(String(product.min_quantity || 0));
      setPrice(String(product.price || 0));
      setCostPrice(String(product.cost_price || 0));
      setCategory(product.category || "");
      setBrand(product.brand || "");
      setColor(product.color || "");
      setBarcode(product.barcode || "");
    }
  }, [product, open]);

  const reset = () => {
    setName(""); setModel(""); setSizeValue(""); setSku("");
    setQuantity("0"); setMinQuantity("0"); setPrice("0"); setCostPrice("0");
    setCategory(""); setBrand(""); setColor(""); setBarcode("");
    setImageFile(null);
  };

  const m = useMutation({
    mutationFn: async () => {
      let imagePath: string | null = product?.image_url || null;
      if (imageFile) imagePath = await uploadProductImage(imageFile);

      const payload = {
        name: name.trim(),
        model: model.trim() || null,
        size: sizeValue.trim() || null,
        sku: sku.trim() || null,
        quantity: Number(quantity),
        min_quantity: Number(minQuantity),
        price: Number(price),
        cost_price: Number(costPrice),
        category: category.trim() || null,
        brand: brand.trim() || null,
        color: color.trim() || null,
        barcode: barcode.trim() || null,
        image_url: imagePath,
      };

      if (product) {
        // Edit mode
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (error) {
          if (error.code === "23505") {
            if (error.message.includes("barcode")) {
              throw new Error("Já existe um produto com esse código de barras.");
            }
            throw new Error("Já existe um produto com esse nome, modelo e tamanho.");
          }
          throw error;
        }
      } else {
        // Create mode
        // Insert with quantity = 0 first so the apply_movement trigger calculates correctly when we insert the initial stock movement
        const { data: newProd, error } = await supabase
          .from("products")
          .insert({ ...payload, quantity: 0 })
          .select("id")
          .single();
        if (error) {
          if (error.code === "23505") {
            if (error.message.includes("barcode")) {
              throw new Error("Já existe um produto com esse código de barras.");
            }
            throw new Error("Já existe um produto com esse nome, modelo e tamanho.");
          }
          throw error;
        }

        if (Number(quantity) > 0) {
          const { error: movErr } = await supabase.from("movements").insert({
            product_id: newProd.id,
            type: "in",
            quantity: Number(quantity),
            note: "Estoque inicial",
          });
          if (movErr) {
            // Rollback product insertion if movement creation fails
            await supabase.from("products").delete().eq("id", newProd.id);
            throw movErr;
          }
        }
      }
    },
    onSuccess: () => {
      toast.success(product ? "Produto atualizado" : "Produto criado");
      setOpen(false);
      reset();
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {product ? (
          <Button size="sm" variant="ghost" title="Editar produto">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button><Plus className="mr-1 h-4 w-4" /> Novo produto</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="np-name">Nome</Label>
            <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Camisa Flamengo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-model">Modelo</Label>
              <Input id="np-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ex: Uniforme 2" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-size">Tamanho</Label>
              <Input id="np-size" value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} placeholder="Ex: P, M, G" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-cat">Categoria</Label>
              <Input id="np-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Camisas" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-brand">Marca</Label>
              <Input id="np-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Adidas" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-color">Cor</Label>
              <Input id="np-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Preto" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-sku">SKU</Label>
              <Input id="np-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-barcode">Código de barras</Label>
              <Input id="np-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="EAN/UPC" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="np-q">Qtd.</Label>
              <Input id="np-q" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={!!product} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-min">Mínimo</Label>
              <Input id="np-min" type="number" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-cost">Custo</Label>
              <Input id="np-cost" type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-price">Venda</Label>
              <Input id="np-price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="np-img">Foto do produto</Label>
            <Input id="np-img" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
            {imageFile && <span className="text-xs text-muted-foreground">{imageFile.name}</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            A combinação de <strong>Nome + Modelo + Tamanho</strong> deve ser única. Código de barras também.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>
            {m.isPending ? "Salvando..." : product ? "Atualizar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryAdjustmentDialog({ product, onDone }: { product: Product; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState(String(product.quantity));
  const [reason, setReason] = useState("");

  const diff = Number(counted) - product.quantity;

  const m = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(Number(counted)) || Number(counted) < 0) {
        throw new Error("Quantidade contada inválida");
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("inventory_adjustments").insert({
        product_id: product.id,
        previous_quantity: product.quantity,
        counted_quantity: Number(counted),
        difference: Number(counted) - product.quantity,
        reason: reason.trim() || null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Inventário ajustado (${diff >= 0 ? "+" : ""}${diff})`);
      setOpen(false);
      setReason("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setCounted(String(product.quantity)); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Ajustar estoque">
          <AlertTriangle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar estoque — {productLabel(product)}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span className="text-muted-foreground">Estoque atual no sistema</span>
            <span className="font-semibold">{product.quantity}</span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adj-cnt">Quantidade contada (físico)</Label>
            <Input id="adj-cnt" type="number" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 text-sm">
            <span className="text-muted-foreground">Diferença</span>
            <span className={`font-semibold ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : ""}`}>
              {diff > 0 ? "+" : ""}{diff}
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adj-reason">Motivo (opcional)</Label>
            <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Contagem mensal, perda, achado..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || diff === 0}>
            {m.isPending ? "Salvando..." : "Aplicar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProductButton({ id, onDone }: { id: string; onDone: () => void }) {
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produto excluído"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => { if (confirm("Excluir este produto?")) m.mutate(); }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
