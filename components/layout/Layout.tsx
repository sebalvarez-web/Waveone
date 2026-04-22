import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface LayoutProps {
  children: ReactNode;
  pagosSinAsignar?: number;
  onSearch?: (query: string) => void;
}

export function Layout({ children, pagosSinAsignar = 0, onSearch }: LayoutProps) {
  return (
    <div className="bg-background min-h-screen">
      <Sidebar pagosSinAsignar={pagosSinAsignar} />
      <TopBar onSearch={onSearch} />
      <main className="ml-60 pt-20 px-8 pb-12">{children}</main>
    </div>
  );
}
