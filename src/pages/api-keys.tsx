import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiKeys, type ApiKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Key, Plus, Trash2, Pencil, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function ApiKeysPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state (shared for create + edit)
  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [showKey, setShowKey] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: apiKeys.list });

  const resetForm = () => {
    setProvider("openai"); setLabel(""); setKey(""); setBaseUrl(""); setIsDefault(true);
    setShowForm(false); setEditingId(null); setShowKey(false);
  };

  const createMut = useMutation({
    mutationFn: apiKeys.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key saved"); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiKeys.update>[1] }) => apiKeys.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key updated"); resetForm(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: apiKeys.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key deleted"); },
  });

  const startEdit = (k: ApiKey) => {
    setEditingId(k.id);
    setProvider(k.provider);
    setLabel(k.label);
    setBaseUrl(k.base_url || "");
    setIsDefault(k.is_default);
    setKey(""); // Don't pre-fill key — leave empty to keep existing
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMut.mutate({
        id: editingId,
        data: { label, base_url: baseUrl || undefined, is_default: isDefault, ...(key ? { key } : {}) },
      });
    } else {
      if (!key) { toast.error("API key is required"); return; }
      createMut.mutate({ provider, label, key, is_default: isDefault, base_url: baseUrl || undefined });
    }
  };

  const keys = data?.api_keys ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" />
            API Keys
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            LLM provider keys for running agents. Encrypted at rest (AES-256-GCM).
          </p>
        </div>
        <Button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          variant={showForm ? "outline" : "default"} size="sm">
          {showForm ? <><X className="h-4 w-4 mr-1" /> Cancel</> : <><Plus className="h-4 w-4 mr-1" /> Add Key</>}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm font-mono">
              {editingId ? "Edit API Key" : "Add LLM Provider Key"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Provider</Label>
                  <Select value={provider} onValueChange={setProvider} disabled={!!editingId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="ollama">Ollama</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono">Label</Label>
                  <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="My OpenAI Key" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">
                  API Key {editingId && <span className="text-muted-foreground">(leave empty to keep current)</span>}
                </Label>
                <div className="relative">
                  <Input type={showKey ? "text" : "password"} value={key} onChange={e => setKey(e.target.value)}
                    placeholder={editingId ? "••••••••••••" : "sk-..."} required={!editingId} className="pr-10" />
                  <button type="button" onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono">Base URL <span className="text-muted-foreground">(optional — for proxies or custom endpoints)</span></Label>
                <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} id="default" />
                <Label htmlFor="default" className="text-xs">Default key for this provider</Label>
              </div>
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={resetForm} size="sm">Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending} size="sm">
                  {editingId ? "Update Key" : "Save Key"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}</div>
      ) : keys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Key className="h-10 w-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No API keys stored. Add one to run agents.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k: ApiKey) => (
            <Card key={k.id} className="border-border/50">
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{k.label}</span>
                    <Badge variant="outline" className="text-[10px]">{k.provider}</Badge>
                    {k.is_default && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {k.key_hint}
                    {k.base_url && <span className="ml-2 text-primary/50">· {k.base_url}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(k)} title="Edit">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Delete"
                    onClick={() => { if (confirm("Delete this API key?")) deleteMut.mutate(k.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
