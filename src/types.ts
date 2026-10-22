export type Task = { id: string; text: string; done: boolean };

// A Pod is one saved reel turned into something you can act on.
export type Pod = {
  id: string;
  createdAt: number;
  sourceUrl?: string;
  title: string;
  summary: string;
  category: 'recipe' | 'workout' | 'learning' | 'product' | 'travel' | 'other';
  tasks: Task[];
  shoppingList: string[];
};

export type PalResult = Omit<Pod, 'id' | 'createdAt' | 'sourceUrl' | 'tasks'> & {
  tasks: string[];
};
