import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/fetchJson';
import type { ModuleSlots, ModulesResponse } from '@/lib/moduleSlots';
import { meetingsSlots } from './modules/meetings';
import { sandboxSlots } from './modules/sandbox';

/**
 * Distribution MyTwin — slots d'interface des modules
 * ---------------------------------------------------
 * Ce que chaque module installé place dans les écrans du shell. Un module
 * absent de cette liste n'a pas d'interface ; un module présent n'en a que
 * s'il est actif.
 */
const SLOTS: readonly ModuleSlots[] = [sandboxSlots, meetingsSlots];

/** Les slots des modules actifs. Tant que l'état est inconnu, aucun : un module est désactivé par défaut. */
export function enabledModuleSlots(
  response: ModulesResponse | null | undefined,
  slots: readonly ModuleSlots[] = SLOTS,
): readonly ModuleSlots[] {
  const enabled = new Set((response?.modules ?? []).filter(module => module.enabled).map(module => module.key));
  return slots.filter(slot => enabled.has(slot.key));
}

/**
 * Les slots des modules actifs, d'après `GET /api/modules`. Même clé que la
 * page d'un challenge pré-remplit côté serveur (`['modules']`).
 */
export function useModuleSlots() {
  const query = useQuery({
    queryKey: ['modules'],
    queryFn: () => fetchJson('/api/modules') as Promise<ModulesResponse>,
    staleTime: 5 * 60_000,
  });
  const slots = useMemo(() => enabledModuleSlots(query.data), [query.data]);
  return { slots, isLoading: query.isLoading };
}
