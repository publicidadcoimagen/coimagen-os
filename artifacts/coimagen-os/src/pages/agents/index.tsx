import { useListAgents, getListAgentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Cpu, Network, Plus } from "lucide-react";

export function Agents() {
  const { data: agents, isLoading } = useListAgents({
    query: { queryKey: getListAgentsQueryKey() }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground mt-1">Manage autonomous creative and production agents</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Deploy Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-lg border-b border-border/50" />
              <CardContent className="h-32" />
            </Card>
          ))
        ) : !agents || agents.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-muted-foreground border border-dashed rounded-lg">
            No agents deployed yet.
          </div>
        ) : (
          agents.map((agent) => (
            <Card key={agent.id} className="overflow-hidden border-border/50 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription className="text-xs font-mono mt-0.5">{agent.role}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                    {agent.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                  {agent.description || "No description provided."}
                </p>
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5 mr-2" />
                    Specialty: <span className="ml-1 text-foreground font-medium">{agent.specialty || "General"}</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Network className="h-3.5 w-3.5 mr-2" />
                    Status: <span className="ml-1 text-foreground font-medium capitalize">{agent.status}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="w-full">Configure</Button>
                  <Button variant="secondary" size="sm" className="w-full">View Logs</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
