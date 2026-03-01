import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agents } from "@/lib/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Trash2, ChevronRight, Cpu, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AgentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["agents"], queryFn: agents.list });
  const deleteMut = useMutation({
    mutationFn: agents.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); toast.success("Agent deleted"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">Agents</h1>
          <Badge variant="outline" className="font-mono text-[10px] tracking-wider">
            {data?.agents?.length ?? 0} REGISTERED
          </Badge>
        </div>
        <Link to="/agents/new">
          <Button className="font-mono text-xs tracking-wider uppercase h-9">
            <Plus className="mr-2 h-3.5 w-3.5" /> Deploy Agent
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card border border-border rounded animate-pulse" />
          ))}
        </div>
      ) : !data?.agents?.length ? (
        <div className="flex flex-col items-center gap-4 py-16 rounded border border-dashed border-border">
          <div className="h-14 w-14 rounded border border-border bg-card flex items-center justify-center">
            <Bot className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">No agents deployed</p>
            <p className="text-xs text-muted-foreground mt-1">Deploy your first agent to start automating tasks.</p>
          </div>
          <Link to="/agents/new">
            <Button variant="outline" className="font-mono text-xs tracking-wider uppercase">
              <Plus className="mr-2 h-3.5 w-3.5" /> Deploy Agent
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {data.agents.map((agent) => (
            <div
              key={agent.id}
              className="group relative rounded border border-border bg-card hover:border-primary/30 transition-all glow-border"
            >
              <Link
                to={`/agents/${agent.id}`}
                className="flex items-center gap-4 px-5 py-4"
              >
                {/* Status LED */}
                <span className={cn("led shrink-0", agent.enabled ? "led-green" : "led-red")} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{agent.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-[9px] tracking-wider uppercase",
                        agent.enabled
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-red-500/30 text-red-400"
                      )}
                    >
                      {agent.enabled ? "ACTIVE" : "OFFLINE"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-xl">
                    {agent.description || agent.system_prompt?.slice(0, 100)}
                  </p>
                </div>

                {/* Model badge */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  <Cpu className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">{agent.model_name}</span>
                </div>

                {/* Turns */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  <RotateCw className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">{agent.max_turns}</span>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </Link>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-12 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm("Delete this agent?")) deleteMut.mutate(agent.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
