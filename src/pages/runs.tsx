import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { agents as agentsApi } from "@/lib/api";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Zap, Clock, Hash, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  queued: "led-amber",
  running: "led-blue led-pulse",
  succeeded: "led-green",
  failed: "led-red",
  cancelled: "led-red",
};

const statusBadgeColors: Record<string, string> = {
  queued: "border-amber-500/30 text-amber-400",
  running: "border-blue-500/30 text-blue-400",
  succeeded: "border-emerald-500/30 text-emerald-400",
  failed: "border-red-500/30 text-red-400",
  cancelled: "border-red-500/30 text-red-400",
};

export function RunsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState("");
  const perPage = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["runs", page, status, agentId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (status) params.set("status", status);
      if (agentId) params.set("agent_id", agentId);
      return fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/v1/runs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then((r) => r.json());
    },
    refetchInterval: 5000,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => agentsApi.list(),
  });

  const items = data?.runs || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">Runs</h1>
          <Badge variant="outline" className="font-mono text-[10px] tracking-wider">
            {total} TOTAL
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px] font-mono text-xs h-8">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agentId} onValueChange={(v) => { setAgentId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[180px] font-mono text-xs h-8">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {(agentsData?.agents || []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-card border border-border rounded animate-pulse" />
          ))}
        </div>
      ) : !items.length ? (
        <div className="flex flex-col items-center gap-3 py-16 rounded border border-dashed border-border">
          <Play className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No runs found.</p>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="data-table grid grid-cols-[1fr_100px_80px_70px_80px_80px_70px] gap-3 px-4 py-2 text-muted-foreground border-b border-border">
            <th className="text-left">Mission</th>
            <th className="text-left">Model</th>
            <th className="text-left">Status</th>
            <th className="text-right">Turns</th>
            <th className="text-right">Tokens</th>
            <th className="text-right">Duration</th>
            <th className="text-right">Age</th>
          </div>

          {/* Rows */}
          <div className="space-y-0.5">
            {items.map((run: any) => {
              const tokens = (run.input_tokens || 0) + (run.output_tokens || 0);
              return (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="grid grid-cols-[1fr_100px_80px_70px_80px_80px_70px] gap-3 items-center px-4 py-2.5 rounded border border-transparent hover:border-border hover:bg-card/50 transition-all group"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn("led shrink-0", statusColors[run.status] || "led-amber")} />
                    <span className="text-sm truncate group-hover:text-primary transition-colors">
                      {run.mission.length > 60 ? run.mission.slice(0, 60) + "…" : run.mission}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{run.model_name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[9px] tracking-wider uppercase w-fit",
                      statusBadgeColors[run.status]
                    )}
                  >
                    {run.status}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground text-right flex items-center justify-end gap-1">
                    <Hash className="h-3 w-3" />{run.total_turns || "—"}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground text-right flex items-center justify-end gap-1">
                    {tokens > 0 ? <><Zap className="h-3 w-3" />{tokens.toLocaleString()}</> : "—"}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground text-right flex items-center justify-end gap-1">
                    {run.duration_ms ? <><Clock className="h-3 w-3" />{(run.duration_ms / 1000).toFixed(1)}s</> : "—"}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60 text-right">
                    {timeAgo(run.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <p className="font-mono text-[11px] text-muted-foreground">
              Page {page} of {totalPages} · {total} run{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-7 w-7 p-0">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-7 w-7 p-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
