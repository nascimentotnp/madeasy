import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, KeyRound, Loader2, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import {
  createUser,
  deleteUser,
  listUsers,
  myRoles,
  resetUserPassword,
  updateUserRoles,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ALL_ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Acesso total" },
  { value: "vendedor", label: "Vendedor", desc: "Cria propostas, edita clientes" },
  { value: "financeiro", label: "Financeiro", desc: "Marca como pago, acessa caixa" },
  { value: "estoquista", label: "Estoquista", desc: "Movimenta produtos no estoque" },
];

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const fetchUsers = useServerFn(listUsers);
  const fetchMyRoles = useServerFn(myRoles);
  const qc = useQueryClient();

  const { data: roles } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => fetchMyRoles({ data: undefined }),
  });
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers({ data: undefined }),
    enabled: roles?.includes("admin"),
  });

  if (roles && !roles.includes("admin")) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Acesso restrito a administradores.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Voltar ao app
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6" /> Usuários do sistema
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie acessos e papéis dos usuários.</p>
        </div>
        <NewUserDialog onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários cadastrados</CardTitle>
          <CardDescription>{users?.length ?? 0} usuário(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <UserRow key={u.id} user={u} onChange={() => qc.invalidateQueries({ queryKey: ["users"] })} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type UserRowData = {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  lastSignInAt: string | null | undefined;
  roles: AppRole[];
};

function UserRow({ user, onChange }: { user: UserRowData; onChange: () => void }) {
  const reset = useServerFn(resetUserPassword);
  const del = useServerFn(deleteUser);

  const doReset = async () => {
    try {
      const res = await reset({ data: { userId: user.id } });
      navigator.clipboard.writeText(res.password);
      toast.success("Nova senha copiada para a área de transferência", {
        description: `Senha: ${res.password}`,
        duration: 30000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const doDelete = async () => {
    try {
      await del({ data: { userId: user.id } });
      toast.success("Usuário excluído");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{user.fullName || "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 && <Badge variant="outline">sem papel</Badge>}
          {user.roles.map((r) => (
            <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
              {r}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("pt-BR") : "nunca"}
      </TableCell>
      <TableCell className="text-right space-x-1">
        <EditRolesDialog user={user} onSaved={onChange} />
        <Button size="sm" variant="outline" onClick={doReset} title="Redefinir senha">
          <KeyRound className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove o acesso de <strong>{user.email}</strong> permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={doDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const create = useServerFn(createUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selected, setSelected] = useState<AppRole[]>(["vendedor"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);

  const toggle = (role: AppRole) => {
    setSelected((s) => (s.includes(role) ? s.filter((r) => r !== role) : [...s, role]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return toast.error("Selecione pelo menos um papel");
    setLoading(true);
    try {
      const res = await create({ data: { email, fullName, roles: selected } });
      setResult(res);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOpen(false);
    setTimeout(() => {
      setEmail("");
      setFullName("");
      setSelected(["vendedor"]);
      setResult(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Usuário criado
              </DialogTitle>
              <DialogDescription>
                Compartilhe esta senha com o usuário <strong>agora</strong> — ela não será mostrada
                novamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">E-mail</Label>
                <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">{result.email}</div>
              </div>
              <div>
                <Label className="text-xs">Senha gerada</Label>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
                    {result.password}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(result.password);
                      toast.success("Senha copiada");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={reset}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
              <DialogDescription>
                Uma senha forte será gerada automaticamente. Você poderá copiá-la na próxima tela.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="nu-name">Nome completo</Label>
                <Input id="nu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-email">E-mail</Label>
                <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Papéis</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {ALL_ROLES.map((r) => (
                    <label key={r.value} className="flex items-start gap-3 cursor-pointer">
                      <Checkbox checked={selected.includes(r.value)} onCheckedChange={() => toggle(r.value)} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar e gerar senha
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditRolesDialog({ user, onSaved }: { user: UserRowData; onSaved: () => void }) {
  const update = useServerFn(updateUserRoles);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppRole[]>(user.roles);
  const [loading, setLoading] = useState(false);

  const toggle = (role: AppRole) => {
    setSelected((s) => (s.includes(role) ? s.filter((r) => r !== role) : [...s, role]));
  };

  const submit = async () => {
    if (selected.length === 0) return toast.error("Selecione pelo menos um papel");
    setLoading(true);
    try {
      await update({ data: { userId: user.id, roles: selected } });
      toast.success("Papéis atualizados");
      onSaved();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setSelected(user.roles);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Editar papéis">
          <UserCog className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar papéis</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border p-3">
          {ALL_ROLES.map((r) => (
            <label key={r.value} className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={selected.includes(r.value)} onCheckedChange={() => toggle(r.value)} />
              <div className="flex-1">
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
