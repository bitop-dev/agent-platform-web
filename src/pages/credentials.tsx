import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { credentials, skills as skillsApi, type Credential, type Skill } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Plus, Trash2, Key, Shield, Eye, EyeOff, ExternalLink } from "lucide-react";

// Well-known credential metadata (URL hints, descriptions)
const KNOWN_META: Record<string, { description: string; url?: string }> = {
  GITHUB_TOKEN: { description: "GitHub Personal Access Token", url: "https://github.com/settings/tokens" },
  SLACK_WEBHOOK_URL: { description: "Slack Incoming Webhook URL", url: "https://api.slack.com/messaging/webhooks" },
  OPENAI_API_KEY: { description: "OpenAI API Key", url: "https://platform.openai.com/api-keys" },
  ANTHROPIC_API_KEY: { description: "Anthropic API Key", url: "https://console.anthropic.com/" },
  JIRA_API_TOKEN: { description: "Jira API Token", url: "https://id.atlassian.com/manage-profile/security/api-tokens" },
  GITLAB_TOKEN: { description: "GitLab Personal Access Token", url: "https://gitlab.com/-/user_settings/personal_access_tokens" },
  LINEAR_API_KEY: { description: "Linear API Key", url: "https://linear.app/settings/api" },
  NOTION_API_KEY: { description: "Notion Integration Token", url: "https://www.notion.so/my-integrations" },
};

export default function CredentialsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["credentials"], queryFn: credentials.list });
  const { data: skillsData } = useQuery({ queryKey: ["skills"], queryFn: () => skillsApi.list() });
  const creds = data?.credentials ?? [];
  const allSkills = skillsData?.skills ?? [];

  // Dynamically build required credentials from skills
  const requiredCreds = useMemo(() => {
    const credMap = new Map<string, { envVar: string; skills: string[]; description: string; url?: string }>();

    for (const skill of allSkills) {
      if (!skill.requires_env) continue;
      let envVars: string[] = [];
      try {
        envVars = JSON.parse(skill.requires_env);
      } catch {
        continue;
      }
      for (const envVar of envVars) {
        const existing = credMap.get(envVar);
        if (existing) {
          if (!existing.skills.includes(skill.name)) existing.skills.push(skill.name);
        } else {
          const meta = KNOWN_META[envVar];
          credMap.set(envVar, {
            envVar,
            skills: [skill.name],
            description: meta?.description || `Required by ${skill.name}`,
            url: meta?.url,
          });
        }
      }
    }
    return Array.from(credMap.values());
  }, [allSkills]);

  // Form state
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [skillName, setSkillName] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showValue, setShowValue] = useState(false);

  const createMutation = useMutation({
    mutationFn: credentials.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credentials"] });
      toast.success("Credential saved");
      setName(""); setValue(""); setSkillName(""); setDescription("");
      setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: credentials.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credentials"] });
      toast.success("Credential deleted");
    },
  });

  const handleQuickAdd = (envVar: string, desc: string, skill?: string) => {
    setName(envVar);
    setDescription(desc);
    setSkillName(skill ?? "");
    setValue("");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return;
    createMutation.mutate({ name, value, skill_name: skillName || undefined, description: description || undefined });
  };

  const existingNames = new Set(creds.map((c: Credential) => c.name));

  // Skills that need credentials
  const skillsNeedingCreds = allSkills.filter((s: Skill) => {
    if (!s.requires_env) return false;
    try { return JSON.parse(s.requires_env).length > 0; } catch { return false; }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Skill Credentials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Secrets passed to WASM/container skill tools at runtime. Encrypted at rest (AES-256-GCM).
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? "Cancel" : "Add Credential"}
        </Button>
      </div>

      {/* Dynamic credential cards from installed skills */}
      {requiredCreds.length > 0 && (
        <div>
          <h2 className="text-[10px] font-mono text-muted-foreground tracking-[0.12em] uppercase mb-3">
            Required by installed skills
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {requiredCreds.map((cred) => {
              const exists = existingNames.has(cred.envVar);
              return (
                <Card key={cred.envVar} className={`border ${exists ? "border-green-800/50 bg-green-950/20" : "border-amber-800/30 bg-amber-950/10"}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-mono text-primary">{cred.envVar}</code>
                      {exists ? (
                        <span className="text-[10px] font-mono text-green-500 flex items-center gap-1">
                          <span className="led led-green" /> SET
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-500 flex items-center gap-1">
                          <span className="led led-amber" /> NEEDED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{cred.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Used by: {cred.skills.map((s, i) => (
                        <span key={s}>{i > 0 && ", "}<code className="text-primary/70">{s}</code></span>
                      ))}
                    </p>
                    <div className="flex gap-2 items-center">
                      {!exists && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]"
                          onClick={() => handleQuickAdd(cred.envVar, cred.description, cred.skills[0])}>
                          <Key className="h-3 w-3 mr-1" /> Configure
                        </Button>
                      )}
                      {cred.url && (
                        <a href={cred.url} target="_blank" rel="noreferrer"
                          className="text-[10px] text-primary/50 hover:text-primary flex items-center gap-0.5">
                          Get key <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state if no skills need creds */}
      {requiredCreds.length === 0 && creds.length === 0 && !showForm && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No credentials needed yet.</p>
            <p className="text-xs mt-1">When you install skills that require API keys (like GitHub or Slack), they'll appear here automatically.</p>
          </CardContent>
        </Card>
      )}

      {/* Add form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-sm font-mono">Add Credential</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-mono">Name (env var)</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                  placeholder="GITHUB_TOKEN" className="font-mono text-sm" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value" className="text-xs font-mono">Value (secret)</Label>
                <div className="relative">
                  <Input id="value" type={showValue ? "text" : "password"} value={value}
                    onChange={e => setValue(e.target.value)} placeholder="ghp_..." className="font-mono text-sm pr-10" required />
                  <button type="button" onClick={() => setShowValue(!showValue)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill" className="text-xs font-mono">Scope to skill (optional)</Label>
                <Select value={skillName} onValueChange={setSkillName}>
                  <SelectTrigger><SelectValue placeholder="All skills" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All skills</SelectItem>
                    {skillsNeedingCreds.map((s: Skill) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc" className="text-xs font-mono">Description</Label>
                <Input id="desc" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Personal GitHub token" className="text-sm" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending} size="sm">
                  <Key className="h-4 w-4 mr-1" />
                  {createMutation.isPending ? "Saving..." : "Save Credential"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing credentials table */}
      {creds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Stored Credentials ({creds.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs text-muted-foreground font-mono">
                    <th className="py-2 pr-4">NAME</th>
                    <th className="py-2 pr-4">VALUE</th>
                    <th className="py-2 pr-4">SKILL SCOPE</th>
                    <th className="py-2 pr-4">DESCRIPTION</th>
                    <th className="py-2 pr-4">ADDED</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {creds.map((cred: Credential) => (
                    <tr key={cred.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono text-xs text-primary">{cred.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{cred.value_hint}</td>
                      <td className="py-2 pr-4 text-xs">
                        {cred.skill_name ? (
                          <code className="text-primary/70">{cred.skill_name}</code>
                        ) : (
                          <span className="text-muted-foreground">all</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{cred.description}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">{new Date(cred.created_at).toLocaleDateString()}</td>
                      <td className="py-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => { if (confirm(`Delete ${cred.name}?`)) deleteMutation.mutate(cred.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info box */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
          <p><strong className="text-primary">How it works:</strong> Credentials are passed as environment variables to WASM and container skill tools at runtime.</p>
          <p>When a skill declares <code className="text-primary">requires_env</code> in its registry entry, the required credentials appear above automatically.</p>
          <p>Values are encrypted with AES-256-GCM before storage. Only the last 4 characters are shown as hints.</p>
          <p>Scoping a credential to a specific skill means it's only available when that skill's tools run. Unscoped credentials are available to all skills.</p>
        </CardContent>
      </Card>
    </div>
  );
}
