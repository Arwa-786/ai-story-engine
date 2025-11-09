/**
 * Story Display Page
 */
import type { Story, StoryStructure, StoryPage, OptionObject, FrontCover } from './types';

/**
 * Lightweight localStorage helpers kept internal to story page + store.
 */
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

/**
 * Combined Global Store (merged from store.ts)
 */
type StoreState = {
  story: Story | null;
};

const STORAGE_KEYS = {
  currentStory: 'currentStory',
} as const;

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

// State
let currentPageIndex = 0;
let storyStartTime: number = Date.now();
let bookContainer: HTMLElement | null = null;

function getPages(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>('.page');
}

/**
 * Sets the cover image and metadata dynamically
 */
function setCoverImage(metadata: { title?: string; subtitle?: string; coverImageUrl?: string }): void {
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
function setCoverDetails(metadata: { author?: string; createdAt?: string }): void {
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
 * Load story metadata from Story + prior localStorage state
 */
function loadStoryMetadata(): void {
  try {
    const storedMetadata = localStorage.getItem('storyMetadata');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingMetadata = storedMetadata ? (JSON.parse(storedMetadata) as any) : null;
    const nowIso = new Date().toISOString();
    const story = store.getState().story;

    const inputFromStory = story?.configuration?.description?.trim();
    const sourceInput = (inputFromStory || '').trim();

    const coverTitleElement = document.getElementById('coverTitle');
    const coverSubtitleElement = document.getElementById('coverSubtitle');
    const coverImageElement = document.getElementById('coverImage') as HTMLImageElement | null;

    // Derive metadata preferentially from Story, then DOM/localStorage
    const resolvedTitle =
      story?.definition?.title?.trim() ||
      story?.structure?.frontCover?.title?.trim() ||
      sourceInput ||
      coverTitleElement?.textContent?.trim() ||
      existingMetadata?.title ||
      'An Untitled Story';

    const resolvedSubtitle =
      story?.definition?.tagline?.trim() ||
      story?.structure?.frontCover?.tagline ||
      coverSubtitleElement?.textContent?.trim() ||
      existingMetadata?.subtitle ||
      'An AI Generated Adventure';

    const computedCoverUrl =
      (sourceInput ? generateCoverImageUrl(sourceInput) : undefined) ||
      coverImageElement?.getAttribute('src') ||
      existingMetadata?.coverImageUrl;

    const resolvedGenre = story?.definition?.genre;

    const metadata = {
      title: resolvedTitle,
      subtitle: resolvedSubtitle,
      coverImageUrl: computedCoverUrl,
      genre: resolvedGenre,
      createdAt: existingMetadata?.createdAt || story?.createdAt || nowIso,
      startedAt: existingMetadata?.startedAt || nowIso,
      author: existingMetadata?.author || 'You'
    };

    setCoverImage(metadata);
    setCoverDetails(metadata);
    localStorage.setItem('storyMetadata', JSON.stringify(metadata));
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
    const storedMetadata = localStorage.getItem('storyMetadata');
    const story = store.getState().story;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata: any | null = storedMetadata ? (JSON.parse(storedMetadata) as any) : null;

    // Resolve input used to derive imagery and summaries
    const input = (story?.configuration?.description?.trim() || 'forest fantasy adventure');

    if (input) {
      // Set back cover image (use a complementary image, not the same as front)
      const backCoverImage = document.getElementById('backCoverImage') as HTMLImageElement;
      const backImageUrl = generateBackCoverImageUrl(input);
      if (backCoverImage) {
        backCoverImage.src = backImageUrl;
      }
      
      // Set summary
      const summaryText = document.getElementById('storySummary');
      if (summaryText) {
        const structuredSummary = story?.structure?.backCover?.summary;
        summaryText.textContent = structuredSummary || generateStorySummary(input);
      }

      // Set back cover book title
      const backCoverTitle = document.getElementById('backBookTitle');
      if (backCoverTitle) {
        const fallbackTitle = input?.trim() || 'An Untitled Story';
        const resolvedTitle =
          metadata?.title?.trim() ||
          story?.definition?.title?.trim() ||
          story?.structure?.frontCover?.title?.trim() ||
          fallbackTitle;
        backCoverTitle.textContent = resolvedTitle;
      }

      const primaryAuthorLine = document.getElementById('backCoverPrimaryAuthor');
      const authorContainer = document.getElementById('backCoverAuthorValue');
      const resolvedAuthor = (metadata?.author?.trim() || 'You');
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
  // Get all images in all pages
  const allImages = document.querySelectorAll<HTMLImageElement>('.page img');
  
  allImages.forEach((img) => {
    // Force browser to load image by creating temporary reference if not already loaded
    if (!(img.complete && img.naturalHeight !== 0)) {
      const preloadImg = new Image();
      preloadImg.src = img.src;
    }
  });
}

/**
 * DOM helpers and builders
 */
function createElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function createParagraphs(text: string): HTMLElement {
  const container = createElement('div', 'story-text');
  const paragraphs = text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    const p = document.createElement('p');
    p.textContent = text.trim();
    container.appendChild(p);
    return container;
  }
  paragraphs.forEach(t => {
    const p = document.createElement('p');
    p.textContent = t;
    container.appendChild(p);
  });
  return container;
}

function buildCoverElement(frontCover?: FrontCover): HTMLElement {
  const page = createElement('div', 'page active') as HTMLElement;
  page.id = 'coverPage';
  page.dataset.page = 'cover';

  const cover = createElement('div', 'book-cover');

  const img = createElement('img', 'book-cover-image') as HTMLImageElement;
  img.id = 'coverImage';
  img.alt = frontCover?.title ? `${frontCover.title} - Cover Image` : 'Story Cover';
  img.loading = 'eager';
  if (frontCover?.image?.url) img.src = frontCover.image.url;

  const content = createElement('div', 'cover-content');
  const title = createElement('h1', 'book-title');
  title.id = 'coverTitle';
  title.textContent = frontCover?.title || 'An Untitled Story';
  const subtitle = createElement('div', 'cover-subtitle');
  subtitle.id = 'coverSubtitle';
  subtitle.textContent = frontCover?.tagline || 'An AI Generated Adventure';
  const tap = createElement('div', 'tap-hint');
  tap.textContent = 'Tap to Continue';
  content.appendChild(title);
  content.appendChild(subtitle);
  content.appendChild(tap);

  const footer = createElement('div', 'cover-footer');
  const author = createElement('div', 'cover-author');
  author.id = 'coverAuthor';
  author.textContent = 'Written by You';
  const publish = createElement('div', 'cover-publish-date');
  publish.id = 'coverPublishDate';
  publish.textContent = 'Published —';
  footer.appendChild(author);
  footer.appendChild(publish);

  cover.appendChild(img);
  cover.appendChild(content);
  cover.appendChild(footer);
  page.appendChild(cover);
  return page;
}

function renderOptionButton(option: OptionObject, isLast: boolean = false): HTMLButtonElement {
  const btn = createElement('button', 'story-option') as HTMLButtonElement;
  btn.dataset.option = option.id;
  if (isLast) {
    btn.dataset.isLast = 'true';
  }
  const span = createElement('span', 'option-text');
  span.textContent = option.text;
  btn.appendChild(span);
  return btn;
}

function buildBranchConversation(branchOptions: OptionObject[], isFinal: boolean): HTMLElement {
  const response = createElement('div', 'conversation-response hidden');
  const divider = createElement('div', 'response-divider');
  response.appendChild(divider);
  // Optional: a small prompt area could go here
  const optionsWrap = createElement('div', 'story-options');
  branchOptions.forEach(o => {
    optionsWrap.appendChild(renderOptionButton(o, isFinal));
  });
  response.appendChild(optionsWrap);
  return response;
}

function buildStoryPageElement(pageData: StoryPage, isFinal: boolean): HTMLElement {
  const page = createElement('div', 'page') as HTMLElement;
  page.dataset.page = 'story';
  if (isFinal) page.dataset.isFinal = 'true';

  // Infer page type
  const hasBranch = pageData.options.some(o => (o.action as unknown as { type?: string })?.type === 'branch');
  const pageType = hasBranch
    ? 'conversation'
    : (pageData.options.length === 1 ? 'single-option' : 'multiple-options');
  page.dataset.pageType = pageType;

  const pageContent = createElement('div', 'page-content');
  const storyContent = createElement('div', 'story-content');

  // Text
  storyContent.appendChild(createParagraphs(pageData.text));

  // Image
  if (pageData.image?.url) {
    const imageWrap = createElement('div', 'story-image');
    const img = document.createElement('img');
    img.src = pageData.image.url;
    img.alt = pageData.image.alt || 'Story scene';
    imageWrap.appendChild(img);
    storyContent.appendChild(imageWrap);
  }

  // Options
  if (pageData.options?.length) {
    const optionsWrap = createElement('div', 'story-options');
    pageData.options.forEach(opt => {
      optionsWrap.appendChild(renderOptionButton(opt, isFinal));
    });
    storyContent.appendChild(optionsWrap);

    // Conversation branch (single level)
    if (hasBranch) {
      const firstBranch = pageData.options.find(o => (o.action as unknown as { type?: string })?.type === 'branch');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const branch = firstBranch?.action as any;
      if (branch?.options && Array.isArray(branch.options) && branch.options.length > 0) {
        const conv = buildBranchConversation(branch.options as OptionObject[], isFinal);
        storyContent.appendChild(conv);
      }
    }
  }

  pageContent.appendChild(storyContent);
  page.appendChild(pageContent);

  // Final page back content for flip-to-back-cover
  if (isFinal) {
    const back = createElement('div', 'page-back-content');
    const bc = createElement('div', 'back-cover');
    const img = createElement('img', 'back-cover-image') as HTMLImageElement;
    img.id = 'backCoverImage';
    img.alt = 'Back Cover';
    img.loading = 'lazy';
    bc.appendChild(img);

    const bcContent = createElement('div', 'back-cover-content');
    const summary = createElement('div', 'story-summary');
    const h1 = createElement('h1', 'back-cover-title');
    h1.id = 'backBookTitle';
    h1.textContent = '';
    const h2 = createElement('h2', 'summary-title');
    h2.textContent = 'Summary';
    const p = createElement('p', 'summary-text');
    p.id = 'storySummary';
    summary.appendChild(h1);
    summary.appendChild(h2);
    summary.appendChild(p);

    const metadataWrap = createElement('div', 'book-metadata');
    const authorSection = createElement('div', 'metadata-section');
    const authorLabel = createElement('div', 'metadata-label');
    authorLabel.textContent = 'Written by';
    const authorValue = createElement('div', 'metadata-value');
    authorValue.id = 'backCoverAuthorValue';
    const primaryAuthor = createElement('div', 'author-line');
    primaryAuthor.id = 'backCoverPrimaryAuthor';
    primaryAuthor.textContent = 'You (Story Creator)';
    authorValue.appendChild(primaryAuthor);
    authorSection.appendChild(authorLabel);
    authorSection.appendChild(authorValue);

    const pubSection = createElement('div', 'metadata-section');
    const pubLabel = createElement('div', 'metadata-label');
    pubLabel.textContent = 'Published';
    const pubValue = createElement('div', 'metadata-value');
    pubValue.id = 'publishDate';
    pubSection.appendChild(pubLabel);
    pubSection.appendChild(pubValue);

    const publisherSection = createElement('div', 'metadata-section');
    const publisherLabel = createElement('div', 'metadata-label');
    publisherLabel.textContent = 'Publisher';
    const publisherValue = createElement('div', 'metadata-value');
    publisherValue.textContent = 'AI Story Engine';
    publisherSection.appendChild(publisherLabel);
    publisherSection.appendChild(publisherValue);

    metadataWrap.appendChild(authorSection);
    metadataWrap.appendChild(pubSection);
    metadataWrap.appendChild(publisherSection);

    bcContent.appendChild(summary);
    bcContent.appendChild(metadataWrap);

    bc.appendChild(bcContent);
    back.appendChild(bc);
    page.appendChild(back);
  }

  return page;
}

function buildDefaultStructure(): StoryStructure {
  let title = store.getState().story?.definition?.title?.trim() || 'An Untitled Story';
  let tagline = store.getState().story?.definition?.tagline?.trim() || 'An AI Generated Adventure';
  return {
    frontCover: {
      title,
      tagline,
    },
    pages: [
      {
        id: 'p1',
        text: 'Your journey begins...',
        options: [{ id: '1', text: 'Continue', action: { type: 'goToNextPage' } }],
      },
      {
        id: 'p2',
        text: 'The path ahead opens to endless possibilities.',
        options: [{ id: '1', text: 'Finish', action: { type: 'goToNextPage' } }],
      },
    ],
    backCover: {
      summary: '',
    },
  };
}

function buildStoryFromStore(): void {
  bookContainer = document.querySelector<HTMLElement>('.book-container');
  if (!bookContainer) return;

  // Preserve the left-page, clear other dynamic content
  const leftPage = bookContainer.querySelector('.left-page');
  bookContainer.innerHTML = '';
  if (leftPage) bookContainer.appendChild(leftPage);

  const story = store.getState().story;
  const structure: StoryStructure = story?.structure || buildDefaultStructure();

  // Cover
  const cover = buildCoverElement(structure.frontCover);
  bookContainer.appendChild(cover);

  // Pages
  const total = structure.pages.length;
  structure.pages.forEach((p, idx) => {
    const isFinal = idx === total - 1;
    const el = buildStoryPageElement(p, isFinal);
    bookContainer!.appendChild(el);
  });
}

function attachOptionHandlers(root: Document | HTMLElement = document): void {
  const allOptionButtons = root.querySelectorAll<HTMLButtonElement>('.story-option');
  const optionButtons = Array.from(allOptionButtons).filter(btn => {
    // Exclude buttons that are inside a .conversation-response element
    return !btn.closest('.conversation-response');
  });
  optionButtons.forEach(btn => {
    btn.addEventListener('click', handleOptionClick);
  });
}

function initializeStoryPage(): void {
  // Build DOM from store/structure first
  buildStoryFromStore();
  // Load metadata after DOM is present
  loadStoryMetadata();
  // Preload all story images
  preloadStoryImages();
  // Initialize first page
  const pagesNow = getPages();
  if (pagesNow.length > 0) {
    pagesNow[0].classList.add('active');
  }
  // Attach initial handlers for options
  attachOptionHandlers();
  // Handle cover page click
  const coverPage = document.getElementById('coverPage');
  if (coverPage) {
    coverPage.addEventListener('click', flipToNextPage);
  }
  // Keyboard navigation
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      const pagesNowKey = getPages();
      const currentPage = pagesNowKey[currentPageIndex];
      const pageType = currentPage?.dataset.page;
      
      if (pageType === 'cover') {
        event.preventDefault();
        flipToNextPage();
      }
    }
    // Toggle debug overlay with backtick `
    if (event.code === 'Backquote' || event.key === '`') {
      event.preventDefault();
      toggleDebugMenu();
    }
  });
  // Add cursor pointer to clickable pages
  if (coverPage) {
    coverPage.addEventListener('mouseenter', () => {
      coverPage.style.cursor = 'pointer';
    });
  }
  // Attach event listeners to control buttons
  const restartButton = document.getElementById('restartButton');
  const exportButton = document.getElementById('exportButton');
  
  if (restartButton) {
    restartButton.addEventListener('click', restartBook);
  }
  
  if (exportButton) {
    exportButton.addEventListener('click', exportToPDF);
  }
}

function isStoryPage(): boolean {
  return !!document.querySelector('.book-container') || !!document.getElementById('coverPage');
}

/**
 * Flip the final page, then replace background back with back cover content
 * No next page will appear - right side stays empty
 */
function flipToBackCover(): void {
  const pagesNow = getPages();
  const currentPage = pagesNow[currentPageIndex];
  
  if (!currentPage) {
    console.error('No current page found');
    return;
  }
  
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
      currentPage.style.setProperty('--back-cover-image-url', `url("${updatedBackCoverImageUrl}")`);
    }
  } else {
    currentPage.style.setProperty('--back-cover-image-url', `url("${backCoverImageUrl}")`);
  }
  
  // Remove active state - no next page will appear
  currentPage.classList.remove('active');
  
  // Start final flip animation (background image back shows during flip)
  requestAnimationFrame(() => {
    currentPage.classList.add('flipping-out-final');
  });

  const finalFlipDuration = 1200;
  const backCoverSettleDelay = 300;

  // After flip completes, replace background back with back cover content
  setTimeout(() => {
    // Remove flipping-out-final animation class
    currentPage.classList.remove('flipping-out-final');
        
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
    bookContainer.classList.remove('back-cover-complete');
    bookContainer.classList.add('show-back-cover');
  }
  
  // Once the flip and centering animations complete, hide the flipped page stack
  setTimeout(() => {
    if (bookContainer) {
      bookContainer.classList.add('back-cover-complete');
    }
  }, finalFlipDuration + backCoverSettleDelay);
  
  // Show book controls after back cover is displayed
  setTimeout(() => {
    const bookControls = document.getElementById('bookControls');
    if (bookControls) {
      bookControls.classList.add('visible');
    }
  }, finalFlipDuration + 600); // Show after centering animation completes (1.2s flip + 0.6s extra delay)
}

// Flip to next page
function flipToNextPage(): void {
  const pagesNow = getPages();
  if (currentPageIndex >= pagesNow.length - 1) {
    return;
  }

  const currentPage = pagesNow[currentPageIndex];
  const nextPage = pagesNow[currentPageIndex + 1];

  // Make next page visible behind the current page before animation starts
  currentPage.classList.remove('active');
  nextPage.classList.add('behind');

  // Start flip animation on next frame to ensure 'behind' class is applied first
  requestAnimationFrame(() => {
    currentPage.classList.add('flipping-out');
  });

  // Complete the flip after animation
  setTimeout(() => {
    currentPage.classList.remove('flipping-out');
    currentPage.classList.add('flipped'); // Keep page visible in flipped state
    nextPage.classList.remove('behind');
    nextPage.classList.add('active');
    
    currentPageIndex++;
  }, 1200); // Match animation duration
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
      setTimeout(flipToBackCover, delay);
    } else {
      setTimeout(flipToNextPage, delay);
    }
  }
}

// Handlers are attached after dynamic DOM build in initializeStoryPage

// Initialize story page only when appropriate
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (isStoryPage()) {
      initializeStoryPage();
    }
  });
} else {
  if (isStoryPage()) {
    initializeStoryPage();
  }
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
  // Show loading state
  const restartButton = document.getElementById('restartButton');
  if (restartButton) {
    restartButton.classList.add('loading');
  }
  
  // Reload the page to restart
  window.location.reload();
}

/**
 * Export the book to PDF - placeholder (disabled)
 */
async function exportToPDF(): Promise<void> {
  const exportButton = document.getElementById('exportButton');
  if (exportButton) {
    exportButton.classList.add('loading');
    const buttonText = exportButton.querySelector('span');
    if (buttonText) {
      buttonText.textContent = 'Preparing...';
    }
  }

  console.log('[PDF Export] Placeholder: PDF export is currently disabled.');

  // Simulate brief work, then reset UI
  await new Promise(resolve => setTimeout(resolve, 400));
  if (exportButton) {
    exportButton.classList.remove('loading');
    const buttonText = exportButton.querySelector('span');
    if (buttonText) {
      buttonText.textContent = 'Export to PDF';
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

/**
 * =====================================================
 * DEBUG OVERLAY
 * Toggle with the backtick (`) key
 * =====================================================
 */
const DEBUG_IDS = {
  menu: 'debugMenu',
  content: 'debugContent',
  close: 'debugCloseBtn',
  refresh: 'debugRefreshBtn',
  copy: 'debugCopyBtn',
} as const;

function updateDebugContent(): void {
  const contentEl = document.getElementById(DEBUG_IDS.content);
  if (!contentEl) return;
  const storyState = store.getState().story;
  (contentEl as HTMLElement).textContent = JSON.stringify(storyState, null, 2);
}

function showDebugMenu(): void {
  const menu = document.getElementById(DEBUG_IDS.menu);
  if (!menu) return;
  updateDebugContent();
  menu.classList.add('visible');
  menu.setAttribute('aria-hidden', 'false');
}

function hideDebugMenu(): void {
  const menu = document.getElementById(DEBUG_IDS.menu);
  if (!menu) return;
  menu.classList.remove('visible');
  menu.setAttribute('aria-hidden', 'true');
}

function toggleDebugMenu(): void {
  const menu = document.getElementById(DEBUG_IDS.menu);
  if (!menu) return;
  if (menu.classList.contains('visible')) {
    hideDebugMenu();
  } else {
    showDebugMenu();
  }
}

// Attach debug menu handlers once DOM is ready (rely on existing init path)
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById(DEBUG_IDS.close);
  const refreshBtn = document.getElementById(DEBUG_IDS.refresh);
  const copyBtn = document.getElementById(DEBUG_IDS.copy);

  closeBtn?.addEventListener('click', hideDebugMenu);
  refreshBtn?.addEventListener('click', updateDebugContent);
  copyBtn?.addEventListener('click', async () => {
    try {
      const storyState = store.getState().story;
      await navigator.clipboard?.writeText(JSON.stringify(storyState, null, 2));
    } catch {
      // no-op
    }
  });
});
