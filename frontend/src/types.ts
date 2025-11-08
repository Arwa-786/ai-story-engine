/**
 * Type definitions for the story engine
 */

export type ImageGenerationModel = 'Nanobanana' | 'imagegen';

export interface StoryConfig {
  length: string;
  density: string;
  inputType: 'custom' | 'random';
  input: string;
  imageModel: ImageGenerationModel;
  geminiApiKey: string;
}

export interface StoryMetadata {
  title: string;
  author?: string;
  subtitle?: string;
  coverImageUrl?: string;
  coverImagePrompt?: string;
  genre?: string;
  createdAt?: string;
  startedAt?: string;
  summary?: string;
}

export interface StoryChapter {
  chapterNumber: number;
  chapterTitle: string;
  tagline?: string;
  content: string;
}

export interface Story {
  metadata: StoryMetadata;
  chapters: StoryChapter[];
}

