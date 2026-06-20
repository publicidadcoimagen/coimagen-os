import { useRoute } from "wouter";
import { 
  useGetClient, 
  useListProjects,
  getGetClientQueryKey,
  getListProjectsQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Building2, Mail, Phone, Calendar, Briefcase, Plus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Link } from "wouter";

export function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const id = parseInt(params?.id || "0");

  const { data: client, isLoading: isLoadingClient } = useGetClient(id, {
    query: { queryKey: getGetClientQueryKey(id) }
  });

  const { data: projects, isLoading: isLoadingProjects } = useListProjects(
    { clientId: id },
    { query: { queryKey: getListProjectsQueryKey({ clientId: id }) } }
  );

  if (isLoadingClient) {
    return <div className="p-8">Loading client details...</div>;
  }

  if (!client) {
    return <div className="p-8">Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground flex items-center mt-1">
            <Building2 className="h-4 w-4 mr-2" />
            {client.company || "No company specified"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Edit Client</Button>
          <StatusBadge status={client.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center text-sm">
              <Mail className="h-4 w-4 mr-3 text-muted-foreground" />
              {client.email || "No email"}
            </div>
            <div className="flex items-center text-sm">
              <Phone className="h-4 w-4 mr-3 text-muted-foreground" />
              {client.phone || "No phone"}
            </div>
            <div className="flex items-center text-sm">
              <Briefcase className="h-4 w-4 mr-3 text-muted-foreground" />
              {client.industry || "No industry specified"}
            </div>
            <div className="flex items-center text-sm">
              <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />
              Added {formatDate(client.createdAt)}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg">Associated Projects</CardTitle>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingProjects ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">Loading projects...</TableCell>
                  </TableRow>
                ) : !projects || projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No projects found.</TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.id} className="hover:bg-muted/50 cursor-pointer">
                      <TableCell className="font-medium">
                        <Link href={`/projects/${project.id}`} className="hover:underline">
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={project.status} /></TableCell>
                      <TableCell><PriorityBadge priority={project.priority || "medium"} /></TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(project.dueDate)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {client.notes && (
          <Card className="col-span-1 md:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{client.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
