import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workflows, agents as agentsApi, type Workflow, type WorkflowRun, type StepRun } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import {
  Plus, Trash2, Play, Network, ChevronDown, ChevronUp, Clock, CheckCircle,
  XCircle, Loader2, ArrowRight, Eye
} from "lucide-react";
import { Link } from "react-router-dom";

// Step builder row
function StepRow({
  step, index, agents, onUpdate, onRemove, stepNames,
}: {
  step: { agent_id: string; name: string; mission_template: string; depends_on: string[] };
  index: number;
  agents: { id: string; name: string }[];
  onUpdate: (s: typeof step) => void;
  onRemove: () => void;
  stepNames: string[];
}) {
  return (
    <div className="border border-border/50 rounded p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-primary">Step {index + 1}</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] font-mono">Step Name</Label>
          <Input value={step.name} onChange={e => onUpdate({ ...step, name: e.target.value })}
            placeholder="research" className="h-8 text-xs font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono">Agent</Label>
          <Select value={step.agent_id} onValueChange={v => onUpdate({ ...step, agent_id: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select agent" /></SelectTrigger>
            <SelectContent>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] font-mono">Mission Template</Label>
        <textarea value={step.mission_template}
          onChange={e => onUpdate({ ...step, mission_template: e.target.value })}
          placeholder="Research {{input}} and provide key findings..."
          className="w-full h-16 text-xs font-mono bg-background border border-border/50 rounded p-2 resize-none" />
        <p className="text-[10px] text-muted-foreground">
          Use <code className="text-primary">{"{{input}}"}</code> for workflow input,{" "}
          <code className="text-primary">{"{{steps.NAME.output}}"}</code> for a previous step's output.
        </p>
      </div>
      {stepNames.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10px] font-mono">Depends On (optional)</Label>
          <div className="flex gap-2 flex-wrap">
            {stepNames.map(sn => (
              <label key={sn} className="flex items-center gap-1 text-xs font-mono cursor-pointer">
                <input type="checkbox" checked={step.depends_on.includes(sn)}
                  onChange={e => {
                    const deps = e.target.checked
                      ? [...step.depends_on, sn]
                      : step.depends_on.filter(d => d !== sn);
                    onUpdate({ ...step, depends_on: deps });
                  }} className="rounded" />
                {sn}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Status icon for workflow runs
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "succeeded": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
    case "running": return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function WorkflowsPage() {
  const qc = useQueryClient();
  const { data: wfData } = useQuery({ queryKey: ["workflows"], queryFn: workflows.list });
  const { data: agentData } = useQuery({ queryKey: ["agents"], queryFn: agentsApi.list });
  const wfs = wfData?.workflows ?? [];
  const agentList = agentData?.agents ?? [];

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  type StepDef = { agent_id: string; name: string; mission_template: string; depends_on: string[] };
  const [steps, setSteps] = useState<StepDef[]>([
    { agent_id: "", name: "", mission_template: "", depends_on: [] },
  ]);

  // Run input
  const [runInput, setRunInput] = useState<Record<string, string>>({});
  const [expandedWf, setExpandedWf] = useState<string | null>(null);

  // Workflow run detail
  const [viewRunId, setViewRunId] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: workflows.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow created");
      setShowCreate(false);
      setName(""); setDescription("");
      setSteps([{ agent_id: "", name: "", mission_template: "", depends_on: [] }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: workflows.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      toast.success("Workflow deleted");
    },
  });

  const runMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: string }) => workflows.run(id, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow-runs", vars.id] });
      toast.success("Workflow started");
      setRunInput({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || steps.some(s => !s.agent_id || !s.name || !s.mission_template)) {
      toast.error("Fill in all step fields"); return;
    }
    createMut.mutate({ name, description, steps });
  };

  const addStep = () => setSteps([...steps, { agent_id: "", name: "", mission_template: "", depends_on: [] }]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            AI Teams
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-agent workflows. Chain agents together — each step's output feeds the next.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} variant={showCreate ? "outline" : "default"} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {showCreate ? "Cancel" : "New Workflow"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-sm font-mono">Create Workflow</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-mono">Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Research Pipeline" className="text-sm" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-mono">Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Researches topic, then writes a report" className="text-sm" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-mono">Steps</Label>
                  <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={addStep}>
                    <Plus className="h-3 w-3 mr-1" /> Add Step
                  </Button>
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <StepRow key={i} step={step} index={i} agents={agentList}
                      stepNames={steps.slice(0, i).map(s => s.name).filter(Boolean)}
                      onUpdate={s => { const ns = [...steps]; ns[i] = s; setSteps(ns); }}
                      onRemove={() => setSteps(steps.filter((_, j) => j !== i))} />
                  ))}
                </div>
              </div>

              {/* Flow visualization */}
              {steps.length > 1 && (
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground px-2">
                  {steps.map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded border ${s.name ? "border-primary/30 text-primary" : "border-border/50"}`}>
                        {s.name || `step-${i + 1}`}
                      </span>
                      {i < steps.length - 1 && <ArrowRight className="h-3 w-3" />}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={createMut.isPending} size="sm">
                  {createMut.isPending ? "Creating..." : "Create Workflow"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Workflow list */}
      {wfs.length === 0 && !showCreate ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Network className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No workflows yet. Create one to chain agents together.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {wfs.map((wf: Workflow) => (
            <WorkflowCard key={wf.id} wf={wf} expandedWf={expandedWf} setExpandedWf={setExpandedWf}
              runInput={runInput} setRunInput={setRunInput} onRun={runMut.mutate} onDelete={deleteMut.mutate}
              viewRunId={viewRunId} setViewRunId={setViewRunId} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({ wf, expandedWf, setExpandedWf, runInput, setRunInput, onRun, onDelete, viewRunId, setViewRunId }: {
  wf: Workflow; expandedWf: string | null; setExpandedWf: (id: string | null) => void;
  runInput: Record<string, string>; setRunInput: (r: Record<string, string>) => void;
  onRun: (args: { id: string; input: string }) => void; onDelete: (id: string) => void;
  viewRunId: string | null; setViewRunId: (id: string | null) => void;
}) {
  const isExpanded = expandedWf === wf.id;
  const { data: detailData } = useQuery({
    queryKey: ["workflow", wf.id],
    queryFn: () => workflows.get(wf.id),
    enabled: isExpanded,
  });
  const { data: runsData } = useQuery({
    queryKey: ["workflow-runs", wf.id],
    queryFn: () => workflows.listRuns(wf.id),
    enabled: isExpanded,
    refetchInterval: isExpanded ? 3000 : false,
  });
  const { data: runDetail } = useQuery({
    queryKey: ["workflow-run", viewRunId],
    queryFn: () => workflows.getRun(viewRunId!),
    enabled: !!viewRunId,
    refetchInterval: viewRunId ? 3000 : false,
  });

  const wfSteps = detailData?.steps ?? [];
  const wfRuns = runsData?.workflow_runs ?? [];
  const stepRuns: StepRun[] = runDetail?.step_runs ?? [];

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedWf(isExpanded ? null : wf.id)}>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            <div>
              <h3 className="font-mono text-sm font-semibold">{wf.name}</h3>
              {wf.description && <p className="text-xs text-muted-foreground">{wf.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${wf.enabled ? "bg-green-950/30 text-green-500" : "bg-red-950/30 text-red-500"}`}>
              {wf.enabled ? "ACTIVE" : "DISABLED"}
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm("Delete workflow?")) onDelete(wf.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4 border-t border-border/30 pt-4">
            {/* Steps */}
            <div>
              <h4 className="text-[10px] font-mono text-muted-foreground mb-2">PIPELINE</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {wfSteps.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1">
                    <div className="px-2 py-1 rounded border border-primary/30 bg-primary/5">
                      <span className="text-xs font-mono text-primary">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({s.agent_name})</span>
                    </div>
                    {i < wfSteps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Run input */}
            <div className="flex gap-2">
              <Input value={runInput[wf.id] || ""} onChange={e => setRunInput({ ...runInput, [wf.id]: e.target.value })}
                placeholder="Enter mission / prompt for this workflow..."
                className="text-xs font-mono flex-1" />
              <Button size="sm" className="h-8" onClick={() => onRun({ id: wf.id, input: runInput[wf.id] || "" })}
                disabled={!runInput[wf.id]}>
                <Play className="h-3.5 w-3.5 mr-1" /> Run
              </Button>
            </div>

            {/* Recent runs */}
            {wfRuns.length > 0 && (
              <div>
                <h4 className="text-[10px] font-mono text-muted-foreground mb-2">RECENT RUNS</h4>
                <div className="space-y-1">
                  {wfRuns.slice(0, 5).map((wr: WorkflowRun) => (
                    <div key={wr.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer"
                      onClick={() => setViewRunId(viewRunId === wr.id ? null : wr.id)}>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={wr.status} />
                        <span className="text-xs font-mono">{wr.status}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{wr.input_text}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{new Date(wr.created_at).toLocaleString()}</span>
                        <Eye className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step run detail */}
            {viewRunId && stepRuns.length > 0 && (
              <div className="border border-border/30 rounded p-3 bg-muted/10">
                <h4 className="text-[10px] font-mono text-muted-foreground mb-2">STEP STATUS</h4>
                <div className="space-y-2">
                  {stepRuns.map((sr: StepRun) => (
                    <div key={sr.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={sr.status} />
                        <span className="text-xs font-mono text-primary">{sr.step_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">{sr.status}</span>
                        {sr.run_id && (
                          <Link to={`/runs/${sr.run_id}`} className="text-[10px] text-primary hover:underline">
                            view run →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {runDetail?.workflow_run?.output_text && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <h4 className="text-[10px] font-mono text-muted-foreground mb-1">OUTPUT</h4>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {runDetail.workflow_run.output_text}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
