import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

interface SidebarProps {
  pagosSinAsignar: number;
}

const navItems = [
  { href: "/", label: "Panel Control", icon: "dashboard" },
  { href: "/corredores", label: "Corredores", icon: "directions_run" },
  { href: "/finanzas", label: "Finanzas", icon: "payments" },
  { href: "/pagos", label: "Pagos", icon: "account_balance_wallet" },
  { href: "/gastos", label: "Gastos", icon: "receipt_long" },
  { href: "/configuracion", label: "Configuración", icon: "settings" },
];

export function Sidebar({ pagosSinAsignar }: SidebarProps) {
  const { pathname } = useRouter();
  const [sinAsignar, setSinAsignar] = useState(pagosSinAsignar);

  useEffect(() => {
    fetch("/api/pagos/sin-asignar")
      .then((r) => r.json())
      .then((data: unknown) => setSinAsignar(Array.isArray(data) ? (data as unknown[]).length : 0))
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r border-slate-200 bg-white z-50 flex flex-col py-6">
      <div className="px-6 mb-8">
        <h1 className="text-xl font-bold text-primary font-headline tracking-tight">
          RunTeam Pro
        </h1>
        <p className="text-label-caps text-outline tracking-widest mt-1">
          Gestión Administrativa
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 transition-all ${
                active
                  ? "text-primary bg-blue-50 border-r-4 border-primary font-semibold"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined mr-3">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
              {item.label === "Finanzas" && sinAsignar > 0 && (
                <span className="ml-auto bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {sinAsignar}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4">
        <Link
          href="/corredores/nuevo"
          className="w-full bg-primary text-white py-3 rounded-lg font-headline text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Añadir Corredor
        </Link>
      </div>
    </aside>
  );
}
