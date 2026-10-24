import { createContext, useContext, useState, type ReactNode } from "react";
import type { Recipe } from "./types";

const Ctx = createContext<{ recipe: Recipe | null; setRecipe: (r: Recipe) => void }>({ recipe: null, setRecipe: () => {} });
export const RecipeProvider = ({ children }: { children: ReactNode }) => {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  return <Ctx.Provider value={{ recipe, setRecipe }}>{children}</Ctx.Provider>;
};
export const useRecipe = () => useContext(Ctx);
