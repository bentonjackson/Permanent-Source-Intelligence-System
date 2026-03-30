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
    <div className="surface-panel panel-grid rounded-[22px] border px-5 py-6 lg:px-7 lg:py-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <p className="engraved-label">{eyebrow}</p>
          <h2 className="mt-4 max-w-4xl font-serif text-[2.25rem] leading-[0.96] tracking-[-0.04em] text-white md:text-[3rem]">
            {title}
          </h2>
          <div className="mt-4 h-px w-24 bg-red-500/55" />
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/62 lg:text-[15px]">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="slate" className="hidden lg:inline-flex">
            Architectural Operations System
          </Badge>
          {actions ?? (
            <>
              <Button variant="outline">Saved Territory</Button>
              <Button>Run Sync</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
