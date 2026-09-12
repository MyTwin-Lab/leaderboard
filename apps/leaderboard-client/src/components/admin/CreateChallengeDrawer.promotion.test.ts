import { describe, it, expect } from 'vitest';
import { buildPromotionRequestBody, type PromotionFormState } from './promotionRequestBody';

const base: PromotionFormState = {
  title: '  Triage assistant  ',
  status: 'active',
  type: 'code',
  startDate: '',
  endDate: '2026-06-01',
  description: '## Context\n\nEmergency triage is slow.',
  roadmap: '',
  cp: 500,
  projectId: '11111111-1111-4111-8111-111111111111',
  rewardRules: { kind: 'ml' },
  codeRules: { kind: 'code' },
  computeEnabled: true,
  apiPackagingEnabled: false,
};

describe('buildPromotionRequestBody', () => {
  it("n'envoie jamais le type, le mode de workspace ni le repo", () => {
    const body = buildPromotionRequestBody(base);
    expect(body).not.toHaveProperty('type');
    expect(body).not.toHaveProperty('workspace_mode');
    expect(body).not.toHaveProperty('github_repo');
  });

  it("n'envoie aucun champ propre aux challenges de validation", () => {
    const body = buildPromotionRequestBody(base);
    expect(body).not.toHaveProperty('source_challenge_id');
    expect(body).not.toHaveProperty('cp_per_validation');
    expect(body).not.toHaveProperty('required_validations');
  });

  it('envoie le projet, le pool, le statut et les dates que l’admin a saisis', () => {
    expect(buildPromotionRequestBody(base)).toMatchObject({
      title: 'Triage assistant',
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

  it('envoie les règles code et coupe compute/API packaging pour un sandbox code', () => {
    const body = buildPromotionRequestBody(base);
    expect(body.reward_rules).toEqual({ kind: 'code' });
    expect(body.compute_enabled).toBe(false);
    expect(body.api_packaging_enabled).toBeUndefined();
  });

  it('envoie les règles ML, le compute et le réglage API packaging pour un sandbox ml', () => {
    const body = buildPromotionRequestBody({ ...base, type: 'ml' });
    expect(body.reward_rules).toEqual({ kind: 'ml' });
    expect(body.compute_enabled).toBe(true);
    expect(body.api_packaging_enabled).toBe(false);
  });
});
