"use client";

import { useQuery } from "@tanstack/react-query";
import { skills } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Puzzle } from "lucide-react";

export default function SkillsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["skills"],
    queryFn: () => skills.list(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Skills</h1>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : !data?.skills?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              No skills available yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.skills.map((skill) => (
            <Card key={skill.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{skill.name}</CardTitle>
                  <Badge variant="outline">{skill.tier}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {skill.description || "No description"}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>v{skill.version}</span>
                  {skill.tags &&
                    skill.tags.split(",").map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag.trim()}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
