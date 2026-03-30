import { stageOrder } from "@/lib/auth/config";
import { BuilderRecord } from "@/types/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LeadBoard({ builders }: { builders: BuilderRecord[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {stageOrder.map((stage) => {
        const stageBuilders = builders.filter((builder) => builder.pipelineStage === stage);

        return (
          <Card key={stage} className="min-h-[280px]">
            <CardHeader>
              <div>
                <p className="eyebrow-label">Stage</p>
                <CardTitle className="mt-2 text-base">{stage}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stageBuilders.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-white/14 bg-white/[0.03] p-4 text-sm text-white/46">
                  No grouped leads in this stage.
                </div>
              ) : (
                stageBuilders.map((builder) => (
                  <div key={builder.id} className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="font-serif text-lg tracking-[-0.03em] text-white">{builder.name}</p>
                    <p className="mt-1 text-sm text-white/56">
                      {builder.activeProperties} active plots • {builder.assignedRep}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="green">Score {builder.leadScore}</Badge>
                      <Badge tone="slate">{builder.counties.join(", ")}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
