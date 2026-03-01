import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, ArrowRight, AlertCircle, Github } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login: doLogin, loadUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle OAuth callback — extract token from query params
  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refresh_token");
    if (token && refreshToken) {
      localStorage.setItem("token", token);
      localStorage.setItem("refresh_token", refreshToken);
      loadUser();
      navigate("/", { replace: true });
    }
  }, [searchParams, loadUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await doLogin(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(oklch(0.9 0 0 / 0.15) 1px, transparent 1px),
            linear-gradient(90deg, oklch(0.9 0 0 / 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative w-full max-w-md px-6">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-primary/30 bg-primary/5 mb-4">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-mono text-xl font-bold tracking-wider text-primary uppercase">AgentOps</h1>
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground mt-1 uppercase">
            Command Center
          </p>
        </div>

        {/* Login card */}
        <div className="rounded border border-border bg-card p-6 space-y-6 glow-border">
          <div>
            <h2 className="font-mono text-sm font-semibold tracking-wider uppercase">Sign In</h2>
            <p className="text-xs text-muted-foreground mt-1">Enter your credentials to access the platform.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@company.com"
                required
                className="font-mono text-sm bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="font-mono text-sm bg-input border-border"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full font-mono tracking-wider uppercase text-xs h-10">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="led led-amber led-pulse" /> Authenticating…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Access Platform <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          </form>

          {/* OAuth divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-card px-3 font-mono tracking-wider text-muted-foreground">
                or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="font-mono text-xs tracking-wider h-10"
              onClick={() => window.location.href = `${API_BASE}/api/v1/auth/github`}
            >
              <Github className="mr-2 h-4 w-4" /> GitHub
            </Button>
            <Button
              variant="outline"
              className="font-mono text-xs tracking-wider h-10"
              onClick={() => window.location.href = `${API_BASE}/api/v1/auth/google`}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </Button>
          </div>

          <div className="border-t border-border pt-4 text-center">
            <span className="text-xs text-muted-foreground">
              No account?{" "}
              <Link to="/register" className="text-primary hover:underline font-medium">
                Request Access
              </Link>
            </span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 font-mono text-[9px] tracking-wider text-muted-foreground/40 uppercase">
          Secure · Encrypted · Enterprise-Grade
        </p>
      </div>
    </div>
  );
}
