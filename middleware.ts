import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Local demo mode: allow the app to run without Clerk keys.
export default function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"]
};
