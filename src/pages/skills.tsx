import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skills, skillSources } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Puzzle, Plus, RefreshCw, Trash2, ExternalLink, GitBranch } from "lucide-react";
import { toast } from "sonner";

export function SkillsPage() {
  const qc = useQueryClient();
  const [showAddSource, setShowAddSource] = useState(false);
  const [srcUrl, setSrcUrl] = useState("");
  const [srcLabel, setSrcLabel] = useState("");

  const { data: skillData, isLoading: skillsLoading } = useQuery({ queryKey: ["skills"], queryFn: () => skills.list() });
  const { data: sourceData, isLoading: sourcesLoading } = useQuery({ queryKey: ["skill-sources"], queryFn: skillSources.list });

  const addSourceMut = useMutation({
    mutationFn: () => skillSources.create(srcUrl, srcLabel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skill-sources"] });
      toast.success("Source added — syncing skills...");
      setShowAddSource(false);
      setSrcUrl("");
      setSrcLabel("");
      // Re-fetch skills after a delay to let sync complete
      setTimeout(() => qc.invalidateQueries({ queryKey: ["skills"] }), 5000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteSourceMut = useMutation({
    mutationFn: skillSources.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skill-sources"] });
      qc.invalidateQueries({ queryKey: ["skills"] });
      toast.success("Source removed");
    },
  });

  const syncMut = useMutation({
    mutationFn: skillSources.syncAll,
    onSuccess: () => {
      toast.success("Sync started — refreshing in a few seconds...");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["skills"] });
        qc.invalidateQueries({ queryKey: ["skill-sources"] });
      }, 5000);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Skills</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sync All
          </Button>
          <Button size="sm" onClick={() => setShowAddSource(!showAddSource)}>
            <Plus className="mr-2 h-4 w-4" /> Add Source
          </Button>
        </div>
      </div>

      {/* Add Source Form */}
      {showAddSource && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Add Skill Source</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Add any GitHub repo that follows the skill registry format (has a <code className="bg-muted px-1 rounded">registry.json</code> at the root).
            </p>
            <form onSubmit={(e) => { e.preventDefault(); addSourceMut.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GitHub Repo URL</Label>
                  <Input value={srcUrl} onChange={(e) => setSrcUrl(e.target.value)}
                    placeholder="github.com/yourname/your-skills" required />
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={srcLabel} onChange={(e) => setSrcLabel(e.target.value)}
                    placeholder="My Custom Skills" required />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowAddSource(false)}>Cancel</Button>
                <Button type="submit" disabled={addSourceMut.isPending}>
                  {addSourceMut.isPending ? "Adding..." : "Add Source"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sources */}
      {!sourcesLoading && sourceData?.skill_sources && sourceData.skill_sources.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Skill Sources</h2>
          <div className="space-y-2">
            {sourceData.skill_sources.map((src) => (
              <Card key={src.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{src.label}</span>
                      {src.is_default && <Badge>Default</Badge>}
                      <Badge variant={src.status === "synced" ? "default" : src.status === "error" ? "destructive" : "outline"}>
                        {src.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{src.skill_count} skills</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{src.url}</p>
                    {src.error_msg && <p className="text-xs text-destructive">{src.error_msg}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`https://${src.url}`} target="_blank" rel="noopener"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                    {!src.is_default && (
                      <Button variant="ghost" size="icon"
                        onClick={() => { if (confirm("Remove this skill source?")) deleteSourceMut.mutate(src.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Skills Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Available Skills</h2>
        {skillsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded animate-pulse" />)}
          </div>
        ) : !skillData?.skills?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Puzzle className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No skills available. Add a skill source to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {skillData.skills.map((skill) => (
              <Card key={skill.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{skill.name}</CardTitle>
                    <Badge variant="outline">{skill.tier}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{skill.description || "No description"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>v{skill.version}</span>
                    {skill.tags && skill.tags.split(",").map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag.trim()}</Badge>
                    ))}
                  </div>
                  {skill.source_url && (
                    <a href={skill.source_url} target="_blank" rel="noopener"
                      className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> View source
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
