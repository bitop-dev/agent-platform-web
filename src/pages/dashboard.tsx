import { useQuery } from "@tanstack/react-query";
import { dashboard } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Play, CheckCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard.get });

  if (isLoading) return <div className="space-y-6"><div className="h-9 w-40 bg-muted rounded animate-pulse" /><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}</div></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Agents" value={data?.agents ?? 0} icon={<Bot className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Total Runs" value={data?.total_runs ?? 0} icon={<Play className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Succeeded" value={data?.succeeded ?? 0} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <StatCard title="Failed" value={data?.failed ?? 0} icon={<XCircle className="h-4 w-4 text-red-500" />} />
      </div>
      <Card>
        <CardHeader><CardTitle>Recent Runs</CardTitle></CardHeader>
        <CardContent>
          {!data?.recent_runs?.length ? (
            <p className="text-muted-foreground text-sm">No runs yet. Create an agent and trigger a run.</p>
          ) : (
            <div className="space-y-3">
              {data.recent_runs.map((run) => (
                <Link key={run.id} to={`/runs/${run.id}`} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-medium truncate max-w-md">{run.mission}</p>
                    <p className="text-xs text-muted-foreground">{run.model_name} · {run.total_turns} turns · {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}</p>
                  </div>
                  <StatusBadge status={run.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>{icon}
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const v = status === "succeeded" ? "default" : status === "failed" ? "destructive" : status === "running" ? "secondary" : "outline";
  return <Badge variant={v}>{status}</Badge>;
}
