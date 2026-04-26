import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: ReactNode;
  pagosSinAsignar?: number;
  onSearch?: (query: string) => void;
}

export function Layout({ children, pagosSinAsignar = 0, onSearch }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  };

  const mainMargin = collapsed ? "md:ml-[72px]" : "md:ml-[248px]";

  return (
    <div className="bg-background min-h-screen text-on-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        pagosSinAsignar={pagosSinAsignar}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <TopBar
        onSearch={onSearch}
        collapsed={collapsed}
        onMobileMenuClick={() => setMobileOpen(true)}
      />

      <main className={`${mainMargin} pt-[88px] px-4 md:px-8 pb-16 transition-all duration-300 ease-out max-w-[1600px] mx-auto`}>
        {children}
      </main>
    </div>
  );
}
