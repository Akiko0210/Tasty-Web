import { strategyConfigs } from "@/lib/constants";
import { Sidebar } from "./Sidebar";
import { useApp } from "@/contexts/AppContext";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white font-sans text-black dark:bg-black dark:text-white">
      <Sidebar strategies={strategyConfigs} />
      <main className="flex-1 ml-64">{children}</main>
    </div>
  );
}
