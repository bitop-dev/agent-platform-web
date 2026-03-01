"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agents } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AgentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: agents.list,
  });

  const deleteMutation = useMutation({
    mutationFn: agents.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent deleted");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Agents</h1>
        <Link href="/agents/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Agent
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : !data?.agents?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Bot className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No agents yet. Create your first one!
            </p>
            <Link href="/agents/new">
              <Button>Create Agent</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.agents.map((agent) => (
            <Card key={agent.id} className="group relative">
              <Link href={`/agents/${agent.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Badge variant={agent.enabled ? "default" : "secondary"}>
                      {agent.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {agent.description || agent.system_prompt}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{agent.model_name}</Badge>
                    <span>· {agent.max_turns} turns max</span>
                  </div>
                </CardContent>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm("Delete this agent?")) {
                    deleteMutation.mutate(agent.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
