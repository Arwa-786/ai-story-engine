/**
 * Global store for frontend state
 */

import type { Story, StoryConfiguration, StoryDefinition, StoryStatus, StoryStructure } from './types';

type StoreState = {
  story: Story | null;
};

const STORAGE_KEYS = {
  currentStory: 'currentStory',
} as const;

function readFromLocalStorage<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeToLocalStorage<T>(key: string, value: T | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage failures (e.g., quota)
  }
}

class GlobalStore {
  private static instance: GlobalStore | null = null;

  private state: StoreState;

  private constructor() {
    this.state = { story: null };
  }

  static getInstance(): GlobalStore {
    if (!GlobalStore.instance) {
      GlobalStore.instance = new GlobalStore();
      GlobalStore.instance.initializeFromStorage();
    }
    return GlobalStore.instance;
  }

  getState(): StoreState {
    return this.state;
  }

  initializeFromStorage(): void {
    const stored = readFromLocalStorage<Story>(STORAGE_KEYS.currentStory);
    if (stored) {
      this.state.story = stored;
    }
  }

  setStory(story: Story | null): void {
    this.state = { ...this.state, story };
    writeToLocalStorage(STORAGE_KEYS.currentStory, story);
  }

  updateStory(partial: Partial<Story>): void {
    if (!this.state.story) return;
    const updated: Story = {
      ...this.state.story,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.setStory(updated);
  }

  clear(): void {
    this.setStory(null);
  }
}

export const store = GlobalStore.getInstance();
export type { StoreState };


