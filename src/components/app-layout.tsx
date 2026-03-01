import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Bot, Play, Puzzle, Key, LogOut, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/store";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/runs", label: "Runs", icon: Play },
  { to: "/skills", label: "Skills", icon: Puzzle },
  { to: "/schedules", label: "Schedules", icon: Calendar },
  { to: "/settings/api-keys", label: "API Keys", icon: Key },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex h-screen w-56 flex-col border-r border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <Bot className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Agent Platform</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {links.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-muted-foreground truncate">{user?.email}</span>
            <button onClick={logout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
