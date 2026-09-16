import {
  Activity,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Settings,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { logout } from "../api";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/licenses", label: "Licenses", icon: CreditCard, end: false },
  { to: "/customers", label: "Customers", icon: Users, end: false },
  { to: "/devices", label: "Devices", icon: MonitorSmartphone, end: false },
  { to: "/activity", label: "Activity", icon: Activity, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full w-60 flex-col border-r border-gray-200 bg-white dark:border-green-100/10 dark:bg-night-900">
      <div className="flex h-14 items-center gap-2.5 border-b border-gray-100 px-5 dark:border-green-100/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">
          M
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-green-50">Madar License</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-green-100/60 dark:hover:bg-white/5 dark:hover:text-green-50"
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3 dark:border-green-100/10">
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-green-100/60 dark:hover:bg-white/5 dark:hover:text-green-50"
        >
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </div>
  );
}
