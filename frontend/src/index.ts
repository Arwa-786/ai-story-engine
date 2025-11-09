/**
 * Story Creation Page Entry Point
 */

import type { StoryConfiguration, Story, StoryDefinition } from './types';
import { store } from './store';

// Get DOM elements with explicit validation for critical inputs
const customToggle = document.getElementById('customToggle') as HTMLButtonElement | null;
const randomToggle = document.getElementById('randomToggle') as HTMLButtonElement | null;
const customSection = document.getElementById('customSection') as HTMLElement | null;
const randomSection = document.getElementById('randomSection') as HTMLElement | null;
const createStoryBtn = document.getElementById('createStoryBtn') as HTMLButtonElement | null;
const storyDescription = document.getElementById('storyDescription') as HTMLTextAreaElement | null;
// API key and image model removed from configuration

if (!customToggle || !randomToggle || !customSection || !randomSection || !createStoryBtn || !storyDescription) {
  throw new Error('Story creation form is missing expected elements. Check index.html for required IDs.');
}

// Toggle between custom and random input
customToggle.addEventListener('click', () => {
  customToggle.classList.add('active');
  randomToggle.classList.remove('active');
  customSection.classList.remove('hidden');
  randomSection.classList.add('hidden');
});

randomToggle.addEventListener('click', () => {
  randomToggle.classList.add('active');
  customToggle.classList.remove('active');
  randomSection.classList.remove('hidden');
  customSection.classList.add('hidden');
});

function createLoadingOverlay(message: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'story-loading-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15, 14, 12, 0.7)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';

  const panel = document.createElement('div');
  panel.style.background = '#fff';
  panel.style.borderRadius = '12px';
  panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
  panel.style.padding = '24px 28px';
  panel.style.minWidth = '260px';
  panel.style.maxWidth = '360px';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.alignItems = 'center';
  panel.style.gap = '12px';

  const spinner = document.createElement('div');
  spinner.style.width = '28px';
  spinner.style.height = '28px';
  spinner.style.border = '3px solid #e5e7eb';
  spinner.style.borderTopColor = '#111827';
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'storySpinner 0.8s linear infinite';

  const text = document.createElement('div');
  text.id = 'story-loading-message';
  text.textContent = message;
  text.style.fontSize = '14px';
  text.style.fontWeight = '600';
  text.style.color = '#111827';
  text.style.textAlign = 'center';

  // Inject keyframes once
  if (!document.getElementById('story-loading-styles')) {
    const style = document.createElement('style');
    style.id = 'story-loading-styles';
    style.textContent = `
@keyframes storySpinner { 
  0% { transform: rotate(0deg); } 
  100% { transform: rotate(360deg); } 
}`;
    document.head.appendChild(style);
  }

  panel.appendChild(spinner);
  panel.appendChild(text);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  return overlay;
}

function updateLoadingMessage(overlay: HTMLElement, message: string): void {
  const el = overlay.querySelector('#story-loading-message') as HTMLElement | null;
  if (el) el.textContent = message;
}

function removeLoadingOverlay(overlay: HTMLElement | null): void {
  if (overlay && overlay.parentElement) {
    overlay.parentElement.removeChild(overlay);
  }
}

function generateId(): string {
  // Prefer crypto if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  return `story_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function fetchStoryDefinition(configuration: StoryConfiguration): Promise<StoryDefinition> {
  // Placeholder endpoint for backend story definition generation
  // Replace with your actual route when implemented
  const response = await fetch('/api/story/definition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configuration }),
  });

  if (!response.ok) {
    throw new Error(`Story definition request failed (${response.status})`);
  }
  const data = (await response.json()) as StoryDefinition;
  return data;
}

// Handle story creation
createStoryBtn.addEventListener('click', async () => {
  const length = (document.querySelector('input[name="length"]:checked') as HTMLInputElement | null)?.value;
  const density = (document.querySelector('input[name="density"]:checked') as HTMLInputElement | null)?.value;
  // image model selection removed

  if (!length || !density) {
    alert('Please select story length and density.');
    return;
  }

  let storyInput: string;
  let inputType: 'custom' | 'random';

  if (customToggle.classList.contains('active')) {
    storyInput = storyDescription.value.trim();
    inputType = 'custom';

    if (!storyInput) {
      alert('Please enter a story description.');
      storyDescription.focus();
      return;
    }
  } else {
    const selectedGenre = document.querySelector('input[name="genre"]:checked') as HTMLInputElement | null;

    if (!selectedGenre) {
      alert('Please select a genre.');
      return;
    }

    storyInput = selectedGenre.value;
    inputType = 'random';
  }

  const config: StoryConfiguration = {
    length: length as StoryConfiguration['length'],
    density: density as StoryConfiguration['density'],
    description: storyInput,
  };

  console.log('Story Configuration:', config);

  // Back-compat for current story.ts which expects 'storyConfig' shape
  const legacyConfig = {
    length: config.length,
    density: config.density,
    inputType,
    input: storyInput,
  };
  localStorage.setItem('storyConfig', JSON.stringify(legacyConfig));

  // Build initial story object for storage
  const nowIso = new Date().toISOString();
  const story: Story = {
    id: generateId(),
    status: 'generating',
    createdAt: nowIso,
    updatedAt: nowIso,
    configuration: config,
  };

  // Persist current story through global store
  store.setStory(story);

  // Show loading overlay while we prepare/generate the story definition
  const overlay = createLoadingOverlay('Creating your story...');
  try {
    updateLoadingMessage(overlay, 'Generating story definition...');
    // Fetch the StoryDefinition from backend (will be implemented server-side)
    const definition = await fetchStoryDefinition(config);
    store.updateStory({ status: 'ready', definition });
  } catch (error) {
    console.warn('Story definition not available yet, continuing with initial data:', error);
    store.updateStory({ status: 'pending' });
  } finally {
    removeLoadingOverlay(overlay);
  }

  // Navigate to story page
  window.location.href = '/views/story.html';
});

