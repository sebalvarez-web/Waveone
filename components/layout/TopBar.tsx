import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

interface TopBarProps {
  onSearch?: (query: string) => void;
}

export function TopBar({ onSearch }: TopBarProps) {
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

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-240px)] h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md z-40 flex justify-between items-center px-8">
      <div className="flex items-center bg-surface-container-low px-4 py-1.5 rounded-full w-96">
        <span className="material-symbols-outlined text-outline text-lg">search</span>
        <input
          className="bg-transparent border-none focus:ring-0 text-sm font-body w-full placeholder:text-outline-variant ml-2"
          placeholder="Buscar corredores o transacciones..."
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="hover:bg-slate-100 rounded-full p-2 transition-all">
          <span className="material-symbols-outlined text-outline">notifications</span>
        </button>
        <div className="h-8 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-on-surface">{email}</p>
          </div>
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
