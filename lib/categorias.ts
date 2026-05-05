// Categorías de gastos — fuente de verdad única.
export interface CategoriaGasto {
  slug: string;
  label: string;
  color: string;
}

export const CATEGORIAS_GASTO: CategoriaGasto[] = [
  { slug: "inventario",          label: "Inventario",                          color: "#FF5E3A" },
  { slug: "uniformes",           label: "Uniformes",                           color: "#D97706" },
  { slug: "consumibles",         label: "Consumibles",                         color: "#F59E0B" },
  { slug: "licencias",           label: "Licencias",                           color: "#7C3AED" },
  { slug: "comidas",             label: "Comidas",                             color: "#EC4899" },
  { slug: "capacitaciones",      label: "Capacitaciones",                      color: "#0EA5E9" },
  { slug: "ultimate",            label: "Ultimate",                            color: "#10B981" },
  { slug: "legales_consultoria", label: "Legales y Servicios de Consultoría",  color: "#6366F1" },
  { slug: "sueldos",             label: "Sueldos",                             color: "#2563EB" },
  { slug: "dividendos",          label: "Dividendos",                          color: "#14B8A6" },
  { slug: "impuestos",           label: "Impuestos",                           color: "#DC2626" },
  { slug: "viaticos",            label: "Viáticos",                            color: "#A855F7" },
  { slug: "comisiones",          label: "Comisiones",                          color: "#F97316" },
  { slug: "otros",               label: "Otros Gastos",                        color: "#94A0B5" },
];

export const CATEGORIAS_GASTO_SLUGS = CATEGORIAS_GASTO.map((c) => c.slug);

export const CATEGORIAS_GASTO_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIAS_GASTO.map((c) => [c.slug, c.label])
);

export const CATEGORIAS_GASTO_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIAS_GASTO.map((c) => [c.slug, c.color])
);

export function labelCategoriaGasto(slug: string | null | undefined): string {
  if (!slug) return "—";
  return CATEGORIAS_GASTO_LABELS[slug] ?? slug;
}
