import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-[28px] border bg-white/75 p-6 shadow-panel backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Badge tone="red">{eyebrow}</Badge>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {actions ?? (
          <>
            <Button variant="outline">Saved Territory</Button>
            <Button>Run Sync</Button>
          </>
        )}
      </div>
    </div>
  );
}
