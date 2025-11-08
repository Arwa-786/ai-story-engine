/**
 * Story Creation Page
 */

import type { StoryConfig, ImageGenerationModel } from './types';

// Get DOM elements
const customToggle = document.getElementById('customToggle') as HTMLButtonElement;
const randomToggle = document.getElementById('randomToggle') as HTMLButtonElement;
const customSection = document.getElementById('customSection') as HTMLElement;
const randomSection = document.getElementById('randomSection') as HTMLElement;
const createStoryBtn = document.getElementById('createStoryBtn') as HTMLButtonElement;
const storyDescription = document.getElementById('storyDescription') as HTMLTextAreaElement;
const geminiApiKeyInput = document.getElementById('geminiApiKey') as HTMLInputElement;

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
  const length = (document.querySelector('input[name="length"]:checked') as HTMLInputElement)?.value;
  const density = (document.querySelector('input[name="density"]:checked') as HTMLInputElement)?.value;
  const imageModel = (document.querySelector('input[name="imageModel"]:checked') as HTMLInputElement)?.value as ImageGenerationModel;
  const geminiApiKey = geminiApiKeyInput.value.trim();
  
  // Validate API key
  if (!geminiApiKey) {
    alert('Please enter a Gemini API key.');
    return;
  }
  
  let storyInput: string;
  let inputType: 'custom' | 'random';
  
  if (customToggle.classList.contains('active')) {
    storyInput = storyDescription.value.trim();
    inputType = 'custom';
    
    if (!storyInput) {
      alert('Please enter a story description.');
      return;
    }
  } else {
    const selectedGenre = document.querySelector('input[name="genre"]:checked') as HTMLInputElement;
    
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
    geminiApiKey
  };
  
  console.log('Story Configuration:', config);
  
  // Save configuration to localStorage for the story page
  localStorage.setItem('storyConfig', JSON.stringify(config));
  
  // Navigate to story page
  window.location.href = '/story.html';
});
