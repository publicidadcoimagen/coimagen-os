import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  useGetDashboardSummary, 
  useGetRecentActivity, 
  useGetProjectsByStatus,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetProjectsByStatusQueryKey
} from "@workspace/api-client-react";
import { Users, FolderKanban, Bot, CheckSquare, Activity } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatDate } from "@/lib/format";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });
  
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });

  const { data: projectsByStatus, isLoading: isLoadingProjects } = useGetProjectsByStatus({
    query: { queryKey: getGetProjectsByStatusQueryKey() }
  });

  if (isLoadingSummary || isLoadingActivity || isLoadingProjects) {
    return <div className="flex items-center justify-center h-full">Loading dashboard...</div>;
  }

  const chartData = projectsByStatus?.map(stat => ({
    name: stat.status,
    value: stat.count
  })) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{summary?.activeClientsThisMonth || 0} this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.completedProjectsThisMonth || 0} completed this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.openTasks || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
            <Bot className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalAgents || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity?.map((entry) => (
                <div key={entry.id} className="flex flex-col space-y-1">
                  <div className="text-sm font-medium">{entry.description}</div>
                  <div className="flex items-center text-xs text-muted-foreground space-x-2">
                    <span>{formatDate(entry.createdAt)}</span>
                    {entry.entityName && (
                      <>
                        <span>•</span>
                        <span>{entry.entityName}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!activity?.length && (
                <div className="text-sm text-muted-foreground">No recent activity.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 h-[400px]">
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No project data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
