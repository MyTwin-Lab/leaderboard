import { EvaluationGridsRepository } from "../database-service/repositories/index.js";
import type { 
  EvaluationGrid, 
  EvaluationGridCategory,
  EvaluationGridSubcriterion,
  EvaluationGridFull,
  EvaluationGridStatus,
  EvaluationGridCategoryType,
} from "../database-service/domain/entities.js";

export interface CreateGridInput {
  slug: string;
  name: string;
  description?: string;
  instructions?: string;
  created_by?: string;
}

export interface UpdateGridInput {
  name?: string;
  description?: string;
  instructions?: string;
}

export interface CreateCategoryInput {
  name: string;
  weight: number;
  type: EvaluationGridCategoryType;
  position?: number;
}

export interface CreateSubcriterionInput {
  criterion: string;
  description?: string;
  weight?: number;
  metrics?: string[];
  indicators?: string[];
  scoring_excellent?: string;
  scoring_good?: string;
  scoring_average?: string;
  scoring_poor?: string;
  position?: number;
}

/**
 * EvaluationGridService
 * ---------------------
 * Service pour gérer les grilles d'évaluation (CRUD, publication, validation)
 */
export class EvaluationGridService {
  private repo: EvaluationGridsRepository;

  constructor() {
    this.repo = new EvaluationGridsRepository();
  }

  // --- GRIDS ---

  async listGrids(options?: {
    status?: EvaluationGridStatus[];
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<EvaluationGrid[]> {
    return this.repo.findAll(options);
  }

  async getGrid(id: string): Promise<EvaluationGrid | null> {
    return this.repo.findById(id);
  }

  async getGridBySlug(slug: string): Promise<EvaluationGrid | null> {
    return this.repo.findBySlug(slug);
  }

  async getFullGrid(id: string): Promise<EvaluationGridFull | null> {
    return this.repo.findFullById(id);
  }

  async getPublishedGrid(slug: string): Promise<EvaluationGridFull | null> {
    return this.repo.findFullPublishedBySlug(slug);
  }

  async createGrid(input: CreateGridInput): Promise<EvaluationGrid> {
    // Vérifier que le slug est unique
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) {
      throw new Error(`Grid with slug "${input.slug}" already exists`);
    }

    return this.repo.create({
      slug: input.slug,
      name: input.name,
      description: input.description,
      version: 1,
      status: 'draft',
      instructions: input.instructions,
      created_by: input.created_by,
    });
  }

  async updateGrid(id: string, input: UpdateGridInput): Promise<EvaluationGrid | null> {
    const grid = await this.repo.findById(id);
    if (!grid) return null;

    // Ne pas permettre la modification d'une grille publiée
    if (grid.status === 'published') {
      throw new Error('Cannot modify a published grid. Duplicate it first.');
    }

    return this.repo.update(id, input);
  }

  async publishGrid(id: string): Promise<EvaluationGrid | null> {
    const grid = await this.repo.findFullById(id);
    if (!grid) return null;

    // Valider que la grille est complète
    this.validateGrid(grid);

    return this.repo.publish(id);
  }

  async archiveGrid(id: string): Promise<EvaluationGrid | null> {
    return this.repo.archive(id);
  }

  async deleteGrid(id: string): Promise<boolean> {
    const grid = await this.repo.findById(id);
    if (!grid) return false;

    // Ne pas permettre la suppression d'une grille publiée
    if (grid.status === 'published') {
      throw new Error('Cannot delete a published grid. Archive it first.');
    }

    return this.repo.delete(id);
  }

  async duplicateGrid(id: string, newSlug?: string): Promise<EvaluationGridFull | null> {
    return this.repo.duplicate(id, newSlug);
  }

  // --- CATEGORIES ---

  async addCategory(gridId: string, input: CreateCategoryInput): Promise<EvaluationGridCategory> {
    const grid = await this.repo.findById(gridId);
    if (!grid) {
      throw new Error('Grid not found');
    }
    if (grid.status === 'published') {
      throw new Error('Cannot modify a published grid');
    }

    // Récupérer les catégories existantes pour déterminer la position
    const existingCategories = await this.repo.findCategoriesByGridId(gridId);
    const position = input.position ?? existingCategories.length;

    return this.repo.createCategory({
      grid_id: gridId,
      name: input.name,
      weight: input.weight,
      type: input.type,
      position,
    });
  }

  async updateCategory(id: string, input: Partial<CreateCategoryInput>): Promise<EvaluationGridCategory | null> {
    return this.repo.updateCategory(id, input);
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.repo.deleteCategory(id);
  }

  async reorderCategories(gridId: string, categoryIds: string[]): Promise<EvaluationGridCategory[]> {
    const categories = await this.repo.findCategoriesByGridId(gridId);
    
    // Mettre à jour les positions
    const updates = categoryIds.map((id, index) => 
      this.repo.updateCategory(id, { position: index })
    );
    
    await Promise.all(updates);
    return this.repo.findCategoriesByGridId(gridId);
  }

  // --- SUBCRITERIA ---

  async addSubcriterion(categoryId: string, input: CreateSubcriterionInput): Promise<EvaluationGridSubcriterion> {
    // Récupérer les sous-critères existants pour déterminer la position
    const existingSubcriteria = await this.repo.findSubcriteriaByCategory(categoryId);
    const position = input.position ?? existingSubcriteria.length;

    return this.repo.createSubcriterion({
      category_id: categoryId,
      criterion: input.criterion,
      description: input.description,
      weight: input.weight,
      metrics: input.metrics,
      indicators: input.indicators,
      scoring_excellent: input.scoring_excellent,
      scoring_good: input.scoring_good,
      scoring_average: input.scoring_average,
      scoring_poor: input.scoring_poor,
      position,
    });
  }

  async updateSubcriterion(id: string, input: Partial<CreateSubcriterionInput>): Promise<EvaluationGridSubcriterion | null> {
    return this.repo.updateSubcriterion(id, input);
  }

  async deleteSubcriterion(id: string): Promise<boolean> {
    return this.repo.deleteSubcriterion(id);
  }

  // --- VALIDATION ---

  private validateGrid(grid: EvaluationGridFull): void {
    if (grid.categories.length === 0) {
      throw new Error('Grid must have at least one category');
    }

    // Vérifier que les poids des catégories totalisent ~1
    const totalWeight = grid.categories.reduce((sum, cat) => sum + cat.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      throw new Error(`Category weights must sum to 1 (current: ${totalWeight.toFixed(2)})`);
    }

    // Vérifier que chaque catégorie a au moins un sous-critère
    for (const cat of grid.categories) {
      if (cat.subcriteria.length === 0) {
        throw new Error(`Category "${cat.name}" must have at least one subcriterion`);
      }
    }
  }

  // --- BULK OPERATIONS ---

  async saveFullGrid(id: string, data: {
    name?: string;
    description?: string;
    instructions?: string;
    categories: Array<{
      uuid?: string;
      name: string;
      weight: number;
      type: EvaluationGridCategoryType;
      position: number;
      subcriteria: Array<Omit<EvaluationGridSubcriterion, 'uuid' | 'category_id'>>;
    }>;
  }): Promise<EvaluationGridFull | null> {
    const grid = await this.repo.findById(id);
    if (!grid) return null;

    if (grid.status === 'published') {
      throw new Error('Cannot modify a published grid');
    }

    // Mettre à jour les métadonnées de la grille
    if (data.name || data.description !== undefined || data.instructions !== undefined) {
      await this.repo.update(id, {
        name: data.name,
        description: data.description,
        instructions: data.instructions,
      });
    }

    // Supprimer toutes les catégories existantes (cascade sur subcriteria)
    const existingCategories = await this.repo.findCategoriesByGridId(id);
    for (const cat of existingCategories) {
      await this.repo.deleteCategory(cat.uuid);
    }

    // Créer les nouvelles catégories et sous-critères
    for (const catData of data.categories) {
      const category = await this.repo.createCategory({
        grid_id: id,
        name: catData.name,
        weight: catData.weight,
        type: catData.type,
        position: catData.position,
      });

      for (const subData of catData.subcriteria) {
        await this.repo.createSubcriterion({
          category_id: category.uuid,
          ...subData,
        });
      }
    }

    return this.repo.findFullById(id);
  }
}
