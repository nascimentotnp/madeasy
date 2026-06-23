import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type SaleItem = {
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: { name: string; model: string | null; size: string | null } | null;
};

type Sale = {
  id: string;
  status: string;
  discount: number;
  total: number;
  notes: string | null;
  created_at: string;
  customers: { name: string; phone: string; country?: string } | null;
  sale_items: SaleItem[];
};

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const productLabel = (p?: SaleItem["products"]) =>
  p ? [p.name, p.model, p.size].filter(Boolean).join(" • ") : "—";

export function generateSalePdf(sale: Sale, opts?: { companyName?: string }) {
  const doc = new jsPDF();
  const title = sale.status === "proposta" ? "ORÇAMENTO" : "RECIBO DE VENDA";
  const company = opts?.companyName ?? "Sua Empresa";

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(company, 14, 18);

  doc.setFontSize(14);
  doc.text(title, 196, 18, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Documento: ${sale.id.slice(0, 8).toUpperCase()}`, 196, 25, { align: "right" });
  doc.text(`Data: ${new Date(sale.created_at).toLocaleString("pt-BR")}`, 196, 30, { align: "right" });

  doc.setDrawColor(200);
  doc.line(14, 35, 196, 35);

  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 14, 43);
  doc.setFont("helvetica", "normal");
  doc.text(sale.customers?.name ?? "—", 35, 43);
  if (sale.customers?.phone) {
    doc.text(`Tel: ${sale.customers.phone}`, 14, 49);
  }

  autoTable(doc, {
    startY: 56,
    head: [["Produto", "Qtd.", "Preço un.", "Subtotal"]],
    body: sale.sale_items.map((it) => [
      productLabel(it.products),
      String(it.quantity),
      BRL(Number(it.unit_price)),
      BRL(Number(it.subtotal)),
    ]),
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY ?? 80;
  let y = finalY + 8;

  const subtotal = sale.sale_items.reduce((s, it) => s + Number(it.subtotal), 0);
  doc.setFontSize(10);
  doc.text(`Subtotal: ${BRL(subtotal)}`, 196, y, { align: "right" });
  if (Number(sale.discount) > 0) {
    y += 6;
    doc.text(`Desconto: −${BRL(Number(sale.discount))}`, 196, y, { align: "right" });
  }
  y += 8;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${BRL(Number(sale.total))}`, 196, y, { align: "right" });

  if (sale.notes) {
    y += 12;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Observações:", 14, y);
    y += 5;
    const lines = doc.splitTextToSize(sale.notes, 180);
    doc.text(lines, 14, y);
  }

  if (sale.status === "proposta") {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      "Orçamento válido por 7 dias. Sujeito à disponibilidade de estoque.",
      14,
      285,
    );
  }

  return doc;
}

export function downloadSalePdf(sale: Sale, opts?: { companyName?: string }) {
  const doc = generateSalePdf(sale, opts);
  const prefix = sale.status === "proposta" ? "orcamento" : "venda";
  doc.save(`${prefix}-${sale.id.slice(0, 8)}.pdf`);
}

export function buildWhatsAppLink(sale: Sale) {
  let phone = (sale.customers?.phone ?? "").replace(/\D/g, "");
  if (phone) {
    const country = sale.customers?.country || "BR";
    const dialDigits = (({
      BR: "55",
      US: "1",
      PT: "351",
      AR: "54",
    } as Record<string, string>)[country]) || "55";
    
    if (!phone.startsWith(dialDigits)) {
      phone = dialDigits + phone;
    }
  }

  const items = sale.sale_items
    .map((it) => `• ${it.quantity}x ${productLabel(it.products)} — ${BRL(Number(it.subtotal))}`)
    .join("\n");
  const title = sale.status === "proposta" ? "Orçamento" : "Resumo da venda";
  const msg =
    `*${title}*\n` +
    `Cliente: ${sale.customers?.name ?? "—"}\n` +
    `Data: ${new Date(sale.created_at).toLocaleDateString("pt-BR")}\n\n` +
    `${items}\n\n` +
    (Number(sale.discount) > 0 ? `Desconto: −${BRL(Number(sale.discount))}\n` : "") +
    `*Total: ${BRL(Number(sale.total))}*`;
  const base = phone ? `https://wa.me/${phone}` : `https://wa.me/`;
  return `${base}?text=${encodeURIComponent(msg)}`;
}
