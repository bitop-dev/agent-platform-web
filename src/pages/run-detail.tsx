import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { runs as runsApi, connectRunStream, type RunEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import {
  ArrowLeft, Square, Clock, Zap, Hash,
  ChevronDown, ChevronRight, Play, CheckCircle,
  XCircle, Wrench, MessageSquare, AlertCircle, Bot, Activity
} from "lucide-react";

// ─── Event parsing ───────────────────────────────────────────────────────────

interface ParsedEvent {
  seq: number;
  type: string;
  data: Record<string, unknown>;
  raw: string;
}

function parseEvent(e: RunEvent): ParsedEvent {
  let data: Record<string, unknown> = {};
  let raw = "";
  try {
    if (e.data) {
      raw = e.data;
      const parsed = JSON.parse(e.data);
      if (typeof parsed === "object" && parsed !== null) data = parsed;
      else data = { value: parsed };
    }
  } catch { data = { value: e.data }; raw = e.data || ""; }
  return { seq: e.seq, type: e.event_type, data, raw };
}

// ─── Timeline model ──────────────────────────────────────────────────────────

interface TimelineStep {
  id: string;
  type: "agent_start" | "turn" | "tool_call" | "agent_end" | "error" | "other";
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  color: string;
  expandable: boolean;
  content?: string;
  status?: "success" | "error" | "running" | "info";
  children?: TimelineStep[];
  callId?: string;
}

function buildTimeline(events: ParsedEvent[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  let currentTurn: TimelineStep | null = null;
  let turnText = "";
  let turnNumber = 0;

  const flushTurn = () => {
    if (!currentTurn) return;
    if (turnText.trim()) {
      currentTurn.expandable = true;
      currentTurn.content = turnText.trim();
      currentTurn.sublabel = `${turnText.trim().length} chars`;
    }
    steps.push(currentTurn);
    currentTurn = null;
    turnText = "";
  };

  for (const e of events) {
    const d = e.data || {};
    switch (e.type) {
      case "agent_start":
        steps.push({ id: "agent-start", type: "agent_start", label: "Agent initialized", icon: <Play className="h-3 w-3" />, color: "text-blue-400", expandable: false, status: "info" });
        break;
      case "turn_start":
        flushTurn();
        turnNumber = Number(d.value || d.Turn || d.turn || turnNumber + 1);
        currentTurn = { id: `turn-${turnNumber}`, type: "turn", label: `Turn ${turnNumber}`, icon: <MessageSquare className="h-3 w-3" />, color: "text-blue-300", expandable: false, status: "info", children: [] };
        break;
      case "text_delta":
        turnText += String(d.Text || d.text || d.delta || d.Delta || "");
        break;
      case "tool_call_start": {
        const name = String(d.ToolName || d.tool_name || d.Name || d.name || "?");
        const callId = String(d.ToolCallID || d.tool_call_id || d.id || "");
        let argsDisplay = "";
        const rawArgs = d.Arguments || d.arguments || d.args || "";
        if (rawArgs) {
          try {
            const parsed = JSON.parse(String(rawArgs));
            argsDisplay = Object.entries(parsed).map(([k, v]) => {
              const s = String(v);
              return `${k}: ${s.length > 120 ? s.slice(0, 120) + "…" : s}`;
            }).join("\n");
          } catch { argsDisplay = String(rawArgs); }
        }
        const toolStep: TimelineStep = { id: `tool-${e.seq}`, type: "tool_call", label: name, sublabel: "executing…", icon: <Wrench className="h-3 w-3" />, color: "text-amber-400", expandable: !!argsDisplay, content: argsDisplay ? `Args:\n${argsDisplay}` : undefined, status: "running", callId };
        if (currentTurn) { currentTurn.children = currentTurn.children || []; currentTurn.children.push(toolStep); }
        else steps.push(toolStep);
        break;
      }
      case "tool_call_end": {
        const name = String(d.ToolName || d.tool_name || d.Name || d.name || "?");
        const callId = String(d.ToolCallID || d.tool_call_id || d.id || "");
        const output = String(d.Content || d.content || d.Output || d.output || "");
        const isErr = d.IsError === true || d.is_error === true;
        const truncOutput = output.length > 500 ? output.slice(0, 500) + "\n…truncated" : output;
        const container = currentTurn?.children || steps;
        const startIdx = [...container].reverse().findIndex(s => s.type === "tool_call" && s.status === "running" && (callId && s.callId ? s.callId === callId : s.label === name));
        if (startIdx >= 0) {
          const idx = container.length - 1 - startIdx;
          container[idx].status = isErr ? "error" : "success";
          container[idx].sublabel = isErr ? "error" : `${output.length} chars`;
          container[idx].icon = isErr ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />;
          container[idx].color = isErr ? "text-red-400" : "text-emerald-400";
          container[idx].expandable = true;
          const existing = container[idx].content || "";
          container[idx].content = existing ? `${existing}\n\nOutput:\n${truncOutput}` : `Output:\n${truncOutput}`;
        }
        break;
      }
      case "agent_end": {
        flushTurn();
        const turns = Number(d.TotalTurns || d.total_turns || 0);
        const dur = Number(d.DurationMs || d.duration_ms || 0);
        const reason = String(d.StopReason || d.stop_reason || "complete");
        steps.push({ id: "agent-end", type: "agent_end", label: `Complete — ${reason}`, sublabel: turns ? `${turns} turns${dur ? ` · ${(dur / 1000).toFixed(1)}s` : ""}` : undefined, icon: <CheckCircle className="h-3 w-3" />, color: "text-emerald-400", expandable: false, status: "success" });
        break;
      }
      case "error": {
        flushTurn();
        const msg = String(d.error || d.Error || d.message || d.value || "Unknown error");
        steps.push({ id: `err-${e.seq}`, type: "error", label: "Error", sublabel: msg.length > 50 ? msg.slice(0, 50) + "…" : msg, icon: <AlertCircle className="h-3 w-3" />, color: "text-red-400", expandable: msg.length > 50, content: msg, status: "error" });
        break;
      }
      case "context_compact":
        if (currentTurn) { currentTurn.children = currentTurn.children || []; currentTurn.children.push({ id: `c-${e.seq}`, type: "other", label: "Context compacted", icon: <Zap className="h-3 w-3" />, color: "text-amber-400", expandable: false, status: "info" }); }
        break;
      default: break;
    }
  }
  flushTurn();
  return steps;
}

// ─── StepRow ─────────────────────────────────────────────────────────────────

function StepRow({ step, depth = 0 }: { step: TimelineStep; depth?: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = step.children && step.children.length > 0;
  const isExpandable = step.expandable || hasChildren;

  const borderCls =
    step.status === "error" ? "border-red-500/20" :
    step.status === "success" ? "border-emerald-500/15" :
    step.status === "running" ? "border-amber-500/20" :
    "border-border";

  return (
    <div className={depth > 0 ? "ml-4" : ""}>
      <button
        className={cn(
          "flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs rounded border transition-colors",
          borderCls,
          isExpandable ? "cursor-pointer hover:bg-muted/30" : "cursor-default",
          step.status === "error" && "bg-red-500/5",
          step.status === "running" && "bg-amber-500/5",
        )}
        onClick={() => isExpandable && setOpen(!open)}
        disabled={!isExpandable}
      >
        <span className={cn("shrink-0", step.color)}>{step.icon}</span>
        <span className="font-mono font-medium flex-1 truncate text-[11px]">{step.label}</span>
        {step.sublabel && <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[120px]">{step.sublabel}</span>}
        {isExpandable && (open ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />)}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {hasChildren && step.children!.map((child) => <StepRow key={child.id} step={child} depth={depth + 1} />)}
          {step.content && (
            <div className={cn("rounded border border-border bg-background/60", depth > 0 ? "ml-4" : "")}>
              <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap break-words p-3 max-h-48 overflow-auto leading-relaxed">{step.content}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const ledMap: Record<string, string> = {
  queued: "led-amber",
  running: "led-blue led-pulse",
  succeeded: "led-green",
  failed: "led-red",
  cancelled: "led-red",
};
const statusBadge: Record<string, string> = {
  queued: "border-amber-500/30 text-amber-400",
  running: "border-blue-500/30 text-blue-400",
  succeeded: "border-emerald-500/30 text-emerald-400",
  failed: "border-red-500/30 text-red-400",
  cancelled: "border-red-500/30 text-red-400",
};

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [streamText, setStreamText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: run, refetch } = useQuery({
    queryKey: ["run", id],
    queryFn: () => runsApi.get(id!),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "queued" || s === "running" ? 2000 : false;
    },
  });

  const { data: eventData } = useQuery({
    queryKey: ["run-events", id],
    queryFn: () => runsApi.events(id!),
    enabled: !!run && run.status !== "queued",
  });

  useEffect(() => {
    if (eventData?.events) {
      const parsed = eventData.events.map(parseEvent);
      setEvents(parsed);
      const text = parsed.filter(e => e.type === "text_delta").map(e => String(e.data.Text || e.data.text || e.data.delta || "")).join("");
      if (text) setStreamText(text);
    }
  }, [eventData]);

  const handleStreamEvent = useCallback((raw: RunEvent) => {
    const parsed = parseEvent(raw);
    setEvents(prev => [...prev, parsed]);
    if (parsed.type === "text_delta") setStreamText(prev => prev + String(parsed.data.Text || parsed.data.text || parsed.data.delta || ""));
    if (parsed.type === "agent_end" || parsed.type === "error") refetch();
  }, [refetch]);

  useEffect(() => {
    if (run?.status === "running" || run?.status === "queued") {
      wsRef.current = connectRunStream(id!, handleStreamEvent, () => refetch());
      return () => wsRef.current?.close();
    }
  }, [id, run?.status, handleStreamEvent, refetch]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [streamText]);

  const timeline = useMemo(() => buildTimeline(events), [events]);
  const isActive = run?.status === "running" || run?.status === "queued";
  const totalTokens = (run?.input_tokens || 0) + (run?.output_tokens || 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-medium truncate">{run?.mission || "Loading…"}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("led", ledMap[run?.status || "queued"])} />
            <span className="font-mono text-[11px] text-muted-foreground">{run?.model_name} · {id?.slice(0, 8)}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn("font-mono text-[9px] tracking-wider uppercase", statusBadge[run?.status || "queued"])}>
          {run?.status}
        </Badge>
        {isActive && (
          <Button variant="destructive" size="sm" onClick={() => runsApi.cancel(id!).then(() => refetch())} className="font-mono text-xs tracking-wider uppercase h-8">
            <Square className="mr-1 h-3 w-3" /> Abort
          </Button>
        )}
      </div>

      {/* Stats bar */}
      {run && (
        <div className="flex items-center gap-5 rounded border border-border bg-card/50 px-4 py-2.5">
          <Stat icon={<Hash className="h-3 w-3" />} label="TURNS" value={String(run.total_turns || 0)} />
          <div className="h-4 w-px bg-border" />
          <Stat icon={<Clock className="h-3 w-3" />} label="DURATION" value={run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : isActive ? "…" : "—"} />
          <div className="h-4 w-px bg-border" />
          <Stat icon={<Zap className="h-3 w-3" />} label="TOKENS" value={totalTokens > 0 ? totalTokens.toLocaleString() : "—"} />
          {run.input_tokens > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="font-mono text-[10px] text-muted-foreground">
                IN {run.input_tokens.toLocaleString()} / OUT {run.output_tokens.toLocaleString()}
              </span>
            </>
          )}
        </div>
      )}

      {/* Output + Timeline */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 glow-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs tracking-wider uppercase flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              Output
              {isActive && <span className="led led-green led-pulse ml-1" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {streamText || run?.output_text ? (
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{streamText || run?.output_text}</pre>
              ) : (
                <p className="text-muted-foreground text-sm py-4">{isActive ? "Waiting for output…" : "No output."}</p>
              )}
              <div ref={scrollRef} />
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="glow-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs tracking-wider uppercase flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                Timeline
              </span>
              <span className="text-[10px] font-normal text-muted-foreground">{timeline.length} steps</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-1">
                {timeline.length === 0 && !isActive && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No events recorded.</p>
                )}
                {timeline.map(step => <StepRow key={step.id} step={step} />)}
                {isActive && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <span className="led led-blue led-pulse" />
                    <span className="font-mono text-[10px]">Processing…</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {run?.error_message && (
        <div className="rounded border border-red-500/20 bg-red-500/5 px-4 py-3">
          <pre className="font-mono text-xs text-red-400 whitespace-pre-wrap">{run.error_message}</pre>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-mono text-[9px] tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-medium">{value}</span>
    </div>
  );
}
