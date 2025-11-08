# Page Types Documentation

This document describes the different page types supported by the AI Story Engine and how to implement them.

## Overview

The story engine supports multiple page types to create dynamic, interactive narratives. Each page type has specific behavior and timing optimized for the best user experience.

## Page Types

### 1. Cover Page (`data-page="cover"`)

**Purpose:** The front cover of the book  
**Behavior:** Click anywhere to flip to the next page  
**Features:**
- Full-screen background image
- Title and subtitle
- "Tap to Continue" hint

**Example:**
```html
<div class="page active" data-page="cover">
    <div class="book-cover">
        <img class="book-cover-image" src="..." alt="Cover">
        <div class="cover-content">
            <h1 class="book-title">Story Title</h1>
            <div class="cover-subtitle">Subtitle</div>
            <div class="tap-hint">Tap to Continue</div>
        </div>
    </div>
</div>
```

### 2. Chapter Title Page (`data-page="chapter"`)

**Purpose:** Introduce a new chapter  
**Behavior:** Click anywhere to flip to the next page  
**Features:**
- Chapter number
- Chapter title
- Optional tagline
- Elegant typography

**Example:**
```html
<div class="page" data-page="chapter">
    <div class="page-content">
        <div class="book-header">
            <div class="book-title-small">Book Title</div>
        </div>
        <div class="chapter-title-page">
            <div class="chapter-number">Chapter I</div>
            <h2 class="chapter-title">Chapter Name</h2>
            <p class="chapter-tagline">Chapter description</p>
        </div>
    </div>
</div>
```

### 3. Single Option Page (`data-page-type="single-option"`)

**Purpose:** Linear narrative with one path forward  
**Behavior:** Auto-flips 400ms after option selection  
**Best For:** Story continuation, acknowledgments, information delivery  

**Example:**
```html
<div class="page" data-page="story" data-page-type="single-option">
    <div class="page-content">
        <div class="page-header">
            <span class="chapter-name">Chapter Name</span>
        </div>
        
        <div class="story-content">
            <div class="story-text">
                <p>Your story content here...</p>
            </div>
            
            <div class="story-image">
                <img src="..." alt="Scene">
            </div>
            
            <div class="story-options">
                <button class="story-option" data-option="1">
                    <span class="option-text">Continue</span>
                </button>
            </div>
        </div>
    </div>
</div>
```

### 4. Multiple Options Page (`data-page-type="multiple-options"`)

**Purpose:** Branching narrative with choices  
**Behavior:** Auto-flips 600ms after option selection  
**Best For:** Decision points, moral choices, path selection  

**Example:**
```html
<div class="page" data-page="story" data-page-type="multiple-options">
    <div class="page-content">
        <div class="page-header">
            <span class="chapter-name">Chapter Name</span>
        </div>
        
        <div class="story-content">
            <div class="story-text">
                <p>You face a critical decision...</p>
            </div>
            
            <div class="story-image">
                <img src="..." alt="Scene">
            </div>
            
            <div class="story-options">
                <button class="story-option" data-option="1">
                    <span class="option-text">Option A</span>
                </button>
                <button class="story-option" data-option="2">
                    <span class="option-text">Option B</span>
                </button>
                <button class="story-option" data-option="3">
                    <span class="option-text">Option C</span>
                </button>
            </div>
        </div>
    </div>
</div>
```

### 5. Conversation Page (`data-page-type="conversation"`)

**Purpose:** Multi-step interactions on the same page  
**Behavior:** 
1. First choice reveals hidden response
2. Page scrolls to show response
3. Second choice flips to next page (400-600ms delay)

**Best For:** Dialogues, interrogations, negotiations  

**Example:**
```html
<div class="page" data-page="story" data-page-type="conversation">
    <div class="page-content">
        <div class="page-header">
            <span class="chapter-name">Chapter Name</span>
        </div>
        
        <div class="story-content">
            <div class="story-text">
                <p>A mysterious figure approaches...</p>
            </div>
            
            <div class="story-image">
                <img src="..." alt="Scene">
            </div>
            
            <!-- Initial options -->
            <div class="story-options">
                <button class="story-option" data-option="1">
                    <span class="option-text">Greet them</span>
                </button>
                <button class="story-option" data-option="2">
                    <span class="option-text">Stay silent</span>
                </button>
            </div>

            <!-- Hidden response - revealed after first choice -->
            <div class="conversation-response hidden">
                <div class="response-divider"></div>
                <div class="story-text response-text">
                    <p><strong>You:</strong> "Greetings!"</p>
                    <p>They respond: "Well met, traveler..."</p>
                </div>
                
                <!-- Follow-up options -->
                <div class="story-options">
                    <button class="story-option" data-option="3">
                        <span class="option-text">Ask for help</span>
                    </button>
                    <button class="story-option" data-option="4">
                        <span class="option-text">Continue on your way</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
```

### 6. Ending Page (with `data-is-last="true"`)

**Purpose:** Final story page before back cover  
**Behavior:** 
1. Auto-flips 1000ms after option selection (longer for dramatic effect)
2. Triggers back cover reveal
3. Book centers to show back cover

**Example:**
```html
<div class="page" data-page="story" data-page-type="ending">
    <div class="page-content">
        <div class="page-header">
            <span class="chapter-name">Chapter Name</span>
        </div>
        
        <div class="story-content">
            <div class="story-text">
                <p>Your journey comes to an end...</p>
            </div>
            
            <div class="story-image">
                <img src="..." alt="The End">
            </div>
            
            <div class="story-options">
                <button class="story-option" data-option="1" data-is-last="true">
                    <span class="option-text">Complete the journey</span>
                </button>
            </div>
        </div>
    </div>
</div>
```

### 7. Back Cover Page (`data-page="back-cover"`)

**Purpose:** Story summary and credits  
**Behavior:** 
- Automatically populated with story metadata
- Book container centers to reveal the full back cover
- Shows duration, creation date, and author credits

**Features:**
- Full-screen background image
- Story summary
- Author information (User, AI, Team A from SharkByte)
- Publication date
- Story duration
- Team credits

**Example:**
```html
<div class="page" data-page="back-cover">
    <div class="back-cover">
        <img class="back-cover-image" src="..." alt="Back Cover">
        <div class="back-cover-content">
            <div class="story-summary">
                <h2 class="summary-title">About This Story</h2>
                <p class="summary-text" id="storySummary">
                    Story summary text...
                </p>
            </div>
            
            <div class="book-metadata">
                <div class="metadata-section">
                    <div class="metadata-label">Written by</div>
                    <div class="metadata-value" id="backCoverAuthorValue">
                        <div class="author-line" id="backCoverPrimaryAuthor">You (Story Creator)</div>
                        <div class="author-line">AI (Story Generator)</div>
                        <div class="author-line">Team A from SharkByte</div>
                    </div>
                </div>
                
                <div class="metadata-section">
                    <div class="metadata-label">Published</div>
                    <div class="metadata-value" id="publishDate"></div>
                </div>
                
                <div class="metadata-section">
                    <div class="metadata-label">Story Duration</div>
                    <div class="metadata-value" id="storyDuration"></div>
                </div>
            </div>
        </div>
    </div>
</div>
```

## Timing Guidelines

| Page Type | Flip Delay | Purpose |
|-----------|------------|---------|
| Single Option | 400ms | Quick, natural progression |
| Multiple Options | 600ms | Time to read choice before flip |
| Conversation (follow-up) | 400-600ms | Depends on context |
| Ending | 1000ms | Dramatic pause before finale |
| Response Reveal | 500ms | Smooth conversation flow |

## Auto-Detection

The system can auto-detect page types based on content:
- If page has `.conversation-response`: `conversation`
- If page has 1 option: `single-option`
- If page has 2+ options: `multiple-options`
- Otherwise: `static`

However, explicitly setting `data-page-type` is recommended for clarity and predictability.

## Best Practices

1. **Use appropriate page types** for the narrative moment
2. **Mark the last story page** with `data-is-last="true"` on options
3. **Keep single-option pages brief** - they advance quickly
4. **Use conversations sparingly** - they're engaging but require more content
5. **Provide clear option text** - users should understand their choice
6. **Include images** on story pages for visual engagement
7. **Test the flow** - use test-flip.html to verify timing and transitions

## Testing

Visit `/test-flip.html` to see all page types in action with detailed examples and explanations.

