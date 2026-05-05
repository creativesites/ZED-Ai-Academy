import { createServiceClient } from "@/lib/supabase/server";
import { getLiveSessionSlots } from "@/lib/live-sessions/slots";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { serviceId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const timezone = searchParams.get("timezone") || undefined;

    const supabase = createServiceClient();
    const result = await getLiveSessionSlots(supabase, params.serviceId, {
      from,
      to,
      timezone,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[api/live-sessions/slots] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
