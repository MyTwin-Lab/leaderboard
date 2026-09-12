import { NextRequest, NextResponse } from 'next/server';
import { NotificationRepository } from '../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const notificationRepo = new NotificationRepository();

/**
 * La forme servie au client.
 *
 * Construite champ par champ, comme `lib/public/sandbox.ts` : une colonne
 * ajoutée plus tard à `notifications` reste privée tant que personne ne l'a
 * écrite ici. `dedupe_key` en particulier n'a aucune raison de sortir — c'est
 * de la plomberie d'unicité, pas une donnée.
 */
interface NotificationView {
  uuid: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string | null;
}

function toView(row: {
  uuid: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
}): NotificationView {
  return {
    uuid: row.uuid,
    type: row.type,
    payload: row.payload ?? {},
    // Un booléen plutôt que la date : le client n'affiche jamais *quand* une
    // notification a été lue, seulement si elle l'est.
    read: row.read_at !== null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

// GET /api/notifications — les siennes, les plus récentes d'abord.
export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [rows, unread] = await Promise.all([
      notificationRepo.findByUser(user.id),
      notificationRepo.countUnread(user.id),
    ]);

    return NextResponse.json({ notifications: rows.map(toView), unread });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH /api/notifications — tout marquer lu.
export async function PATCH(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const updated = await notificationRepo.markAllRead(user.id);
    return NextResponse.json({ updated });
  } catch (err) {
    console.error('Error marking notifications read:', err);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
