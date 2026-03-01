"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { runs as runsApi, connectRunStream, type RunEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Square,
  Clock,
  Zap,
  Hash,
  ChevronDown,
  ChevronRight,
  Play,
  CheckCircle,
  XCircle,
  Wrench,
  MessageSquare,
  AlertCircle,
} from "lucide-react";

interface ParsedEvent {
  seq: number;
  type: string;
  data: Record<string, unknown>;
  raw: RunEvent;
}

// Collapsed timeline item for display
interface TimelineItem {
  id: string;
  type: "start" | "end" | "tool" | "text" | "error" | "status";
  label: string;
  detail?: string;
  icon: React.ReactNode;
  color: string;
  expandable: boolean;
  expandedContent?: string;
  seq: number;
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [streamText, setStreamText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: run, refetch } = useQuery({
    queryKey: ["run", id],
    queryFn: () => runsApi.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2000 : false;
    },
  });

  const { data: eventData } = useQuery({
    queryKey: ["run-events", id],
    queryFn: () => runsApi.events(id),
    enabled: !!run && run.status !== "queued",
  });

  useEffect(() => {
    if (eventData?.events) {
      const parsed = eventData.events.map(parseEvent);
      setEvents(parsed);

      const text = parsed
        .filter((e) => e.type === "text_delta")
        .map((e) => String(e.data.delta || e.data.Delta || e.data.Text || ""))
        .join("");
      if (text) setStreamText(text);
    }
  }, [eventData]);

  const handleStreamEvent = useCallback(
    (rawEvent: RunEvent) => {
      const parsed = parseEvent(rawEvent);
      setEvents((prev) => [...prev, parsed]);
      if (parsed.type === "text_delta") {
        const delta = String(
          parsed.data.delta || parsed.data.Delta || parsed.data.Text || ""
        );
        setStreamText((prev) => prev + delta);
      }
      if (parsed.type === "agent_end" || parsed.type === "error") {
        refetch();
      }
    },
    [refetch]
  );

  useEffect(() => {
    if (run?.status === "running" || run?.status === "queued") {
      wsRef.current = connectRunStream(id, handleStreamEvent, () => {
        refetch();
      });
      return () => wsRef.current?.close();
    }
  }, [id, run?.status, handleStreamEvent, refetch]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamText]);

  // Build collapsed timeline from raw events
  const timeline = useMemo(() => buildTimeline(events), [events]);

  const isActive = run?.status === "running" || run?.status === "queued";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold truncate max-w-2xl">
            {run?.mission || "Loading..."}
          </h1>
          <p className="text-sm text-muted-foreground">
            {run?.model_name} · Run {id.slice(0, 8)}
          </p>
        </div>
        {run && <StatusBadge status={run.status} />}
        {isActive && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => runsApi.cancel(id).then(() => refetch())}
          >
            <Square className="mr-1 h-3 w-3" /> Stop
          </Button>
        )}
      </div>

      {/* Stats */}
      {run && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" /> {run.total_turns} turns
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{" "}
            {run.duration_ms
              ? `${(run.duration_ms / 1000).toFixed(1)}s`
              : isActive
                ? "Running..."
                : "—"}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />{" "}
            {(run.input_tokens || 0) + (run.output_tokens || 0)} tokens
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main output */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Output
              {isActive && (
                <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="prose prose-invert max-w-none">
                {streamText || run?.output_text ? (
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {streamText || run?.output_text}
                  </pre>
                ) : (
                  <p className="text-muted-foreground">
                    {isActive
                      ? "Waiting for output..."
                      : "No output generated."}
                  </p>
                )}
              </div>
              <div ref={scrollRef} />
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Timeline</span>
              <span className="text-xs font-normal text-muted-foreground">
                {timeline.length} events
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {timeline.map((item) => (
                  <TimelineRow key={item.id} item={item} />
                ))}
                {isActive && (
                  <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    Running...
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {run?.error_message && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <pre className="text-sm text-destructive whitespace-pre-wrap">
              {run.error_message}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-md border ${item.color} overflow-hidden`}>
      <button
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs"
        onClick={() => item.expandable && setOpen(!open)}
      >
        {item.icon}
        <span className="font-medium flex-1 truncate">{item.label}</span>
        {item.detail && (
          <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">
            {item.detail}
          </span>
        )}
        {item.expandable && (
          open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        )}
      </button>
      {open && item.expandedContent && (
        <>
          <Separator />
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all p-2 max-h-40 overflow-auto bg-background/50">
            {item.expandedContent}
          </pre>
        </>
      )}
    </div>
  );
}

function buildTimeline(events: ParsedEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let textDeltaCount = 0;
  let lastTextSeq = 0;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const d = e.data || {};

    switch (e.type) {
      case "agent_start":
        items.push({
          id: `start-${e.seq}`,
          type: "start",
          label: "Agent started",
          icon: <Play className="h-3 w-3 text-blue-400" />,
          color: "border-blue-500/30 bg-blue-500/5",
          expandable: false,
          seq: e.seq,
        });
        break;

      case "agent_end": {
        const turns = d.TotalTurns || d.total_turns || "";
        const duration = d.DurationMs || d.duration_ms || "";
        const reason = d.StopReason || d.stop_reason || "complete";
        items.push({
          id: `end-${e.seq}`,
          type: "end",
          label: `Agent finished — ${reason}`,
          detail: turns ? `${turns} turns${duration ? ` · ${(Number(duration) / 1000).toFixed(1)}s` : ""}` : undefined,
          icon: <CheckCircle className="h-3 w-3 text-green-400" />,
          color: "border-green-500/30 bg-green-500/5",
          expandable: !!d.History,
          expandedContent: d.History
            ? `Turns: ${turns}\nTokens: ${d.TotalTokens || 0}\nDuration: ${duration ? `${(Number(duration) / 1000).toFixed(1)}s` : "—"}\nStop: ${reason}`
            : undefined,
          seq: e.seq,
        });
        break;
      }

      case "tool_call_start": {
        const name = String(d.ToolName || d.tool_name || "unknown");
        let args = "";
        try {
          const raw = String(d.Arguments || d.arguments || "{}");
          const parsed = JSON.parse(raw);
          // Show a short summary of the arguments
          args = Object.entries(parsed)
            .map(([k, v]) => {
              const val = String(v);
              return `${k}: ${val.length > 60 ? val.slice(0, 60) + "…" : val}`;
            })
            .join("\n");
        } catch {
          args = String(d.Arguments || d.arguments || "");
        }

        items.push({
          id: `tool-start-${e.seq}`,
          type: "tool",
          label: `⚡ ${name}`,
          detail: "executing",
          icon: <Wrench className="h-3 w-3 text-yellow-400" />,
          color: "border-yellow-500/30 bg-yellow-500/5",
          expandable: !!args,
          expandedContent: args || undefined,
          seq: e.seq,
        });
        break;
      }

      case "tool_call_end": {
        const name = String(d.ToolName || d.tool_name || "unknown");
        const content = String(d.Content || d.content || d.result || "");
        const isError = d.IsError === true || d.is_error === true;
        const preview =
          content.length > 200 ? content.slice(0, 200) + "…" : content;

        items.push({
          id: `tool-end-${e.seq}`,
          type: "tool",
          label: `${isError ? "✗" : "✓"} ${name}`,
          detail: isError ? "error" : `${content.length} chars`,
          icon: isError ? (
            <XCircle className="h-3 w-3 text-red-400" />
          ) : (
            <CheckCircle className="h-3 w-3 text-green-400" />
          ),
          color: isError
            ? "border-red-500/30 bg-red-500/5"
            : "border-green-500/30 bg-green-500/5",
          expandable: !!content,
          expandedContent: preview,
          seq: e.seq,
        });
        break;
      }

      case "text_delta":
        textDeltaCount++;
        lastTextSeq = e.seq;
        // Don't add individual text deltas — they're shown in the output pane
        break;

      case "turn_start":
      case "turn_end": {
        const turnNum = d.Turn || d.turn || "";
        items.push({
          id: `${e.type}-${e.seq}`,
          type: "status",
          label: e.type === "turn_start" ? `Turn ${turnNum} started` : `Turn ${turnNum} ended`,
          icon: <MessageSquare className="h-3 w-3 text-muted-foreground" />,
          color: "border-border bg-transparent",
          expandable: false,
          seq: e.seq,
        });
        break;
      }

      case "error": {
        const msg = String(d.error || d.Error || d.message || d.raw || "Unknown error");
        items.push({
          id: `error-${e.seq}`,
          type: "error",
          label: "Error",
          detail: msg.slice(0, 50),
          icon: <AlertCircle className="h-3 w-3 text-red-400" />,
          color: "border-red-500/30 bg-red-500/5",
          expandable: msg.length > 50,
          expandedContent: msg,
          seq: e.seq,
        });
        break;
      }

      case "status_update": {
        const status = String(d.status || d.Status || "");
        items.push({
          id: `status-${e.seq}`,
          type: "status",
          label: `Status: ${status}`,
          icon: <MessageSquare className="h-3 w-3 text-muted-foreground" />,
          color: "border-border bg-transparent",
          expandable: false,
          seq: e.seq,
        });
        break;
      }

      default:
        // Unknown event types — show them but collapsed
        items.push({
          id: `${e.type}-${e.seq}-${i}`,
          type: "status",
          label: e.type || "unknown",
          icon: <MessageSquare className="h-3 w-3 text-muted-foreground" />,
          color: "border-border bg-transparent",
          expandable: true,
          expandedContent: JSON.stringify(d, null, 2),
          seq: e.seq,
        });
    }
  }

  // Add a summary for text deltas if any
  if (textDeltaCount > 0) {
    // Insert before agent_end (or at the end)
    const endIdx = items.findIndex((it) => it.type === "end");
    const textItem: TimelineItem = {
      id: `text-summary-${lastTextSeq}`,
      type: "text",
      label: `Streaming output`,
      detail: `${textDeltaCount} chunks`,
      icon: <MessageSquare className="h-3 w-3 text-purple-400" />,
      color: "border-purple-500/30 bg-purple-500/5",
      expandable: false,
      seq: lastTextSeq,
    };
    if (endIdx >= 0) {
      items.splice(endIdx, 0, textItem);
    } else {
      items.push(textItem);
    }
  }

  return items;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "succeeded"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "running"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

function parseEvent(e: RunEvent): ParsedEvent {
  let data: Record<string, unknown> = {};
  try {
    if (e.data) {
      data = JSON.parse(e.data);
    }
  } catch {
    data = { raw: e.data };
  }
  return {
    seq: e.seq,
    type: e.event_type,
    data,
    raw: e,
  };
}
