import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { runs as runsApi, connectRunStream, type RunEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Square, Clock, Zap, Hash, ChevronDown, ChevronRight, Play, CheckCircle, XCircle, Wrench, MessageSquare, AlertCircle } from "lucide-react";

interface ParsedEvent { seq: number; type: string; data: Record<string, unknown>; }
interface TimelineItem { id: string; type: string; label: string; detail?: string; icon: React.ReactNode; color: string; expandable: boolean; content?: string; }

function parseEvent(e: RunEvent): ParsedEvent {
  let data: Record<string, unknown> = {};
  try { if (e.data) data = JSON.parse(e.data); } catch { data = { raw: e.data }; }
  return { seq: e.seq, type: e.event_type, data };
}

function buildTimeline(events: ParsedEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let textCount = 0;

  // Events to silently skip (they're noise in the timeline)
  const skipTypes = new Set(["text_delta", "message_start", "message_end"]);

  for (const e of events) {
    const d = e.data || {};

    // Skip text deltas and message boundaries — they're shown in the output pane
    if (skipTypes.has(e.type)) {
      if (e.type === "text_delta") textCount++;
      continue;
    }

    switch (e.type) {
      case "agent_start":
        items.push({ id: `s-${e.seq}`, type: "start", label: "Agent started", icon: <Play className="h-3 w-3 text-blue-400" />, color: "border-blue-500/30 bg-blue-500/5", expandable: false });
        break;
      case "agent_end": {
        const turns = d.TotalTurns || d.total_turns || "";
        const dur = d.DurationMs || d.duration_ms || "";
        const reason = String(d.StopReason || d.stop_reason || "complete");
        items.push({ id: `e-${e.seq}`, type: "end", label: `Agent finished — ${reason}`, detail: turns ? `${turns} turns${dur ? ` · ${(Number(dur) / 1000).toFixed(1)}s` : ""}` : undefined, icon: <CheckCircle className="h-3 w-3 text-green-400" />, color: "border-green-500/30 bg-green-500/5", expandable: false });
        break;
      }
      case "tool_call_start": {
        const name = String(d.ToolName || d.tool_name || "unknown");
        let args = "";
        try { const p = JSON.parse(String(d.Arguments || d.arguments || "{}")); args = Object.entries(p).map(([k, v]) => { const s = String(v); return `${k}: ${s.length > 60 ? s.slice(0, 60) + "…" : s}`; }).join("\n"); } catch { args = String(d.Arguments || ""); }
        items.push({ id: `ts-${e.seq}`, type: "tool", label: `⚡ ${name}`, detail: "executing", icon: <Wrench className="h-3 w-3 text-yellow-400" />, color: "border-yellow-500/30 bg-yellow-500/5", expandable: !!args, content: args });
        break;
      }
      case "tool_call_end": {
        const name = String(d.ToolName || d.tool_name || "unknown");
        const content = String(d.Content || d.content || "");
        const isErr = d.IsError === true || d.is_error === true;
        items.push({ id: `te-${e.seq}`, type: "tool", label: `${isErr ? "✗" : "✓"} ${name}`, detail: isErr ? "error" : `${content.length} chars`, icon: isErr ? <XCircle className="h-3 w-3 text-red-400" /> : <CheckCircle className="h-3 w-3 text-green-400" />, color: isErr ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5", expandable: !!content, content: content.length > 200 ? content.slice(0, 200) + "…" : content });
        break;
      }
      case "turn_start": {
        const turn = d.Turn || d.turn || "";
        items.push({ id: `tns-${e.seq}`, type: "status", label: `Turn ${turn} started`, icon: <MessageSquare className="h-3 w-3 text-blue-300" />, color: "border-blue-400/20 bg-blue-400/5", expandable: false });
        break;
      }
      case "turn_end": {
        const turn = d.Turn || d.turn || "";
        items.push({ id: `tne-${e.seq}`, type: "status", label: `Turn ${turn} ended`, icon: <MessageSquare className="h-3 w-3 text-blue-300" />, color: "border-blue-400/20 bg-blue-400/5", expandable: false });
        break;
      }
      case "deferred_action":
        items.push({ id: `da-${e.seq}`, type: "status", label: "Deferred action detected", icon: <AlertCircle className="h-3 w-3 text-yellow-400" />, color: "border-yellow-500/30 bg-yellow-500/5", expandable: true, content: JSON.stringify(d, null, 2) });
        break;
      case "error": {
        const msg = String(d.error || d.Error || d.message || d.raw || "Unknown error");
        items.push({ id: `err-${e.seq}`, type: "error", label: "Error", detail: msg.slice(0, 50), icon: <AlertCircle className="h-3 w-3 text-red-400" />, color: "border-red-500/30 bg-red-500/5", expandable: msg.length > 50, content: msg });
        break;
      }
      default:
        // Unknown events — only show if they have meaningful data
        if (d && Object.keys(d).length > 0 && !d.raw) {
          items.push({ id: `${e.type}-${e.seq}`, type: "status", label: e.type, icon: <MessageSquare className="h-3 w-3 text-muted-foreground" />, color: "border-border bg-transparent", expandable: true, content: JSON.stringify(d, null, 2) });
        }
    }
  }

  // Add a single summary row for all streaming text
  if (textCount > 0) {
    const endIdx = items.findIndex((i) => i.type === "end");
    const textItem: TimelineItem = { id: "text-summary", type: "text", label: "Streaming output", detail: `${textCount} chunks`, icon: <MessageSquare className="h-3 w-3 text-purple-400" />, color: "border-purple-500/30 bg-purple-500/5", expandable: false };
    endIdx >= 0 ? items.splice(endIdx, 0, textItem) : items.push(textItem);
  }

  return items;
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-md border ${item.color} overflow-hidden`}>
      <button className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs" onClick={() => item.expandable && setOpen(!open)}>
        {item.icon}<span className="font-medium flex-1 truncate">{item.label}</span>
        {item.detail && <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">{item.detail}</span>}
        {item.expandable && (open ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />)}
      </button>
      {open && item.content && <><Separator /><pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all p-2 max-h-40 overflow-auto bg-background/50">{item.content}</pre></>}
    </div>
  );
}

export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [streamText, setStreamText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: run, refetch } = useQuery({
    queryKey: ["run", id], queryFn: () => runsApi.get(id!),
    refetchInterval: (q) => { const s = q.state.data?.status; return s === "queued" || s === "running" ? 2000 : false; },
  });

  const { data: eventData } = useQuery({ queryKey: ["run-events", id], queryFn: () => runsApi.events(id!), enabled: !!run && run.status !== "queued" });

  useEffect(() => {
    if (eventData?.events) {
      const parsed = eventData.events.map(parseEvent);
      setEvents(parsed);
      const text = parsed.filter((e) => e.type === "text_delta").map((e) => String(e.data.Text || e.data.text || e.data.delta || e.data.Delta || "")).join("");
      if (text) setStreamText(text);
    }
  }, [eventData]);

  const handleStreamEvent = useCallback((raw: RunEvent) => {
    const parsed = parseEvent(raw);
    setEvents((prev) => [...prev, parsed]);
    if (parsed.type === "text_delta") setStreamText((prev) => prev + String(parsed.data.Text || parsed.data.text || parsed.data.delta || parsed.data.Delta || ""));
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold truncate max-w-2xl">{run?.mission || "Loading..."}</h1>
          <p className="text-sm text-muted-foreground">{run?.model_name} · Run {id?.slice(0, 8)}</p>
        </div>
        {run && <Badge variant={run.status === "succeeded" ? "default" : run.status === "failed" ? "destructive" : "outline"}>{run.status}</Badge>}
        {isActive && <Button variant="destructive" size="sm" onClick={() => runsApi.cancel(id!).then(() => refetch())}><Square className="mr-1 h-3 w-3" /> Stop</Button>}
      </div>

      {run && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {run.total_turns} turns</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : isActive ? "Running..." : "—"}</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> {(run.input_tokens || 0) + (run.output_tokens || 0)} tokens</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2">Output{isActive && <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />}</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {streamText || run?.output_text ? <pre className="whitespace-pre-wrap text-sm font-sans">{streamText || run?.output_text}</pre> : <p className="text-muted-foreground">{isActive ? "Waiting for output..." : "No output."}</p>}
              <div ref={scrollRef} />
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center justify-between"><span>Timeline</span><span className="text-xs font-normal text-muted-foreground">{timeline.length} events</span></CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {timeline.map((item) => <TimelineRow key={item.id} item={item} />)}
                {isActive && <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />Running...</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {run?.error_message && <Card className="border-destructive"><CardContent className="pt-4"><pre className="text-sm text-destructive whitespace-pre-wrap">{run.error_message}</pre></CardContent></Card>}
    </div>
  );
}
