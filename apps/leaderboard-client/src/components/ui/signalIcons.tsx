import type { LucideIcon } from 'lucide-react';
import {
  Lightbulb,
  HeartHandshake,
  Search,
  MessageCircle,
  Wrench,
  BookOpen,
  Target,
  Zap,
  Radio,
} from 'lucide-react';

/**
 * Catalogue d'icônes proposées pour les signaux de contribution. Les clés sont
 * stockées en base (challenge_signals.icon) — ne pas les renommer sans
 * migration des données existantes.
 */
export const SIGNAL_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  lightbulb: { icon: Lightbulb, label: 'Idea' },
  handshake: { icon: HeartHandshake, label: 'Help' },
  search: { icon: Search, label: 'Review' },
  message: { icon: MessageCircle, label: 'Discussion' },
  wrench: { icon: Wrench, label: 'Fix' },
  book: { icon: BookOpen, label: 'Knowledge' },
  target: { icon: Target, label: 'Goal' },
  zap: { icon: Zap, label: 'Initiative' },
};

/** Icône par défaut quand un signal n'en a pas (ou a une clé inconnue). */
export const DEFAULT_SIGNAL_ICON: LucideIcon = Radio;

export function getSignalIcon(key: string | null | undefined): LucideIcon {
  return (key && SIGNAL_ICONS[key]?.icon) || DEFAULT_SIGNAL_ICON;
}
