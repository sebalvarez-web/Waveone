import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { useState } from "react";
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

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const email = session?.user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();
  const leftOffset = collapsed ? "md:left-16" : "md:left-60";
  const rightWidth = collapsed ? "md:w-[calc(100%-64px)]" : "md:w-[calc(100%-240px)]";

  return (
    <header
      className={`fixed top-0 right-0 left-0 ${leftOffset} ${rightWidth} h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md z-40 flex justify-between items-center px-4 md:px-8 transition-all duration-200`}
    >
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          onClick={onMobileMenuClick}
        >
          <span className="material-symbols-outlined text-outline">menu</span>
        </button>

        <div className="flex items-center bg-surface-container-low px-4 py-1.5 rounded-full w-48 md:w-96">
          <span className="material-symbols-outlined text-outline text-lg">search</span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm font-body w-full placeholder:text-outline-variant ml-2"
            placeholder="Buscar..."
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch?.(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="hover:bg-slate-100 rounded-full p-2 transition-all hidden md:block">
          <span className="material-symbols-outlined text-outline">notifications</span>
        </button>
        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block" />
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-on-surface hidden md:block">{email}</p>
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-xs hover:opacity-80 transition-all"
            title="Cerrar sesión"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
}
