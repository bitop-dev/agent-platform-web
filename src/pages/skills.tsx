import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skills, skillSources } from "@/lib/api";
// Card not used in flat industrial layout
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Puzzle, Plus, RefreshCw, Trash2, ExternalLink, GitBranch, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SkillsPage() {
  const qc = useQueryClient();
  const [showAddSource, setShowAddSource] = useState(false);
  const [srcUrl, setSrcUrl] = useState("");
  const [srcLabel, setSrcLabel] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const { data: skillData, isLoading: skillsLoading } = useQuery({ queryKey: ["skills"], queryFn: () => skills.list() });
  const { data: sourceData } = useQuery({ queryKey: ["skill-sources"], queryFn: skillSources.list });

  const addSourceMut = useMutation({
    mutationFn: () => skillSources.create(srcUrl, srcLabel),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["skill-sources"] }); toast.success("Source added"); setShowAddSource(false); setSrcUrl(""); setSrcLabel(""); setTimeout(() => qc.invalidateQueries({ queryKey: ["skills"] }), 5000); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteSourceMut = useMutation({ mutationFn: skillSources.delete, onSuccess: () => { qc.invalidateQueries({ queryKey: ["skill-sources", "skills"] }); toast.success("Removed"); } });
  const syncMut = useMutation({ mutationFn: skillSources.syncAll, onSuccess: () => { toast.success("Syncing…"); setTimeout(() => qc.invalidateQueries({ queryKey: ["skills", "skill-sources"] }), 5000); } });

  const sources = sourceData?.skill_sources || [];
  const allSkills = skillData?.skills || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">Skills</h1>
          <Badge variant="outline" className="font-mono text-[10px] tracking-wider">{allSkills.length} AVAILABLE</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="font-mono text-xs tracking-wider uppercase h-8">
            <RefreshCw className={cn("mr-1.5 h-3 w-3", syncMut.isPending && "animate-spin")} /> Sync
          </Button>
          <Button size="sm" onClick={() => setShowAddSource(!showAddSource)} className="font-mono text-xs tracking-wider uppercase h-8">
            <Plus className="mr-1.5 h-3 w-3" /> Source
          </Button>
        </div>
      </div>

      {/* Add Source Form */}
      {showAddSource && (
        <div className="rounded border border-primary/20 bg-primary/5 p-4 space-y-4">
          <h3 className="font-mono text-xs tracking-wider uppercase font-semibold flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5" /> Add Skill Source
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); addSourceMut.mutate(); }} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Repository URL</Label>
              <Input value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)} placeholder="github.com/user/skills" required className="font-mono text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Label</Label>
              <Input value={srcLabel} onChange={(e) => setSrcLabel(e.target.value)} placeholder="My Skills" required className="font-mono text-xs h-8" />
            </div>
            <Button type="submit" size="sm" disabled={addSourceMut.isPending} className="font-mono text-xs h-8">
              {addSourceMut.isPending ? "Adding…" : "Add"}
            </Button>
          </form>
        </div>
      )}

      {/* Sources collapsible */}
      {sources.length > 0 && (
        <button onClick={() => setSourcesOpen(!sourcesOpen)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full text-left">
          {sourcesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className="font-mono text-[10px] tracking-wider uppercase">{sources.length} Source{sources.length > 1 ? "s" : ""}</span>
        </button>
      )}
      {sourcesOpen && sources.map((src) => (
        <div key={src.id} className="flex items-center gap-3 px-4 py-2.5 rounded border border-border bg-card/50 text-sm">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-medium text-xs">{src.label}</span>
          {src.is_default && <Badge variant="outline" className="font-mono text-[8px]">DEFAULT</Badge>}
          <span className={cn("led shrink-0", src.status === "synced" ? "led-green" : src.status === "error" ? "led-red" : "led-amber")} />
          <span className="font-mono text-[10px] text-muted-foreground">{src.skill_count} skills</span>
          <span className="font-mono text-[10px] text-muted-foreground/60 flex-1 truncate">{src.url}</span>
          {!src.is_default && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (confirm("Remove?")) deleteSourceMut.mutate(src.id); }}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      ))}

      {/* Skills grid */}
      {skillsLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-28 bg-card border border-border rounded animate-pulse" />)}
        </div>
      ) : !allSkills.length ? (
        <div className="flex flex-col items-center gap-3 py-16 rounded border border-dashed border-border">
          <Puzzle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No skills available. Add a source to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {allSkills.map((skill) => (
            <div key={skill.id} className="rounded border border-border bg-card p-4 space-y-2 glow-border hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{skill.name}</span>
                <Badge variant="outline" className="font-mono text-[9px] tracking-wider uppercase">{skill.tier}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{skill.description || "No description"}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="font-mono text-[10px] text-muted-foreground/60">v{skill.version}</span>
                {skill.tags && skill.tags.split(",").map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono text-[9px] px-1.5 py-0">{t.trim()}</Badge>
                ))}
              </div>
              {skill.source_url && (
                <a href={skill.source_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> source
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
