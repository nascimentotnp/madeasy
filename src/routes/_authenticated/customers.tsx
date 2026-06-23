import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Search, Trash2, Pencil, Users, Loader2, AlertTriangle } from "lucide-react";
import { useMyRoles } from "@/hooks/use-my-roles";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [{ title: "Clientes — Controle de Estoque" }],
  }),
  component: CustomersPage,
});

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

const onlyDigits = (v: string) => v.replace(/\D+/g, "");
const onlyLetters = (v: string) => v.replace(/[^\p{L}\s]+/gu, "");

const formatPostal = (country: CountryCode, digits: string) => {
  if (country === "BR") {
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return digits;
  }
  return digits;
};

function CustomersPage() {
  const qc = useQueryClient();
  const { can } = useMyRoles();

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["customers"] });
  };

  const customers = customersQ.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Clientes</h1>
          </div>
          {can.editCustomer && <NewCustomerDialog onDone={invalidate} />}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <CustomersCard customers={customers} onDone={invalidate} />
      </main>
    </div>
  );
}

function CustomersCard({
  customers,
  onDone,
}: {
  customers: Customer[];
  onDone: () => void;
}) {
  const { can } = useMyRoles();
  const [q, setQ] = useState("");

  const filtered = customers.filter((c) => {
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      return [c.name, c.phone, c.email, c.city, c.cep].filter(Boolean).join(" ").toLowerCase().includes(needle);
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Cadastro de Clientes</CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, cidade..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 w-80"
            />
          </div>
        </div>
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
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum cliente encontrado
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {COUNTRIES[c.country as CountryCode]?.dial || "+55"} {c.phone}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{c.cep ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {can.editCustomer && (
                      <>
                        <NewCustomerDialog customer={c} onDone={onDone} />
                        <DeleteCustomerButton id={c.id} onDone={onDone} />
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

function NewCustomerDialog({
  customer,
  onDone,
}: {
  customer?: Customer;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<CountryCode>("BR");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  useEffect(() => {
    if (customer) {
      setCountry((customer.country as CountryCode) || "BR");
      setName(customer.name || "");
      setPhone(customer.phone || "");
      setEmail(customer.email || "");
      setCep(customer.cep || "");
      setStreet(customer.street || "");
      setNumber(customer.number || "");
      setComplement(customer.complement || "");
      setNeighborhood(customer.neighborhood || "");
      setCity(customer.city || "");
      setState(customer.state || "");
    }
  }, [customer, open]);

  const c = COUNTRIES[country];

  const reset = () => {
    setCountry("BR"); setName(""); setPhone(""); setEmail("");
    setCep(""); setStreet(""); setNumber(""); setComplement("");
    setNeighborhood(""); setCity(""); setState("");
    setCepError("");
  };

  const fetchAddress = async (digits: string) => {
    setCepError("");
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!r.ok) throw new Error("Serviço de CEP indisponível");
      const d: { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string } = await r.json();
      if (d.erro) {
        setCepError("CEP não encontrado");
        toast.error("CEP não encontrado");
        return;
      }
      if (d.logradouro) setStreet(d.logradouro);
      if (d.bairro) setNeighborhood(d.bairro);
      if (d.localidade) setCity(d.localidade);
      if (d.uf) setState(d.uf);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao consultar CEP";
      setCepError(message);
      toast.error(message);
    } finally {
      setCepLoading(false);
    }
  };

  const handleCepLookup = () => {
    if (country !== "BR") {
      setCepError("Consulta de endereço disponível apenas para Brasil");
      return;
    }
    if (!/^\d{8}$/.test(cep)) {
      setCepError("CEP deve ter exatamente 8 dígitos numéricos");
      return;
    }
    fetchAddress(cep);
  };

  const clearAddress = () => {
    setCep("");
    setStreet("");
    setNumber("");
    setComplement("");
    setNeighborhood("");
    setCity("");
    setState("");
    setCepError("");
  };

  const m = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      const cleanPhone = onlyDigits(phone);
      const cleanCep = onlyDigits(cep);
      if (!cleanName) throw new Error("Nome é obrigatório");
      if (!cleanPhone) throw new Error("Telefone é obrigatório");
      if (!/^\d+$/.test(cleanPhone))
        throw new Error("Telefone deve conter apenas números, sem espaços, traços ou sinais");
      if (cleanPhone.length !== c.phoneMaxDigits)
        throw new Error(
          country === "BR"
            ? "Telefone brasileiro deve ter exatamente 11 dígitos (DDD + número, ex: 21999999999)"
            : `Telefone deve ter exatamente ${c.phoneMaxDigits} dígitos`
        );
      if (country === "BR" && cleanPhone[2] !== "9")
        throw new Error("Celular brasileiro deve começar com 9 após o DDD (ex: 21999999999)");
      if (!cleanCep) throw new Error(`${c.postalLabel} é obrigatório (faz parte da chave única)`);
      if (!/^\d+$/.test(cleanCep))
        throw new Error(`${c.postalLabel} deve conter apenas números`);
      if (cleanCep.length !== c.postalMaxDigits)
        throw new Error(
          country === "BR"
            ? "CEP deve ter exatamente 8 dígitos (somente números, ex: 20040020)"
            : `${c.postalLabel} deve ter exatamente ${c.postalMaxDigits} dígitos`
        );

      const payload = {
        name: cleanName,
        phone: cleanPhone,
        email: email.trim() || null,
        country,
        cep: cleanCep,
        street: street.trim() || null,
        number: number.trim() || null,
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
      };

      if (customer) {
        // Edit mode
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", customer.id);
        if (error) {
          if (error.code === "23505") {
            throw new Error("Já existe um cliente com este CEP, nome e telefone");
          }
          throw error;
        }
      } else {
        // Create mode
        const { error } = await supabase.from("customers").insert(payload);
        if (error) {
          if (error.code === "23505") {
            throw new Error("Já existe um cliente com este CEP, nome e telefone");
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(customer ? "Cliente atualizado" : "Cliente criado");
      setOpen(false);
      reset();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {customer ? (
          <Button size="sm" variant="ghost" title="Editar cliente">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline"><Users className="mr-1 h-4 w-4" /> Novo cliente</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>País</Label>
            <Select value={country} onValueChange={(v) => setCountry(v as CountryCode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(COUNTRIES) as CountryCode[]).map((k) => (
                  <SelectItem key={k} value={k}>{COUNTRIES[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nc-name">Nome</Label>
            <Input
              id="nc-name"
              value={name}
              onChange={(e) => setName(onlyLetters(e.target.value))}
              placeholder="Apenas letras"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nc-phone">Telefone</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{c.dial}</span>
                <Input
                  id="nc-phone"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, c.phoneMaxDigits))}
                  placeholder={c.phoneHint}
                />
              </div>
              <p className="text-xs text-muted-foreground">{c.phoneHint} — só números</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nc-cep">{c.postalLabel}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="nc-cep"
                  inputMode="numeric"
                  disabled={cepLoading}
                  value={formatPostal(country, cep)}
                  onChange={(e) => {
                    const digits = onlyDigits(e.target.value).slice(0, c.postalMaxDigits);
                    setCep(digits);
                    setCepError("");
                  }}
                  placeholder={country === "BR" ? "12345-678" : "Só números"}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cepLoading || country !== "BR" || !/^\d{8}$/.test(cep)}
                  onClick={handleCepLookup}
                >
                  {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar
                </Button>
              </div>
              {cepLoading && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando endereço…
                </p>
              )}
              {cepError && !cepLoading && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {cepError}
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                disabled={cepLoading || (!cep && !street && !number && !complement && !neighborhood && !city && !state)}
                onClick={clearAddress}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Limpar endereço
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nc-street">Rua</Label>
              <Input id="nc-street" value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nc-num">Número</Label>
              <Input id="nc-num" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nc-comp">Complemento</Label>
              <Input id="nc-comp" value={complement} onChange={(e) => setComplement(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nc-bairro">Bairro</Label>
              <Input id="nc-bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="nc-city">Cidade</Label>
              <Input id="nc-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nc-state">UF</Label>
              <Input
                id="nc-state"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 3))}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="nc-email">Email</Label>
            <Input id="nc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!name || m.isPending}>
            {m.isPending ? "Salvando..." : customer ? "Atualizar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCustomerButton({ id, onDone }: { id: string; onDone: () => void }) {
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente excluído"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => { if (confirm("Excluir este cliente?")) m.mutate(); }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
