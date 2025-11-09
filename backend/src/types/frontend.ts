/**
 * Backend-side mirror of selected frontend types needed for generation.
 * These should match the shapes in `frontend/src/types.ts` lines 1-66.
 */
export type StoryLength = 'short' | 'medium' | 'long';
export type StoryDensity = 'short' | 'medium' | 'dense';

export interface StoryConfiguration {
  length: StoryLength;
  density: StoryDensity;
  description: string;
}

export interface EndingOption {
  id: string;
  title: string;
  description: string;
  isCanonical?: boolean;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description?: string;
  motivation?: string;
  backstory?: string;
}

export interface Outcome {
  id: string;
  title: string;
  description: string;
}

export interface ImageObject {
  alt?: string;
  prompt?: string;
}

export interface StoryDefinition {
  title: string;
  genre: string;
  theme: string;
  tagline: string;
  image?: ImageObject;

  overview: string;
  plot: string;
  conflict: string;
  resolution: string;
  startHook: string;
  endingOptions: EndingOption[];

  protagonist: Character;
  antagonist?: Character;
  supportingCast?: Character[];

  location: string;
  worldDescription: string;
  timePeriod: string;
}


