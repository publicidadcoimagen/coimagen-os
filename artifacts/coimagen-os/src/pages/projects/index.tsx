import { useState } from "react";
import { Link } from "wouter";
import { useListProjects, getListProjectsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Plus, Search } from "lucide-react";
import { formatDate } from "@/lib/format";

export function Projects() {
  const [search, setSearch] = useState("");
  const { data: projects, isLoading } = useListProjects({
    query: { queryKey: getListProjectsQueryKey() }
  });

  const filteredProjects = projects?.filter(project => 
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.clientName?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4 flex flex-row justify-between items-center">
          <div className="flex items-center space-x-2 w-full max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects or clients..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0 px-0 h-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading projects...</TableCell>
                </TableRow>
              ) : filteredProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No projects found.</TableCell>
                </TableRow>
              ) : (
                filteredProjects.map((project) => (
                  <TableRow key={project.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link href={`/projects/${project.id}`} className="hover:underline">
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {project.clientId ? (
                        <Link href={`/clients/${project.clientId}`} className="text-muted-foreground hover:underline">
                          {project.clientName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={project.status} /></TableCell>
                    <TableCell><PriorityBadge priority={project.priority || "medium"} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(project.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
