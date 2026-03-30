import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div>
          <p className="eyebrow-label">Metric</p>
          <CardTitle className="mt-2 text-base">{label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-3xl tracking-[-0.04em] text-white">{value}</p>
        <p className="mt-2 text-sm text-white/56">{detail}</p>
      </CardContent>
    </Card>
  );
}
