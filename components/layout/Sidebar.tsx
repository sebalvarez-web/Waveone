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
  { href: "/", label: "Panel", icon: "dashboard", group: "main" },
  { href: "/corredores", label: "Corredores", icon: "directions_run", group: "main" },
  { href: "/coaches", label: "Coaches", icon: "sports", group: "main" },
  { href: "/finanzas", label: "Finanzas", icon: "payments", group: "fin" },
  { href: "/pagos", label: "Pagos", icon: "account_balance_wallet", group: "fin" },
  { href: "/gastos", label: "Gastos", icon: "receipt_long", group: "fin" },
  { href: "/deudas", label: "Deudas", icon: "calendar_month", group: "fin" },
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
    "fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-300 ease-out",
    "bg-primary text-white",
    collapsed ? "w-[72px]" : "w-[248px]",
    mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
  ].join(" ");

  const mainItems = navItems.filter((i) => i.group === "main");
  const finItems = navItems.filter((i) => i.group === "fin");

  return (
    <aside className={sidebarClass}>
      {/* Brand */}
      <div className={`pt-6 pb-4 ${collapsed ? "px-3" : "px-5"}`}>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-[#FF8A6B] flex items-center justify-center shadow-pop flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12c2-2 3.5-2 5 0s3 2 5 0 3.5-2 5 0 3 2 5 0" />
              <path d="M2 17c2-2 3.5-2 5 0s3 2 5 0 3.5-2 5 0 3 2 5 0" opacity="0.6" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-[17px] font-headline font-bold text-white tracking-tight leading-none">Wave One</h1>
              <p className="text-[10px] text-white/50 font-medium tracking-wider mt-1">ADMIN</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2" : "px-3"} py-2 space-y-6`}>
        <NavGroup label="GENERAL" collapsed={collapsed}>
          {mainItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
              onMobileClose={onMobileClose}
            />
          ))}
        </NavGroup>

        <NavGroup label="FINANZAS" collapsed={collapsed}>
          {finItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
              onMobileClose={onMobileClose}
              badge={item.label === "Pagos" && sinAsignar > 0 ? sinAsignar : undefined}
            />
          ))}
        </NavGroup>
      </nav>

      {/* Footer / collapse */}
      <div className={`mt-auto border-t border-white/[0.08] ${collapsed ? "p-2" : "p-3"}`}>
        <button
          onClick={onToggleCollapse}
          className={`w-full flex items-center gap-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors ${
            collapsed ? "justify-center py-2.5" : "px-3 py-2.5"
          }`}
          title={collapsed ? "Expandir" : "Colapsar"}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          <span className="material-symbols-outlined text-[20px]">
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
          {!collapsed && <span className="text-xs font-medium">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}

function NavGroup({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
  return (
    <div>
      {!collapsed && (
        <p className="px-3 mb-2 text-[10px] font-bold tracking-[0.12em] text-white/40">{label}</p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

interface NavLinkProps {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onMobileClose: () => void;
  badge?: number;
}

function NavLink({ href, icon, label, active, collapsed, onMobileClose, badge }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onMobileClose}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center rounded-lg transition-all duration-200 ${
        collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
      } ${
        active
          ? "bg-white text-primary shadow-soft"
          : "text-white/70 hover:text-white hover:bg-white/[0.06]"
      }`}
    >
      <span className={`material-symbols-outlined text-[20px] ${active ? "fill" : ""}`}>{icon}</span>
      {!collapsed && (
        <span className={`text-sm ml-3 ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
      )}
      {!collapsed && badge !== undefined && (
        <span className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full ${
          active ? "bg-accent text-white" : "bg-accent text-white"
        }`}>
          {badge}
        </span>
      )}
      {collapsed && badge !== undefined && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full ring-2 ring-primary" />
      )}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-primary text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-pop font-medium">
          {label}
        </span>
      )}
    </Link>
  );
}
