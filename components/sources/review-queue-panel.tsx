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
        <div>
          <p className="eyebrow-label">Ambiguity review</p>
          <CardTitle className="mt-2">Review Queue</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 break-words text-sm text-white/56">
                    {item.details ?? item.builderName ?? item.sourceName ?? "Needs review"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="amber">{labelize(item.reviewType)}</Badge>
                  <Badge tone="slate">Priority {item.priority}</Badge>
                </div>
              </div>
              <div className="mt-3 space-y-2 text-sm text-white/58">
                {item.rationale ? <p className="break-words">{item.rationale}</p> : null}
                <p>
                  Last seen {formatDate(item.lastSeenAt)}
                  {item.sourceName ? ` • ${item.sourceName}` : ""}
                </p>
                {item.opportunityId ? (
                  <Link
                    href={`/opportunities/${item.opportunityId}`}
                    className="text-link"
                  >
                    Open record
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/56">
            No open review items. Connector failures, weak identities, and missing-contact gaps will appear here automatically.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
