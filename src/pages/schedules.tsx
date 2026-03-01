import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schedules as schedulesApi, agents as agentsApi, type Schedule, type Agent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Clock, Plus, Trash2, Play, Pause, PlayCircle,
  Calendar, Timer, Zap, AlertCircle, CheckCircle, XCircle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function formatNextRun(nextRunAt?: string) {
  if (!nextRunAt) return "—";
  const d = new Date(nextRunAt);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return "overdue";
  if (diffMs < 60_000) return `in ${Math.round(diffMs / 1000)}s`;
  if (diffMs < 3_600_000) return `in ${Math.round(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `in ${Math.round(diffMs / 3_600_000)}h`;
  return d.toLocaleDateString();
}

function scheduleDescription(s: Schedule) {
  switch (s.schedule_type) {
    case "cron": return s.cron_expr || "—";
    case "every": {
      const sec = s.interval_seconds || 0;
      if (sec >= 86400) return `every ${Math.round(sec / 86400)}d`;
      if (sec >= 3600) return `every ${Math.round(sec / 3600)}h`;
      if (sec >= 60) return `every ${Math.round(sec / 60)}m`;
      return `every ${sec}s`;
    }
    case "once": return "one-time";
    default: return s.schedule_type;
  }
}

function statusIcon(status?: string) {
  switch (status) {
    case "succeeded": return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
    case "failed": return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    case "running": return <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
    default: return null;
  }
}

function CreateScheduleDialog({ agents }: { agents: Agent[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    agent_id: "", name: "", description: "", schedule_type: "cron" as "cron" | "every" | "once",
    cron_expr: "", interval_minutes: 60, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    mission: "", overlap_policy: "skip",
  });

  const createMut = useMutation({
    mutationFn: () => schedulesApi.create({
      agent_id: form.agent_id,
      name: form.name,
      description: form.description,
      schedule_type: form.schedule_type,
      cron_expr: form.schedule_type === "cron" ? form.cron_expr : undefined,
      interval_seconds: form.schedule_type === "every" ? form.interval_minutes * 60 : undefined,
      timezone: form.timezone,
      mission: form.mission || undefined,
      overlap_policy: form.overlap_policy,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule created");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New Schedule</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Schedule</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Agent</Label>
            <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Schedule Name</Label>
            <Input placeholder="Daily standup report" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.schedule_type} onValueChange={(v) => setForm({ ...form, schedule_type: v as "cron" | "every" | "once" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cron">Cron Expression</SelectItem>
                <SelectItem value="every">Fixed Interval</SelectItem>
                <SelectItem value="once">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.schedule_type === "cron" && (
            <div>
              <Label>Cron Expression</Label>
              <Input placeholder="0 9 * * 1-5" value={form.cron_expr} onChange={(e) => setForm({ ...form, cron_expr: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">min hour dom month dow (e.g. "0 9 * * 1-5" = weekdays at 9am)</p>
            </div>
          )}
          {form.schedule_type === "every" && (
            <div>
              <Label>Interval (minutes)</Label>
              <Input type="number" min={1} value={form.interval_minutes} onChange={(e) => setForm({ ...form, interval_minutes: parseInt(e.target.value) || 60 })} />
            </div>
          )}
          <div>
            <Label>Timezone</Label>
            <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
          <div>
            <Label>Mission Override <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="Leave blank to use default" value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} />
          </div>
          <div>
            <Label>Overlap Policy</Label>
            <Select value={form.overlap_policy} onValueChange={(v) => setForm({ ...form, overlap_policy: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip (wait for next)</SelectItem>
                <SelectItem value="queue">Queue (run after current)</SelectItem>
                <SelectItem value="parallel">Parallel (run concurrently)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={() => createMut.mutate()} disabled={!form.agent_id || !form.name || createMut.isPending}>
            {createMut.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SchedulesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: schedulesData, isLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => schedulesApi.list(),
    refetchInterval: 30_000,
  });
  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => agentsApi.list(),
  });

  const toggleMut = useMutation({
    mutationFn: (s: Schedule) => s.enabled ? schedulesApi.disable(s.id) : schedulesApi.enable(s.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const triggerMut = useMutation({
    mutationFn: (id: string) => schedulesApi.trigger(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Run triggered");
      if (data.run_id) navigate(`/runs/${data.run_id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = schedulesData?.schedules || [];
  const agentMap = new Map((agentsData?.agents || []).map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-sm text-muted-foreground">Automate agent runs on a schedule</p>
        </div>
        <CreateScheduleDialog agents={agentsData?.agents || []} />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No schedules yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create a schedule to run agents automatically</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items.map((s) => {
          const agent = agentMap.get(s.agent_id);
          return (
            <Card key={s.id} className={!s.enabled ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`shrink-0 p-2 rounded-lg ${s.enabled ? "bg-blue-500/10" : "bg-muted"}`}>
                    {s.schedule_type === "cron" ? <Calendar className="h-5 w-5 text-blue-400" /> :
                     s.schedule_type === "every" ? <Timer className="h-5 w-5 text-blue-400" /> :
                     <Zap className="h-5 w-5 text-blue-400" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      <Badge variant={s.enabled ? "default" : "secondary"}>
                        {s.enabled ? "active" : "paused"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{agent?.name || s.agent_id.slice(0, 8)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {scheduleDescription(s)}
                      </span>
                      <span>{s.timezone}</span>
                    </div>
                  </div>

                  {/* Next run */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">
                      {s.enabled ? formatNextRun(s.next_run_at) : "—"}
                    </div>
                    {s.last_run_status && (
                      <div className="flex items-center gap-1 justify-end mt-1 text-xs text-muted-foreground">
                        {statusIcon(s.last_run_status)}
                        <span>Last: {s.last_run_status}</span>
                      </div>
                    )}
                    {s.consecutive_errors > 0 && (
                      <div className="flex items-center gap-1 justify-end mt-0.5 text-xs text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {s.consecutive_errors} errors
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" title="Run now" onClick={() => triggerMut.mutate(s.id)}>
                      <PlayCircle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title={s.enabled ? "Pause" : "Resume"} onClick={() => toggleMut.mutate(s)}>
                      {s.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" className="text-destructive" onClick={() => deleteMut.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Mission / error detail */}
                {s.mission && (
                  <p className="mt-2 text-xs text-muted-foreground truncate pl-14">{s.mission}</p>
                )}
                {s.last_error && (
                  <p className="mt-1 text-xs text-red-400 truncate pl-14">Error: {s.last_error}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
