import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bot, Play, Puzzle, Key, LogOut, Calendar,
  Users, Activity, ChevronRight, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/store";

const navSections = [
  {
    label: "Operations",
    links: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/agents", label: "Agents", icon: Bot },
      { to: "/runs", label: "Runs", icon: Play },
      { to: "/schedules", label: "Schedules", icon: Calendar },
    ],
  },
  {
    label: "Configuration",
    links: [
      { to: "/skills", label: "Skills", icon: Puzzle },
      { to: "/teams", label: "Teams", icon: Users },
      { to: "/settings/api-keys", label: "API Keys", icon: Key },
      { to: "/audit-log", label: "Audit Log", icon: Shield },
    ],
  },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* ─── Sidebar ─── */}
      <aside className="flex h-screen w-60 flex-col border-r border-border bg-sidebar">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 border border-primary/20">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold tracking-wider text-primary uppercase">
              AgentOps
            </span>
            <span className="text-[10px] text-muted-foreground font-mono tracking-wide">
              COMMAND CENTER
            </span>
          </div>
        </div>

        {/* Navigation sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-2 font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground/70">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.links.map(({ to, label, icon: Icon }) => {
                  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-all duration-150",
                        active
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-transparent"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1">{label}</span>
                      {active && <ChevronRight className="h-3 w-3 text-primary/60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* System status + user */}
        <div className="border-t border-sidebar-border p-3 space-y-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-sidebar-accent/50">
            <span className="led led-green led-pulse" />
            <span className="font-mono text-[10px] text-muted-foreground tracking-wide">SYSTEM ONLINE</span>
          </div>

          {/* User */}
          <div className="flex items-center justify-between px-3 py-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="font-mono text-[10px] text-primary font-bold">
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground truncate font-mono">
                {user?.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
