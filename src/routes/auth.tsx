import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Copy, CheckCircle2, LogIn, ShieldPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin, bootstrapStatus } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const checkBootstrap = useServerFn(bootstrapStatus);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bootstrap-status"],
    queryFn: () => checkBootstrap({ data: undefined }),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {data?.needsBootstrap ? (
          <BootstrapForm onDone={() => refetch()} />
        ) : (
          <LoginForm onSuccess={() => navigate({ to: "/" })} />
        )}
      </div>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSuccess();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogIn className="h-5 w-5" /> Entrar
        </CardTitle>
        <CardDescription>Acesse o sistema de estoque e vendas</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
          <p className="text-xs text-muted-foreground">
            Esqueceu a senha? Peça ao administrador para gerar uma nova.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function BootstrapForm({ onDone }: { onDone: () => void }) {
  const bootstrap = useServerFn(bootstrapAdmin);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await bootstrap({ data: { email, fullName } });
      setResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" /> Admin criado
          </CardTitle>
          <CardDescription>
            Salve esta senha agora — ela <strong>não será mostrada novamente</strong>.
            Apenas o hash fica guardado no banco.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm">{result.email}</div>
          </div>
          <div className="space-y-1">
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
                  setCopied(true);
                  toast.success("Senha copiada");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Alert>
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              Se perder esta senha, será necessário recuperar acesso direto no banco.
            </AlertDescription>
          </Alert>
          <Button className="w-full" disabled={!copied} onClick={onDone}>
            {copied ? "Já salvei, continuar para o login" : "Copie a senha para continuar"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldPlus className="h-5 w-5" /> Configurar primeiro admin
        </CardTitle>
        <CardDescription>
          Nenhum administrador existe ainda. Cadastre o admin inicial — uma senha forte será gerada
          automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar admin e gerar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
