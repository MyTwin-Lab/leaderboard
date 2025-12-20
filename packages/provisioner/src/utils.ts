// packages/provisioner/src/utils.ts

/**
 * Génère un slug à partir d'un texte
 * Utilise une implémentation simple en attendant l'installation du package slugify
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')                   // Décompose les accents
    .replace(/[\u0300-\u036f]/g, '')    // Supprime les accents
    .replace(/[^\w\s-]/g, '')           // Supprime les caractères spéciaux
    .replace(/\s+/g, '-')               // Espaces → tirets
    .replace(/-+/g, '-')                // Tirets multiples → un seul
    .replace(/^-+/, '')                 // Supprime tirets au début
    .replace(/-+$/, '');                // Supprime tirets à la fin
}

/**
 * Génère le nom de branche pour un challenge
 * Format: challenge/{index}-{slug}
 * Exemple: challenge/007-admin-experience
 */
export function generateChallengeBranchName(index: number, title: string): string {
  const paddedIndex = String(index).padStart(3, '0');
  const slug = slugify(title);
  return `challenge/${paddedIndex}-${slug}`;
}

/**
 * Génère le nom de branche pour une task
 * Format: task/{challenge-index}-{task-slug}
 * Exemple: task/007-setup-environment
 */
export function generateTaskBranchName(challengeIndex: number, taskTitle: string): string {
  const paddedIndex = String(challengeIndex).padStart(3, '0');
  const slug = slugify(taskTitle);
  return `task/${paddedIndex}-${slug}`;
}

/**
 * Mappe un type de repo vers un type de workspace
 */
export function mapRepoTypeToWorkspaceType(repoType: string): string {
  const mapping: Record<string, string> = {
    'github': 'git_branch',
    'gitlab': 'git_branch',
    'huggingface': 'hf_space',
    'figma': 'figma_project',
  };
  
  return mapping[repoType] || repoType;
}
