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

/**
 * DELETE /api/notifications/[id] — retirer une notification.
 *
 * Deux appelants, un seul geste : refuser une invitation de groupe, et retirer
 * celle qu'un join réussi vient de rendre caduque.
 *
 * Refuser **ne révoque rien** : le jeton du groupe reste valide et le lien
 * partagé par ailleurs continue de fonctionner. Sans état en attente, c'est un
 * classement sans suite, pas un veto.
 *
 * Même 404 indistinct que le PATCH, pour la même raison.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ok = await notificationRepo.delete(id, user.id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error deleting notification:', err);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
