/**
 * Story Display Page
 */
import type { Story, StoryStructure, StoryPage, OptionObject, FrontCover, StoryDefinition, StoryTelemetry, OptionSelectionEvent, StoryMetadata } from './types';

/**
 * Lightweight localStorage helpers kept internal to story page + store.
 */
function readFromLocalStorage<T>(key: string): T | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    console.log('Reading from localStorage:', key);
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

/**
 * In-memory image cache keyed by `${storyId}:${kind}:${id?}`.
 * Avoids reloading when images are already in state or loaded in session.
 */
type ImageCacheEntry = {
  dataUrl: string;
  mimeType?: string;
  width?: number;
  height?: number;
  lastAccessed: number;
};
const imageCache: Map<string, ImageCacheEntry> = new Map();

function getCurrentStoryId(): string | null {
  try {
    return store.getState().story?.id ?? null;
  } catch {
    return null;
  }
}

function getFrontCoverKey(): string | null {
  const id = getCurrentStoryId();
  return id ? `${id}:frontCover` : null;
}

function getBackCoverKey(): string | null {
  const id = getCurrentStoryId();
  return id ? `${id}:backCover` : null;
}

function getPageKeyById(pageId: string): string | null {
  const id = getCurrentStoryId();
  return id ? `${id}:page:${pageId}` : null;
}

function cacheImageDataUrl(key: string | null, dataUrl: string, mimeType?: string): void {
  if (!key || !dataUrl) return;
  imageCache.set(key, {
    dataUrl,
    mimeType,
    lastAccessed: Date.now(),
  });
}

function getCachedImageDataUrl(key: string | null): string | null {
  if (!key) return null;
  const entry = imageCache.get(key);
  if (!entry) return null;
  entry.lastAccessed = Date.now();
  return entry.dataUrl;
}

function isDataUrl(src: string | undefined): boolean {
  return !!src && /^data:/i.test(src);
}

async function fetchUrlAsDataUrl(url: string): Promise<{ dataUrl: string; mimeType: string } | null> {
  try {
    const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const mimeType = blob.type || 'image/png';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    return { dataUrl, mimeType };
  } catch {
    return null;
  }
}

function prefillImageCacheFromStore(): void {
  try {
    const story = store.getState().story;
    if (!story || !story.structure) return;
    const sid = story.id;
    if (!sid) return;
    const fc = story.structure.frontCover?.image?.dataUrl;
    if (fc) cacheImageDataUrl(`${sid}:frontCover`, fc, story.structure.frontCover?.image?.mimeType);
    const bc = story.structure.backCover?.image?.dataUrl;
    if (bc) cacheImageDataUrl(`${sid}:backCover`, bc, story.structure.backCover?.image?.mimeType);
    const pages = story.structure.pages || [];
    pages.forEach(p => {
      const d = p.image?.dataUrl;
      if (d) cacheImageDataUrl(`${sid}:page:${p.id}`, d, p.image?.mimeType);
    });
  } catch {
    // ignore
  }
}

// State
let currentPageIndex = 0;
let storyStartTime: number = Date.now();
let bookContainer: HTMLElement | null = null;

/**
 * Telemetry helpers
 */
function getDefaultTelemetry(): StoryTelemetry {
  return { optionSelections: [], storyline: [] };
}

function getCurrentTelemetry(): StoryTelemetry {
  const s = store.getState().story;
  return (s?.metadata?.telemetry) ?? getDefaultTelemetry();
}

function updateTelemetry(updater: (t: StoryTelemetry) => void): void {
  const currentStory = store.getState().story;
  if (!currentStory) return;
  const telemetry = { ...getCurrentTelemetry() };
  updater(telemetry);
  const nextMetadata: StoryMetadata = {
    ...(currentStory.metadata ?? { telemetry: getDefaultTelemetry() }),
    telemetry,
  };
  store.updateStory({ metadata: nextMetadata });
}

function trackOptionSelection(event: Omit<OptionSelectionEvent, 'timestamp'>): void {
  updateTelemetry(t => {
    t.optionSelections = t.optionSelections.concat({
      ...event,
      timestamp: new Date().toISOString(),
    });
  });
}

function trackStorylineEvent(type: StoryTelemetry['storyline'][number]['type'], details?: Omit<StoryTelemetry['storyline'][number], 'timestamp' | 'type'>): void {
  updateTelemetry(t => {
    t.storyline = t.storyline.concat({
      type,
      timestamp: new Date().toISOString(),
      ...(details ?? {}),
    });
  });
}

/**
 * Cover speech playback state
 */
let coverAudio: HTMLAudioElement | null = null;
let coverAudioStarted = false;
let coverAudioObjectUrls: string[] = [];
let coverAudioFetchAborters: AbortController[] = [];
let coverStopOnClickHandler: ((e: Event) => void) | null = null;

/**
 * Per-page narration playback state
 */
let pageSourceNode: AudioBufferSourceNode | null = null;
let pageGainNode: GainNode | null = null;
let pageAudioFetchAborter: AbortController | null = null;
let pageStopOnClickHandler: ((e: Event) => void) | null = null;

/**
 * Shared AudioContext unlock for reliable autoplay after user gesture
 */
let sharedAudioContext: AudioContext | null = null;
let audioUnlockSetup = false;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext!;
}

function setupAudioUnlock(): void {
  if (audioUnlockSetup) return;
  audioUnlockSetup = true;
  const tryResume = () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state !== 'running') {
        void ctx.resume();
      }
    } catch {
      // ignore
    } finally {
      document.removeEventListener('click', tryResume, true);
      document.removeEventListener('touchstart', tryResume, true);
      document.removeEventListener('keydown', tryResume, true);
    }
  };
  document.addEventListener('click', tryResume, true);
  document.addEventListener('touchstart', tryResume, true);
  document.addEventListener('keydown', tryResume, true);
}

function getStoryGenre(): string | undefined {
  try {
    const g = store.getState().story?.definition?.genre;
    return typeof g === 'string' ? g : undefined;
  } catch {
    return undefined;
  }
}

async function fetchSpeechObjectUrl(text: string, genre?: string, signal?: AbortSignal): Promise<string> {
  const resp = await fetch('/api/speech/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, genre }),
    signal,
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Speech request failed (${resp.status}) ${errText}`);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  coverAudioObjectUrls.push(url);
  return url;
}

function stopCoverAudio(): void {
  try {
    // Abort any in-flight fetches
    coverAudioFetchAborters.forEach(a => { try { a.abort(); } catch { /* ignore */ } });
    coverAudioFetchAborters = [];
    // Stop audio element
    if (coverAudio) {
      try {
        coverAudio.pause();
      } catch {
        // ignore
      }
      coverAudio.src = '';
      coverAudio.load();
      coverAudio = null;
    }
    // Revoke created URLs
    coverAudioObjectUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    });
    coverAudioObjectUrls = [];
    // Remove click-to-stop listener
    if (coverStopOnClickHandler) {
      document.removeEventListener('click', coverStopOnClickHandler, true);
      coverStopOnClickHandler = null;
    }
  } catch {
    // no-op
  } finally {
    coverAudioStarted = false;
  }
}

function stopPageAudio(): void {
  try {
    if (pageAudioFetchAborter) {
      try { pageAudioFetchAborter.abort(); } catch { /* ignore */ }
      pageAudioFetchAborter = null;
    }
    if (pageSourceNode) {
      try { pageSourceNode.stop(0); } catch { /* ignore */ }
      try { pageSourceNode.disconnect(); } catch { /* ignore */ }
      pageSourceNode.onended = null;
      pageSourceNode = null;
    }
    if (pageGainNode) {
      try { pageGainNode.disconnect(); } catch { /* ignore */ }
      pageGainNode = null;
    }
    if (pageStopOnClickHandler) {
      document.removeEventListener('click', pageStopOnClickHandler, true);
      pageStopOnClickHandler = null;
    }
  } catch {
    // ignore
  }
}

async function fetchSpeechArrayBuffer(text: string, genre?: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const resp = await fetch('/api/speech/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, genre }),
    signal,
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Speech request failed (${resp.status}) ${errText}`);
  }
  return await resp.arrayBuffer();
}

function scheduleCoverReadAloud(): void {
  if (coverAudioStarted) return;
  // Delay 1s after cover appears
  window.setTimeout(async () => {
    // Ensure we are still on the cover page
    const pagesNow = getPages();
    const first = pagesNow[0];
    if (!first || first.dataset.page !== 'cover' || currentPageIndex !== 0) return;
    // Resolve texts from DOM
    const titleEl = document.getElementById('coverTitle');
    const subtitleEl = document.getElementById('coverSubtitle');
    const title = (titleEl?.textContent || '').trim();
    const tagline = (subtitleEl?.textContent || '').trim();
    if (!title && !tagline) return;
    // Start playback
    coverAudioStarted = true;
    const genre = getStoryGenre();
    const abortTitle = new AbortController();
    const abortTag = new AbortController();
    coverAudioFetchAborters = [abortTitle, abortTag];
    try {
      // Prefetch both segments concurrently for gapless-ish playback
      const requests: Array<Promise<string>> = [];
      if (title) requests.push(fetchSpeechObjectUrl(title, genre, abortTitle.signal));
      if (tagline) requests.push(fetchSpeechObjectUrl(tagline, genre, abortTag.signal));
      const urls = await Promise.all(requests);
      if (urls.length === 0) {
        coverAudioStarted = false;
        return;
      }
      let index = 0;
      coverAudio = new Audio(urls[index]);
      coverAudio.addEventListener('ended', () => {
        index += 1;
        if (!coverAudio) return;
        if (index < urls.length) {
          coverAudio.src = urls[index];
          // Attempt immediate play of next segment
          void coverAudio.play().catch(() => {
            // If autoplay continuation fails, stop gracefully
            stopCoverAudio();
          });
        } else {
          // Completed both segments
          stopCoverAudio();
        }
      });
      coverAudio.addEventListener('error', () => {
        stopCoverAudio();
      });
      // Attempt to play the first segment
      try {
        setupAudioUnlock();
        await coverAudio.play();
        // Only after playback actually starts, attach click-to-stop
        coverStopOnClickHandler = () => { stopCoverAudio(); };
        document.addEventListener('click', coverStopOnClickHandler, true);
      } catch {
        // Autoplay blocked; set up a one-time capture click to start audio instead of flipping
        const oneTimeUnlock = async (ev: Event) => {
          try {
            // Prevent this click from bubbling to the cover flip handler
            ev.preventDefault();
            if (typeof (ev as any).stopImmediatePropagation === 'function') {
              (ev as any).stopImmediatePropagation();
            }
            ev.stopPropagation();
            document.removeEventListener('click', oneTimeUnlock, true);
            setupAudioUnlock();
            if (!coverAudio) {
              // If coverAudio was torn down for some reason, rebuild from urls
              coverAudio = new Audio(urls[0]);
              index = 0;
              coverAudio.addEventListener('ended', () => {
                index += 1;
                if (!coverAudio) return;
                if (index < urls.length) {
                  coverAudio.src = urls[index];
                  void coverAudio.play().catch(() => stopCoverAudio());
                } else {
                  stopCoverAudio();
                }
              });
              coverAudio.addEventListener('error', () => stopCoverAudio());
            }
            await coverAudio.play();
            // Attach normal click-to-stop behavior after audio is audibly playing
            coverStopOnClickHandler = () => { stopCoverAudio(); };
            document.addEventListener('click', coverStopOnClickHandler, true);
          } catch {
            // If still blocked or failed, just tear down and allow normal navigation
            stopCoverAudio();
          }
        };
        // Capture-phase so we intercept before page flip handler
        document.addEventListener('click', oneTimeUnlock, true);
      }
    } catch {
      stopCoverAudio();
    }
  }, 1000);
}

async function startPageNarrationForDomIndex(domIndex: number): Promise<void> {
  try {
    setupAudioUnlock();
    // Only read for actual story pages (not cover)
    const dataIndex = mapDomToDataIndex(domIndex);
    if (dataIndex < 0) return;
    const storyNow = store.getState().story;
    const page = storyNow?.structure?.pages?.[dataIndex];
    const text = (page?.text || '').trim();
    if (!text) return;
    // Stop any ongoing narrations first
    stopCoverAudio();
    stopPageAudio();
    const genre = getStoryGenre();
    // Fetch speech and play via WebAudio for reliable playback
    pageAudioFetchAborter = new AbortController();
    const bufferData = await fetchSpeechArrayBuffer(text, genre, pageAudioFetchAborter.signal);
    const ctx = getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(bufferData.slice(0));
    // Build graph: BufferSource -> Gain -> Destination
    pageSourceNode = ctx.createBufferSource();
    pageSourceNode.buffer = audioBuffer;
    pageGainNode = ctx.createGain();
    pageGainNode.gain.value = 1.0;
    pageSourceNode.connect(pageGainNode);
    pageGainNode.connect(ctx.destination);
    // Stop on any user click
    pageStopOnClickHandler = () => { stopPageAudio(); };
    document.addEventListener('click', pageStopOnClickHandler, true);
    pageSourceNode.onended = () => {
      stopPageAudio();
    };
    // Ensure context is running, then start
    if (ctx.state !== 'running') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
    pageSourceNode.start(0);
  } catch {
    stopPageAudio();
  }
}

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
    coverPublishDate.textContent = formatDate(createdAt);
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

    const imgFromStructure = story?.structure?.frontCover?.image;
    const imgFromDefinition = story?.definition?.image;
    const computedCoverUrl =
      imgFromStructure?.dataUrl ||
      imgFromDefinition?.dataUrl ||
      imgFromStructure?.url ||
      imgFromDefinition?.url ||
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
async function setupBackCover(): Promise<void> {
  try {
    const storedMetadata = localStorage.getItem('storyMetadata');
    const story = store.getState().story;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata: any | null = storedMetadata ? (JSON.parse(storedMetadata) as any) : null;

    // Resolve input used to derive imagery and summaries
    const input = (story?.configuration?.description?.trim() || 'forest fantasy adventure');

    if (input) {
      // Ensure back cover summary exists (LLM-generated)
      await maybeGenerateBackCoverSummaryIfMissing();
      // Ensure back cover art exists (AI-generated)
      // Show a dedicated loading screen once the summary is done, only if image is still missing
      {
        const afterSummary = store.getState().story;
        const hasBackImage =
          Boolean(afterSummary?.structure?.backCover?.image?.dataUrl) ||
          Boolean(afterSummary?.structure?.backCover?.image?.url);
        if (!hasBackImage) {
          // Replace any existing overlay with a new "Generating cover art..." screen
          const existingOverlay = document.getElementById('story-opening-overlay') as HTMLElement | null;
          if (existingOverlay) {
            try { removeInlineLoadingOverlay(existingOverlay); } catch { /* ignore */ }
          }
          const artOverlay = createInlineLoadingOverlay('Generating cover art...');
          try {
            await maybeGenerateBackCoverImageIfMissing();
          } finally {
            removeInlineLoadingOverlay(artOverlay);
          }
        } else {
          // If image already present, just proceed without additional overlay
          await maybeGenerateBackCoverImageIfMissing();
        }
      }
      const backCoverImage = document.getElementById('backCoverImage') as HTMLImageElement;
      const current = store.getState().story;
      const backSrc =
        current?.structure?.backCover?.image?.dataUrl ||
        current?.structure?.backCover?.image?.url;
      if (backCoverImage && backSrc) {
        backCoverImage.src = backSrc;
      }
      
      // Set summary (prefer freshly generated BackCoverSummary from store)
      const summaryText = document.getElementById('storySummary');
      if (summaryText) {
        const refreshed = store.getState().story;
        const structuredSummary = refreshed?.structure?.backCover?.summary;
        summaryText.textContent =
          (typeof structuredSummary === 'string' && structuredSummary.trim().length > 0)
            ? structuredSummary
            : generateStorySummary(input);
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
  const src = frontCover?.image?.dataUrl || frontCover?.image?.url;
  if (src) img.src = src;

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
  publish.textContent = '';
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

function buildBranchConversation(branchOptions: OptionObject[], isFinal: boolean, branchText?: string): HTMLElement {
  const response = createElement('div', 'conversation-response hidden');
  const divider = createElement('div', 'response-divider');
  response.appendChild(divider);
  // Optional prompt/content above branch options
  const prompt = createElement('div', 'conversation-text') as HTMLElement;
  if (branchText && typeof branchText === 'string') {
    prompt.textContent = branchText;
  } else {
    prompt.textContent = '';
  }
  response.appendChild(prompt);
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
  const resolvedSrc = pageData.image?.dataUrl || pageData.image?.url;
  {
    const imageWrap = createElement('div', 'story-image');
    const img = document.createElement('img');
    img.alt = pageData.image?.alt || 'Story scene';
    img.loading = 'lazy';
    img.setAttribute('decoding', 'async');
    imageWrap.appendChild(img);
    storyContent.appendChild(imageWrap);
    const cachedSrc = getCachedImageDataUrl(getPageKeyById(pageData.id));
    const initialSrc = cachedSrc || resolvedSrc;
    if (initialSrc) {
      const { overlay, barFill } = createImageLoadingOverlay();
      imageWrap.appendChild(overlay);
      imageWrap.classList.add('loading');
      const sim = startSimulatedProgress(barFill);
      let handled = false;
      const handleLoaded = () => {
        if (handled) return;
        handled = true;
        sim.stop();
        barFill.style.width = '100%';
        window.setTimeout(() => overlay.remove(), 180);
        imageWrap.classList.remove('loading');
        if (isDataUrl(initialSrc)) {
          cacheImageDataUrl(getPageKeyById(pageData.id), initialSrc);
        }
      };
      const handleError = () => {
        if (handled) return;
        handled = true;
        sim.stop();
        overlay.classList.add('error');
        window.setTimeout(() => {
          try { overlay.remove(); } catch {}
          imageWrap.classList.remove('loading');
        }, 220);
      };
      img.onload = handleLoaded;
      img.onerror = handleError;
      img.src = initialSrc;
      // Hide loader as soon as a valid src is set
      imageWrap.classList.remove('loading');
      if (img.complete && img.naturalHeight !== 0) {
        handleLoaded();
      }
      // Ensure paint completion even for cached images
      try {
        if (typeof (img as any).decode === 'function') {
          (img as any).decode().then(handleLoaded).catch(handleLoaded);
        }
      } catch {
        // ignore decode support issues
      }
    }
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
        const conv = buildBranchConversation(branch.options as OptionObject[], isFinal, (branch as { text?: string }).text);
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
    publisherValue.textContent = 'Story Untold';
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
  const defImage = store.getState().story?.definition?.image;
  return {
    frontCover: {
      title,
      tagline,
      image: defImage,
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
  const hasBackCover = Boolean((structure as unknown as { backCover?: unknown }).backCover);
  structure.pages.forEach((p, idx) => {
    const isFinal = idx === total - 1 && hasBackCover;
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
  prefillImageCacheFromStore();
  buildStoryFromStore();
  // Prepare audio unlock on first user interaction
  setupAudioUnlock();
  // Load metadata after DOM is present
  loadStoryMetadata();
  // Begin warming critical images while on the cover
  warmupImagesOnCover().catch(() => {});
  // Initialize first page
  const pagesNow = getPages();
  if (pagesNow.length > 0) {
    pagesNow[0].classList.add('active');
  }
  // Schedule cover read aloud once the cover is visible
  scheduleCoverReadAloud();
  // Attach initial handlers for options
  attachOptionHandlers();
  // If no pages yet but we have a definition, attempt to fetch the opening page here
  maybeFetchOpeningPageIfMissing()
    .catch(err => {
      console.warn('Opening page generation failed on story page:', err);
    })
    .finally(() => {
      // After attempting opening scene, generate cover art if missing
      maybeGenerateCoverImageIfMissing().catch(err => {
        console.warn('Cover image generation failed:', err);
      });
    // Warmup first page and back cover images once structure exists
    warmupImagesOnCover().catch(() => {});
    });
  // Handle cover page click
  const coverPage = document.getElementById('coverPage');
  if (coverPage) {
    coverPage.addEventListener('click', () => {
      // Stop cover narration on user interaction, then flip
      stopCoverAudio();
      flipToNextPage();
    });
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
  // New Story button
  const newStoryButton = document.getElementById('newStoryButton');
  if (newStoryButton) {
    newStoryButton.addEventListener('click', startNewStory);
  }
}

function isStoryPage(): boolean {
  return !!document.querySelector('.book-container') || !!document.getElementById('coverPage');
}

/**
 * Fallback: fetch the first story page on the story screen if missing
 */
async function maybeFetchOpeningPageIfMissing(): Promise<void> {
  const current = store.getState().story;
  const hasAnyPage = Boolean(current?.structure?.pages && current.structure.pages.length > 0);
  const hasDefinition = Boolean(current?.definition);
  if (hasAnyPage || !hasDefinition) return;

  const overlay = createInlineLoadingOverlay('Generating opening scene...');
  try {
    const firstPage = await fetchFirstStoryPage(current!.definition!);
    // Build/update minimal structure
    const frontCover: FrontCover = {
      title: current!.definition!.title,
      tagline: current!.definition!.tagline,
      image: current!.definition!.image,
    };
    const existingPages = current!.structure?.pages ?? [];
    store.updateStory({
      structure: ({ frontCover, pages: existingPages.length > 0 ? existingPages : [firstPage] } as unknown as StoryStructure),
    });
    // Rebuild the DOM with new data
    buildStoryFromStore();
    loadStoryMetadata();
    preloadStoryImages();
    const pagesNow = getPages();
    if (pagesNow.length > 0) {
      pagesNow[0].classList.add('active');
    }
    attachOptionHandlers();
  } finally {
    removeInlineLoadingOverlay(overlay);
  }
}

async function fetchFirstStoryPage(definition: StoryDefinition): Promise<StoryPage> {
  const cfg = store.getState().story?.configuration;
  const response = await fetch('/api/story/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition, stepIndex: 0, configuration: cfg }),
  });
  if (!response.ok) {
    throw new Error(`Story page request failed (${response.status})`);
  }
  const data = (await response.json()) as StoryPage;
  return data;
}

/**
 * Build a descriptive cover art prompt from the StoryDefinition if one isn't provided.
 */
function buildCoverPromptFromDefinition(definition: StoryDefinition): string {
  const title = definition.title?.trim();
  const genre = definition.genre?.trim();
  const theme = definition.theme?.trim();
  const location = definition.location?.trim();
  const period = definition.timePeriod?.trim();
  const tagline = definition.tagline?.trim();
  const world = definition.worldDescription?.trim();
  const protagonist = definition.protagonist?.name?.trim();
  const antagonist = definition.antagonist?.name?.trim();
  const base = [
    title ? `Book cover for "${title}"` : 'Book cover',
    genre ? `genre: ${genre}` : '',
    theme ? `theme: ${theme}` : '',
    location ? `setting: ${location}` : '',
    period ? `time period: ${period}` : '',
    protagonist ? `featuring protagonist ${protagonist}` : '',
    antagonist ? `and antagonist ${antagonist}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const mood = tagline ? `, mood: ${tagline}` : '';
  const worldHint = world ? `, world: ${world}` : '';
  // Guidance for composition. Final size is controlled by CSS; provide aspect hints.
  const composition =
    ', cinematic, detailed, high contrast, sharp focus, rich lighting, vertical 3:4, cover art';
  return `${base}${mood}${worldHint}${composition}`;
}

/**
 * Build a complementary back cover prompt from the StoryDefinition.
 */
function buildBackCoverPromptFromDefinition(definition: StoryDefinition): string {
  const title = definition.title?.trim();
  const genre = definition.genre?.trim();
  const theme = definition.theme?.trim();
  const location = definition.location?.trim();
  const period = definition.timePeriod?.trim();
  const world = definition.worldDescription?.trim();
  const protagonist = definition.protagonist?.name?.trim();
  const antagonist = definition.antagonist?.name?.trim();
  const base = [
    title ? `Back cover illustration for "${title}"` : 'Back cover illustration',
    genre ? `genre: ${genre}` : '',
    theme ? `theme: ${theme}` : '',
    location ? `setting: ${location}` : '',
    period ? `time period: ${period}` : '',
    protagonist ? `featuring protagonist ${protagonist}` : '',
    antagonist ? `and antagonist ${antagonist}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const perspective = ', complementary to front cover, alternate angle, subtle, no text';
  const composition = ', cinematic, detailed, high contrast, sharp focus, rich lighting, vertical 3:4, back cover art';
  return `${base}${perspective}${(world ? `, world: ${world}` : '')}${composition}`;
}

/**
 * Generate a cover image using the backend image agent if none is present.
 * Shows a loading overlay: "Generating cover art..."
 */
async function maybeGenerateCoverImageIfMissing(): Promise<void> {
  const current = store.getState().story;
  const definition = current?.definition;
  if (!definition) return;
  const existing =
    current?.structure?.frontCover?.image?.dataUrl ||
    current?.structure?.frontCover?.image?.url;
  if (existing) return;
  const prompt =
    definition.image?.prompt?.trim() ||
    buildCoverPromptFromDefinition(definition);
  if (!prompt || prompt.length === 0) return;

  const overlay = createInlineLoadingOverlay('Generating cover art...');
  try {
    const resp = await fetch('/api/story/cover-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!resp.ok) {
      throw new Error(`Cover image request failed (${resp.status})`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await resp.json();
    const mimeType: string = typeof data?.mimeType === 'string' && data.mimeType ? data.mimeType : 'image/png';
    const base64: string | undefined = data?.imageBase64;
    if (!base64 || typeof base64 !== 'string' || base64.length === 0) {
      throw new Error('Invalid image data returned');
    }
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Persist in store
    const structure = current?.structure || buildDefaultStructure();
    const newFrontCover: FrontCover = {
      ...structure.frontCover,
      image: {
        ...(structure.frontCover.image || {}),
        dataUrl,
        mimeType,
        prompt,
        alt: definition.title ? `${definition.title} - Cover Image` : 'Story Cover',
      },
    };
    store.updateStory({
      structure: ({ ...structure, frontCover: newFrontCover } as unknown as StoryStructure),
    });

    // Cache in-memory to avoid future reloads
    cacheImageDataUrl(getFrontCoverKey(), dataUrl, mimeType);

    // Update DOM immediately without full rebuild
    const coverImage = document.getElementById('coverImage') as HTMLImageElement | null;
    if (coverImage) {
      coverImage.src = dataUrl;
      coverImage.alt = newFrontCover.image?.alt || coverImage.alt;
    }
    // Refresh metadata so the UI footer shows correct publish date etc
    loadStoryMetadata();
  } catch (err) {
    setOverlayError(overlay, 'Failed to generate cover art.');
    await delay(900);
    throw err;
  } finally {
    removeInlineLoadingOverlay(overlay);
  }
}

/**
 * Generate a back cover image using the backend image agent if none is present.
 */
async function maybeGenerateBackCoverImageIfMissing(): Promise<void> {
  const current = store.getState().story;
  const definition = current?.definition;
  if (!definition) return;
  const existing =
    current?.structure?.backCover?.image?.dataUrl ||
    current?.structure?.backCover?.image?.url;
  if (existing) return;
  // Prefer prompt produced by the back cover summary result if present
  const summaryPrompt =
    current?.structure?.backCover?.image?.prompt &&
    typeof current.structure.backCover.image.prompt === 'string'
      ? current.structure.backCover.image.prompt.trim()
      : '';
  const basePrompt =
    (summaryPrompt && summaryPrompt.length > 0
      ? summaryPrompt
      : (definition.image?.prompt?.trim() || buildBackCoverPromptFromDefinition(definition)));
  if (!basePrompt || basePrompt.length === 0) return;
  try {
    const resp = await fetch('/api/story/cover-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: basePrompt }),
    });
    if (!resp.ok) {
      throw new Error(`Back cover image request failed (${resp.status})`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await resp.json();
    const mimeType: string = typeof data?.mimeType === 'string' && data.mimeType ? data.mimeType : 'image/png';
    const base64: string | undefined = data?.imageBase64;
    if (!base64 || typeof base64 !== 'string' || base64.length === 0) {
      throw new Error('Invalid back cover image data returned');
    }
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const structure = current?.structure || buildDefaultStructure();
    const updatedBackCover = {
      ...(structure.backCover || { summary: '' }),
      image: {
        ...(structure.backCover?.image || {}),
        dataUrl,
        mimeType,
        prompt: basePrompt,
        alt: definition.title ? `${definition.title} - Back Cover` : 'Back Cover',
      },
    };
    store.updateStory({
      structure: ({ ...structure, backCover: updatedBackCover } as unknown as StoryStructure),
    });
    // Cache in-memory
    cacheImageDataUrl(getBackCoverKey(), dataUrl, mimeType);
    // Update DOM immediately if element is present
    const backCoverImage = document.getElementById('backCoverImage') as HTMLImageElement | null;
    if (backCoverImage) {
      backCoverImage.src = dataUrl;
      backCoverImage.alt = updatedBackCover.image?.alt || backCoverImage.alt;
    }
  } catch {
    // Silent failure; CSS gradient fallback remains
  }
}

/**
 * Build a square scene illustration prompt for a specific page.
 * Prioritises page.image.prompt, then derives from definition + page text.
 */
function buildScenePromptFromPage(definition: StoryDefinition, page: StoryPage, pageIndex: number): string {
  const fallback = page.image?.prompt?.trim();
  if (fallback && fallback.length > 0) return `${fallback}, square 1:1, illustration, cohesive with cover`;
  const title = definition.title?.trim();
  const genre = definition.genre?.trim();
  const theme = definition.theme?.trim();
  const location = definition.location?.trim();
  const period = definition.timePeriod?.trim();
  const protagonist = definition.protagonist?.name?.trim();
  const antagonist = definition.antagonist?.name?.trim();
  const excerpt = (page.text || '').split('\n').join(' ').slice(0, 220);
  const parts = [
    title ? `"${title}" scene ${pageIndex + 1}` : 'Story scene',
    genre ? `genre: ${genre}` : '',
    theme ? `theme: ${theme}` : '',
    location ? `setting: ${location}` : '',
    period ? `time period: ${period}` : '',
    protagonist ? `protagonist: ${protagonist}` : '',
    antagonist ? `antagonist: ${antagonist}` : '',
    excerpt ? `depict: ${excerpt}` : '',
  ].filter(Boolean).join(', ');
  const composition = ', detailed, rich lighting, illustration, square 1:1, no text overlay';
  return `${parts}${composition}`;
}

/**
 * Create a compact loading overlay for image containers with a progress bar.
 */
function createImageLoadingOverlay(): { overlay: HTMLElement; barFill: HTMLElement } {
  const overlay = document.createElement('div');
  overlay.className = 'image-loading';
  const bar = document.createElement('div');
  bar.className = 'image-progress';
  const barFill = document.createElement('div');
  barFill.className = 'image-progress__fill';
  bar.appendChild(barFill);
  overlay.appendChild(bar);
  return { overlay, barFill };
}

/**
 * Simulate progress to ~92% while work is in-flight; caller finalizes at 100%.
 */
function startSimulatedProgress(barFill: HTMLElement): { stop: () => void; set: (pct: number) => void } {
  // Clear any previous interval attached to this bar to avoid duplicate timers
  const existingIdRaw = (barFill as HTMLElement & { dataset: DOMStringMap }).dataset.simIntervalId;
  if (existingIdRaw) {
    const existingId = Number(existingIdRaw);
    if (!Number.isNaN(existingId)) {
      window.clearInterval(existingId);
    }
  }
  // Initialize progress from current width if present to avoid jumps backwards
  const currentWidth = (barFill.style && typeof barFill.style.width === 'string' && barFill.style.width.trim().endsWith('%'))
    ? Number(barFill.style.width.replace('%', '').trim())
    : NaN;
  let progress = Number.isFinite(currentWidth) ? Math.max(0, Math.min(92, Math.floor(currentWidth))) : 8;
  const id = window.setInterval(() => {
    progress = Math.min(92, progress + Math.max(1, Math.floor(Math.random() * 4)));
    barFill.style.width = `${progress}%`;
  }, 220);
  (barFill as HTMLElement & { dataset: DOMStringMap }).dataset.simIntervalId = String(id);
  return {
    stop: () => {
      window.clearInterval(id);
      // Only clear dataset if it still points to this interval id
      const current = (barFill as HTMLElement & { dataset: DOMStringMap }).dataset.simIntervalId;
      if (current === String(id)) {
        delete (barFill as HTMLElement & { dataset: DOMStringMap }).dataset.simIntervalId;
      }
    },
    set: (pct: number) => { barFill.style.width = `${Math.max(0, Math.min(100, Math.floor(pct))) }%`; },
  };
}

/**
 * Ensure/generate an image for a given story page index, update store + DOM if provided.
 */
async function maybeGeneratePageImageIfMissing(pageIndex: number, imageWrapEl?: HTMLElement, imgEl?: HTMLImageElement): Promise<void> {
  const current = store.getState().story;
  const structure = current?.structure;
  const definition = current?.definition;
  if (!structure || !definition) return;
  const pages = structure.pages || [];
  if (pageIndex < 0 || pageIndex >= pages.length) return;
  const page = pages[pageIndex];
  const existing = page?.image?.dataUrl || page?.image?.url;
  const alt = page?.image?.alt || 'Story scene';
  const cacheKey = getPageKeyById(page.id);
  // Serve from cache when available
  const cached = getCachedImageDataUrl(cacheKey);
  if (cached && imgEl) {
    let overlay = imageWrapEl?.querySelector('.image-loading') as HTMLElement | null;
    let barFill = overlay?.querySelector('.image-progress__fill') as HTMLElement | null;
    if (!overlay || !barFill) {
      const ui = createImageLoadingOverlay();
      overlay = ui.overlay;
      barFill = ui.barFill;
      if (imageWrapEl) imageWrapEl.appendChild(overlay);
    }
    imageWrapEl?.classList.add('loading');
    const simCached = startSimulatedProgress(barFill!);
    imgEl.loading = 'lazy';
    imgEl.setAttribute('decoding', 'async');
    imgEl.alt = alt;
    imgEl.src = cached;
    // Hide loader as soon as a valid src is set
    imageWrapEl?.classList.remove('loading');
    if (imgEl.complete && imgEl.naturalHeight !== 0) {
      simCached.stop();
      barFill!.style.width = '100%';
      overlay && window.setTimeout(() => overlay!.remove(), 120);
      imageWrapEl?.classList.remove('loading');
      return;
    }
    imgEl.onload = () => {
      simCached.stop();
      barFill!.style.width = '100%';
      overlay && window.setTimeout(() => overlay!.remove(), 120);
      imageWrapEl?.classList.remove('loading');
    };
    imgEl.onerror = () => {
      simCached.stop();
      overlay?.classList.add('error');
      window.setTimeout(() => {
        try { overlay?.remove(); } catch {}
        imageWrapEl?.classList.remove('loading');
      }, 220);
    };
    try {
      if (typeof (imgEl as any).decode === 'function') {
        (imgEl as any).decode().then(() => {
          simCached.stop();
          barFill!.style.width = '100%';
          overlay && window.setTimeout(() => overlay!.remove(), 120);
          imageWrapEl?.classList.remove('loading');
        }).catch(() => {
          // fall back to onload/onerror
        });
      }
    } catch {
      // ignore decode support issues
    }
    return;
  }
  // If we already have a URL/dataUrl, just bind it to the DOM img if provided
  if (existing) {
    if (imgEl) {
      // Reuse existing overlay if present, otherwise create one
      let overlay = imageWrapEl?.querySelector('.image-loading') as HTMLElement | null;
      let barFill = overlay?.querySelector('.image-progress__fill') as HTMLElement | null;
      if (!overlay || !barFill) {
        const ui = createImageLoadingOverlay();
        overlay = ui.overlay;
        barFill = ui.barFill;
        if (imageWrapEl) imageWrapEl.appendChild(overlay);
      }
      imageWrapEl?.classList.add('loading');
      const sim = startSimulatedProgress(barFill!);
      imgEl.loading = 'lazy';
      imgEl.setAttribute('decoding', 'async');
      imgEl.alt = alt;
      let handled = false;
      const handleLoaded = () => {
        if (handled) return;
        handled = true;
        sim.stop();
        barFill!.style.width = '100%';
        if (overlay) window.setTimeout(() => overlay!.remove(), 180);
        imageWrapEl?.classList.remove('loading');
        // Cache if dataUrl; else attempt conversion and persist
        if (isDataUrl(existing)) {
          cacheImageDataUrl(cacheKey, existing, page.image?.mimeType);
        } else if (!page.image?.dataUrl) {
          fetchUrlAsDataUrl(existing).then(result => {
            if (!result) return;
            const updatedPagesConv = pages.slice();
            updatedPagesConv[pageIndex] = {
              ...page,
              image: {
                ...(page.image || {}),
                dataUrl: result.dataUrl,
                mimeType: result.mimeType,
                alt,
              } as unknown as StoryPage['image'],
            };
            store.updateStory({
              structure: ({ ...structure, pages: updatedPagesConv } as unknown as StoryStructure),
            });
            cacheImageDataUrl(cacheKey, result.dataUrl, result.mimeType);
          }).catch(() => {});
        }
      };
      const handleError = () => {
        if (handled) return;
        handled = true;
        sim.stop();
        overlay?.classList.add('error');
        window.setTimeout(() => {
          try { overlay?.remove(); } catch {}
          imageWrapEl?.classList.remove('loading');
        }, 220);
      };
      imgEl.onload = handleLoaded;
      imgEl.onerror = handleError;
      imgEl.src = existing;
      // Hide loader as soon as a valid src is set
      imageWrapEl?.classList.remove('loading');
      if (imgEl.complete && imgEl.naturalHeight !== 0) {
        handleLoaded();
      }
      try {
        if (typeof (imgEl as any).decode === 'function') {
          (imgEl as any).decode().then(handleLoaded).catch(handleLoaded);
        }
      } catch {
        // ignore
      }
    }
    return;
  }
  // Generate via backend using prompt derived from page + definition
  const prompt = buildScenePromptFromPage(definition, page, pageIndex);
  // Attach loader UI if DOM provided
  let overlay: HTMLElement | null = null;
  let sim: { stop: () => void; set: (pct: number) => void } | null = null;
  let barFill: HTMLElement | null = null;
  if (imageWrapEl && imgEl) {
    // Reuse existing overlay if present, otherwise create one
    overlay = imageWrapEl.querySelector('.image-loading') as HTMLElement | null;
    barFill = overlay?.querySelector('.image-progress__fill') as HTMLElement | null;
    if (!overlay || !barFill) {
      const ui = createImageLoadingOverlay();
      overlay = ui.overlay;
      barFill = ui.barFill;
      imageWrapEl.appendChild(overlay);
    }
    imageWrapEl.classList.add('loading');
    sim = startSimulatedProgress(barFill!);
  }
  try {
    const resp = await fetch('/api/agents/image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!resp.ok) {
      throw new Error(`Page image request failed (${resp.status})`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await resp.json();
    const mimeType: string = typeof data?.mimeType === 'string' && data.mimeType ? data.mimeType : 'image/png';
    const base64: string | undefined = data?.imageBase64;
    if (!base64 || typeof base64 !== 'string' || base64.length === 0) {
      throw new Error('Invalid page image data returned');
    }
    const dataUrl = `data:${mimeType};base64,${base64}`;
    // Persist into store
    const updatedPages = pages.slice();
    updatedPages[pageIndex] = {
      ...page,
      image: {
        ...(page.image || {}),
        dataUrl,
        mimeType,
        prompt,
        alt,
      } as unknown as StoryPage['image'],
    };
    store.updateStory({
      structure: ({ ...structure, pages: updatedPages } as unknown as StoryStructure),
    });
    cacheImageDataUrl(cacheKey, dataUrl, mimeType);
    // Bind to DOM if applicable
    if (imgEl) {
      imgEl.loading = 'lazy';
      imgEl.setAttribute('decoding', 'async');
      imgEl.alt = alt;
      let handled = false;
      const handleLoaded = () => {
        if (handled) return;
        handled = true;
        if (sim && barFill) {
          sim.stop();
          barFill.style.width = '100%';
        }
        if (overlay) {
          window.setTimeout(() => overlay!.remove(), 180);
        }
        imageWrapEl?.classList.remove('loading');
      };
      const handleError = () => {
        if (handled) return;
        handled = true;
        if (sim) sim.stop();
        if (overlay) overlay.classList.add('error');
        window.setTimeout(() => {
          try { overlay?.remove(); } catch {}
          imageWrapEl?.classList.remove('loading');
        }, 220);
      };
      imgEl.onload = handleLoaded;
      imgEl.onerror = handleError;
      imgEl.src = dataUrl;
      // Hide loader as soon as a valid src is set
      imageWrapEl?.classList.remove('loading');
      if (imgEl.complete && imgEl.naturalHeight !== 0) {
        handleLoaded();
      }
      try {
        if (typeof (imgEl as any).decode === 'function') {
          (imgEl as any).decode().then(handleLoaded).catch(handleLoaded);
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    if (overlay) {
      overlay.classList.add('error');
      window.setTimeout(() => {
        try { overlay.remove(); } catch {}
        imageWrapEl?.classList.remove('loading');
      }, 240);
    } else {
      imageWrapEl?.classList.remove('loading');
    }
    throw err;
  }
}

/**
 * Given a DOM page index (includes cover at 0), return data page index (0-based).
 */
function mapDomToDataIndex(domIndex: number): number {
  return Math.max(0, domIndex - 1);
}

/**
 * Ensure the image for the given DOM page element is loaded/generated.
 */
async function ensureDomPageImageLoaded(domPageEl: HTMLElement, domIndex: number): Promise<void> {
  if (!domPageEl) return;
  if (domPageEl.dataset.page !== 'story') return;
  const imageWrap = domPageEl.querySelector<HTMLElement>('.story-image');
  const imgEl = imageWrap?.querySelector('img') as HTMLImageElement | null;
  if (!imageWrap || !imgEl) return;
  // Guard: if this image is already loading or loaded, avoid starting a second loader
  const hasOverlay = !!imageWrap.querySelector('.image-loading');
  const isLoadingClass = imageWrap.classList.contains('loading');
  const hasSrc = typeof imgEl.src === 'string' && imgEl.src.length > 0;
  const isLoaded = imgEl.complete && imgEl.naturalHeight !== 0;
  const isStillLoading = hasSrc && !isLoaded;
  if (hasOverlay || isLoadingClass || isLoaded || isStillLoading) {
    return;
  }
  const dataIndex = mapDomToDataIndex(domIndex);
  await maybeGeneratePageImageIfMissing(dataIndex, imageWrap, imgEl);
}

/**
 * While on the front cover, begin warming the first page image and back cover.
 */
async function warmupImagesOnCover(): Promise<void> {
  try {
    const current = store.getState().story;
    const structure = current?.structure;
    if (!structure) return;
    // Preload/generate first page image
    if (structure.pages && structure.pages.length > 0) {
      await maybeGeneratePageImageIfMissing(0);
    }
    // Defer any back cover generation until the final page is reached
  } catch {
    // best-effort; ignore
  }
}

function createInlineLoadingOverlay(message: string): HTMLElement {
  // Remove any existing overlay to avoid duplicates
  const existing = document.getElementById('story-opening-overlay');
  if (existing && existing.parentElement) {
    existing.parentElement.removeChild(existing);
  }
  const overlay = document.createElement('div');
  overlay.id = 'story-opening-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15, 14, 12, 0.78)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '2147483000';
  overlay.style.pointerEvents = 'auto';
  // Lock page scroll while overlay is present
  overlay.dataset.prevHtmlOverflow = document.documentElement.style.overflow || '';
  overlay.dataset.prevBodyOverflow = document.body.style.overflow || '';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  const panel = document.createElement('div');
  // Fullscreen content container centered
  panel.style.background = 'transparent';
  panel.style.width = '100%';
  panel.style.height = '100%';
  panel.style.padding = '0';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.alignItems = 'center';
  panel.style.justifyContent = 'center';
  panel.style.gap = '16px';

  const barWrap = document.createElement('div');
  barWrap.id = 'inline-loading-bar';
  barWrap.style.width = 'min(720px, 80vw)';
  barWrap.style.height = '14px';
  barWrap.style.background = 'rgba(243, 244, 246, 0.9)';
  barWrap.style.borderRadius = '999px';
  barWrap.style.overflow = 'hidden';
  const barFill = document.createElement('div');
  barFill.id = 'inline-loading-bar-fill';
  barFill.style.width = '20%';
  barFill.style.height = '100%';
  barFill.style.background = '#111827';
  barFill.style.transition = 'width 260ms ease';
  barFill.style.borderRadius = '999px';
  barWrap.appendChild(barFill);

  const text = document.createElement('div');
  text.id = 'inline-loading-message';
  text.textContent = message;
  text.style.fontSize = '18px';
  text.style.fontWeight = '700';
  text.style.letterSpacing = '0.2px';
  text.style.color = 'rgba(255,255,255,0.95)';
  text.style.textAlign = 'center';

  panel.appendChild(barWrap);
  panel.appendChild(text);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  let progress = 24;
  const id = window.setInterval(() => {
    progress = Math.min(94, progress + Math.max(1, Math.floor(Math.random() * 5)));
    barFill.style.width = `${progress}%`;
  }, 260);
  overlay.dataset.intervalId = String(id);
  return overlay;
}

function removeInlineLoadingOverlay(overlay: HTMLElement | null): void {
  if (!overlay) return;
  const idRaw = overlay.dataset.intervalId;
  if (idRaw) {
    window.clearInterval(Number(idRaw));
  }
  // Restore page scroll state
  const prevHtmlOverflow = overlay.dataset.prevHtmlOverflow ?? '';
  const prevBodyOverflow = overlay.dataset.prevBodyOverflow ?? '';
  document.documentElement.style.overflow = prevHtmlOverflow;
  document.body.style.overflow = prevBodyOverflow;
  if (overlay.parentElement) {
    overlay.parentElement.removeChild(overlay);
  }
}

/**
 * Loading overlay helpers
 */
function setOverlayMessage(overlay: HTMLElement, message: string): void {
  const msgEl = overlay.querySelector('#inline-loading-message') as HTMLElement | null;
  if (msgEl) msgEl.textContent = message;
}

function setOverlayError(overlay: HTMLElement, message: string): void {
  setOverlayMessage(overlay, message);
  const barFill = overlay.querySelector('#inline-loading-bar-fill') as HTMLElement | null;
  if (barFill) {
    barFill.style.background = '#b91c1c'; // red-700
    barFill.style.width = '100%';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Flip the final page, then replace background back with back cover content
 * No next page will appear - right side stays empty
 */
async function flipToBackCover(): Promise<void> {
  // Ensure any narration is stopped before flipping to back cover
  stopCoverAudio();
  stopPageAudio();
  const pagesNow = getPages();
  const currentPage = pagesNow[currentPageIndex];
  
  if (!currentPage) {
    console.error('No current page found');
    return;
  }
  
  // Get the back cover image URL to use for the flip animation
  const backCoverImage = document.getElementById('backCoverImage') as HTMLImageElement;
  let backCoverImageUrl = backCoverImage?.src || '';
  
  // If back cover image not set yet, set it up first
  if (!backCoverImageUrl) {
    await setupBackCover();
    // Re-get the URL after setup
    const updatedBackCoverImage = document.getElementById('backCoverImage') as HTMLImageElement;
    const updatedBackCoverImageUrl = updatedBackCoverImage?.src || '';
    
    if (updatedBackCoverImageUrl) {
      currentPage.style.setProperty('--back-cover-image-url', `url("${updatedBackCoverImageUrl}")`);
    }
  } else {
    currentPage.style.setProperty('--back-cover-image-url', `url("${backCoverImageUrl}")`);
  }
  // Ensure a loading overlay on the back cover art while it finishes loading
  try { attachBackCoverImageProgress(); } catch { /* ignore */ }
  
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
  // Stop any ongoing narration before flipping
  stopCoverAudio();
  stopPageAudio();
  console.log('Flipping to next page');
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
    // Ensure the newly active page image is loaded/generated
    ensureDomPageImageLoaded(nextPage, currentPageIndex + 1).catch(() => {});
    // Start narration for the newly active page
    const nextDomIndex = currentPageIndex + 1;
    void startPageNarrationForDomIndex(nextDomIndex);
    
    currentPageIndex++;
    // Telemetry: track page flip to data page index
    try {
      const dataIndex = mapDomToDataIndex(currentPageIndex);
      const storyNow = store.getState().story;
      const pageId = storyNow?.structure?.pages?.[dataIndex]?.id;
      trackStorylineEvent('pageFlip', { pageIndex: dataIndex, pageId });
    } catch {
      // ignore telemetry failure
    }
  }, 1200); // Match animation duration
}

/**
 * Generate the next story page for a selected option, append it, then flip
 */
async function generateNextPageAndFlip(selectedOptionId: string, inlineOverlay?: HTMLElement): Promise<void> {
  console.log('Generating next page and flipping');
  const story = store.getState().story;
  const definition = story?.definition;
  const structure = story?.structure;
  if (!definition || !structure) {
    console.log('No definition or structure found, flipping to next page');
    flipToNextPage();
    return;
  }
  const currentPages = structure.pages || [];
  // Map DOM page index (includes cover at 0) to data page index (first story page at 0)
  const dataPageIndex = Math.max(0, Math.min(currentPages.length - 1, currentPageIndex - 1));
  console.log('Index mapping', { domIndex: currentPageIndex, dataIndex: dataPageIndex, totalDataPages: currentPages.length });
  const currentPage = currentPages[dataPageIndex];
  if (!currentPage) {
    console.log('No current page found, flipping to next page');
    flipToNextPage();
    return;
  }
  // Resolve selected option from top-level or nested branch options
  let selectedOption = currentPage.options.find(o => o.id === selectedOptionId);
  if (!selectedOption) {
    for (const opt of currentPage.options) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const act: any = opt.action;
      if (act?.type === 'branch' && Array.isArray(act.options)) {
        const nested = act.options.find((o: OptionObject) => o.id === selectedOptionId);
        if (nested) {
          selectedOption = nested;
          break;
        }
      }
    }
  }
  if (!selectedOption) {
    console.log('No selected option found in current page or branch options');
    throw new Error('Selected option not found on current page');
  }

  // Track the user's selection for telemetry
  try {
    const optionText = selectedOption.text;
    const pageEl = document.querySelectorAll<HTMLElement>('.page')[currentPageIndex] as HTMLElement | null;
    trackOptionSelection({
      pageId: currentPage.id,
      pageIndex: dataPageIndex,
      optionId: selectedOption.id,
      optionText,
      pageType: pageEl ? (getPageType(pageEl) as 'conversation' | 'single-option' | 'multiple-options' | 'static') : undefined,
    });
  } catch {
    // ignore telemetry failure
  }

  const overlay = inlineOverlay || createInlineLoadingOverlay('Generating next page...');
  const nextIndex = currentPages.length; // next page is appended
  const nextPage = await fetchNextStoryPage(definition, selectedOption, nextIndex);
  // Persist to store
  const updatedPages = currentPages.concat(nextPage);
  store.updateStory({
    structure: {
      frontCover: structure.frontCover,
      pages: updatedPages,
    } as StoryStructure,
  });
  // Track page generation
  trackStorylineEvent('pageGenerated', { pageId: nextPage.id, pageIndex: nextIndex });
  // Append to DOM and prepare for flip
  if (!bookContainer) {
    bookContainer = document.querySelector<HTMLElement>('.book-container');
  }
  if (bookContainer) {
    // Determine if the appended page should be the final page based on configuration
    const cfg = store.getState().story?.configuration;
    const policy = getPagePolicy(cfg?.length);
    const isFinalNext = nextIndex >= (policy.maxPages - 1);
    const el = buildStoryPageElement(nextPage, isFinalNext);
    bookContainer.appendChild(el);
    // Attach handlers on newly added buttons
    attachOptionHandlers(el);
    // Begin loading the new page's image in the background
    const domIndex = getPages().length - 1;
    ensureDomPageImageLoaded(el as HTMLElement, domIndex).catch(() => {});
  }
  // Flip only after success
  flipToNextPage();
}

/**
 * Fetch next story page (step) using the selected option as previousOption
 */
async function fetchNextStoryPage(definition: StoryDefinition, previousOption: OptionObject, stepIndex?: number): Promise<StoryPage> {
  const cfg = store.getState().story?.configuration;
  const response = await fetch('/api/story/step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ definition, previousOption, stepIndex, configuration: cfg }),
  });
  if (!response.ok) {
    throw new Error(`Story page request failed (${response.status})`);
  }
  const data = (await response.json()) as StoryPage;
  return data;
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
async function handleOptionClick(event: Event): Promise<void> {
  // Ensure we don't double-handle the same click
  if (event.defaultPrevented) return;
  event.preventDefault();
  if (typeof (event as any).stopImmediatePropagation === 'function') {
    (event as any).stopImmediatePropagation();
  }
  event.stopPropagation();
  // Support both direct handlers and delegated (document-level) handlers
  let button = event.currentTarget as HTMLButtonElement | null;
  if (!button || !(button instanceof HTMLButtonElement) || !button.classList.contains('story-option')) {
    const maybeBtn = (event.target as HTMLElement | null)?.closest('.story-option') as HTMLButtonElement | null;
    if (!maybeBtn) return;
    button = maybeBtn;
  }
  const optionsContainer = button.parentElement;
  
  if (!optionsContainer) return;

  // Check if this is the last option (story ending)
  const isLastOption = button.dataset.isLast === 'true';
  
  // Get page type for appropriate handling
  const pageElement = button.closest('.page') as HTMLElement;
  const pageType = getPageType(pageElement);

  // Debug: log option click details
  try {
    const optionText = (button.querySelector('.option-text') as HTMLElement | null)?.textContent
      ?? button.textContent?.trim()
      ?? '';
    console.log('[Story] Option clicked', {
      optionId: button.dataset.option,
      optionText,
      pageType,
      currentPageIndex,
    });
  } catch {
    // no-op for logging errors
  }

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
    // If this is the top-level branch option, inject its branch text into the conversation response
    try {
      const current = store.getState().story;
      const pages = current?.structure?.pages ?? [];
      const dataPageIndex = Math.max(0, Math.min(pages.length - 1, currentPageIndex - 1));
      const pageData = pages[dataPageIndex];
      const topOptionId = button.dataset.option || '';
      const topOption = pageData?.options?.find(o => o.id === topOptionId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const action: any = topOption?.action;
      const branchText: string | undefined = action?.type === 'branch' ? action?.text : undefined;
      const textEl = (pageElement || document).querySelector('.conversation-response .conversation-text') as HTMLElement | null;
      if (textEl && typeof branchText === 'string' && branchText.trim().length > 0) {
        textEl.textContent = branchText;
        // Telemetry: record branch prompt reveal
        try {
          trackStorylineEvent('branchRevealed', { pageId: pageData?.id, pageIndex: dataPageIndex, note: 'Conversation branch prompt shown' });
        } catch {
          // ignore telemetry failure
        }
      }
    } catch {
      // ignore
    }
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
    // Non-conversation page: generate the next page from the selected option, then flip
    // If this is a final-page option, go directly to back cover
    if (isLastOption) {
      const overlay = createInlineLoadingOverlay('Finalizing your book...');
      try {
        await setupBackCover();
        flipToBackCover();
      } finally {
        removeInlineLoadingOverlay(overlay);
      }
      return;
    }
    const selectedOptionId = button.dataset.option || '';
    console.log('[Story] Showing loader for next page');
    const overlay = createInlineLoadingOverlay('Generating next page...');
    try {
      await generateNextPageAndFlip(selectedOptionId, overlay);
    } catch (err) {
      console.error('[Story] Next page generation failed', err);
      setOverlayError(overlay, 'Failed to generate next page. Please try again.');
      // Re-enable options so user can retry
      optionsContainer.querySelectorAll('.story-option').forEach(btn => {
        (btn as HTMLButtonElement).disabled = false;
        (btn as HTMLElement).classList.remove('disabled', 'fade-out', 'hidden');
      });
      button.classList.remove('selected');
      // Briefly show the error state
      await delay(900);
    } finally {
      removeInlineLoadingOverlay(overlay);
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
 * Start a brand new story: clear current state/metadata and navigate to creation screen
 */
function startNewStory(): void {
  const btn = document.getElementById('newStoryButton');
  if (btn) {
    btn.classList.add('loading');
  }
  try {
    // Clear store and metadata
    store.clear();
    try { localStorage.removeItem('storyMetadata'); } catch { /* ignore */ }
  } finally {
    // Navigate to story creation page
    window.location.href = '/index.html';
  }
}

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

/**
 * Redact large/base64 fields from story state for debug display and clipboard copy.
 */
function redactStoryForDebug(story: Story | null): unknown {
  if (!story) return story;
  // Use a JSON replacer to strip/shorten heavy fields
  // - Remove image.dataUrl entirely
  // - Preserve prompt/alt/metadata
  const replacer = (key: string, value: unknown) => {
    if (key === 'dataUrl' && typeof value === 'string') {
      // Replace with a compact descriptor to avoid leaking base64
      const preview = value.startsWith('data:') ? value.slice(0, Math.min(value.indexOf(';base64,'), 64)) : '';
      return preview ? `${preview};base64,[redacted]` : '[redacted dataUrl]';
    }
    return value;
  };
  return JSON.parse(JSON.stringify(story, replacer));
}

function updateDebugContent(): void {
  const contentEl = document.getElementById(DEBUG_IDS.content);
  if (!contentEl) return;
  const storyState = store.getState().story;
  const redacted = redactStoryForDebug(storyState);
  (contentEl as HTMLElement).textContent = JSON.stringify(redacted, null, 2);
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
      const redacted = redactStoryForDebug(storyState);
      await navigator.clipboard?.writeText(JSON.stringify(redacted, null, 2));
    } catch {
      // no-op
    }
  });
});

/**
 * Attach an inline loading overlay with progress to the back cover image
 * if it is still loading. Safe to call multiple times; will reuse overlay.
 */
function attachBackCoverImageProgress(): void {
  const backCover = document.querySelector('.back-cover') as HTMLElement | null;
  const img = document.getElementById('backCoverImage') as HTMLImageElement | null;
  if (!backCover || !img) return;
  // If already loaded, nothing to do
  if (img.complete && img.naturalHeight !== 0) return;
  // Reuse or create overlay
  let overlay = backCover.querySelector('.image-loading') as HTMLElement | null;
  let barFill = overlay?.querySelector('.image-progress__fill') as HTMLElement | null;
  if (!overlay || !barFill) {
    const ui = createImageLoadingOverlay();
    overlay = ui.overlay;
    barFill = ui.barFill;
    backCover.appendChild(overlay);
  }
  backCover.classList.add('loading');
  const sim = startSimulatedProgress(barFill!);
  const finishOk = () => {
    sim.stop();
    barFill!.style.width = '100%';
    window.setTimeout(() => {
      try { overlay!.remove(); } catch { /* ignore */ }
      backCover.classList.remove('loading');
    }, 160);
  };
  const finishErr = () => {
    sim.stop();
    overlay!.classList.add('error');
    window.setTimeout(() => {
      try { overlay!.remove(); } catch { /* ignore */ }
      backCover.classList.remove('loading');
    }, 240);
  };
  // If already complete but dims not yet known, try decode to finalize quickly
  if (typeof (img as any).decode === 'function') {
    (img as any).decode().then(finishOk).catch(() => {
      // fallback to events
    });
  }
  if (img.complete) {
    // If the browser thinks it's complete but dimensions are 0, rely on events
    if (img.naturalHeight !== 0) {
      finishOk();
      return;
    }
  }
  img.addEventListener('load', finishOk, { once: true });
  img.addEventListener('error', finishErr, { once: true });
}

/**
 * Derive page policy from configuration length
 */
function getPagePolicy(length: 'small' | 'medium' | 'long' | undefined): { minPages: number; maxPages: number } {
  switch (length) {
    case 'small':
      return { minPages: 3, maxPages: 5 };
    case 'long':
      return { minPages: 10, maxPages: 16 };
    case 'medium':
    default:
      return { minPages: 6, maxPages: 10 };
  }
}

/**
 * Generate and persist a back cover summary via backend if missing
 */
async function maybeGenerateBackCoverSummaryIfMissing(): Promise<void> {
  const current = store.getState().story;
  const definition = current?.definition;
  const structure = current?.structure;
  if (!definition) return;
  const existing = structure?.backCover?.summary;
  if (existing && existing.trim().length > 0) return;
  try {
    const cfg = current?.configuration;
    const resp = await fetch('/api/story/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definition,
        pages: (structure?.pages || []).map(p => ({ id: p.id, text: p.text })),
        configuration: cfg,
      }),
    });
    if (!resp.ok) {
      throw new Error(`Back cover summary request failed (${resp.status})`);
    }
    const data = await resp.json();
    const summary: string = typeof data?.summary === 'string' ? data.summary : '';
    if (!summary || summary.trim().length === 0) return;
    // Persist summary and any provided image metadata (prompt/alt)
    const imageObj = (data && typeof data === 'object' && data.image && typeof data.image === 'object')
      ? {
          prompt: typeof data.image.prompt === 'string' ? data.image.prompt : undefined,
          alt: typeof data.image.alt === 'string' ? data.image.alt : undefined,
        }
      : undefined;
    const updatedStructure = { ...(structure || { frontCover: {}, pages: [] }) } as unknown as StoryStructure;
    const nextBackCover = {
      ...(updatedStructure.backCover || { summary: '' }),
      summary,
      image: {
        ...(updatedStructure.backCover?.image || {}),
        ...(imageObj || {}),
      },
    };
    updatedStructure.backCover = nextBackCover;
    store.updateStory({ structure: updatedStructure });
    // If present in DOM, fill immediately
    const summaryText = document.getElementById('storySummary');
    if (summaryText) {
      summaryText.textContent = summary;
    }
  } catch {
    // fall back silently
  }
}

