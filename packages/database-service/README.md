# 🗄️ Database Service Package

Service de gestion de la base de données PostgreSQL pour le système MyTwin Leaderboard. Ce package encapsule toute la logique d'accès aux données avec Drizzle ORM.

## 🎯 Vue d'ensemble

Le **database-service** fournit une couche d'abstraction complète pour interagir avec la base de données PostgreSQL. Il suit une architecture en couches avec des entités de domaine, des schémas de validation et des repositories.

## 🏗️ Architecture

```
database-service/
├── db/
│   ├── drizzle.ts      # Schémas Drizzle + Client DB
│   └── mappers.ts      # Conversions DB ↔ Domain
├── domain/
│   ├── entities.ts     # Entités métier TypeScript
│   └── schemas_zod.ts  # Validation Zod
└── repositories/
    ├── project.repo.ts
    ├── repo.repo.ts
    ├── challenge.repo.ts
    ├── challengeRepos.repo.ts
    ├── challengeTeam.repo.ts
    ├── user.repo.ts
    ├── contribution.repo.ts
    └── index.ts
```

### Couches du système

1. **DB Layer** (`db/`) : Schémas Drizzle et connexion PostgreSQL
2. **Domain Layer** (`domain/`) : Entités métier et validation
3. **Repository Layer** (`repositories/`) : Opérations CRUD et requêtes

## 📊 Modèle de données

### Entités principales

#### **Project**
Représente un projet global contenant des repos et des challenges.

```typescript
interface Project {
  uuid: string;
  title: string;
  description?: string;
  created_at: Date;
}
```

**Relations** :
- `1:N` avec `Repo`
- `1:N` avec `Challenge`

---

#### **Repo**
Repository externe (GitHub, etc.) lié à un projet.

```typescript
interface Repo {
  uuid: string;
  title: string;
  type: string;                    // Type de repo (github, gitlab, etc.)
  external_repo_id?: string;       // ID externe du repo
  project_id: string;              // FK → projects.uuid
}
```

**Relations** :
- `N:1` avec `Project`
- `N:M` avec `Challenge` (via `challenge_repos`)

---

#### **Challenge**
Défi ou sprint de développement avec dates et récompenses.

```typescript
interface Challenge {
  uuid: string;
  index: number;                   // Numéro du challenge
  title: string;
  status: string;                  // État (active, completed, etc.)
  start_date: Date;
  end_date: Date;
  description?: string;
  roadmap?: string;
  contribution_points_reward: number;
  project_id: string;              // FK → projects.uuid
}
```

**Relations** :
- `N:1` avec `Project`
- `N:M` avec `Repo` (via `challenge_repos`)
- `N:M` avec `User` (via `challenge_teams`)
- `1:N` avec `Contribution`

---

#### **User**
Utilisateur participant aux challenges.

```typescript
interface User {
  uuid: string;
  role: string;                    // Rôle (admin, developer, etc.)
  full_name: string;
  github_username: string;
  created_at: Date;
}
```

**Relations** :
- `1:N` avec `Contribution`
- `N:M` avec `Challenge` (via `challenge_teams`)

---

#### **Contribution**
Contribution d'un utilisateur à un challenge (commit, PR, etc.).

```typescript
interface Contribution {
  uuid: string;
  title: string;
  type: string;                    // Type de contribution
  description?: string;
  evaluation?: any;                // Résultat d'évaluation (JSON)
  tags?: string[];                 // Tags de catégorisation
  reward: number;                  // Points gagnés
  user_id: string;                 // FK → users.uuid
  challenge_id: string;            // FK → challenges.uuid
}
```

**Relations** :
- `N:1` avec `User`
- `N:1` avec `Challenge`

---

#### **Tables de liaison**

**ChallengeRepo** : Associe des repos à des challenges
```typescript
interface ChallengeRepo {
  challenge_id: string;
  repo_id: string;
}
```

**ChallengeTeam** : Associe des utilisateurs à des challenges
```typescript
interface ChallengeTeam {
  challenge_id: string;
  user_id: string;
}
```

## 🔧 Repositories

Chaque entité dispose d'un repository avec des opérations CRUD standardisées.

### Pattern commun

Tous les repositories implémentent ces méthodes de base :

```typescript
class Repository {
  async findAll(): Promise<Entity[]>
  async findById(uuid: string): Promise<Entity | null>
  async create(entity: Omit<Entity, "uuid">): Promise<Entity>
  async update(uuid: string, entity: Partial<Entity>): Promise<Entity>
  async delete(uuid: string): Promise<void>
}
```

### Méthodes spécialisées

#### **ProjectRepository**
```typescript
async findWithRepos(uuid: string): Promise<Repo[]>
async findWithChallenges(uuid: string): Promise<Challenge[]>
```

#### **ContributionRepository**
```typescript
async findByUser(userId: string): Promise<Contribution[]>
async findByChallenge(challengeId: string): Promise<Contribution[]>
async findDetailed(uuid: string): Promise<{
  contribution: Contribution;
  user: User | null;
  challenge: Challenge | null;
}>
```

#### **ChallengeRepository**
```typescript
async findWithRepos(uuid: string): Promise<Repo[]>
async findWithTeamMembers(uuid: string): Promise<User[]>
async findWithContributions(uuid: string): Promise<Contribution[]>
```

#### **UserRepository**
```typescript
async findByGithubUsername(username: string): Promise<User | null>
async findWithContributions(uuid: string): Promise<Contribution[]>
async findWithChallenges(uuid: string): Promise<Challenge[]>
```

## 🔄 Mappers

Les **mappers** assurent la conversion entre les types Drizzle et les entités de domaine.

### DB → Domain
```typescript
toDomainProject(row: DbProject): Project
toDomainRepo(row: DbRepo): Repo
toDomainChallenge(row: DbChallenge): Challenge
toDomainUser(row: DbUser): User
toDomainContribution(row: DbContribution): Contribution
```

### Domain → DB
```typescript
toDbProject(entity: Omit<Project, "uuid" | "created_at">)
toDbRepo(entity: Omit<Repo, "uuid">)
toDbChallenge(entity: Omit<Challenge, "uuid">)
toDbUser(entity: Omit<User, "uuid" | "created_at">)
toDbContribution(entity: Omit<Contribution, "uuid">)
```

**Avantages** :
- Gestion des valeurs `null` vs `undefined`
- Conversion automatique des dates
- Typage strict entre les couches

## ✅ Validation avec Zod

Tous les repositories utilisent des schémas Zod pour valider les données avant insertion/mise à jour.

```typescript
// Exemple dans ProjectRepository
async create(entity: Omit<Project, "uuid" | "created_at">): Promise<Project> {
  const validated = projectSchema.omit({ uuid: true, created_at: true }).parse(entity);
  const dbData = toDbProject(validated);
  const [inserted] = await db.insert(projects).values(dbData).returning();
  return toDomainProject(inserted);
}
```

**Schémas disponibles** :
- `projectSchema`
- `repoSchema`
- `challengeSchema`
- `userSchema`
- `contributionSchema`
- `challengeRepoSchema`
- `challengeTeamSchema`

## 🚀 Utilisation

### Configuration

Le client Drizzle se connecte via une variable d'environnement :

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mytwin_leaderboard
```

### Exemple d'utilisation

```typescript
import { ProjectRepository, UserRepository, ContributionRepository } from "@mytwin/database-service";

const projectRepo = new ProjectRepository();
const userRepo = new UserRepository();
const contributionRepo = new ContributionRepository();

// Créer un projet
const project = await projectRepo.create({
  title: "MyTwin AI",
  description: "Projet de leaderboard IA"
});

// Créer un utilisateur
const user = await userRepo.create({
  role: "developer",
  full_name: "John Doe",
  github_username: "johndoe"
});

// Récupérer les contributions d'un utilisateur
const contributions = await contributionRepo.findByUser(user.uuid);

// Récupérer un projet avec ses repos
const repos = await projectRepo.findWithRepos(project.uuid);
```

## 🔐 Sécurité et bonnes pratiques

1. **Validation systématique** : Toutes les données sont validées avec Zod avant insertion
2. **Typage strict** : Utilisation de TypeScript pour éviter les erreurs de type
3. **Cascade deletes** : Les suppressions en cascade sont configurées au niveau DB
4. **Transactions** : Utiliser les transactions Drizzle pour les opérations complexes
5. **Mappers** : Toujours passer par les mappers pour garantir la cohérence des données

## 📦 Dépendances

- **drizzle-orm** : ORM TypeScript pour PostgreSQL
- **pg** : Client PostgreSQL natif
- **zod** : Validation de schémas
- **dotenv** : Gestion des variables d'environnement

## 🔄 Relations Drizzle

Les relations sont définies dans `drizzle.ts` pour permettre les requêtes jointes :

```typescript
export const projectsRelations = relations(projects, ({ many }) => ({
  repos: many(repos),
  challenges: many(challenges),
}));

export const contributionsRelations = relations(contributions, ({ one }) => ({
  user: one(users, {
    fields: [contributions.user_id],
    references: [users.uuid],
  }),
  challenge: one(challenges, {
    fields: [contributions.challenge_id],
    references: [challenges.uuid],
  }),
}));
```

Ces relations permettent d'utiliser les méthodes de jointure de Drizzle pour des requêtes optimisées.

## 🎯 Points clés

- ✅ **Architecture en couches** : Séparation claire entre DB, Domain et Repositories
- ✅ **Type-safety** : TypeScript + Zod pour une sécurité maximale
- ✅ **Mappers bidirectionnels** : Conversion automatique DB ↔ Domain
- ✅ **Validation automatique** : Zod valide toutes les entrées/sorties
- ✅ **Relations configurées** : Jointures optimisées avec Drizzle
- ✅ **CRUD complet** : Toutes les opérations de base + méthodes spécialisées
