/**
 * Story Creation Page Entry Point
 */

import type { StoryConfig, ImageGenerationModel } from './types';

// Get DOM elements with explicit validation for critical inputs
const customToggle = document.getElementById('customToggle') as HTMLButtonElement | null;
const randomToggle = document.getElementById('randomToggle') as HTMLButtonElement | null;
const customSection = document.getElementById('customSection') as HTMLElement | null;
const randomSection = document.getElementById('randomSection') as HTMLElement | null;
const createStoryBtn = document.getElementById('createStoryBtn') as HTMLButtonElement | null;
const storyDescription = document.getElementById('storyDescription') as HTMLTextAreaElement | null;
const geminiApiKeyElement = document.getElementById('geminiApiKey');

if (!(geminiApiKeyElement instanceof HTMLInputElement)) {
  throw new Error(
    'Gemini API Key input field (#geminiApiKey) is missing from index.html. Ensure the markup renders correctly.',
  );
}

const geminiApiKeyInput = geminiApiKeyElement;

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

// Handle story creation
createStoryBtn.addEventListener('click', () => {
  const length = (document.querySelector('input[name="length"]:checked') as HTMLInputElement | null)?.value;
  const density = (document.querySelector('input[name="density"]:checked') as HTMLInputElement | null)?.value;
  const imageModel = (document.querySelector('input[name="imageModel"]:checked') as HTMLInputElement | null)
    ?.value as ImageGenerationModel | undefined;
  const geminiApiKey = geminiApiKeyInput.value.trim();

  // Validate API key
  if (!geminiApiKey) {
    alert('Please enter a Gemini API key.');
    geminiApiKeyInput.focus();
    return;
  }

  if (!length || !density || !imageModel) {
    alert('Please select story length, density, and image generation model.');
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

  const config: StoryConfig = {
    length,
    density,
    inputType,
    input: storyInput,
    imageModel,
    geminiApiKey,
  };

  console.log('Story Configuration:', config);

  // Save configuration to localStorage for the story page
  localStorage.setItem('storyConfig', JSON.stringify(config));

  // Navigate to story page
  window.location.href = '/story.html';
});

