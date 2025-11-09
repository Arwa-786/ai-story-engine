/**
 * Type definitions for the story engine
 */

/**
 * - length and density map to radio groups
 * - description maps to the custom textarea (or resolved concept prompt)
 */
export type StoryLength = 'short' | 'medium' | 'long';
export type StoryDensity = 'short' | 'medium' | 'dense';

export interface StoryConfiguration {
  length: StoryLength;
  density: StoryDensity;
  description: string;
}

/**
 * Core narrative domain model (high-level definition)
 */
export interface EndingOption {
  id: string;
  title: string;
  description: string;
  isCanonical?: boolean;
}

export interface Character {
  id: string;
  name: string;
  role: string; // e.g., "protagonist", "antagonist", "mentor"
  description?: string;
  motivation?: string;
  backstory?: string;
}

export interface Outcome {
  id: string;
  title: string;
  description: string;
}

export interface StoryDefinition {
  // Core Story Metadata
  title: string;
  genre: string;
  theme: string;
  tagline: string;
  image?: ImageObject;

  // Story Structure
  overview: string;
  plot: string;
  conflict: string;
  resolution: string;
  startHook: string;
  endingOptions: EndingOption[];

  // World & Characters
  protagonist: Character;
  antagonist?: Character;
  supportingCast?: Character[];

  // Setting
  location: string;
  worldDescription: string;
  timePeriod: string;
}

/**
 * Structured, render-ready story model ("Story Step (index)")
 */
export interface ImageObject {
  url?: string;
  alt?: string;
  prompt?: string;
}

export interface OptionActionGoToNextPage {
  type: 'goToNextPage';
}

export interface OptionActionBranch {
  type: 'branch';
  text: string;
  options: OptionObject[];
}

export type OptionAction =
  | OptionActionGoToNextPage
  | OptionActionBranch;

export interface OptionObject {
  id: string;
  text: string;
  action: OptionAction;
}

export interface StoryPage {
  id: string;
  text: string;
  image?: ImageObject;
  options: OptionObject[];
}

export interface BackCover {
  summary: string;
  image?: ImageObject;
}

export interface FrontCover {
  title: string;
  tagline: string;
  image?: {
    url?: string;
    alt?: string;
  };
}

export interface StoryStructure {
  frontCover: FrontCover;
  pages: StoryPage[];
  backCover: BackCover;
}

export type StoryStatus = 'pending' | 'generating' | 'ready' | 'error';

/**
 * Canonical Story document tying together config, definition, and structure.
 * `metadata` can be filled progressively by the renderer.
 */
export interface Story {
  id: string;
  status: StoryStatus;
  createdAt: string;
  updatedAt: string;
  configuration: StoryConfiguration;
  definition?: StoryDefinition;
  structure?: StoryStructure;
}

