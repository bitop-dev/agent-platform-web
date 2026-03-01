import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { credentials, type Credential } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Trash2, Key, Shield, Eye, EyeOff } from "lucide-react";

// Well-known credentials that skills need
const KNOWN_CREDENTIALS = [
  { name: "GITHUB_TOKEN", description: "GitHub Personal Access Token", skills: ["github"], url: "https://github.com/settings/tokens" },
  { name: "SLACK_WEBHOOK_URL", description: "Slack Incoming Webhook URL", skills: ["slack_notify"], url: "https://api.slack.com/messaging/webhooks" },
  { name: "OPENAI_API_KEY", description: "OpenAI API Key (for skill tools)", skills: [], url: "https://platform.openai.com/api-keys" },
  { name: "ANTHROPIC_API_KEY", description: "Anthropic API Key (for skill tools)", skills: [], url: "https://console.anthropic.com/" },
];

export default function CredentialsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["credentials"], queryFn: credentials.list });
  const creds = data?.credentials ?? [];

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

  const handleQuickAdd = (known: typeof KNOWN_CREDENTIALS[0]) => {
    setName(known.name);
    setDescription(known.description);
    setSkillName(known.skills[0] ?? "");
    setValue("");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return;
    createMutation.mutate({ name, value, skill_name: skillName || undefined, description: description || undefined });
  };

  // Group creds by whether they match known credentials
  const existingNames = new Set(creds.map((c: Credential) => c.name));

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

      {/* Quick-add cards for well-known credentials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {KNOWN_CREDENTIALS.map((known) => {
          const exists = existingNames.has(known.name);
          return (
            <Card key={known.name} className={`border ${exists ? "border-green-800/50 bg-green-950/20" : "border-border/50"}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono text-primary">{known.name}</code>
                  {exists ? (
                    <span className="text-[10px] font-mono text-green-500 flex items-center gap-1">
                      <span className="led led-green" /> SET
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground">NOT SET</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{known.description}</p>
                {known.skills.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Used by: {known.skills.map(s => <code key={s} className="text-primary/70">{s}</code>)}
                  </p>
                )}
                <div className="flex gap-2">
                  {!exists && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleQuickAdd(known)}>
                      <Key className="h-3 w-3 mr-1" /> Configure
                    </Button>
                  )}
                  {known.url && (
                    <a href={known.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary/50 hover:text-primary underline mt-1">
                      Get key →
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                    <SelectItem value="github">github</SelectItem>
                    <SelectItem value="slack_notify">slack_notify</SelectItem>
                    <SelectItem value="web_search">web_search</SelectItem>
                    <SelectItem value="web_fetch">web_fetch</SelectItem>
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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Stored Credentials ({creds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : creds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credentials stored. Add one above to enable authenticated skill tools.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
          <p><strong className="text-primary">How it works:</strong> Credentials are passed as environment variables to WASM and container skill tools at runtime.</p>
          <p>For example, the <code className="text-primary">github</code> skill reads <code className="text-primary">GITHUB_TOKEN</code> to authenticate API calls to <code>api.github.com</code>.</p>
          <p>Values are encrypted with AES-256-GCM before storage. Only the last 4 characters are shown as hints.</p>
          <p>Scoping a credential to a specific skill means it's only available when that skill's tools run. Unscoped credentials are available to all skills.</p>
        </CardContent>
      </Card>
    </div>
  );
}
