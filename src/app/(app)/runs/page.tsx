"use client";

import { useQuery } from "@tanstack/react-query";
import { runs } from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function RunsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["runs"],
    queryFn: runs.list,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Runs</h1>

      {isLoading ? (
        <div className="h-64 bg-muted rounded animate-pulse" />
      ) : !data?.runs?.length ? (
        <p className="text-muted-foreground">
          No runs yet. Go to an agent and trigger a run.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mission</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Turns</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <Link
                    href={`/runs/${run.id}`}
                    className="text-primary hover:underline truncate max-w-xs block"
                  >
                    {run.mission.slice(0, 80)}
                    {run.mission.length > 80 ? "..." : ""}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{run.model_name}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={run.status} />
                </TableCell>
                <TableCell>{run.total_turns}</TableCell>
                <TableCell>
                  {run.duration_ms
                    ? `${(run.duration_ms / 1000).toFixed(1)}s`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(run.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "succeeded"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "running"
          ? "secondary"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
