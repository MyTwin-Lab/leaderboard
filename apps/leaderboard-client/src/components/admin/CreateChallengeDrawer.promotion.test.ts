import { describe, it, expect } from 'vitest';
import { buildPromotionRequestBody, type PromotionFormState } from './promotionRequestBody';

const base: PromotionFormState = {
  title: '  Triage assistant  ',
  slug: 'triage-assistant',
  status: 'active',
  startDate: '',
  endDate: '2026-06-01',
  description: '## Context\n\nEmergency triage is slow.',
  roadmap: '',
  cp: 500,
  projectId: '11111111-1111-4111-8111-111111111111',
};

describe('buildPromotionRequestBody', () => {
  it("n'envoie jamais le type, le mode de workspace ni le repo, même si la section du flow les propose", () => {
    const body = buildPromotionRequestBody(base, { type: 'code', workspace_mode: 'provided_repo', github_repo: 'acme/app' });
    expect(body).not.toHaveProperty('type');
    expect(body).not.toHaveProperty('workspace_mode');
    expect(body).not.toHaveProperty('github_repo');
  });

  it('envoie le projet, le pool, le statut et les dates que l’admin a saisis', () => {
    expect(buildPromotionRequestBody(base)).toMatchObject({
      title: 'Triage assistant',
      // Le slug choisi dans le tiroir, celui de la proposition par défaut.
      slug: 'triage-assistant',
      status: 'active',
      project_id: base.projectId,
      contribution_points_reward: 500,
      // Une date vide vaut « pas de date », pas la chaîne vide.
      start_date: null,
      end_date: '2026-06-01',
      description: '## Context\n\nEmergency triage is slow.',
    });
  });

  it('omet description et roadmap quand elles sont vides', () => {
    const body = buildPromotionRequestBody({ ...base, description: '   ', roadmap: '' });
    expect(body.description).toBeUndefined();
    expect(body.roadmap).toBeUndefined();
  });

  it('ajoute les champs que la section du flow fournit', () => {
    const body = buildPromotionRequestBody(base, { reward_rules: { kind: 'ml' }, compute_enabled: true, api_packaging_enabled: false });
    expect(body).toMatchObject({ reward_rules: { kind: 'ml' }, compute_enabled: true, api_packaging_enabled: false });
  });
});
