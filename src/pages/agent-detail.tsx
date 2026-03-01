import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agents, runs as runsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play, Settings, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mission, setMission] = useState("");

  const { data: agent, isLoading } = useQuery({ queryKey: ["agent", id], queryFn: () => agents.get(id!) });
  const { data: runData } = useQuery({ queryKey: ["runs"], queryFn: runsApi.list });
  const agentRuns = runData?.runs?.filter((r) => r.agent_id === id)?.slice(0, 10) ?? [];

  const triggerMut = useMutation({
    mutationFn: (m: string) => runsApi.create(id!, m),
    onSuccess: (run) => { qc.invalidateQueries({ queryKey: ["runs"] }); toast.success("Run started"); navigate(`/runs/${run.id}`); },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <div className="h-64 bg-muted rounded animate-pulse" />;
  if (!agent) return <p>Agent not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{agent.name}</h1>
          {agent.description && <p className="text-muted-foreground">{agent.description}</p>}
        </div>
        <Badge variant={agent.enabled ? "default" : "secondary"}>{agent.enabled ? "Active" : "Disabled"}</Badge>
        <Link to={`/agents/${id}/edit`}><Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button></Link>
      </div>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Play className="h-4 w-4" /> Run Agent</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (mission.trim()) triggerMut.mutate(mission); }} className="flex gap-3">
            <Input value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Enter a mission..." className="flex-1" />
            <Button type="submit" disabled={!mission.trim() || triggerMut.isPending}>{triggerMut.isPending ? "Starting..." : "Run"}</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Configuration</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Model</span><Badge variant="outline">{agent.model_name}</Badge></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span>{agent.model_provider}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Max Turns</span><span>{agent.max_turns}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Timeout</span><span>{agent.timeout_seconds}s</span></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>System Prompt</CardTitle></CardHeader><CardContent>
          <pre className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted p-3 rounded-md max-h-48 overflow-auto">{agent.system_prompt}</pre>
        </CardContent></Card>
      </div>

      <Separator />
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Runs</h2>
        {!agentRuns.length ? <p className="text-sm text-muted-foreground">No runs yet.</p> : (
          <div className="space-y-2">{agentRuns.map((run) => (
            <Link key={run.id} to={`/runs/${run.id}`} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/50 transition-colors">
              <div className="space-y-1">
                <p className="text-sm font-medium truncate max-w-md">{run.mission}</p>
                <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()} · {run.total_turns} turns · {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}</p>
              </div>
              <Badge variant={run.status === "succeeded" ? "default" : run.status === "failed" ? "destructive" : "outline"}>{run.status}</Badge>
            </Link>
          ))}</div>
        )}
      </div>
    </div>
  );
}
