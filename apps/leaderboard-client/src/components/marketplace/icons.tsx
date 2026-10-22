import {
  Activity,
  AudioWaveform,
  CalendarCheck,
  FolderHeart,
  HeartPulse,
  Mic,
  PhoneCall,
  ScanSearch,
  Watch,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type { ModuleIcon as ModuleIconName } from "@/content/marketplace/types";

/**
 * Le pictogramme d'un module. Le registre ne nomme qu'une clé
 * (`content/marketplace`) : le contenu ne dépend d'aucune bibliothèque d'UI.
 */
const ICONS: Record<ModuleIconName, LucideIcon> = {
  record: FolderHeart,
  engine: Workflow,
  "care-plan": CalendarCheck,
  device: Watch,
  heart: HeartPulse,
  metabolic: Activity,
  mind: AudioWaveform,
  skin: ScanSearch,
  prevention: Mic,
  call: PhoneCall,
};

export function ModuleIcon({ name, className }: { name: ModuleIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10m0 0L9 4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 3.5h-3v9h9v-3M9 3h4v4M13 3 7.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
