import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

interface SidebarProps {
  pagosSinAsignar: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { href: "/", label: "Panel Control", icon: "dashboard" },
  { href: "/corredores", label: "Corredores", icon: "directions_run" },
  { href: "/coaches", label: "Coaches", icon: "sports" },
  { href: "/finanzas", label: "Finanzas", icon: "payments" },
  { href: "/pagos", label: "Pagos", icon: "account_balance_wallet" },
  { href: "/gastos", label: "Gastos", icon: "receipt_long" },
  { href: "/deudas", label: "Deudas", icon: "calendar_month" },
];

export function Sidebar({
  pagosSinAsignar,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
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

  const sidebarClass = [
    "fixed left-0 top-0 h-screen border-r border-slate-200 bg-white z-50 flex flex-col py-6 transition-all duration-200",
    collapsed ? "w-16" : "w-60",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
  ].join(" ");

  return (
    <aside className={sidebarClass}>
      <div className={`mb-8 ${collapsed ? "px-2 text-center" : "px-6"}`}>
        {collapsed ? (
          <span className="material-symbols-outlined text-primary text-2xl">waves</span>
        ) : (
          <>
            <h1 className="text-xl font-bold text-primary font-headline tracking-tight">Wave One</h1>
            <p className="text-label-caps text-outline tracking-widest mt-1">Gestión Administrativa</p>
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={`flex items-center transition-all group relative ${
                collapsed ? "px-0 py-3 justify-center" : "px-4 py-3"
              } ${
                active
                  ? "text-primary bg-blue-50 border-r-4 border-primary font-semibold"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {!collapsed && <span className="text-sm ml-3">{item.label}</span>}
              {!collapsed && item.label === "Finanzas" && sinAsignar > 0 && (
                <span className="ml-auto bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {sinAsignar}
                </span>
              )}
              {collapsed && item.label === "Finanzas" && sinAsignar > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
              )}
              {collapsed && (
                <span className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 py-2 text-outline hover:text-on-surface hover:bg-slate-50 rounded-lg transition-all"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          <span className="material-symbols-outlined text-sm">
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
          {!collapsed && <span className="text-xs">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
