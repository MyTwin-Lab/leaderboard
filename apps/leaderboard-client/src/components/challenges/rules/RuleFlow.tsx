import type { ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';

/**
 * Primitives de mise en page des vues de règles (tiroir « Reward rules »),
 * sur le design vitrine : `.v-co-flow*` dans
 * `components/challenges/challenge-overlays-vitrine.css`.
 */

export const pct = (n: number) => Math.round(n * 100);

export function FlowArrow() {
  return (
    <div className="v-co-flow-arrow">
      <ArrowDown />
    </div>
  );
}

export function FlowBox({
  icon, title, children, tone = 'default',
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="v-co-flow-box" data-tone={tone}>
      <div className="v-co-flow-head">
        <div className="v-co-flow-icon">{icon}</div>
        <span className="v-co-flow-title">{title}</span>
      </div>
      <div className="v-co-flow-body">{children}</div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="v-label v-co-flow-label">{children}</p>;
}
