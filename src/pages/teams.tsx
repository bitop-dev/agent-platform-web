import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Users, Crown, Shield, User, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

async function fetchTeams() {
  const res = await fetch(`${API_BASE}/api/v1/teams`, { headers: headers() });
  return res.json();
}
async function fetchMembers(teamId: string) {
  const res = await fetch(`${API_BASE}/api/v1/teams/${teamId}/members`, { headers: headers() });
  return res.json();
}
async function createTeam(name: string) {
  const res = await fetch(`${API_BASE}/api/v1/teams`, {
    method: "POST", headers: headers(), body: JSON.stringify({ name }),
  });
  return res.json();
}
async function inviteMember(teamId: string, email: string, role: string) {
  const res = await fetch(`${API_BASE}/api/v1/teams/${teamId}/invitations`, {
    method: "POST", headers: headers(), body: JSON.stringify({ email, role }),
  });
  return res.json();
}
async function deleteTeam(id: string) {
  const res = await fetch(`${API_BASE}/api/v1/teams/${id}`, { method: "DELETE", headers: headers() });
  return res.json();
}

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: User,
};
const roleColors: Record<string, string> = {
  owner: "border-primary/30 text-primary",
  admin: "border-blue-500/30 text-blue-400",
  member: "border-border text-muted-foreground",
  viewer: "border-border text-muted-foreground/60",
};

export function TeamsPage() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
  const { data: membersData } = useQuery({
    queryKey: ["team-members", selectedTeam],
    queryFn: () => fetchMembers(selectedTeam!),
    enabled: !!selectedTeam,
  });

  const createMut = useMutation({
    mutationFn: () => createTeam(newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setNewName("");
      setDialogOpen(false);
      toast.success("Team created");
    },
  });

  const inviteMut = useMutation({
    mutationFn: () => inviteMember(selectedTeam!, inviteEmail, "member"),
    onSuccess: () => {
      setInviteEmail("");
      toast.success("Invitation sent");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setSelectedTeam(null);
      toast.success("Team deleted");
    },
  });

  const teams = data?.teams || [];
  const members = membersData?.members || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold tracking-tight">Teams</h1>
          <Badge variant="outline" className="font-mono text-[10px] tracking-wider">
            {teams.length} TEAM{teams.length !== 1 ? "S" : ""}
          </Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono text-xs tracking-wider uppercase h-9">
              <Plus className="mr-2 h-3.5 w-3.5" /> New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-mono tracking-wider uppercase text-sm">Create Team</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">Team Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Engineering"
                  className="font-mono text-sm"
                  required
                />
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full font-mono text-xs tracking-wider uppercase">
                {createMut.isPending ? "Creating…" : "Create Team"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-16 bg-card border border-border rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Teams list */}
          <div className="space-y-2">
            {teams.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 rounded border border-dashed border-border">
                <Users className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No teams yet.</p>
              </div>
            ) : (
              teams.map((team: any) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded border text-left transition-all glow-border",
                    selectedTeam === team.id
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card hover:border-primary/20"
                  )}
                >
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{team.name}</span>
                    <p className="font-mono text-[10px] text-muted-foreground">{team.slug}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this team?")) deleteMut.mutate(team.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </button>
              ))
            )}
          </div>

          {/* Members panel */}
          {selectedTeam && (
            <Card className="glow-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm tracking-wider uppercase flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Members
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Invite form */}
                <form
                  onSubmit={(e) => { e.preventDefault(); inviteMut.mutate(); }}
                  className="flex gap-2"
                >
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@company.com"
                    className="font-mono text-xs flex-1"
                    required
                  />
                  <Button type="submit" size="sm" disabled={inviteMut.isPending} className="font-mono text-xs tracking-wider uppercase shrink-0">
                    <Mail className="mr-1 h-3 w-3" /> Invite
                  </Button>
                </form>

                {/* Members list */}
                <div className="space-y-1">
                  {members.map((m: any) => {
                    const RoleIcon = roleIcons[m.role] || User;
                    return (
                      <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded border border-transparent hover:border-border">
                        <div className="h-7 w-7 rounded bg-card border border-border flex items-center justify-center shrink-0">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground">
                            {m.name?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">{m.name}</span>
                          <p className="font-mono text-[10px] text-muted-foreground">{m.email}</p>
                        </div>
                        <Badge variant="outline" className={cn("font-mono text-[9px] tracking-wider uppercase", roleColors[m.role])}>
                          <RoleIcon className="h-2.5 w-2.5 mr-1" /> {m.role}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
