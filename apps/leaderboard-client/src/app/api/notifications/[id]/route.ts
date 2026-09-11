import { NextRequest, NextResponse } from 'next/server';
import { NotificationRepository } from '../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const notificationRepo = new NotificationRepository();

/**
 * PATCH /api/notifications/[id] — marquer une notification lue.
 *
 * La propriété de la ligne est portée par le WHERE du repository, pas par un
 * test écrit ici : une garde qui vit dans la requête ne peut pas être oubliée
 * par un second appelant.
 *
 * D'où un 404 qui couvre aussi bien « n'existe pas » que « n'est pas à vous »
 * que « déjà lue ». C'est voulu pour les deux premiers : répondre 403
 * confirmerait l'existence d'une ligne qui ne regarde pas l'appelant.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ok = await notificationRepo.markRead(id, user.id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error marking notification read:', err);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
