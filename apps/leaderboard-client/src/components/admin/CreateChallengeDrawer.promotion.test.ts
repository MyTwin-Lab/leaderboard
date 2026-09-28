import { describe, it, expect } from 'vitest';
import { buildPromotionRequestBody, type PromotionFormState } from './promotionRequestBody';

const base: PromotionFormState = {
  title: '  Triage assistant  ',
  slug: 'triage-assistant',
  status: 'active',
  type: 'code',
  startDate: '',
  endDate: '2026-06-01',
  description: '## Context\n\nEmergency triage is slow.',
  roadmap: '',
  cp: 500,
  projectId: '11111111-1111-4111-8111-111111111111',
};

describe('buildPromotionRequestBody', () => {
  it('envoie le type choisi par l’admin — une proposition n’en porte pas', () => {
    expect(buildPromotionRequestBody(base).type).toBe('code');
    expect(buildPromotionRequestBody({ ...base, type: 'ml' }).type).toBe('ml');
  });

  it("n'envoie ni le mode de workspace ni le repo, même si la section du flow les propose", () => {
    // Ils découlent du type : un challenge `code` issu d'une promotion est
    // forcément un `own_repo`, et la route n'accepte pas ces champs. Le type
    // de la section est ignoré aussi : c'est l'état du tiroir qui le porte.
    const body = buildPromotionRequestBody(base, { type: 'ml', workspace_mode: 'provided_repo', github_repo: 'acme/app' });
    expect(body.type).toBe('code');
    expect(body).not.toHaveProperty('workspace_mode');
    expect(body).not.toHaveProperty('github_repo');
  });

  it('relaie les champs du flow — règles, compute, étape API', () => {
    const body = buildPromotionRequestBody(base, { reward_rules: { kind: 'ml' }, compute_enabled: true, api_packaging_enabled: false });
    expect(body).toMatchObject({ reward_rules: { kind: 'ml' }, compute_enabled: true, api_packaging_enabled: false });
  });

  it("n'envoie aucun champ propre aux challenges de validation", () => {
    const body = buildPromotionRequestBody(base);
    expect(body).not.toHaveProperty('source_challenge_id');
    expect(body).not.toHaveProperty('cp_per_validation');
    expect(body).not.toHaveProperty('required_validations');
  });

  it('nettoie le titre, garde le slug, et traduit les dates et les champs vides', () => {
    const body = buildPromotionRequestBody(base);
    expect(body).toMatchObject({
      title: 'Triage assistant',
      slug: 'triage-assistant',
      status: 'active',
      start_date: null,
      end_date: '2026-06-01',
      description: '## Context\n\nEmergency triage is slow.',
      contribution_points_reward: 500,
      project_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(body.roadmap).toBeUndefined();
  });
});
