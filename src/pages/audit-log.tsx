import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLog } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  "auth.login": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "auth.register": "bg-green-500/20 text-green-400 border-green-500/30",
  "auth.oauth_login": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "agent.create": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "agent.update": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "agent.delete": "bg-red-500/20 text-red-400 border-red-500/30",
  "run.create": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "run.cancel": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "api_key.create": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "api_key.delete": "bg-red-500/20 text-red-400 border-red-500/30",
  "schedule.create": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "team.create": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "team.invite": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

function formatTime(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parseMetadata(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const perPage = 30;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", page],
    queryFn: () => auditLog.list(page, perPage),
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Shield className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-zinc-100">
            AUDIT LOG
          </h1>
          <p className="text-sm text-zinc-500 font-mono">
            {total} entries · Security event trail
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/50">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="font-mono text-xs text-zinc-500 w-[180px]">
                TIMESTAMP
              </TableHead>
              <TableHead className="font-mono text-xs text-zinc-500 w-[160px]">
                ACTION
              </TableHead>
              <TableHead className="font-mono text-xs text-zinc-500">
                DETAILS
              </TableHead>
              <TableHead className="font-mono text-xs text-zinc-500 w-[120px]">
                IP ADDRESS
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-zinc-500 py-12">
                  Loading audit entries...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-zinc-500 py-12">
                  No audit entries yet
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry: any) => {
                const meta = parseMetadata(entry.metadata);
                const colorClass =
                  ACTION_COLORS[entry.action] ??
                  "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

                return (
                  <TableRow
                    key={entry.id}
                    className="border-zinc-800/50 hover:bg-zinc-900/50"
                  >
                    <TableCell className="font-mono text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-zinc-600" />
                        {formatTime(entry.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px] tracking-wider border",
                          colorClass
                        )}
                      >
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-300">
                      {Object.entries(meta).map(([k, v]) => (
                        <span key={k} className="mr-3">
                          <span className="text-zinc-500">{k}:</span>{" "}
                          <span className="text-zinc-300 font-mono text-xs">
                            {String(v).substring(0, 40)}
                          </span>
                        </span>
                      ))}
                      {entry.resource_id && Object.keys(meta).length === 0 && (
                        <span className="text-zinc-500 font-mono text-xs">
                          {entry.resource_id.substring(0, 8)}…
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {entry.ip_address || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 font-mono">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
