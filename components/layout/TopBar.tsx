import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

interface TopBarProps {
  onSearch?: (query: string) => void;
  collapsed?: boolean;
  onMobileMenuClick?: () => void;
}

export function TopBar({ onSearch, collapsed = false, onMobileMenuClick }: TopBarProps) {
  const { session } = useSessionContext();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const email = session?.user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();
  const leftOffset = collapsed ? "md:left-[72px]" : "md:left-[248px]";
  const rightWidth = collapsed ? "md:w-[calc(100%-72px)]" : "md:w-[calc(100%-248px)]";

  return (
    <header
      className={`fixed top-0 right-0 left-0 ${leftOffset} ${rightWidth} h-[72px] z-40 transition-all duration-300 ease-out`}
    >
      <div className="h-full bg-background/85 backdrop-blur-xl border-b border-outline-variant/60 flex justify-between items-center px-4 md:px-8">
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-surface-container-low transition-colors"
            onClick={onMobileMenuClick}
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined text-on-surface">menu</span>
          </button>

          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none">
              search
            </span>
            <input
              className="w-full bg-surface-container-low/80 border border-transparent hover:border-outline-variant focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15 text-sm rounded-lg pl-10 pr-3 py-2.5 placeholder:text-outline transition-all outline-none"
              placeholder="Buscar corredores, pagos, gastos..."
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="hidden md:flex w-10 h-10 rounded-lg items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors relative"
            aria-label="Notificaciones"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent ring-2 ring-background" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-surface-container-low transition-colors"
              aria-label="Menú de usuario"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-[#FF8A6B] flex items-center justify-center text-white font-bold text-xs shadow-soft">
                {initials || "U"}
              </div>
              <div className="hidden lg:flex flex-col items-start leading-tight">
                <span className="text-xs font-semibold text-on-surface max-w-[160px] truncate">{email || "Usuario"}</span>
                <span className="text-[10px] text-on-surface-variant">Administrador</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px] hidden lg:block">expand_more</span>
            </button>

            {menuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-pop border border-outline-variant/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant/40">
                  <p className="text-xs text-on-surface-variant">Sesión iniciada</p>
                  <p className="text-sm font-semibold text-on-surface truncate">{email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-error-container/40 transition-colors flex items-center gap-2 font-medium"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
