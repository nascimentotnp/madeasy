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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, Plus, DollarSign, Wallet, Receipt, CreditCard, LockOpen, Lock, CheckCircle2 } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { AccessDenied } from "@/components/app-sidebar";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Financeiro — Controle de Estoque" }] }),
  component: FinancePage,
});

const formatBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PaymentMethod = { id: string; name: string; fee_percent: number; active: boolean };
type Expense = {
  id: string;
  description: string;
  category: string | null;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  payment_method_id: string | null;
  status: "pendente" | "pago" | "cancelado";
  notes: string | null;
};
type CashSession = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  notes: string | null;
};
type CashEntry = {
  id: string;
  amount: number;
  description: string | null;
  entry_type: string;
  created_at: string;
  cash_session_id: string | null;
};
type SaleRow = {
  id: string;
  total: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  customers: { name: string } | null;
};

function FinancePage() {
  const { can, isLoading } = useMyRoles();
  if (isLoading) return null;
  if (!can.viewFinance) return <AccessDenied message="Apenas admin ou financeiro." />;
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
              <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" />Financeiro</h1>
              <p className="text-sm text-muted-foreground">Despesas, recebimentos, caixa e formas de pagamento</p>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto py-6 px-4">
        <Tabs defaultValue="cash" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cash"><Wallet className="mr-2 h-4 w-4" />Caixa</TabsTrigger>
            <TabsTrigger value="expenses"><Receipt className="mr-2 h-4 w-4" />Despesas</TabsTrigger>
            <TabsTrigger value="receivables"><DollarSign className="mr-2 h-4 w-4" />A Receber</TabsTrigger>
            <TabsTrigger value="methods"><CreditCard className="mr-2 h-4 w-4" />Formas de Pagamento</TabsTrigger>
          </TabsList>
          <TabsContent value="cash"><CashTab /></TabsContent>
          <TabsContent value="expenses"><ExpensesTab /></TabsContent>
          <TabsContent value="receivables"><ReceivablesTab /></TabsContent>
          <TabsContent value="methods"><PaymentMethodsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- CASH ---------------- */
function CashTab() {
  const qc = useQueryClient();
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const sessionsQ = useQuery({
    queryKey: ["cash_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_sessions").select("*").order("opened_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as CashSession[];
    },
  });

  const openSession = sessionsQ.data?.find((s) => !s.closed_at) ?? null;

  const entriesQ = useQuery({
    queryKey: ["cash_entries", openSession?.id ?? "none"],
    enabled: !!openSession,
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_entries").select("*").eq("cash_session_id", openSession!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as CashEntry[];
    },
  });

  const expected = useMemo(() => {
    const sum = (entriesQ.data ?? []).reduce((acc, e) => acc + Number(e.amount), 0);
    return Number(openSession?.opening_balance ?? 0) + sum;
  }, [entriesQ.data, openSession]);

  const openMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cash_sessions").insert({ opening_balance: Number(openingBalance) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Caixa aberto"); qc.invalidateQueries({ queryKey: ["cash_sessions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: async () => {
      if (!openSession) throw new Error("Sem caixa aberto");
      const cb = Number(closingBalance);
      const { error } = await supabase.from("cash_sessions").update({
        closed_at: new Date().toISOString(),
        closing_balance: cb,
        expected_balance: expected,
        difference: cb - expected,
        notes: closeNotes || null,
      }).eq("id", openSession.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Caixa fechado"); setClosingBalance(""); setCloseNotes(""); qc.invalidateQueries({ queryKey: ["cash_sessions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const movementMut = useMutation({
    mutationFn: async (p: { type: "aporte" | "sangria"; amount: number; description: string }) => {
      if (!openSession) throw new Error("Sem caixa aberto");
      const signed = p.type === "aporte" ? Math.abs(p.amount) : -Math.abs(p.amount);
      const { error } = await supabase.from("cash_entries").insert({
        amount: signed, description: p.description, entry_type: p.type, cash_session_id: openSession.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento registrado"); qc.invalidateQueries({ queryKey: ["cash_entries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status do caixa</CardTitle></CardHeader>
          <CardContent>
            {openSession ? (
              <Badge className="bg-emerald-600"><LockOpen className="mr-1 h-3 w-3" />Aberto</Badge>
            ) : (
              <Badge variant="outline"><Lock className="mr-1 h-3 w-3" />Fechado</Badge>
            )}
            {openSession && (
              <p className="mt-2 text-xs text-muted-foreground">Aberto em {new Date(openSession.opened_at).toLocaleString("pt-BR")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo inicial</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{formatBRL(Number(openSession?.opening_balance ?? 0))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo esperado</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{formatBRL(expected)}</CardContent>
        </Card>
      </div>

      {!openSession ? (
        <Card>
          <CardHeader><CardTitle>Abrir caixa</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Saldo inicial</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => openMut.mutate()} disabled={openMut.isPending}><LockOpen className="mr-2 h-4 w-4" />Abrir caixa</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <CashMovementForm onSubmit={(p) => movementMut.mutate(p)} />
          <Card>
            <CardHeader><CardTitle>Fechar caixa</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Saldo contado</Label>
                <Input type="number" step="0.01" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} placeholder={String(expected.toFixed(2))} />
              </div>
              <div className="space-y-1">
                <Label>Observações</Label>
                <Textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} rows={2} />
              </div>
              {closingBalance && (
                <p className="text-sm">Diferença: <span className={Number(closingBalance) - expected === 0 ? "text-emerald-700" : "text-red-700"}>{formatBRL(Number(closingBalance) - expected)}</span></p>
              )}
              <Button onClick={() => closeMut.mutate()} disabled={closeMut.isPending || !closingBalance} variant="destructive"><Lock className="mr-2 h-4 w-4" />Fechar caixa</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {openSession && (
        <Card>
          <CardHeader><CardTitle>Lançamentos da sessão</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {(entriesQ.data ?? []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline">{e.entry_type}</Badge></TableCell>
                    <TableCell>{e.description ?? "—"}</TableCell>
                    <TableCell className={`text-right font-mono ${Number(e.amount) < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatBRL(Number(e.amount))}</TableCell>
                  </TableRow>
                ))}
                {(entriesQ.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem lançamentos.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico de fechamentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Abertura</TableHead><TableHead>Fechamento</TableHead><TableHead className="text-right">Inicial</TableHead><TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Contado</TableHead><TableHead className="text-right">Diferença</TableHead></TableRow></TableHeader>
            <TableBody>
              {(sessionsQ.data ?? []).filter((s) => s.closed_at).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.opened_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{s.closed_at ? new Date(s.closed_at).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(s.opening_balance))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(s.expected_balance ?? 0))}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(s.closing_balance ?? 0))}</TableCell>
                  <TableCell className={`text-right font-mono ${Number(s.difference ?? 0) === 0 ? "" : "text-red-700"}`}>{formatBRL(Number(s.difference ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CashMovementForm({ onSubmit }: { onSubmit: (p: { type: "aporte" | "sangria"; amount: number; description: string }) => void }) {
  const [type, setType] = useState<"aporte" | "sangria">("aporte");
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle>Aporte / Sangria</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as "aporte" | "sangria")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aporte">Aporte (entrada)</SelectItem>
                <SelectItem value="sangria">Sangria (saída)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Descrição</Label>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <Button onClick={() => { if (!amount) return; onSubmit({ type, amount: Number(amount), description: desc }); setAmount(""); setDesc(""); }}>
          <Plus className="mr-2 h-4 w-4" />Lançar
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- EXPENSES ---------------- */
function ExpensesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const methodsQ = useQuery({
    queryKey: ["payment_methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("*").order("name");
      if (error) throw error;
      return data as PaymentMethod[];
    },
  });

  const expensesQ = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const payMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Despesa marcada como paga"); qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["cash_entries"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (expensesQ.data ?? []).filter((e) => statusFilter === "all" || e.status === statusFilter);
  const totals = useMemo(() => {
    const list = expensesQ.data ?? [];
    return {
      pendente: list.filter((e) => e.status === "pendente").reduce((a, e) => a + Number(e.amount), 0),
      pago: list.filter((e) => e.status === "pago").reduce((a, e) => a + Number(e.amount), 0),
    };
  }, [expensesQ.data]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A pagar</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-amber-700">{formatBRL(totals.pendente)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pago</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-700">{formatBRL(totals.pago)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Despesas</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
                <SelectItem value="cancelado">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova despesa</Button></DialogTrigger>
              <NewExpenseDialog methods={methodsQ.data ?? []} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["expenses"] }); }} />
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const overdue = e.status === "pendente" && e.due_date && new Date(e.due_date) < new Date(new Date().toDateString());
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell>{e.category ?? "—"}</TableCell>
                    <TableCell>
                      {e.due_date ? new Date(e.due_date).toLocaleDateString("pt-BR") : "—"}
                      {overdue && <Badge variant="destructive" className="ml-2">Atrasada</Badge>}
                    </TableCell>
                    <TableCell>
                      {e.status === "pago" ? <Badge className="bg-emerald-600">Pago</Badge>
                        : e.status === "cancelado" ? <Badge variant="outline">Cancelado</Badge>
                        : <Badge variant="outline" className="border-amber-500 text-amber-700">Pendente</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(e.amount))}</TableCell>
                    <TableCell className="text-right">
                      {e.status === "pendente" && (
                        <Button size="sm" variant="outline" onClick={() => payMut.mutate(e.id)}><CheckCircle2 className="mr-1 h-3 w-3" />Pagar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem despesas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewExpenseDialog({ methods, onDone }: { methods: PaymentMethod[]; onDone: () => void }) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("none");
  const [recurring, setRecurring] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [payNow, setPayNow] = useState(false);

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        description, category: category || null, amount: Number(amount),
        due_date: dueDate || null,
        payment_method_id: paymentMethodId === "none" ? null : paymentMethodId,
        recurring: recurring === "none" ? null : recurring,
        notes: notes || null,
        status: payNow ? "pago" : "pendente",
        paid_at: payNow ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Despesa criada"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label>Descrição*</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Aluguel, Fornecedor..." /></div>
          <div className="space-y-1"><Label>Valor*</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Forma de pagamento</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Recorrência</Label>
          <Select value={recurring} onValueChange={setRecurring}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não recorrente</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="anual">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} /> Já está paga (lançar no caixa agora)
        </label>
      </div>
      <DialogFooter>
        <Button onClick={() => mut.mutate()} disabled={!description || !amount || mut.isPending}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- RECEIVABLES ---------------- */
function ReceivablesTab() {
  const qc = useQueryClient();
  const salesQ = useQuery({
    queryKey: ["sales_receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,total,status,due_date,paid_at,created_at,customers(name)")
        .in("status", ["entregue", "proposta"])
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as SaleRow[];
    },
  });

  const payMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").update({ status: "pago" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Venda marcada como paga"); qc.invalidateQueries({ queryKey: ["sales_receivables"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = salesQ.data ?? [];
  const total = list.reduce((a, s) => a + Number(s.total), 0);
  const overdueTotal = list.filter((s) => s.due_date && new Date(s.due_date) < new Date(new Date().toDateString())).reduce((a, s) => a + Number(s.total), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">A receber</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-700">{formatBRL(total)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencidas</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-red-700">{formatBRL(overdueTotal)}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Contas a receber</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Status</TableHead><TableHead>Criada</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((s) => {
                const overdue = s.due_date && new Date(s.due_date) < new Date(new Date().toDateString());
                return (
                  <TableRow key={s.id}>
                    <TableCell>{s.customers?.name ?? "—"}</TableCell>
                    <TableCell>{s.status === "entregue" ? <Badge className="bg-blue-600">Entregue</Badge> : <Badge variant="outline" className="border-amber-500 text-amber-700">Proposta</Badge>}</TableCell>
                    <TableCell>{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{s.due_date ? new Date(s.due_date).toLocaleDateString("pt-BR") : "—"}{overdue && <Badge variant="destructive" className="ml-2">Vencida</Badge>}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(s.total))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => payMut.mutate(s.id)}><CheckCircle2 className="mr-1 h-3 w-3" />Receber</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nada a receber.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- PAYMENT METHODS ---------------- */
function PaymentMethodsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fee, setFee] = useState("0");

  const methodsQ = useQuery({
    queryKey: ["payment_methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("*").order("name");
      if (error) throw error;
      return data as PaymentMethod[];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payment_methods").insert({ name, fee_percent: Number(fee) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Forma adicionada"); setName(""); setFee("0"); qc.invalidateQueries({ queryKey: ["payment_methods"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (m: PaymentMethod) => {
      const { error } = await supabase.from("payment_methods").update({ active: !m.active }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_methods"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Nova forma de pagamento</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="w-56" /></div>
          <div className="space-y-1"><Label>Taxa (%)</Label><Input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} className="w-28" /></div>
          <Button onClick={() => addMut.mutate()} disabled={!name || addMut.isPending}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Cadastradas</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="text-right">Taxa</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(methodsQ.data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-right font-mono">{Number(m.fee_percent).toFixed(2)}%</TableCell>
                  <TableCell>{m.active ? <Badge className="bg-emerald-600">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggleMut.mutate(m)}>{m.active ? "Desativar" : "Ativar"}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
