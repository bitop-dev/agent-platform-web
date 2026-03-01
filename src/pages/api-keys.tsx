import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiKeys } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Key, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ApiKeysPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isDefault, setIsDefault] = useState(true);

  const { data, isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: apiKeys.list });
  const createMut = useMutation({
    mutationFn: apiKeys.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key saved"); setShowForm(false); setKey(""); setLabel(""); setBaseUrl(""); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteMut = useMutation({
    mutationFn: apiKeys.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key deleted"); },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">API Keys</h1>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="mr-2 h-4 w-4" /> Add Key</Button>
      </div>

      {showForm && (
        <Card><CardHeader><CardTitle>Add LLM Provider Key</CardTitle></CardHeader><CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate({ provider, label, key, is_default: isDefault, base_url: baseUrl || undefined }); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Provider</Label><Select value={provider} onValueChange={setProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI</SelectItem><SelectItem value="anthropic">Anthropic</SelectItem><SelectItem value="ollama">Ollama</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My OpenAI Key" required /></div>
            </div>
            <div className="space-y-2"><Label>API Key</Label><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-..." required /></div>
            <div className="space-y-2"><Label>Base URL <span className="text-muted-foreground">(optional)</span></Label><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" /></div>
            <div className="flex items-center gap-2"><Switch checked={isDefault} onCheckedChange={setIsDefault} id="default" /><Label htmlFor="default">Default key for this provider</Label></div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Save Key</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {isLoading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}</div> : !data?.api_keys?.length ? (
        <Card><CardContent className="flex flex-col items-center gap-4 py-12"><Key className="h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground">No API keys stored. Add one to run agents.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">{data.api_keys.map((k) => (
          <Card key={k.id}><CardContent className="flex items-center justify-between py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2"><span className="font-medium">{k.label}</span><Badge variant="outline">{k.provider}</Badge>{k.is_default && <Badge>Default</Badge>}</div>
              <p className="text-xs text-muted-foreground">{k.key_hint}{k.base_url && ` · ${k.base_url}`}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this API key?")) deleteMut.mutate(k.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </CardContent></Card>
        ))}</div>
      )}
    </div>
  );
}
