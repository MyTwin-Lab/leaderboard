import { eq, desc, asc, and, ilike } from "drizzle-orm";
import { 
  db, 
  evaluation_grids, 
  evaluation_grid_categories, 
  evaluation_grid_subcriteria 
} from "../db/drizzle.js";
import { 
  toDomainEvaluationGrid, 
  toDbEvaluationGrid,
  toDomainEvaluationGridCategory,
  toDbEvaluationGridCategory,
  toDomainEvaluationGridSubcriterion,
  toDbEvaluationGridSubcriterion,
} from "../db/mappers.js";
import type { 
  EvaluationGrid, 
  EvaluationGridCategory,
  EvaluationGridSubcriterion,
  EvaluationGridFull,
  EvaluationGridStatus,
} from "../domain/entities.js";

export interface FindGridsOptions {
  status?: EvaluationGridStatus[];
  search?: string;
  page?: number;
  pageSize?: number;
}

export class EvaluationGridsRepository {
  /**
   * Récupère toutes les grilles avec filtres optionnels
   */
  async findAll(options: FindGridsOptions = {}): Promise<EvaluationGrid[]> {
    const { status, search, page = 1, pageSize = 20 } = options;

    let query = db.select().from(evaluation_grids).$dynamic();

    if (status && status.length > 0) {
      // Filter by status (OR)
      const statusConditions = status.map(s => eq(evaluation_grids.status, s));
      if (statusConditions.length === 1) {
        query = query.where(statusConditions[0]);
      }
    }

    if (search) {
      query = query.where(ilike(evaluation_grids.name, `%${search}%`));
    }

    const rows = await query
      .orderBy(desc(evaluation_grids.updated_at))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return rows.map(toDomainEvaluationGrid);
  }

  /**
   * Récupère une grille par ID
   */
  async findById(id: string): Promise<EvaluationGrid | null> {
    const rows = await db
      .select()
      .from(evaluation_grids)
      .where(eq(evaluation_grids.uuid, id))
      .limit(1);

    return rows.length > 0 ? toDomainEvaluationGrid(rows[0]) : null;
  }

  /**
   * Récupère une grille par slug
   */
  async findBySlug(slug: string): Promise<EvaluationGrid | null> {
    const rows = await db
      .select()
      .from(evaluation_grids)
      .where(eq(evaluation_grids.slug, slug))
      .limit(1);

    return rows.length > 0 ? toDomainEvaluationGrid(rows[0]) : null;
  }

  /**
   * Récupère une grille publiée par slug (pour l'évaluateur)
   */
  async findPublishedBySlug(slug: string): Promise<EvaluationGrid | null> {
    const rows = await db
      .select()
      .from(evaluation_grids)
      .where(and(
        eq(evaluation_grids.slug, slug),
        eq(evaluation_grids.status, 'published')
      ))
      .limit(1);

    return rows.length > 0 ? toDomainEvaluationGrid(rows[0]) : null;
  }

  /**
   * Récupère une grille complète avec catégories et sous-critères
   */
  async findFullById(id: string): Promise<EvaluationGridFull | null> {
    const grid = await this.findById(id);
    if (!grid) return null;

    const categories = await this.findCategoriesByGridId(id);
    const categoriesWithSubcriteria = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        subcriteria: await this.findSubcriteriaByCategory(cat.uuid),
      }))
    );

    return {
      ...grid,
      categories: categoriesWithSubcriteria,
    };
  }

  /**
   * Récupère une grille complète publiée par slug (pour l'évaluateur)
   */
  async findFullPublishedBySlug(slug: string): Promise<EvaluationGridFull | null> {
    const grid = await this.findPublishedBySlug(slug);
    if (!grid) return null;

    return this.findFullById(grid.uuid);
  }

  /**
   * Crée une nouvelle grille
   */
  async create(data: Omit<EvaluationGrid, 'uuid' | 'created_at' | 'updated_at'>): Promise<EvaluationGrid> {
    const rows = await db
      .insert(evaluation_grids)
      .values(toDbEvaluationGrid(data))
      .returning();

    return toDomainEvaluationGrid(rows[0]);
  }

  /**
   * Met à jour une grille
   */
  async update(id: string, data: Partial<Omit<EvaluationGrid, 'uuid' | 'created_at'>>): Promise<EvaluationGrid | null> {
    const rows = await db
      .update(evaluation_grids)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(evaluation_grids.uuid, id))
      .returning();

    return rows.length > 0 ? toDomainEvaluationGrid(rows[0]) : null;
  }

  /**
   * Publie une grille (change le statut et incrémente la version)
   */
  async publish(id: string): Promise<EvaluationGrid | null> {
    const grid = await this.findById(id);
    if (!grid) return null;

    const rows = await db
      .update(evaluation_grids)
      .set({
        status: 'published',
        version: grid.version + 1,
        published_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(evaluation_grids.uuid, id))
      .returning();

    return rows.length > 0 ? toDomainEvaluationGrid(rows[0]) : null;
  }

  /**
   * Archive une grille
   */
  async archive(id: string): Promise<EvaluationGrid | null> {
    const rows = await db
      .update(evaluation_grids)
      .set({
        status: 'archived',
        updated_at: new Date(),
      })
      .where(eq(evaluation_grids.uuid, id))
      .returning();

    return rows.length > 0 ? toDomainEvaluationGrid(rows[0]) : null;
  }

  /**
   * Supprime une grille (cascade sur catégories et sous-critères)
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(evaluation_grids)
      .where(eq(evaluation_grids.uuid, id));

    return true;
  }

  /**
   * Duplique une grille existante (pour créer une nouvelle version)
   */
  async duplicate(id: string, newSlug?: string): Promise<EvaluationGridFull | null> {
    const original = await this.findFullById(id);
    if (!original) return null;

    // Créer la nouvelle grille
    const newGrid = await this.create({
      slug: newSlug || `${original.slug}-copy`,
      name: `${original.name} (Copy)`,
      description: original.description,
      version: 1,
      status: 'draft',
      instructions: original.instructions,
      created_by: original.created_by,
    });

    // Dupliquer les catégories et sous-critères
    for (const cat of original.categories) {
      const newCategory = await this.createCategory({
        grid_id: newGrid.uuid,
        name: cat.name,
        weight: cat.weight,
        type: cat.type,
        position: cat.position,
      });

      for (const sub of cat.subcriteria) {
        await this.createSubcriterion({
          category_id: newCategory.uuid,
          criterion: sub.criterion,
          description: sub.description,
          weight: sub.weight,
          metrics: sub.metrics,
          indicators: sub.indicators,
          scoring_excellent: sub.scoring_excellent,
          scoring_good: sub.scoring_good,
          scoring_average: sub.scoring_average,
          scoring_poor: sub.scoring_poor,
          position: sub.position,
        });
      }
    }

    return this.findFullById(newGrid.uuid);
  }

  // --- CATEGORIES ---

  async findCategoriesByGridId(gridId: string): Promise<EvaluationGridCategory[]> {
    const rows = await db
      .select()
      .from(evaluation_grid_categories)
      .where(eq(evaluation_grid_categories.grid_id, gridId))
      .orderBy(asc(evaluation_grid_categories.position));

    return rows.map(toDomainEvaluationGridCategory);
  }

  async createCategory(data: Omit<EvaluationGridCategory, 'uuid'>): Promise<EvaluationGridCategory> {
    const rows = await db
      .insert(evaluation_grid_categories)
      .values(toDbEvaluationGridCategory(data))
      .returning();

    return toDomainEvaluationGridCategory(rows[0]);
  }

  async updateCategory(id: string, data: Partial<Omit<EvaluationGridCategory, 'uuid' | 'grid_id'>>): Promise<EvaluationGridCategory | null> {
    const rows = await db
      .update(evaluation_grid_categories)
      .set(data)
      .where(eq(evaluation_grid_categories.uuid, id))
      .returning();

    return rows.length > 0 ? toDomainEvaluationGridCategory(rows[0]) : null;
  }

  async deleteCategory(id: string): Promise<boolean> {
    await db
      .delete(evaluation_grid_categories)
      .where(eq(evaluation_grid_categories.uuid, id));

    return true;
  }

  // --- SUBCRITERIA ---

  async findSubcriteriaByCategory(categoryId: string): Promise<EvaluationGridSubcriterion[]> {
    const rows = await db
      .select()
      .from(evaluation_grid_subcriteria)
      .where(eq(evaluation_grid_subcriteria.category_id, categoryId))
      .orderBy(asc(evaluation_grid_subcriteria.position));

    return rows.map(toDomainEvaluationGridSubcriterion);
  }

  async createSubcriterion(data: Omit<EvaluationGridSubcriterion, 'uuid'>): Promise<EvaluationGridSubcriterion> {
    const rows = await db
      .insert(evaluation_grid_subcriteria)
      .values(toDbEvaluationGridSubcriterion(data))
      .returning();

    return toDomainEvaluationGridSubcriterion(rows[0]);
  }

  async updateSubcriterion(id: string, data: Partial<Omit<EvaluationGridSubcriterion, 'uuid' | 'category_id'>>): Promise<EvaluationGridSubcriterion | null> {
    const rows = await db
      .update(evaluation_grid_subcriteria)
      .set(data)
      .where(eq(evaluation_grid_subcriteria.uuid, id))
      .returning();

    return rows.length > 0 ? toDomainEvaluationGridSubcriterion(rows[0]) : null;
  }

  async deleteSubcriterion(id: string): Promise<boolean> {
    await db
      .delete(evaluation_grid_subcriteria)
      .where(eq(evaluation_grid_subcriteria.uuid, id));

    return true;
  }

  /**
   * Bulk upsert des catégories pour une grille
   */
  async bulkUpsertCategories(gridId: string, categories: Omit<EvaluationGridCategory, 'uuid' | 'grid_id'>[]): Promise<EvaluationGridCategory[]> {
    // Supprimer les catégories existantes
    await db
      .delete(evaluation_grid_categories)
      .where(eq(evaluation_grid_categories.grid_id, gridId));

    // Insérer les nouvelles
    if (categories.length === 0) return [];

    const rows = await db
      .insert(evaluation_grid_categories)
      .values(categories.map((cat, idx) => ({
        grid_id: gridId,
        name: cat.name,
        weight: cat.weight,
        type: cat.type,
        position: cat.position ?? idx,
      })))
      .returning();

    return rows.map(toDomainEvaluationGridCategory);
  }

  /**
   * Bulk upsert des sous-critères pour une catégorie
   */
  async bulkUpsertSubcriteria(categoryId: string, subcriteria: Omit<EvaluationGridSubcriterion, 'uuid' | 'category_id'>[]): Promise<EvaluationGridSubcriterion[]> {
    // Supprimer les sous-critères existants
    await db
      .delete(evaluation_grid_subcriteria)
      .where(eq(evaluation_grid_subcriteria.category_id, categoryId));

    // Insérer les nouveaux
    if (subcriteria.length === 0) return [];

    const rows = await db
      .insert(evaluation_grid_subcriteria)
      .values(subcriteria.map((sub, idx) => toDbEvaluationGridSubcriterion({
        ...sub,
        category_id: categoryId,
        position: sub.position ?? idx,
      })))
      .returning();

    return rows.map(toDomainEvaluationGridSubcriterion);
  }
}
