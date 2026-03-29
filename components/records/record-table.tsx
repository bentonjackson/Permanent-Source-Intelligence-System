import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuilderRecord } from "@/types/domain";
import { formatCurrency, formatDate } from "@/lib/utils";

export function RecordTable({ builders }: { builders: BuilderRecord[] }) {
  const records = builders.flatMap((builder) =>
    builder.properties.flatMap((property) =>
      property.permits.map((permit) => ({
        builder: builder.name,
        address: property.address,
        city: property.city,
        county: property.county,
        stage: builder.pipelineStage,
        permit
      }))
    )
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permit and Property Explorer</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-3">Builder</th>
              <th className="pb-3">Address</th>
              <th className="pb-3">County</th>
              <th className="pb-3">Classification</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Value</th>
              <th className="pb-3">Issue Date</th>
              <th className="pb-3">Lead Stage</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.permit.id} className="border-t align-top">
                <td className="py-4 font-medium">{record.builder}</td>
                <td className="py-4">
                  <p>{record.address}</p>
                  <p className="text-slate-500">{record.city}</p>
                </td>
                <td className="py-4">{record.county}</td>
                <td className="py-4">
                  <Badge tone={record.permit.classification === "single_family_home" ? "green" : "slate"}>
                    {record.permit.classification}
                  </Badge>
                </td>
                <td className="py-4">{record.permit.permitStatus}</td>
                <td className="py-4">{formatCurrency(record.permit.estimatedProjectValue)}</td>
                <td className="py-4">{formatDate(record.permit.issueDate)}</td>
                <td className="py-4">{record.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
