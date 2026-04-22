import { NextResponse } from 'next/server';
import { NotificationService } from '../../../../lib/notification-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') || undefined;
  const limit = Number(url.searchParams.get('limit') || '50');
  const offset = Number(url.searchParams.get('offset') || '0');
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

  if (!userId)
    return NextResponse.json({ error: 'missing userId' }, { status: 400 });

  const notifications = await NotificationService.fetchNotifications(
    userId,
    limit,
    offset,
    unreadOnly,
  );
  return NextResponse.json({ notifications });
}
