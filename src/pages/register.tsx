import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, ArrowRight, AlertCircle } from "lucide-react";

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: doRegister } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await doRegister(email, name, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(oklch(0.9 0 0 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0 0 / 0.15) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative w-full max-w-md px-6">
        <div className="flex flex-col items-center mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-primary/30 bg-primary/5 mb-4">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-mono text-xl font-bold tracking-wider text-primary uppercase">AgentOps</h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mt-1 uppercase">Request Access</p>
        </div>

        <div className="rounded border border-border bg-card p-6 space-y-6 glow-border">
          <div>
            <h2 className="font-mono text-sm font-semibold tracking-wider uppercase">Register</h2>
            <p className="text-xs text-muted-foreground mt-1">Create an operator account.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Operator Name" required className="font-mono text-sm bg-input" />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@company.com" required className="font-mono text-sm bg-input" />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="font-mono text-sm bg-input" />
            </div>
            <Button type="submit" disabled={loading} className="w-full font-mono tracking-wider uppercase text-xs h-10">
              {loading ? (
                <span className="flex items-center gap-2"><span className="led led-amber led-pulse" /> Creating Account…</span>
              ) : (
                <span className="flex items-center gap-2">Create Account <ArrowRight className="h-3.5 w-3.5" /></span>
              )}
            </Button>
          </form>

          <div className="border-t border-border pt-4 text-center">
            <span className="text-xs text-muted-foreground">
              Already have access?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">Sign In</Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
