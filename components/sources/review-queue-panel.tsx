import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { ReviewQueueItemRecord } from "@/types/domain";

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

export function ReviewQueuePanel({ items }: { items: ReviewQueueItemRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {item.details ?? item.builderName ?? item.sourceName ?? "Needs review"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="amber">{labelize(item.reviewType)}</Badge>
                  <Badge tone="slate">Priority {item.priority}</Badge>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {item.rationale ? <p className="break-words">{item.rationale}</p> : null}
                <p>
                  Last seen {formatDate(item.lastSeenAt)}
                  {item.sourceName ? ` • ${item.sourceName}` : ""}
                </p>
                {item.opportunityId ? (
                  <Link
                    href={`/opportunities/${item.opportunityId}`}
                    className="text-sm font-medium text-red-700 underline-offset-4 hover:underline"
                  >
                    Open record
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
            No open review items. Connector failures, weak identities, and missing-contact gaps will appear here automatically.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
