/**
 * Test complet du package Provisioner
 * 
 * Ce test vérifie:
 * 1. Les utilitaires (slugify, génération de noms de branches)
 * 2. Le registry des providers
 * 3. Le GitHub Branch Provider (avec mock ou réel selon GITHUB_TOKEN)
 * 4. Le provisioning de challenge et task
 * 
 * Exécution: npx tsx packages/test/test-provisioner.ts
 */

import { 
  ProvisionerRegistry,
  GitHubBranchProvider,
  provisionChallengeWorkspace,
  provisionTaskWorkspace,
  slugify,
  generateChallengeBranchName,
  generateTaskBranchName,
  mapRepoTypeToWorkspaceType,
} from '../provisioner/src/index.js';
import type { 
  WorkspaceProvider, 
  ProvisionRequest, 
  ProvisionResult, 
  WorkspaceStatus 
} from '../provisioner/src/types.js';
import { ProviderNotFoundError } from '../provisioner/src/errors.js';

// ============================================================
// MOCK PROVIDER pour les tests sans GitHub
// ============================================================

class MockGitBranchProvider implements WorkspaceProvider {
  readonly type = 'git_branch' as const;
  readonly name = 'Mock Git Branch';
  
  private branches = new Map<string, { ref: string; url: string }>();

  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    const { parentRef, name } = request;
    const fullRef = `refs/heads/${name}`;
    const url = `https://mock-github.com/${parentRef}/tree/${name}`;
    
    // Simuler une branche existante
    const key = `${parentRef}:${name}`;
    if (this.branches.has(key)) {
      console.log(`   [Mock] Branch already exists: ${name}`);
      return {
        provider: this.name,
        workspaceType: this.type,
        ref: fullRef,
        url,
        status: 'ready',
        meta: { alreadyExisted: true },
        error: `Branch '${name}' already exists`,
      };
    }

    // Créer la branche
    this.branches.set(key, { ref: fullRef, url });
    console.log(`   [Mock] Created branch: ${name} from ${request.baseRef || 'main'}`);
    
    return {
      provider: this.name,
      workspaceType: this.type,
      ref: fullRef,
      url,
      status: 'ready',
      meta: {
        baseBranch: request.baseRef || 'main',
        sha: 'mock-sha-' + Math.random().toString(36).substring(7),
        createdAt: new Date().toISOString(),
      },
    };
  }

  async getStatus(parentRef: string, ref: string): Promise<WorkspaceStatus> {
    const branchName = ref.replace('refs/heads/', '');
    const key = `${parentRef}:${branchName}`;
    return this.branches.has(key) ? 'ready' : 'pending';
  }

  async deprovision(parentRef: string, ref: string): Promise<void> {
    const branchName = ref.replace('refs/heads/', '');
    const key = `${parentRef}:${branchName}`;
    this.branches.delete(key);
    console.log(`   [Mock] Deleted branch: ${branchName}`);
  }

  // Helper pour les tests
  reset(): void {
    this.branches.clear();
  }
}

// ============================================================
// DONNÉES DE TEST
// ============================================================

const FAKE_CHALLENGE = {
  uuid: 'challenge-uuid-001',
  index: 7,
  title: 'Admin Experience Update',
  status: 'active',
  project_id: 'project-uuid-001',
};

const FAKE_TASK = {
  uuid: 'task-uuid-001',
  challenge_id: FAKE_CHALLENGE.uuid,
  title: 'Setup Development Environment',
  type: 'solo' as const,
  status: 'todo' as const,
};

const FAKE_REPO = {
  uuid: 'repo-uuid-001',
  title: 'leaderboard',
  type: 'github',
  external_repo_id: 'MyTwin-Lab/leaderboard',
  project_id: 'project-uuid-001',
};

// ============================================================
// TESTS
// ============================================================

async function testUtils() {
  console.log('\n📐 Test 1: Utilitaires\n');

  // Test slugify
  console.log('   Testing slugify():');
  const testCases = [
    { input: 'Admin Experience Update', expected: 'admin-experience-update' },
    { input: 'Test avec accénts éàù', expected: 'test-avec-accents-eau' },
    { input: '  Multiple   Spaces  ', expected: 'multiple-spaces' },
    { input: 'Special!@#$%^&*()Chars', expected: 'specialchars' },
    { input: 'Already-slugified', expected: 'already-slugified' },
  ];

  let allPassed = true;
  for (const { input, expected } of testCases) {
    const result = slugify(input);
    const passed = result === expected;
    console.log(`      "${input}" → "${result}" ${passed ? '✅' : `❌ (expected: ${expected})`}`);
    if (!passed) allPassed = false;
  }

  // Test generateChallengeBranchName
  console.log('\n   Testing generateChallengeBranchName():');
  const challengeBranch = generateChallengeBranchName(7, 'Admin Experience Update');
  const expectedChallengeBranch = 'challenge/007-admin-experience-update';
  console.log(`      Index 7, "Admin Experience Update" → "${challengeBranch}"`);
  console.log(`      ${challengeBranch === expectedChallengeBranch ? '✅' : '❌'} Expected: ${expectedChallengeBranch}`);
  if (challengeBranch !== expectedChallengeBranch) allPassed = false;

  // Test generateTaskBranchName
  console.log('\n   Testing generateTaskBranchName():');
  const taskBranch = generateTaskBranchName(7, 'Setup Development Environment');
  const expectedTaskBranch = 'task/007-setup-development-environment';
  console.log(`      Challenge 7, "Setup Development Environment" → "${taskBranch}"`);
  console.log(`      ${taskBranch === expectedTaskBranch ? '✅' : '❌'} Expected: ${expectedTaskBranch}`);
  if (taskBranch !== expectedTaskBranch) allPassed = false;

  // Test mapRepoTypeToWorkspaceType
  console.log('\n   Testing mapRepoTypeToWorkspaceType():');
  const mappings = [
    { input: 'github', expected: 'git_branch' },
    { input: 'gitlab', expected: 'git_branch' },
    { input: 'huggingface', expected: 'hf_space' },
    { input: 'figma', expected: 'figma_project' },
    { input: 'unknown', expected: 'unknown' },
  ];
  for (const { input, expected } of mappings) {
    const result = mapRepoTypeToWorkspaceType(input);
    const passed = result === expected;
    console.log(`      "${input}" → "${result}" ${passed ? '✅' : `❌ (expected: ${expected})`}`);
    if (!passed) allPassed = false;
  }

  return allPassed;
}

async function testRegistry() {
  console.log('\n📦 Test 2: ProvisionerRegistry\n');

  // Clear registry for clean test
  ProvisionerRegistry.clear();

  // Test: No provider registered
  console.log('   Testing getProvider() with no provider:');
  try {
    ProvisionerRegistry.getProvider('git_branch');
    console.log('      ❌ Should have thrown ProviderNotFoundError');
    return false;
  } catch (error) {
    if (error instanceof ProviderNotFoundError) {
      console.log('      ✅ Correctly threw ProviderNotFoundError');
    } else {
      console.log('      ❌ Wrong error type:', error);
      return false;
    }
  }

  // Test: Register provider
  console.log('\n   Testing register():');
  const mockProvider = new MockGitBranchProvider();
  ProvisionerRegistry.register(mockProvider);
  console.log('      ✅ Provider registered');

  // Test: hasProvider
  console.log('\n   Testing hasProvider():');
  const hasGitBranch = ProvisionerRegistry.hasProvider('git_branch');
  const hasFigma = ProvisionerRegistry.hasProvider('figma_project');
  console.log(`      git_branch: ${hasGitBranch ? '✅' : '❌'}`);
  console.log(`      figma_project: ${!hasFigma ? '✅ (correctly false)' : '❌ (should be false)'}`);

  // Test: getProvider
  console.log('\n   Testing getProvider():');
  const provider = ProvisionerRegistry.getProvider('git_branch');
  console.log(`      ✅ Got provider: ${provider.name}`);

  // Test: getSupportedTypes
  console.log('\n   Testing getSupportedTypes():');
  const types = ProvisionerRegistry.getSupportedTypes();
  console.log(`      ✅ Supported types: ${types.join(', ')}`);

  return hasGitBranch && !hasFigma && provider.name === 'Mock Git Branch';
}

async function testMockProvisioning() {
  console.log('\n🔧 Test 3: Mock Provisioning\n');

  // Ensure mock provider is registered
  ProvisionerRegistry.clear();
  const mockProvider = new MockGitBranchProvider();
  ProvisionerRegistry.register(mockProvider);

  // Test: Provision challenge workspace
  console.log('   Testing provisionChallengeWorkspace():');
  const challengeResult = await provisionChallengeWorkspace({
    challengeIndex: FAKE_CHALLENGE.index,
    challengeTitle: FAKE_CHALLENGE.title,
    repoExternalId: FAKE_REPO.external_repo_id,
    repoType: FAKE_REPO.type,
  });

  console.log(`      Provider: ${challengeResult.provider}`);
  console.log(`      Ref: ${challengeResult.ref}`);
  console.log(`      URL: ${challengeResult.url}`);
  console.log(`      Status: ${challengeResult.status}`);
  console.log(`      Meta: ${JSON.stringify(challengeResult.meta)}`);

  const challengeOk = 
    challengeResult.status === 'ready' &&
    challengeResult.ref === 'refs/heads/challenge/007-admin-experience-update';
  console.log(`      ${challengeOk ? '✅' : '❌'} Challenge workspace provisioned`);

  // Test: Provision task workspace (based on challenge branch)
  console.log('\n   Testing provisionTaskWorkspace():');
  const taskResult = await provisionTaskWorkspace({
    challengeIndex: FAKE_CHALLENGE.index,
    taskTitle: FAKE_TASK.title,
    repoExternalId: FAKE_REPO.external_repo_id,
    repoType: FAKE_REPO.type,
    challengeBranchRef: challengeResult.ref,
  });

  console.log(`      Provider: ${taskResult.provider}`);
  console.log(`      Ref: ${taskResult.ref}`);
  console.log(`      URL: ${taskResult.url}`);
  console.log(`      Status: ${taskResult.status}`);
  console.log(`      Meta: ${JSON.stringify(taskResult.meta)}`);

  const taskOk = 
    taskResult.status === 'ready' &&
    taskResult.ref === 'refs/heads/task/007-setup-development-environment';
  console.log(`      ${taskOk ? '✅' : '❌'} Task workspace provisioned`);

  // Test: Re-provision same challenge (should detect existing)
  console.log('\n   Testing re-provisioning (existing branch):');
  const reProvisionResult = await provisionChallengeWorkspace({
    challengeIndex: FAKE_CHALLENGE.index,
    challengeTitle: FAKE_CHALLENGE.title,
    repoExternalId: FAKE_REPO.external_repo_id,
    repoType: FAKE_REPO.type,
  });

  const existingOk: boolean = 
    reProvisionResult.status === 'ready' &&
    (reProvisionResult.meta?.alreadyExisted ?? false) === true;
  console.log(`      Status: ${reProvisionResult.status}`);
  console.log(`      Already existed: ${reProvisionResult.meta?.alreadyExisted}`);
  console.log(`      Error message: ${reProvisionResult.error || 'none'}`);
  console.log(`      ${existingOk ? '✅' : '❌'} Existing branch detected correctly`);

  return challengeOk && taskOk && existingOk;
}

async function testRealGitHubProvisioning() {
  console.log('\n🐙 Test 4: Real GitHub Provisioning (optional)\n');

  if (!process.env.GITHUB_TOKEN) {
    console.log('   ⏭️  Skipped: GITHUB_TOKEN not set');
    console.log('   To run this test, set GITHUB_TOKEN environment variable');
    return true; // Not a failure, just skipped
  }

  // Use real GitHub provider
  ProvisionerRegistry.clear();
  try {
    const githubProvider = new GitHubBranchProvider();
    ProvisionerRegistry.register(githubProvider);
    console.log('   ✅ GitHub provider initialized');
  } catch (error: any) {
    console.log(`   ❌ Failed to initialize GitHub provider: ${error.message}`);
    return false;
  }

  // Use a test repo - you should change this to a repo you own
  const testRepo = process.env.TEST_GITHUB_REPO || 'MyTwin-Lab/leaderboard';
  const testBranchName = `test/provisioner-${Date.now()}`;

  console.log(`\n   Testing on repo: ${testRepo}`);
  console.log(`   Branch to create: ${testBranchName}`);

  try {
    const provider = ProvisionerRegistry.getProvider('git_branch');
    
    // Create branch
    console.log('\n   Creating test branch...');
    const result = await provider.provision({
      workspaceType: 'git_branch',
      parentRef: testRepo,
      name: testBranchName,
      baseRef: 'main',
    });

    console.log(`      Status: ${result.status}`);
    console.log(`      Ref: ${result.ref}`);
    console.log(`      URL: ${result.url}`);

    if (result.status !== 'ready') {
      console.log(`   ❌ Failed to create branch: ${result.error}`);
      return false;
    }
    console.log('   ✅ Branch created successfully');

    // Check status
    console.log('\n   Checking branch status...');
    const status = await provider.getStatus(testRepo, result.ref);
    console.log(`      Status: ${status}`);
    console.log(`   ${status === 'ready' ? '✅' : '❌'} Status check passed`);

    // Clean up - delete the test branch
    if (provider.deprovision) {
      console.log('\n   Cleaning up (deleting test branch)...');
      await provider.deprovision(testRepo, result.ref);
      console.log('   ✅ Test branch deleted');
    }

    return true;
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testNoProviderScenario() {
  console.log('\n🚫 Test 5: No Provider Available\n');

  // Clear registry
  ProvisionerRegistry.clear();

  // Try to provision with no provider
  console.log('   Testing provisioning with no provider registered:');
  const result = await provisionChallengeWorkspace({
    challengeIndex: 1,
    challengeTitle: 'Test',
    repoExternalId: 'owner/repo',
    repoType: 'github',
  });

  console.log(`      Status: ${result.status}`);
  console.log(`      Error: ${result.error}`);

  const ok: boolean = result.status === 'failed' && (result.error?.includes('No provider') ?? false);
  console.log(`   ${ok ? '✅' : '❌'} Correctly handled missing provider`);

  return ok;
}

// ============================================================
// MAIN
// ============================================================

async function runAllTests() {
  console.log('🧪 ═══════════════════════════════════════════════════════════');
  console.log('   PROVISIONER PACKAGE - COMPLETE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════');

  const results: { name: string; passed: boolean }[] = [];

  try {
    results.push({ name: 'Utilities', passed: await testUtils() });
    results.push({ name: 'Registry', passed: await testRegistry() });
    results.push({ name: 'Mock Provisioning', passed: await testMockProvisioning() });
    results.push({ name: 'No Provider Scenario', passed: await testNoProviderScenario() });
    results.push({ name: 'Real GitHub (optional)', passed: await testRealGitHubProvisioning() });
  } catch (error: any) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let allPassed = true;
  for (const { name, passed } of results) {
    console.log(`   ${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allPassed = false;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  if (allPassed) {
    console.log('   ✅ ALL TESTS PASSED!');
  } else {
    console.log('   ❌ SOME TESTS FAILED');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

runAllTests();
