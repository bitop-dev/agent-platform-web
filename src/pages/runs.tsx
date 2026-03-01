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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

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
        <h1 className="text-3xl font-bold">Runs</h1>
        <div className="flex items-center gap-3">
          {/* Status filter */}
          <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px]">
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
          {/* Agent filter */}
          <Select value={agentId} onValueChange={(v) => { setAgentId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
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
        <div className="h-64 bg-muted rounded animate-pulse" />
      ) : !items.length ? (
        <p className="text-muted-foreground">No runs found.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mission</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Turns</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((run: any) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <Link to={`/runs/${run.id}`} className="text-primary hover:underline truncate max-w-xs block">
                      {run.mission.length > 70 ? run.mission.slice(0, 70) + "…" : run.mission}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{run.model_name}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={
                      run.status === "succeeded" ? "default" :
                      run.status === "failed" ? "destructive" : "outline"
                    }>{run.status}</Badge>
                  </TableCell>
                  <TableCell>{run.total_turns || "—"}</TableCell>
                  <TableCell>
                    {(run.input_tokens || 0) + (run.output_tokens || 0) > 0 ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Zap className="h-3 w-3" />
                        {((run.input_tokens || 0) + (run.output_tokens || 0)).toLocaleString()}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(run.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} run{total !== 1 ? "s" : ""} · Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
