import type { Category } from "@prisma/client";
import type { CategoryModule } from "./types";
import { jigsawPuzzleModule } from "./jigsawPuzzle";

// Registry of active category modules. v1 registers puzzles only; adding board
// or card games later means implementing a module and registering it here.
const modules: Partial<Record<Category, CategoryModule>> = {
  JIGSAW_PUZZLE: jigsawPuzzleModule,
  // BOARD_GAME: boardGameModule,   // future
  // CARD_GAME: cardGameModule,     // future
};

export function getCategoryModule(category: Category): CategoryModule {
  const mod = modules[category];
  if (!mod) {
    throw new Error(`No category module registered for "${category}"`);
  }
  return mod;
}

export function listCategoryModules(): CategoryModule[] {
  return Object.values(modules).filter(Boolean) as CategoryModule[];
}

export function isCategorySupported(category: Category): boolean {
  return Boolean(modules[category]);
}

export type { CategoryModule } from "./types";
