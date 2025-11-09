/**
 * Story Display Page
 */

import type { StoryMetadata } from './types';

// State
let currentPageIndex = 0;
let storyStartTime: number = Date.now();
const pages = document.querySelectorAll<HTMLElement>('.page');
const bookContainer = document.querySelector<HTMLElement>('.book-container');

/**
 * Sets the cover image and metadata dynamically
 */
function setCoverImage(metadata: StoryMetadata): void {
  const coverImage = document.getElementById('coverImage') as HTMLImageElement;
  const coverTitle = document.getElementById('coverTitle') as HTMLElement;
  const coverSubtitle = document.getElementById('coverSubtitle') as HTMLElement;

  if (coverImage && metadata.coverImageUrl) {
    coverImage.src = metadata.coverImageUrl;
    coverImage.alt = `${metadata.title} - Cover Image`;
  }

  if (coverTitle && metadata.title) {
    coverTitle.textContent = metadata.title;
  }

  if (coverSubtitle && metadata.subtitle) {
    coverSubtitle.textContent = metadata.subtitle;
  }
}

/**
 * Update cover footer details (author, publish date)
 */
function setCoverDetails(metadata: StoryMetadata): void {
  const coverAuthor = document.getElementById('coverAuthor') as HTMLElement | null;
  const coverPublishDate = document.getElementById('coverPublishDate') as HTMLElement | null;

  const resolvedAuthor = metadata.author?.trim() || 'You';
  if (coverAuthor) {
    coverAuthor.textContent = `Written by ${resolvedAuthor === 'You (Story Creator)' ? 'You' : resolvedAuthor}`;
  }

  if (coverPublishDate) {
    const createdAt = metadata.createdAt || new Date().toISOString();
    coverPublishDate.textContent = `Published ${formatDate(createdAt)}`;
  }
}

/**
 * Generate a cover image URL based on story input
 * This is a placeholder that uses Unsplash for demo purposes
 */
function generateCoverImageUrl(storyInput: string): string {
  // Map keywords to appropriate Unsplash image searches
  const keywords = storyInput.toLowerCase();
  
  if (keywords.includes('forest') || keywords.includes('tree') || keywords.includes('wood')) {
    return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=800&fit=crop';
  } else if (keywords.includes('space') || keywords.includes('galaxy') || keywords.includes('star')) {
    return 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&h=800&fit=crop';
  } else if (keywords.includes('ocean') || keywords.includes('sea') || keywords.includes('water')) {
    return 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1200&h=800&fit=crop';
  } else if (keywords.includes('mountain') || keywords.includes('peak') || keywords.includes('cliff')) {
    return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop';
  } else if (keywords.includes('city') || keywords.includes('urban') || keywords.includes('street')) {
    return 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&h=800&fit=crop';
  } else if (keywords.includes('desert') || keywords.includes('sand') || keywords.includes('dune')) {
    return 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200&h=800&fit=crop';
  } else if (keywords.includes('castle') || keywords.includes('medieval') || keywords.includes('knight')) {
    return 'https://images.unsplash.com/photo-1549048851-e5fa07c0d3af?w=1200&h=800&fit=crop';
  } else if (keywords.includes('magic') || keywords.includes('fantasy') || keywords.includes('wizard')) {
    return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=800&fit=crop';
  } else if (keywords.includes('dragon') || keywords.includes('creature') || keywords.includes('monster')) {
    return 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=1200&h=800&fit=crop';
  } else if (keywords.includes('mystery') || keywords.includes('dark') || keywords.includes('noir')) {
    return 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&h=800&fit=crop';
  } else {
    // Default fantasy/adventure image
    return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=800&fit=crop';
  }
}

/**
 * Load story metadata from URL parameters or localStorage
 */
function loadStoryMetadata(): void {
  try {
    const storedConfig = localStorage.getItem('storyConfig');
    const storedMetadata = localStorage.getItem('storyMetadata');
    const existingMetadata = storedMetadata ? (JSON.parse(storedMetadata) as StoryMetadata) : null;
    const nowIso = new Date().toISOString();

    if (storedConfig) {
      const config = JSON.parse(storedConfig);
      const coverImageUrl = generateCoverImageUrl(config.input);

      const metadata: StoryMetadata = {
        title: (config.input || existingMetadata?.title || 'An Untitled Story').trim(),
        subtitle: existingMetadata?.subtitle || 'An AI Generated Adventure',
        coverImageUrl,
        genre: config.inputType === 'random' ? config.input : existingMetadata?.genre,
        createdAt: existingMetadata?.createdAt || nowIso,
        startedAt: existingMetadata?.startedAt || nowIso,
        author: existingMetadata?.author || 'You'
      };

      setCoverImage(metadata);
      setCoverDetails(metadata);
      localStorage.setItem('storyMetadata', JSON.stringify(metadata));
      return;
    }

    const coverTitleElement = document.getElementById('coverTitle');
    const coverSubtitleElement = document.getElementById('coverSubtitle');
    const coverImageElement = document.getElementById('coverImage') as HTMLImageElement | null;

    const fallbackMetadata: StoryMetadata = {
      title: coverTitleElement?.textContent?.trim() || existingMetadata?.title || 'An Untitled Story',
      subtitle: coverSubtitleElement?.textContent?.trim() || existingMetadata?.subtitle || 'An AI Generated Adventure',
      coverImageUrl: coverImageElement?.getAttribute('src') ?? existingMetadata?.coverImageUrl,
      createdAt: existingMetadata?.createdAt || nowIso,
      startedAt: existingMetadata?.startedAt || nowIso,
      author: existingMetadata?.author || 'You'
    };

    setCoverImage(fallbackMetadata);
    setCoverDetails(fallbackMetadata);
    localStorage.setItem('storyMetadata', JSON.stringify(fallbackMetadata));
  } catch (error) {
    console.error('Error loading story metadata:', error);
  }
}

/**
 * Format a date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Calculate story duration
 */
function calculateDuration(): string {
  const duration = Math.floor((Date.now() - storyStartTime) / 1000);
  
  if (duration < 60) {
    return `${duration} seconds`;
  } else {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} minutes`;
  }
}

/**
 * Generate a complementary back cover image URL (different from front)
 * This uses a related but different image from the front cover
 */
function generateBackCoverImageUrl(storyInput: string): string {
  // Map keywords to complementary Unsplash image searches
  const keywords = storyInput.toLowerCase();
  
  if (keywords.includes('forest') || keywords.includes('tree') || keywords.includes('wood')) {
    return 'https://images.unsplash.com/photo-1511497584788-876760111969?w=1200&h=800&fit=crop'; // Misty forest path
  } else if (keywords.includes('space') || keywords.includes('galaxy') || keywords.includes('star')) {
    return 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&h=800&fit=crop'; // Nebula
  } else if (keywords.includes('ocean') || keywords.includes('sea') || keywords.includes('water')) {
    return 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&h=800&fit=crop'; // Ocean waves at sunset
  } else if (keywords.includes('mountain') || keywords.includes('peak') || keywords.includes('cliff')) {
    return 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=800&fit=crop'; // Mountain range sunset
  } else if (keywords.includes('city') || keywords.includes('urban') || keywords.includes('street')) {
    return 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200&h=800&fit=crop'; // City night lights
  } else if (keywords.includes('desert') || keywords.includes('sand') || keywords.includes('dune')) {
    return 'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?w=1200&h=800&fit=crop'; // Desert sunset
  } else if (keywords.includes('castle') || keywords.includes('medieval') || keywords.includes('knight')) {
    return 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200&h=800&fit=crop'; // Medieval castle
  } else if (keywords.includes('magic') || keywords.includes('fantasy') || keywords.includes('wizard')) {
    return 'https://images.unsplash.com/photo-1511497584788-876760111969?w=1200&h=800&fit=crop'; // Mystical forest
  } else if (keywords.includes('dragon') || keywords.includes('creature') || keywords.includes('monster')) {
    return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop'; // Dark mountains
  } else if (keywords.includes('mystery') || keywords.includes('dark') || keywords.includes('noir')) {
    return 'https://images.unsplash.com/photo-1517331156700-3c241d2b4d83?w=1200&h=800&fit=crop'; // Dark foggy scene
  } else {
    // Default complementary fantasy/adventure image
    return 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?w=1200&h=800&fit=crop'; // Sunset landscape
  }
}

/**
 * Generate story summary based on config
 */
function generateStorySummary(input: string): string {
  const summaries: { [key: string]: string } = {
    'fantasy': 'An epic fantasy adventure through magical realms, where heroes rise and legends are born. Your choices have shaped a tale of wonder, courage, and destiny.',
    'sci-fi': 'A thrilling science fiction odyssey across the cosmos, exploring the boundaries of technology and humanity. Each decision led you deeper into the mysteries of the universe.',
    'mystery': 'A captivating mystery that kept you guessing until the very end. Through careful deduction and keen observation, you unraveled the truth hidden in shadows.',
    'horror': 'A chilling horror story that tested your courage at every turn. You navigated through darkness and fear, facing the unknown with determination.',
    'adventure': 'An exhilarating adventure filled with excitement, danger, and discovery. Your journey took you to places unknown and challenged you in unexpected ways.',
    'romance': 'A heartwarming romance that explored the depths of connection and emotion. Your choices crafted a story of love, growth, and meaningful relationships.'
  };
  
  // Check if input matches any genre
  const lowerInput = input.toLowerCase();
  for (const [genre, summary] of Object.entries(summaries)) {
    if (lowerInput.includes(genre)) {
      return summary;
    }
  }
  
  // Default summary
  return `An unforgettable journey through "${input}" - a story shaped by your choices and imagination. Each decision you made wove together a unique narrative that will be remembered.`;
}

/**
 * Setup back cover with dynamic content
 */
function setupBackCover(): void {
  try {
    const storedConfig = localStorage.getItem('storyConfig');
    const storedMetadata = localStorage.getItem('storyMetadata');
    
    let config: { input: string } | null = null;
    let metadata: StoryMetadata | null = null;
    
    if (storedConfig) {
      config = JSON.parse(storedConfig);
      metadata = storedMetadata ? (JSON.parse(storedMetadata) as StoryMetadata) : null;
    } else {
      // Fallback for test environment - use a default configuration
      console.log('No stored config found, using test defaults');
      config = { input: 'forest fantasy adventure' }; // Default that matches test page
      metadata = {
        title: 'Test Story',
        subtitle: 'Testing All Page Types',
        coverImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=800&fit=crop',
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        author: 'You'
      };
    }
    
    if (config) {
      // Set back cover image (use a complementary image, not the same as front)
      const backCoverImage = document.getElementById('backCoverImage') as HTMLImageElement;
      const backImageUrl = generateBackCoverImageUrl(config.input);
      if (backCoverImage) {
        backCoverImage.src = backImageUrl;
        console.log('Back cover image set to:', backImageUrl);
      }
      
      // Set summary
      const summaryText = document.getElementById('storySummary');
      if (summaryText) {
        summaryText.textContent = generateStorySummary(config.input);
      }

      // Set back cover book title
      const backCoverTitle = document.getElementById('backBookTitle');
      if (backCoverTitle) {
        const fallbackTitle = config.input?.trim() || 'An Untitled Story';
        const resolvedTitle = metadata?.title?.trim() || fallbackTitle;
        backCoverTitle.textContent = resolvedTitle;
      }

      const primaryAuthorLine = document.getElementById('backCoverPrimaryAuthor');
      const authorContainer = document.getElementById('backCoverAuthorValue');
      const resolvedAuthor = metadata?.author?.trim() || 'You';
      const authorDisplay = resolvedAuthor === 'You' ? 'You (Story Creator)' : resolvedAuthor;

      if (primaryAuthorLine) {
        primaryAuthorLine.textContent = authorDisplay;
      } else if (authorContainer) {
        const authorLine = document.createElement('div');
        authorLine.className = 'author-line';
        authorLine.textContent = authorDisplay;
        authorContainer.appendChild(authorLine);
      }
      
      // Set publish date
      const publishDate = document.getElementById('publishDate');
      if (publishDate && metadata?.createdAt) {
        publishDate.textContent = formatDate(metadata.createdAt);
      }
      
      // Set story duration
      const storyDuration = document.getElementById('storyDuration');
      if (storyDuration) {
        storyDuration.textContent = calculateDuration();
      }
    }
  } catch (error) {
    console.error('Error setting up back cover:', error);
  }
}

/**
 * Preload all images in the story for instant display
 * This ensures images are ready before pages flip
 */
function preloadStoryImages(): void {
  console.log('Preloading all story images...');
  
  // Get all images in all pages
  const allImages = document.querySelectorAll<HTMLImageElement>('.page img');
  let loadedCount = 0;
  const totalImages = allImages.length;
  
  allImages.forEach((img) => {
    // If image is already loaded, count it
    if (img.complete && img.naturalHeight !== 0) {
      loadedCount++;
    } else {
      // Force browser to load image by creating temporary reference
      const preloadImg = new Image();
      preloadImg.onload = () => {
        loadedCount++;
        console.log(`Image loaded: ${preloadImg.src} (${loadedCount}/${totalImages})`);
      };
      preloadImg.onerror = () => {
        console.warn(`Failed to load image: ${preloadImg.src}`);
        loadedCount++;
      };
      preloadImg.src = img.src;
    }
  });
  
  console.log(`Preloading ${totalImages} images...`);
}

// Load metadata on page load
loadStoryMetadata();

// Preload all story images immediately
preloadStoryImages();

// Initialize first page
console.log(`Story initialized with ${pages.length} pages`);
if (pages.length > 0) {
  pages[0].classList.add('active');
  console.log('First page activated:', pages[0].id);
}

/**
 * Flip the final page, then replace background back with back cover content
 * No next page will appear - right side stays empty
 */
function flipToBackCover(): void {
  console.log('flipToBackCover called - flipping final page (no next page on right)');
  
  const currentPage = pages[currentPageIndex];
  
  if (!currentPage) {
    console.error('No current page found');
    return;
  }

  console.log('Current page:', currentPage);
  
  // Get the back cover image URL to use for the flip animation
  const backCoverImage = document.getElementById('backCoverImage') as HTMLImageElement;
  const backCoverImageUrl = backCoverImage?.src || '';
  
  // If back cover image not set yet, set it up first
  if (!backCoverImageUrl) {
    setupBackCover();
    // Re-get the URL after setup
    const updatedBackCoverImage = document.getElementById('backCoverImage') as HTMLImageElement;
    const updatedBackCoverImageUrl = updatedBackCoverImage?.src || '';
    
    if (updatedBackCoverImageUrl) {
      console.log('Setting back cover image for animation:', updatedBackCoverImageUrl);
      currentPage.style.setProperty('--back-cover-image-url', `url("${updatedBackCoverImageUrl}")`);
    }
  } else {
    console.log('Setting back cover image for animation:', backCoverImageUrl);
    currentPage.style.setProperty('--back-cover-image-url', `url("${backCoverImageUrl}")`);
  }
  
  // Remove active state - no next page will appear
  currentPage.classList.remove('active');
  
  // Start final flip animation (background image back shows during flip)
  requestAnimationFrame(() => {
    console.log('Starting final flip animation - background image back visible during flip');
    currentPage.classList.add('flipping-out-final');
  });

  const finalFlipDuration = 1200;
  const backCoverSettleDelay = 300;

  // After flip completes, replace background back with back cover content
  setTimeout(() => {
    console.log('Flip complete - page is now flipped showing background back');
    
    // Remove flipping-out-final animation class
    currentPage.classList.remove('flipping-out-final');
    
    console.log('Replacing background back with back cover content');
    
    // Apply permanent flipped state
    // This hides the background back and shows the back cover content in its place
    currentPage.classList.add('flipped-final');
  }, finalFlipDuration); // Match flip animation duration
  
  // After the flip completes, collapse the flipped stack so only the back cover remains
  setTimeout(() => {
    const flippedStackPages = document.querySelectorAll<HTMLElement>('.page.flipped');
    flippedStackPages.forEach(page => {
      if (!page.classList.contains('stack-hidden')) {
        page.classList.add('stack-hidden');
      }
    });
  }, finalFlipDuration);
  
  // Start centering animation immediately with the flip
  if (bookContainer) {
    console.log('Applying centering animation class - starts immediately with flip');
    bookContainer.classList.remove('back-cover-complete');
    bookContainer.classList.add('show-back-cover');
  }
  
  // Once the flip and centering animations complete, hide the flipped page stack
  setTimeout(() => {
    if (bookContainer) {
      console.log('Back cover settled - hiding flipped page stack');
      bookContainer.classList.add('back-cover-complete');
    }
  }, finalFlipDuration + backCoverSettleDelay);
  
  // Show book controls after back cover is displayed
  setTimeout(() => {
    const bookControls = document.getElementById('bookControls');
    if (bookControls) {
      console.log('Showing book controls (Restart and Export)');
      bookControls.classList.add('visible');
    }
  }, finalFlipDuration + 600); // Show after centering animation completes (1.2s flip + 0.6s extra delay)
}

// Flip to next page
function flipToNextPage(): void {
  console.log(`flipToNextPage called. Current index: ${currentPageIndex}, Total pages: ${pages.length}`);
  
  if (currentPageIndex >= pages.length - 1) {
    console.log('Already at last page - cannot flip further');
    return;
  }

  console.log(`Flipping from page ${currentPageIndex} to ${currentPageIndex + 1}`);
  
  const currentPage = pages[currentPageIndex];
  const nextPage = pages[currentPageIndex + 1];

  console.log('Current page:', currentPage);
  console.log('Next page:', nextPage);

  // Make next page visible behind the current page before animation starts
  currentPage.classList.remove('active');
  nextPage.classList.add('behind');
  
  console.log('Added behind class to next page');
  
  // Start flip animation on next frame to ensure 'behind' class is applied first
  requestAnimationFrame(() => {
    console.log('Adding flipping-out animation');
    currentPage.classList.add('flipping-out');
    console.log('Current page classes:', currentPage.className);
  });

  // Complete the flip after animation
  setTimeout(() => {
    console.log('Animation complete, cleaning up');
    currentPage.classList.remove('flipping-out');
    currentPage.classList.add('flipped'); // Keep page visible in flipped state
    nextPage.classList.remove('behind');
    nextPage.classList.add('active');
    
    currentPageIndex++;
    console.log('New currentPageIndex:', currentPageIndex);
  }, 1200); // Match animation duration
}

// Handle cover page click
const coverPage = document.getElementById('coverPage');
if (coverPage) {
  coverPage.addEventListener('click', flipToNextPage);
}

/**
 * Determine page type based on data attributes and options
 */
function getPageType(pageElement: HTMLElement): string {
  // Check if page has explicit type
  const explicitType = pageElement.dataset.pageType;
  if (explicitType) return explicitType;
  
  // Auto-detect based on content
  const optionsContainers = pageElement.querySelectorAll('.story-options');
  const firstContainer = optionsContainers[0];
  
  if (!firstContainer) return 'static';
  
  const options = firstContainer.querySelectorAll('.story-option');
  const hasConversation = pageElement.querySelector('.conversation-response');
  
  if (hasConversation) return 'conversation';
  if (options.length === 1) return 'single-option';
  if (options.length > 1) return 'multiple-options';
  
  return 'static';
}

/**
 * Handle story option clicks with page type awareness
 */
function handleOptionClick(event: Event): void {
  const button = event.currentTarget as HTMLButtonElement;
  const optionsContainer = button.parentElement;
  
  if (!optionsContainer) return;

  // Check if this is the last option (story ending)
  const isLastOption = button.dataset.isLast === 'true';
  
  // Get page type for appropriate handling
  const pageElement = button.closest('.page') as HTMLElement;
  const pageType = getPageType(pageElement);

  console.log(`Option clicked on ${pageType} page, isLastOption: ${isLastOption}`);
  console.log(`Current page index: ${currentPageIndex}, Total pages: ${pages.length}`);

  // Disable all options immediately to prevent multiple clicks
  optionsContainer.querySelectorAll('.story-option').forEach(btn => {
    (btn as HTMLButtonElement).disabled = true;
  });

  // Mark selected option
  button.classList.add('selected');

  // Check for nested conversation response (look in parent conversation-response if it exists)
  const parentConversation = button.closest('.conversation-response') as HTMLElement | null;
  let responseElement: HTMLElement | null = null;
  
  if (parentConversation) {
    // We're inside a conversation response, look for a nested response within it
    responseElement = parentConversation.querySelector<HTMLElement>('.conversation-response:not(.shown)');
  } else {
    // We're at the top level, look for the first conversation response
    responseElement = pageElement?.querySelector<HTMLElement>('.conversation-response:not(.shown)');
  }
  
  const isConversation = !!responseElement;
  
  if (isConversation) {
    // Conversation page - fade out and hide non-selected options
    console.log('Conversation mode: fading out non-selected options');
    optionsContainer.querySelectorAll('.story-option').forEach(btn => {
      if (btn !== button) {
        btn.classList.add('fade-out');
      }
    });
    
    // Hide the non-selected options after fade-out animation completes
    setTimeout(() => {
      optionsContainer.querySelectorAll('.story-option').forEach(btn => {
        if (btn !== button) {
          (btn as HTMLElement).classList.add('hidden');
        }
      });
    }, 400); // Match fadeOutOption animation duration
  } else {
    // Non-conversation page - just disable non-selected options
    optionsContainer.querySelectorAll('.story-option').forEach(btn => {
      if (btn !== button) {
        btn.classList.add('disabled');
      }
    });
  }
  
  if (responseElement) {
    // Conversation page - show next response level
    console.log('Showing conversation response (possibly nested)');
    responseElement.classList.add('shown');
    
    setTimeout(() => {
      responseElement!.classList.remove('hidden');
      
      // Scroll to response
      const pageContent = pageElement?.querySelector<HTMLElement>('.page-content');
      if (pageContent) {
        pageContent.scrollTo({
          top: pageContent.scrollHeight,
          behavior: 'smooth'
        });
      }
      
      // After showing response, attach handlers to new options
      const responseOptions = responseElement!.querySelectorAll<HTMLButtonElement>(':scope > .story-options > .story-option');
      responseOptions.forEach(btn => {
        btn.addEventListener('click', handleOptionClick);
      });
    }, 500);
  } else {
    // No more conversation responses - auto-flip to next page or back cover
    let delay = 600; // Default for multiple options
    
    if (pageType === 'single-option') {
      delay = 400; // Faster for single option (feels more natural)
    } else if (isLastOption) {
      delay = 1000; // Longer for dramatic ending
    }
    
    // Check if this is the final page with back cover content
    const hasFinalPageBackCover = pageElement?.dataset.isFinal === 'true';
    
    if (isLastOption && hasFinalPageBackCover) {
      console.log(`Auto-flipping to back cover after ${delay}ms`);
      setTimeout(flipToBackCover, delay);
    } else {
      console.log(`Auto-flipping to next page after ${delay}ms`);
      setTimeout(flipToNextPage, delay);
    }
  }
}

// Attach handlers to initially visible option buttons (not in hidden conversation responses)
// Use a more reliable method to exclude buttons inside conversation responses
const allOptionButtons = document.querySelectorAll<HTMLButtonElement>('.story-option');
const optionButtons = Array.from(allOptionButtons).filter(btn => {
  // Exclude buttons that are inside a .conversation-response element
  return !btn.closest('.conversation-response');
});

console.log(`Attaching click handlers to ${optionButtons.length} initially visible option buttons`);
optionButtons.forEach((button, index) => {
  const btn = button as HTMLButtonElement;
  const isLast = btn.dataset.isLast;
  console.log(`  Button ${index + 1}: "${btn.textContent?.trim()}" ${isLast ? '(LAST)' : ''}`);
  button.addEventListener('click', handleOptionClick);
});

// Keyboard navigation
document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === ' ') {
    const currentPage = pages[currentPageIndex];
    const pageType = currentPage?.dataset.page;
    
    if (pageType === 'cover') {
      event.preventDefault();
      flipToNextPage();
    }
  }
});

// Add cursor pointer to clickable pages
if (coverPage) {
  coverPage.addEventListener('mouseenter', () => {
    coverPage.style.cursor = 'pointer';
  });
}

/**
 * =====================================================
 * BOOK CONTROLS - Restart & Export to PDF
 * =====================================================
 */

/**
 * Restart the book - reloads the page to start from the beginning
 */
function restartBook(): void {
  console.log('Restarting book...');
  
  // Show loading state
  const restartButton = document.getElementById('restartButton');
  if (restartButton) {
    restartButton.classList.add('loading');
  }
  
  // Reload the page to restart
  window.location.reload();
}

/**
 * Export the book to PDF - each page becomes a PDF page
 * Uses html2pdf.js library for robust PDF generation
 */
async function exportToPDF(): Promise<void> {
  console.log('Starting PDF export...');
  
  const exportButton = document.getElementById('exportButton');
  if (exportButton) {
    exportButton.classList.add('loading');
    const buttonText = exportButton.querySelector('span');
    if (buttonText) {
      buttonText.textContent = 'Generating PDF...';
    }
  }
  
  try {
    // Dynamically import html2pdf
    const html2pdf = (await import('html2pdf.js')).default;
    
    // Get all pages
    const allPages = Array.from(pages);
    
    // Get story metadata for filename
    let storyTitle = 'Story';
    try {
      const storedConfig = localStorage.getItem('storyConfig');
      const storedMetadata = localStorage.getItem('storyMetadata');
      
      if (storedMetadata) {
        const metadata = JSON.parse(storedMetadata);
        storyTitle = metadata.title || 'Story';
      } else if (storedConfig) {
        const config = JSON.parse(storedConfig);
        storyTitle = config.input || 'Story';
      }
    } catch (error) {
      console.warn('Could not load story metadata for PDF:', error);
      storyTitle = 'Test Story'; // Fallback for test environment
    }
    
    // Sanitize filename
    const filename = `${storyTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    
    console.log(`Exporting ${allPages.length} pages to PDF: ${filename}`);
    
    // Create a temporary container for rendering pages
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '800px'; // Fixed width for consistent PDF layout
    tempContainer.style.background = '#fdfbf7';
    document.body.appendChild(tempContainer);
    
    // PDF configuration
    const opt = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fdfbf7'
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: 'avoid-all' }
    };
    
    // Process each page and generate PDF
    let pdfInstance: any = null;
    
    for (let i = 0; i < allPages.length; i++) {
      const page = allPages[i];
      const pageType = page.dataset.page;
      
      console.log(`Processing page ${i + 1}/${allPages.length} (${pageType})`);
      
      // Clone the page for rendering
      const pageClone = page.cloneNode(true) as HTMLElement;
      
      // Ensure all content is visible in the clone
      pageClone.style.position = 'relative';
      pageClone.style.width = '100%';
      pageClone.style.height = 'auto';
      pageClone.style.minHeight = '600px';
      pageClone.style.visibility = 'visible';
      pageClone.style.opacity = '1';
      pageClone.style.transform = 'none';
      pageClone.style.borderRadius = '8px';
      pageClone.style.boxShadow = 'none';
      pageClone.style.overflow = 'visible';
      
      // Handle page-specific content visibility
      const pageContent = pageClone.querySelector('.page-content') as HTMLElement;
      const bookCover = pageClone.querySelector('.book-cover') as HTMLElement;
      const backContent = pageClone.querySelector('.page-back-content') as HTMLElement;
      
      if (pageContent) {
        pageContent.style.opacity = '1';
        pageContent.style.visibility = 'visible';
        pageContent.style.overflow = 'visible';
        pageContent.style.height = 'auto';
      }
      
      if (bookCover) {
        bookCover.style.opacity = '1';
        bookCover.style.visibility = 'visible';
      }
      
      // For final page, show back cover content
      if (page.dataset.isFinal === 'true' && backContent) {
        backContent.style.display = 'block';
        backContent.style.opacity = '1';
        backContent.style.visibility = 'visible';
        backContent.style.transform = 'none';
        backContent.style.position = 'absolute';
        backContent.style.top = '0';
        backContent.style.left = '0';
        backContent.style.width = '100%';
        backContent.style.height = '100%';
        
        // Hide front content for final page
        if (pageContent) pageContent.style.display = 'none';
      }
      
      // Remove animations and transitions
      const animatedElements = pageClone.querySelectorAll('*');
      animatedElements.forEach(el => {
        (el as HTMLElement).style.animation = 'none';
        (el as HTMLElement).style.transition = 'none';
      });
      
      // Make all images visible and loaded
      const images = pageClone.querySelectorAll('img');
      images.forEach(img => {
        (img as HTMLImageElement).style.opacity = '1';
        (img as HTMLImageElement).style.visibility = 'visible';
      });
      
      // Clear and add the clone to temp container
      tempContainer.innerHTML = '';
      tempContainer.appendChild(pageClone);
      
      // Wait for images to load
      await waitForImages(pageClone);
      
      // Add page to PDF
      if (i === 0) {
        // First page - initialize PDF
        pdfInstance = await html2pdf().set(opt).from(tempContainer).toPdf().get('pdf');
      } else {
        // Subsequent pages - add new page
        pdfInstance.addPage();
        await html2pdf().set(opt).from(tempContainer).toPdf().get('pdf').then((pdf: any) => {
          // Transfer the rendered content to our main PDF instance
          const pageCount = pdf.internal.getNumberOfPages();
          const lastPageContent = pdf.internal.pages[pageCount];
          pdfInstance.internal.pages.push(lastPageContent);
        });
      }
      
      // Small delay between pages for stability
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Save the PDF
    if (pdfInstance) {
      pdfInstance.save(filename);
    }
    
    // Cleanup
    document.body.removeChild(tempContainer);
    
    console.log('PDF export completed successfully!');
    
    // Reset button state
    if (exportButton) {
      exportButton.classList.remove('loading');
      const buttonText = exportButton.querySelector('span');
      if (buttonText) {
        buttonText.textContent = 'Export to PDF';
      }
    }
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Failed to export PDF. Please try again.');
    
    // Reset button state
    if (exportButton) {
      exportButton.classList.remove('loading');
      const buttonText = exportButton.querySelector('span');
      if (buttonText) {
        buttonText.textContent = 'Export to PDF';
      }
    }
  }
}

/**
 * Wait for all images in an element to load
 */
function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  
  if (images.length === 0) {
    return Promise.resolve();
  }
  
  const imagePromises = images.map(img => {
    return new Promise<void>((resolve) => {
      if (img.complete && img.naturalHeight !== 0) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Resolve even on error to not block
      }
    });
  });
  
  return Promise.all(imagePromises).then(() => {});
}

// Attach event listeners to control buttons
document.addEventListener('DOMContentLoaded', () => {
  const restartButton = document.getElementById('restartButton');
  const exportButton = document.getElementById('exportButton');
  
  if (restartButton) {
    restartButton.addEventListener('click', restartBook);
  }
  
  if (exportButton) {
    exportButton.addEventListener('click', exportToPDF);
  }
  
  console.log('Book controls initialized');
});
