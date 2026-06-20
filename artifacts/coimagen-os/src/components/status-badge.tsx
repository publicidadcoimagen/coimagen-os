import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  
  switch (status) {
    case "active":
    case "in_progress":
      variant = "default";
      break;
    case "completed":
    case "done":
      variant = "secondary";
      break;
    case "cancelled":
    case "paused":
      variant = "destructive";
      break;
    case "planning":
    case "todo":
    case "prospect":
      variant = "outline";
      break;
  }

  return (
    <Badge variant={variant} className="capitalize">
      {status.replace("_", " ")}
    </Badge>
  );
}

type PriorityBadgeProps = {
  priority: string;
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  
  switch (priority) {
    case "urgent":
    case "high":
      variant = "destructive";
      break;
    case "medium":
      variant = "default";
      break;
    case "low":
      variant = "secondary";
      break;
  }

  return (
    <Badge variant={variant} className="capitalize">
      {priority}
    </Badge>
  );
}
