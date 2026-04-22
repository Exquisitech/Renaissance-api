import { NextResponse } from 'next/server';
import { NotificationService } from '../../../../lib/notification-service';

export async function POST(req: Request) {
  const body = await req.json();
  const { userId } = body;
  if (!userId)
    return NextResponse.json({ error: 'missing userId' }, { status: 400 });

  const result = await NotificationService.subscribe(userId);
  return NextResponse.json(result);
}
