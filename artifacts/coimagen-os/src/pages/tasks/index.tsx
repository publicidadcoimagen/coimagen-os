import { useState } from "react";
import { Link } from "wouter";
import { useListTasks, getListTasksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Calendar, User, FolderKanban, Plus } from "lucide-react";
import { formatDate } from "@/lib/format";

export function Tasks() {
  const { data: tasks, isLoading } = useListTasks({
    query: { queryKey: getListTasksQueryKey() }
  });

  // Group tasks by status for Kanban view
  const columns = [
    { id: "todo", label: "To Do" },
    { id: "in_progress", label: "In Progress" },
    { id: "review", label: "In Review" },
    { id: "done", label: "Done" },
  ];

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Production pipeline board</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 h-full min-w-max">
          {columns.map((column) => {
            const columnTasks = tasks?.filter(t => t.status === column.id) || [];
            
            return (
              <div key={column.id} className="w-80 flex flex-col bg-muted/20 rounded-xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50 bg-muted/40 flex items-center justify-between">
                  <h3 className="font-medium">{column.label}</h3>
                  <span className="text-xs bg-background text-muted-foreground px-2 py-1 rounded-full border border-border">
                    {columnTasks.length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
                  ) : columnTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm italic">Empty</div>
                  ) : (
                    columnTasks.map((task) => (
                      <Card key={task.id} className="cursor-grab hover:border-primary/50 transition-colors shadow-sm">
                        <CardHeader className="p-3 pb-0 space-y-2">
                          <div className="flex justify-between items-start">
                            <PriorityBadge priority={task.priority || "medium"} />
                          </div>
                          <CardTitle className="text-sm font-medium leading-tight">
                            {task.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pb-2 pt-2">
                          {task.projectName && (
                            <div className="flex items-center text-xs text-muted-foreground mb-2">
                              <FolderKanban className="h-3 w-3 mr-1" />
                              <Link href={`/projects/${task.projectId}`} className="hover:underline hover:text-foreground transition-colors truncate">
                                {task.projectName}
                              </Link>
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="p-3 pt-0 flex justify-between items-center text-xs text-muted-foreground border-t border-border/30 mt-2">
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            <span className="truncate max-w-[80px]">
                              {task.agentName || "Unassigned"}
                            </span>
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1" />
                              {formatDate(task.dueDate)}
                            </div>
                          )}
                        </CardFooter>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
