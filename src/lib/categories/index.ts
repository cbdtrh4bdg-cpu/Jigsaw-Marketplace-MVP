import { Category } from "@prisma/client";
import type { CategoryModule } from "./types";
import { jigsawPuzzleModule } from "./jigsawPuzzle";

/**
 * The category registry. For v1 only JIGSAW_PUZZLE is registered; board and
 * card game modules slot in here (plus seed data) with no core changes.
 */
const MODULES: Partial<Record<Category, CategoryModule>> = {
  [Category.JIGSAW_PUZZLE]: jigsawPuzzleModule as unknown as CategoryModule,
};

export function getCategoryModule(category: Category): CategoryModule {
  const mod = MODULES[category];
  if (!mod) {
    throw new Error(`No category module registered for ${category}`);
  }
  return mod;
}

export function registeredCategories(): Category[] {
  return Object.keys(MODULES) as Category[];
}

export function isRegisteredCategory(category: Category): boolean {
  return category in MODULES;
}

export type { CategoryModule } from "./types";
