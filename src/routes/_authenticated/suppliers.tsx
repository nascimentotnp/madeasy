import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, Plus, Truck, Pencil, Trash2 } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { AccessDenied } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Fornecedores — Controle de Estoque" }] }),
  component: SuppliersPage,
});

type Supplier = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

type FormState = Omit<Supplier, "id" | "created_at">;

const emptyForm: FormState = { name: "", document: "", phone: "", email: "", address: "", notes: "" };

function SuppliersPage() {
  const { can, isLoading } = useMyRoles();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const q = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !isLoading && can.manageSuppliers,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome");
      const payload = {
        name: form.name.trim(),
        document: form.document || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Fornecedor atualizado" : "Fornecedor criado");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor excluído");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (!can.manageSuppliers) return <AccessDenied message="Apenas admin ou financeiro." />;

  const startEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      document: s.document ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
    setOpen(true);
  };

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

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
              <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" />Fornecedores</h1>
              <p className="text-sm text-muted-foreground">Cadastre quem fornece seus produtos</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />Novo fornecedor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>CNPJ / Documento</Label>
                    <Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Endereço</Label>
                  <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Observações</Label>
                  <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      <main className="container mx-auto py-6 px-4">
        <Card>
          <CardHeader><CardTitle>Lista de fornecedores</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.document ?? "—"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell>{s.email ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`Excluir fornecedor "${s.name}"?`)) delMut.mutate(s.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(q.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum fornecedor cadastrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
