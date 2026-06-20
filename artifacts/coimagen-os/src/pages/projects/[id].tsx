import { useRoute } from "wouter";
import { 
  useGetProject, 
  useListTasks,
  getGetProjectQueryKey,
  getListTasksQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Calendar, Building2, Wallet, User, Plus } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";
import { Link } from "wouter";

export function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = parseInt(params?.id || "0");

  const { data: project, isLoading: isLoadingProject } = useGetProject(id, {
    query: { queryKey: getGetProjectQueryKey(id) }
  });

  const { data: tasks, isLoading: isLoadingTasks } = useListTasks(
    { projectId: id },
    { query: { queryKey: getListTasksQueryKey({ projectId: id }) } }
  );

  if (isLoadingProject) {
    return <div className="p-8">Loading project details...</div>;
  }

  if (!project) {
    return <div className="p-8">Project not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          {project.clientId && (
            <p className="text-muted-foreground flex items-center mt-1">
              <Building2 className="h-4 w-4 mr-2" />
              <Link href={`/clients/${project.clientId}`} className="hover:underline">
                {project.clientName}
              </Link>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit Project</Button>
          <StatusBadge status={project.status} />
          <PriorityBadge priority={project.priority || "medium"} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center text-sm">
              <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />
              Due: {formatDate(project.dueDate)}
            </div>
            <div className="flex items-center text-sm">
              <Wallet className="h-4 w-4 mr-3 text-muted-foreground" />
              Budget: {formatCurrency(project.budget)}
            </div>
            {project.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-lg">Tasks</CardTitle>
              <CardDescription>Production pipeline for this project</CardDescription>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">Loading tasks...</TableCell>
                  </TableRow>
                ) : !tasks || tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No tasks in this project.</TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-muted/50 cursor-pointer">
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          {task.agentName ? (
                            <>
                              <User className="h-3 w-3 mr-1 text-muted-foreground" />
                              {task.agentName}
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={task.status} /></TableCell>
                      <TableCell><PriorityBadge priority={task.priority || "medium"} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
