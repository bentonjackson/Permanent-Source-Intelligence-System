import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/client";

function toNullableDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  const body = await request.json();

  try {
    const updated = await prisma.plotOpportunity.update({
      where: {
        id: params.opportunityId
      },
      data: {
        bidStatus: body.bidStatus,
        inquiredAt: body.inquiredAt !== undefined ? toNullableDate(body.inquiredAt) : undefined,
        needsFollowUp: typeof body.needsFollowUp === "boolean" ? body.needsFollowUp : undefined,
        suggestedFollowUpDate: body.suggestedFollowUpDate !== undefined ? toNullableDate(body.suggestedFollowUpDate) : undefined,
        secondFollowUpDate: body.secondFollowUpDate !== undefined ? toNullableDate(body.secondFollowUpDate) : undefined,
        followedUpOn: body.followedUpOn !== undefined ? toNullableDate(body.followedUpOn) : undefined,
        closedAt: body.closedAt !== undefined ? toNullableDate(body.closedAt) : undefined,
        notes: body.notes !== undefined ? String(body.notes).split("\n").filter(Boolean) : undefined
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to persist opportunity update.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
