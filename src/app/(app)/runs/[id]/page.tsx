"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
} from "lucide-react";

interface ParsedEvent {
  seq: number;
  type: string;
  data: Record<string, unknown>;
  raw: RunEvent;
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

  // Load historical events
  const { data: eventData } = useQuery({
    queryKey: ["run-events", id],
    queryFn: () => runsApi.events(id),
    enabled: !!run && run.status !== "queued",
  });

  useEffect(() => {
    if (eventData?.events) {
      const parsed = eventData.events.map(parseEvent);
      setEvents(parsed);

      // Build text from text_delta events
      const text = parsed
        .filter((e) => e.type === "text_delta")
        .map((e) => String(e.data.delta || e.data.Delta || ""))
        .join("");
      if (text) setStreamText(text);
    }
  }, [eventData]);

  // WebSocket for live streaming
  const handleStreamEvent = useCallback((rawEvent: RunEvent) => {
    const parsed = parseEvent(rawEvent);
    setEvents((prev) => [...prev, parsed]);
    if (parsed.type === "text_delta") {
      const delta = String(parsed.data.delta || parsed.data.Delta || "");
      setStreamText((prev) => prev + delta);
    }
    if (parsed.type === "agent_end" || parsed.type === "error") {
      refetch();
    }
  }, [refetch]);

  useEffect(() => {
    if (run?.status === "running" || run?.status === "queued") {
      wsRef.current = connectRunStream(id, handleStreamEvent, () => {
        refetch();
      });
      return () => wsRef.current?.close();
    }
  }, [id, run?.status, handleStreamEvent, refetch]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamText]);

  const isActive = run?.status === "running" || run?.status === "queued";

  return (
    <div className="space-y-6">
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

        {/* Event timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Events ({events.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-1">
                {events.map((e) => (
                  <EventRow key={e.seq} event={e} />
                ))}
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

function EventRow({ event }: { event: ParsedEvent }) {
  const [open, setOpen] = useState(false);
  const isToolCall =
    event.type === "tool_call_start" || event.type === "tool_call_end";
  const toolName =
    String(event.data.ToolName || event.data.tool_name || "") || undefined;

  return (
    <div className="border rounded px-2 py-1 text-xs">
      <button
        className="flex items-center gap-1 w-full text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <EventBadge type={event.type} />
        {isToolCall && toolName && (
          <span className="text-muted-foreground ml-1">{toolName}</span>
        )}
        <span className="ml-auto text-muted-foreground">#{event.seq}</span>
      </button>
      {open && (
        <>
          <Separator className="my-1" />
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all max-h-32 overflow-auto">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const color =
    type === "agent_start"
      ? "bg-blue-500/20 text-blue-400"
      : type === "agent_end"
        ? "bg-green-500/20 text-green-400"
        : type === "tool_call_start"
          ? "bg-yellow-500/20 text-yellow-400"
          : type === "tool_call_end"
            ? "bg-yellow-500/20 text-yellow-400"
            : type === "text_delta"
              ? "bg-purple-500/20 text-purple-400"
              : type === "error"
                ? "bg-red-500/20 text-red-400"
                : "bg-muted text-muted-foreground";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${color}`}>
      {type}
    </span>
  );
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
    data = JSON.parse(e.data);
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
