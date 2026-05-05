import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateZoomSignature } from "@/lib/zoom-signature";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ bookingId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookingId } = await ctx.params;
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("live_session_bookings")
    .select("id, learner_id, instructor_id, status, starts_at, ends_at")
    .eq("id", bookingId)
    .single();

  if (!booking || (booking.learner_id !== userId && booking.instructor_id !== userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "Session is not confirmed yet" }, { status: 409 });
  }

  const now = Date.now();
  const allowedStart = new Date(booking.starts_at).getTime() - 15 * 60_000;
  const allowedEnd = new Date(booking.ends_at).getTime() + 30 * 60_000;
  if (now < allowedStart || now > allowedEnd) {
    return NextResponse.json({ error: "Session is outside the join window" }, { status: 403 });
  }

  const { data: zoomMeeting } = await supabase
    .from("zoom_meetings")
    .select("*")
    .eq("booking_id", booking.id)
    .single();

  if (!zoomMeeting) {
    return NextResponse.json({ error: "Zoom meeting has not been created for this booking" }, { status: 404 });
  }

  const sdkKey = process.env.NEXT_PUBLIC_ZOOM_MEETING_SDK_KEY ?? process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID;
  if (!sdkKey) {
    return NextResponse.json({ error: "Zoom Meeting SDK public key is not configured" }, { status: 500 });
  }

  const user = await currentUser();
  const displayName = user?.fullName || user?.username || "Zed AI Academy";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const signature = generateZoomSignature(zoomMeeting.zoom_meeting_id, 0);

  return NextResponse.json({
    signature,
    meetingNumber: zoomMeeting.zoom_meeting_id,
    password: zoomMeeting.password_encrypted ?? "",
    sdkKey,
    displayName,
    email,
  });
}

