import { KeyRound, Menu } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { currentAdmin } from "../api";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./Theme";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/licenses": "Licenses",
  "/customers": "Customers",
  "/devices": "Devices",
  "/activity": "Activity",
  "/settings": "Settings",
};

export function AppLayout({ children }: { children?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const admin = currentAdmin();
  const title = titles[pathname] ?? (pathname.startsWith("/licenses/") ? "License Details" : "Madar License");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-night-950">
      {/* desktop sidebar */}
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

      {/* mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0" onClick={() => setMobileOpen(false)}>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6 dark:border-green-100/10 dark:bg-night-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              className="cursor-pointer rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-green-100/60 dark:hover:bg-white/10"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-green-50">{title}</h2>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium text-gray-900 dark:text-green-50">{admin?.name ?? "Admin"}</p>
              <p className="text-xs leading-tight text-gray-400 dark:text-green-100/40">{admin?.email}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <KeyRound size={15} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
