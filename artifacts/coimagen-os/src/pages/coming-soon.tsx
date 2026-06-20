import { LucideIcon, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComingSoonProps {
  title: string;
  description: string;
  Icon?: LucideIcon;
}

export function ComingSoon({ title, description, Icon }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <Card className="max-w-md w-full border-dashed border-border/50">
        <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            {Icon ? (
              <Icon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Lock className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <Badge variant="outline" className="mb-3 text-xs tracking-wider uppercase">
              En construcción
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{description}</p>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-2">Disponible en una próxima versión de Coimagen OS</p>
        </CardContent>
      </Card>
    </div>
  );
}
