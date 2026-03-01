import { useQuery } from "@tanstack/react-query";
import { dashboard } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Play, CheckCircle, XCircle, Zap, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard.get, refetchInterval: 10000 });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashHeader />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: "Active Agents",
      value: data?.agents ?? 0,
      icon: Bot,
      color: "text-primary",
      bg: "bg-primary/5 border-primary/20",
      led: "led-amber",
    },
    {
      label: "Total Runs",
      value: data?.total_runs ?? 0,
      icon: Play,
      color: "text-blue-400",
      bg: "bg-blue-500/5 border-blue-500/20",
      led: "led-blue",
    },
    {
      label: "Succeeded",
      value: data?.succeeded ?? 0,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/5 border-emerald-500/20",
      led: "led-green",
    },
    {
      label: "Failed",
      value: data?.failed ?? 0,
      icon: XCircle,
      color: "text-red-400",
      bg: "bg-red-500/5 border-red-500/20",
      led: "led-red",
    },
  ];

  const successRate =
    data && data.total_runs > 0
      ? ((data.succeeded / data.total_runs) * 100).toFixed(1)
      : "—";

  return (
    <div className="space-y-6">
      <DashHeader />

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className={cn("border glow-border", s.bg)}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted-foreground">
                  {s.label}
                </span>
                <span className={cn("led", s.led)} />
              </div>
              <div className="flex items-end gap-2">
                <span className="font-mono text-3xl font-semibold tracking-tight">{s.value}</span>
                <s.icon className={cn("h-5 w-5 mb-1", s.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Metrics bar ─── */}
      <div className="flex items-center gap-6 rounded border border-border bg-card/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-mono text-xs text-muted-foreground">SUCCESS RATE</span>
          <span className="font-mono text-sm font-semibold text-primary">{successRate}%</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-xs text-muted-foreground">RUNNING</span>
          <span className="font-mono text-sm font-semibold">{data?.running ?? 0}</span>
        </div>
      </div>

      {/* ─── Recent Runs ─── */}
      <Card className="glow-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-mono text-sm tracking-wide uppercase">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.recent_runs?.length ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground text-sm">No runs yet.</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Create an agent and trigger a run to get started.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data.recent_runs.map((run) => (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="flex items-center gap-3 rounded border border-transparent px-3 py-2.5 hover:bg-muted/30 hover:border-border transition-all group"
                >
                  <StatusLED status={run.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {run.mission.length > 80 ? run.mission.slice(0, 80) + "…" : run.mission}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {run.model_name}
                      {run.total_turns ? ` · ${run.total_turns} turns` : ""}
                      {run.duration_ms ? ` · ${(run.duration_ms / 1000).toFixed(1)}s` : ""}
                      {(run.input_tokens || 0) + (run.output_tokens || 0) > 0
                        ? ` · ${((run.input_tokens || 0) + (run.output_tokens || 0)).toLocaleString()} tok`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-wider",
                      run.status === "succeeded" && "border-emerald-500/30 text-emerald-400",
                      run.status === "failed" && "border-red-500/30 text-red-400",
                      run.status === "running" && "border-blue-500/30 text-blue-400",
                    )}
                  >
                    {run.status}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground/60 w-16 text-right shrink-0">
                    {timeAgo(run.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashHeader() {
  return (
    <div className="flex items-center gap-3">
      <h1 className="font-mono text-2xl font-bold tracking-tight">Dashboard</h1>
      <div className="flex-1" />
      <div className="flex items-center gap-2 text-muted-foreground/60">
        <span className="led led-green led-pulse" />
        <span className="font-mono text-[10px] tracking-wider">LIVE</span>
      </div>
    </div>
  );
}

function StatusLED({ status }: { status: string }) {
  const cls =
    status === "succeeded" ? "led-green" :
    status === "failed" ? "led-red" :
    status === "running" ? "led-blue led-pulse" :
    "led-amber";
  return <span className={cn("led shrink-0", cls)} />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
