import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agents, models, skills as skillsApi, type Skill } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bot, MessageSquare, Cpu, Puzzle, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "identity", label: "Identity", icon: Bot },
  { id: "mission", label: "Mission", icon: MessageSquare },
  { id: "model", label: "Model", icon: Cpu },
  { id: "skills", label: "Skills", icon: Puzzle },
  { id: "review", label: "Review", icon: CheckCircle },
] as const;

function StepIndicator({ current, steps }: { current: number; steps: typeof STEPS }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const active = i === current;
        const done = i < current;
        return (
          <div key={step.id} className="flex items-center gap-2">
            {i > 0 && <div className={cn("w-8 h-px", done ? "bg-primary" : "bg-border")} />}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" :
              done ? "bg-primary/10 text-primary" :
              "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NewAgentPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [provider, setProvider] = useState("openai");
  const [modelName, setModelName] = useState("gpt-4o");
  const [maxTurns, setMaxTurns] = useState(20);
  const [timeout, setTimeout] = useState(300);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const { data: modelData } = useQuery({ queryKey: ["models"], queryFn: () => models.list() });
  const { data: skillsData } = useQuery({ queryKey: ["skills"], queryFn: () => skillsApi.list() });
  const filtered = modelData?.models?.filter((m) => m.provider === provider) ?? [];
  const allSkills = skillsData?.skills || [];

  const toggleSkill = (id: string) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const agent = await agents.create({
        name, description, system_prompt: systemPrompt,
        model_provider: provider, model_name: modelName,
        max_turns: maxTurns, timeout_seconds: timeout,
      });
      // Attach selected skills
      for (let i = 0; i < selectedSkills.length; i++) {
        await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/v1/agents/${agent.id}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
          body: JSON.stringify({ skill_id: selectedSkills[i], position: i + 1 }),
        });
      }
      return agent;
    },
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent created");
      navigate(`/agents/${agent.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canNext = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return systemPrompt.trim().length > 0;
      case 2: return modelName.length > 0;
      case 3: return true; // skills are optional
      case 4: return true;
      default: return false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Create Agent</h1>

      <StepIndicator current={step} steps={STEPS} />

      {/* Step 0: Identity */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Identity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Web Researcher" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Searches the web and produces reports..." />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Mission */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Mission</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">System Prompt *</Label>
              <Textarea id="prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a senior research analyst. Your job is to thoroughly research topics..."
                rows={10} autoFocus />
              <p className="text-xs text-muted-foreground">{systemPrompt.length} characters</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Model */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" /> Model</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={(v) => { setProvider(v); setModelName(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="ollama">Ollama</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={modelName} onValueChange={(v) => { if (v !== "__custom__") setModelName(v); else setModelName(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    {filtered.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.display_name} ({(m.context_window / 1000).toFixed(0)}K)
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">✏️ Custom model name...</SelectItem>
                  </SelectContent>
                </Select>
                {(!filtered.some(m => m.id === modelName) || modelName === "") && (
                  <Input value={modelName} onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. gpt-4.1-mini, claude-sonnet-4-20250514, deepseek-chat"
                    className="mt-2 font-mono text-sm" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Turns</Label>
                <Input type="number" value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} min={1} max={100} />
              </div>
              <div className="space-y-2">
                <Label>Timeout (seconds)</Label>
                <Input type="number" value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} min={30} max={3600} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Skills */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5" /> Skills
              <span className="text-sm font-normal text-muted-foreground ml-auto">
                {selectedSkills.length} selected
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allSkills.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No skills available. Sync a skill source first.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {allSkills.map((skill: Skill) => {
                  const selected = selectedSkills.includes(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(skill.id)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <span className="font-medium text-sm">{skill.name}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">{skill.tier}</Badge>
                        {selected && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
                      )}
                      {skill.tags && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {skill.tags.split(",").map((t) => (
                            <Badge key={t} variant="secondary" className="text-[9px] px-1 py-0">{t.trim()}</Badge>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Review</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{name}</span>
              </div>
              {description && (
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium truncate max-w-xs">{description}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{provider} / {modelName}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Limits</span>
                <span className="font-medium">{maxTurns} turns · {timeout}s timeout</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Skills</span>
                <span className="font-medium">
                  {selectedSkills.length > 0
                    ? allSkills.filter((s) => selectedSkills.includes(s.id)).map((s) => s.name).join(", ")
                    : "None"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">System Prompt</span>
                <pre className="mt-1 text-xs bg-muted/30 rounded p-3 whitespace-pre-wrap max-h-40 overflow-auto">
                  {systemPrompt}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <div>
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {step === 0 && (
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          )}
        </div>
        <div>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Creating..." : "Create Agent"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
