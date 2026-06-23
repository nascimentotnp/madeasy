import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";

type Notification = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger";
  href: "/" | "/finance" | "/sales";
};

export function NotificationsBell() {
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notification[]> => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const in7d = new Date(); in7d.setDate(in7d.getDate() + 7);
      const in7dStr = in7d.toISOString().slice(0, 10);

      const products = await supabase
        .from("products")
        .select("id,name,quantity,min_quantity")
        .gt("min_quantity", 0);
      const expenses = await supabase
        .from("expenses")
        .select("id,description,amount,due_date")
        .eq("status", "pendente")
        .not("due_date", "is", null)
        .lte("due_date", in7dStr);
      const receivables = await supabase
        .from("sales")
        .select("id,total,due_date,customers(name)")
        .eq("status", "entregue")
        .not("due_date", "is", null)
        .lt("due_date", todayStr);

      const notes: Notification[] = [];

      (products.data ?? []).forEach((p) => {
        if (p.quantity <= p.min_quantity) {
          notes.push({
            id: `lowstock-${p.id}`,
            title: `Estoque baixo: ${p.name}`,
            detail: `Restam ${p.quantity} (mínimo ${p.min_quantity})`,
            severity: p.quantity === 0 ? "danger" : "warning",
            href: "/",
          });
        }
      });

      (expenses.data ?? []).forEach((e) => {
        const d = e.due_date ? new Date(e.due_date) : null;
        const overdue = d && d < new Date(todayStr);
        notes.push({
          id: `exp-${e.id}`,
          title: overdue ? `Despesa vencida: ${e.description}` : `Despesa próxima: ${e.description}`,
          detail: `R$ ${Number(e.amount).toFixed(2)} — vence em ${e.due_date}`,
          severity: overdue ? "danger" : "warning",
          href: "/finance",
        });
      });

      (receivables.data ?? []).forEach((r) => {
        const customerName = (r.customers as { name?: string } | null)?.name ?? "—";
        notes.push({
          id: `rec-${r.id}`,
          title: `Recebimento vencido: ${customerName}`,
          detail: `R$ ${Number(r.total).toFixed(2)} — vencia em ${r.due_date}`,
          severity: "danger",
          href: "/sales",
        });
      });

      return notes;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const notes = q.data ?? [];
  const count = notes.length;
  const hasDanger = notes.some((n) => n.severity === "danger");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
                hasDanger ? "bg-rose-600" : "bg-amber-500"
              }`}
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificações ({count})</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">Tudo em ordem ✨</div>
        )}
        {notes.slice(0, 12).map((n) => (
          <DropdownMenuItem key={n.id} asChild className="cursor-pointer">
            <Link to={n.href} className="flex flex-col items-start gap-0.5 py-2">
              <div className="flex w-full items-center gap-2">
                <Badge
                  variant={n.severity === "danger" ? "destructive" : "outline"}
                  className={n.severity === "warning" ? "border-amber-500 text-amber-700" : ""}
                >
                  {n.severity === "danger" ? "Urgente" : "Atenção"}
                </Badge>
                <span className="text-sm font-medium truncate">{n.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">{n.detail}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {count > 12 && (
          <div className="px-3 py-2 text-center text-xs text-muted-foreground">+ {count - 12} mais</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
