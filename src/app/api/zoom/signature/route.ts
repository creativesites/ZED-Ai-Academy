import { NextRequest, NextResponse } from 'next/server';
import { generateZoomSignature } from '@/lib/zoom-signature';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { meetingNumber, role } = await req.json();
    const requestedRole = Number(role ?? 0);

    if (!meetingNumber) {
      return NextResponse.json({ error: 'meetingNumber is required' }, { status: 400 });
    }

    if (requestedRole !== 0) {
      return NextResponse.json({ error: 'Host signatures are not available from the legacy meeting endpoint' }, { status: 403 });
    }

    const signature = generateZoomSignature(meetingNumber.toString().replace(/\s/g, ''), requestedRole);
    
    return NextResponse.json({ signature });
  } catch (error) {
    console.error('Zoom signature error:', error);
    return NextResponse.json({ error: 'Failed to generate signature' }, { status: 500 });
  }
}
