import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { runs as runsApi, connectRunStream, type RunEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  ArrowLeft, Square, Clock, Zap, Hash,
  ChevronDown, ChevronRight, Play, CheckCircle,
  XCircle, Wrench, MessageSquare, AlertCircle, Bot
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
      if (typeof parsed === "object" && parsed !== null) {
        data = parsed;
      } else {
        // Primitives like turn number "1"
        data = { value: parsed };
      }
    }
  } catch {
    data = { value: e.data };
    raw = e.data || "";
  }
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
  content?: string;         // Expanded detail text
  status?: "success" | "error" | "running" | "info";
  children?: TimelineStep[]; // Tool calls within a turn
  callId?: string;          // ToolCallID for matching start→end
}

function buildTimeline(events: ParsedEvent[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  let currentTurn: TimelineStep | null = null;
  let turnText = "";
  let turnNumber = 0;

  const flushTurn = () => {
    if (!currentTurn) return;
    // Add accumulated text as expandable content
    if (turnText.trim()) {
      currentTurn.expandable = true;
      currentTurn.content = turnText.trim();
      currentTurn.sublabel = `${turnText.trim().length} chars output`;
    }
    steps.push(currentTurn);
    currentTurn = null;
    turnText = "";
  };

  for (const e of events) {
    const d = e.data || {};

    switch (e.type) {
      case "agent_start":
        steps.push({
          id: `agent-start`,
          type: "agent_start",
          label: "Agent started",
          icon: <Play className="h-3.5 w-3.5" />,
          color: "text-blue-400",
          expandable: false,
          status: "info",
        });
        break;

      case "turn_start": {
        flushTurn();
        turnNumber = Number(d.value || d.Turn || d.turn || turnNumber + 1);
        currentTurn = {
          id: `turn-${turnNumber}`,
          type: "turn",
          label: `Turn ${turnNumber}`,
          icon: <MessageSquare className="h-3.5 w-3.5" />,
          color: "text-blue-300",
          expandable: false,
          status: "info",
          children: [],
        };
        break;
      }

      case "text_delta": {
        const text = String(d.Text || d.text || d.delta || d.Delta || "");
        turnText += text;
        break;
      }

      case "tool_call_start": {
        const name = String(d.ToolName || d.tool_name || d.Name || d.name || "unknown");
        const callId = String(d.ToolCallID || d.tool_call_id || d.id || "");
        let argsDisplay = "";
        const rawArgs = d.Arguments || d.arguments || d.args || "";
        if (rawArgs) {
          try {
            const parsed = JSON.parse(String(rawArgs));
            argsDisplay = Object.entries(parsed)
              .map(([k, v]) => {
                const s = String(v);
                return `${k}: ${s.length > 120 ? s.slice(0, 120) + "…" : s}`;
              })
              .join("\n");
          } catch {
            argsDisplay = String(rawArgs);
          }
        }
        const toolStep: TimelineStep = {
          id: `tool-start-${e.seq}`,
          type: "tool_call",
          label: name,
          sublabel: "running…",
          icon: <Wrench className="h-3.5 w-3.5" />,
          color: "text-yellow-400",
          expandable: !!argsDisplay,
          content: argsDisplay ? `Arguments:\n${argsDisplay}` : undefined,
          status: "running",
          callId,
        };
        if (currentTurn) {
          currentTurn.children = currentTurn.children || [];
          currentTurn.children.push(toolStep);
        } else {
          steps.push(toolStep);
        }
        break;
      }

      case "tool_call_end": {
        const name = String(d.ToolName || d.tool_name || d.Name || d.name || "unknown");
        const callId = String(d.ToolCallID || d.tool_call_id || d.id || "");
        const output = String(d.Content || d.content || d.Output || d.output || "");
        const isErr = d.IsError === true || d.is_error === true;
        const truncOutput = output.length > 500 ? output.slice(0, 500) + "\n… (truncated)" : output;

        // Match by ToolCallID first, fall back to name
        const container = currentTurn?.children || steps;
        const startIdx = [...container].reverse().findIndex(
          (s) => s.type === "tool_call" && s.status === "running" &&
            (callId && s.callId ? s.callId === callId : s.label === name)
        );
        if (startIdx >= 0) {
          const idx = container.length - 1 - startIdx;
          container[idx].status = isErr ? "error" : "success";
          container[idx].sublabel = isErr ? "error" : `${output.length} chars`;
          container[idx].icon = isErr
            ? <XCircle className="h-3.5 w-3.5" />
            : <CheckCircle className="h-3.5 w-3.5" />;
          container[idx].color = isErr ? "text-red-400" : "text-green-400";
          container[idx].expandable = true;
          const existing = container[idx].content || "";
          container[idx].content = existing
            ? `${existing}\n\nOutput:\n${truncOutput}`
            : `Output:\n${truncOutput}`;
        } else {
          // Orphan tool_call_end — add standalone
          const toolEnd: TimelineStep = {
            id: `tool-end-${e.seq}`,
            type: "tool_call",
            label: `${name}`,
            sublabel: isErr ? "error" : `${output.length} chars`,
            icon: isErr ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />,
            color: isErr ? "text-red-400" : "text-green-400",
            expandable: !!truncOutput,
            content: truncOutput ? `Output:\n${truncOutput}` : undefined,
            status: isErr ? "error" : "success",
          };
          if (currentTurn) {
            currentTurn.children = currentTurn.children || [];
            currentTurn.children.push(toolEnd);
          } else {
            steps.push(toolEnd);
          }
        }
        break;
      }

      case "turn_end":
        // Just triggers the flush; label gets set by flushTurn
        break;

      case "agent_end": {
        flushTurn();
        const turns = Number(d.TotalTurns || d.total_turns || 0);
        const dur = Number(d.DurationMs || d.duration_ms || 0);
        const reason = String(d.StopReason || d.stop_reason || "complete");
        steps.push({
          id: `agent-end`,
          type: "agent_end",
          label: `Finished — ${reason}`,
          sublabel: turns ? `${turns} turn${turns > 1 ? "s" : ""}${dur ? ` · ${(dur / 1000).toFixed(1)}s` : ""}` : undefined,
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          color: "text-green-400",
          expandable: false,
          status: "success",
        });
        break;
      }

      case "error": {
        flushTurn();
        const msg = String(d.error || d.Error || d.message || d.value || "Unknown error");
        steps.push({
          id: `error-${e.seq}`,
          type: "error",
          label: "Error",
          sublabel: msg.length > 60 ? msg.slice(0, 60) + "…" : msg,
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          color: "text-red-400",
          expandable: msg.length > 60,
          content: msg,
          status: "error",
        });
        break;
      }

      case "context_compact":
        if (currentTurn) {
          currentTurn.children = currentTurn.children || [];
          currentTurn.children.push({
            id: `compact-${e.seq}`,
            type: "other",
            label: "Context compacted",
            icon: <Zap className="h-3.5 w-3.5" />,
            color: "text-orange-400",
            expandable: false,
            status: "info",
          });
        }
        break;

      case "loop_detected":
        if (currentTurn) {
          currentTurn.children = currentTurn.children || [];
          currentTurn.children.push({
            id: `loop-${e.seq}`,
            type: "other",
            label: "Loop detected",
            sublabel: String(d.Strategy || d.strategy || ""),
            icon: <AlertCircle className="h-3.5 w-3.5" />,
            color: "text-orange-400",
            expandable: false,
            status: "info",
          });
        }
        break;

      // message_start, message_end — skip, no useful info
      case "message_start":
      case "message_end":
        break;

      default:
        break;
    }
  }

  flushTurn();
  return steps;
}

// ─── Timeline components ─────────────────────────────────────────────────────

function StepRow({ step, depth = 0 }: { step: TimelineStep; depth?: number }) {
  const [open, setOpen] = useState(false);

  const bgClass =
    step.status === "error" ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10" :
    step.status === "success" ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10" :
    step.type === "turn" ? "border-border bg-muted/30 hover:bg-muted/50" :
    step.type === "tool_call" && step.status === "running" ? "border-yellow-500/20 bg-yellow-500/5" :
    "border-border bg-transparent hover:bg-muted/30";

  const hasChildren = step.children && step.children.length > 0;
  const isExpandable = step.expandable || hasChildren;

  return (
    <div className={depth > 0 ? "ml-4" : ""}>
      <button
        className={`flex items-center gap-2 w-full text-left px-3 py-2 text-xs rounded-md border transition-colors ${bgClass}`}
        onClick={() => isExpandable && setOpen(!open)}
        disabled={!isExpandable}
      >
        <span className={`shrink-0 ${step.color}`}>{step.icon}</span>
        <span className="font-medium flex-1 truncate">{step.label}</span>
        {step.sublabel && (
          <span className="text-muted-foreground text-[10px] truncate max-w-[140px]">
            {step.sublabel}
          </span>
        )}
        {isExpandable && (
          open
            ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-1">
          {/* Tool calls within this turn */}
          {hasChildren && step.children!.map((child) => (
            <StepRow key={child.id} step={child} depth={depth + 1} />
          ))}
          {/* Expandable content (text output, tool args/output) */}
          {step.content && (
            <div className={`${depth > 0 ? "ml-4" : ""} ml-1 rounded border border-border bg-background/60`}>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words p-3 max-h-60 overflow-auto leading-relaxed">
                {step.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

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
      const text = parsed
        .filter((e) => e.type === "text_delta")
        .map((e) => String(e.data.Text || e.data.text || e.data.delta || ""))
        .join("");
      if (text) setStreamText(text);
    }
  }, [eventData]);

  const handleStreamEvent = useCallback((raw: RunEvent) => {
    const parsed = parseEvent(raw);
    setEvents((prev) => [...prev, parsed]);
    if (parsed.type === "text_delta") {
      setStreamText((prev) => prev + String(parsed.data.Text || parsed.data.text || parsed.data.delta || ""));
    }
    if (parsed.type === "agent_end" || parsed.type === "error") refetch();
  }, [refetch]);

  useEffect(() => {
    if (run?.status === "running" || run?.status === "queued") {
      wsRef.current = connectRunStream(id!, handleStreamEvent, () => refetch());
      return () => wsRef.current?.close();
    }
  }, [id, run?.status, handleStreamEvent, refetch]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamText]);

  const timeline = useMemo(() => buildTimeline(events), [events]);
  const isActive = run?.status === "running" || run?.status === "queued";

  const statusBadge = run && (
    <Badge
      variant={
        run.status === "succeeded" ? "default" :
        run.status === "failed" ? "destructive" : "outline"
      }
    >
      {run.status}
    </Badge>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{run?.mission || "Loading…"}</h1>
          <p className="text-sm text-muted-foreground">{run?.model_name} · Run {id?.slice(0, 8)}</p>
        </div>
        {statusBadge}
        {isActive && (
          <Button variant="destructive" size="sm" onClick={() => runsApi.cancel(id!).then(() => refetch())}>
            <Square className="mr-1 h-3 w-3" /> Stop
          </Button>
        )}
      </div>

      {/* Stats bar */}
      {run && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" /> {run.total_turns || 0} turns
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{" "}
            {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : isActive ? "Running…" : "—"}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" /> {(run.input_tokens || 0) + (run.output_tokens || 0)} tokens
          </span>
        </div>
      )}

      {/* Main content: Output + Timeline */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Output pane */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Output
              {isActive && <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {streamText || run?.output_text ? (
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                  {streamText || run?.output_text}
                </pre>
              ) : (
                <p className="text-muted-foreground">
                  {isActive ? "Waiting for output…" : "No output."}
                </p>
              )}
              <div ref={scrollRef} />
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Timeline pane */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Timeline</span>
              <span className="text-xs font-normal text-muted-foreground">
                {timeline.length} steps
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {timeline.length === 0 && !isActive && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No events recorded.</p>
                )}
                {timeline.map((step) => (
                  <StepRow key={step.id} step={step} />
                ))}
                {isActive && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    Running…
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Error banner */}
      {run?.error_message && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <pre className="text-sm text-destructive whitespace-pre-wrap">{run.error_message}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
