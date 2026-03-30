import { NextRequest, NextResponse } from "next/server";

import {
  deleteOpportunityContact,
  updateOpportunityContact
} from "@/lib/opportunities/contacted-workflow";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const body = await request.json();
    const opportunity = await updateOpportunityContact(params.contactId, body);

    return NextResponse.json(opportunity);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update contact.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const opportunity = await deleteOpportunityContact(params.contactId);

    return NextResponse.json(opportunity);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete contact.",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
