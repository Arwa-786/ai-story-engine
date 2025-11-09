# Story Untold

Interactive AI-powered story maker built with TypeScript and Vite. Create beautiful, branching narratives with dynamic page flips, multiple page types, and AI-generated content.

## 🚀 Quick Start

### Setup

Install dependencies:
```bash
npm install
```

### Development

Start the dev server:
```bash
npm run dev
```

Opens at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Output in `dist/` folder.

## 📁 Project Structure

```
story-untold/
├── src/
│   ├── types/
│   ├── types.ts              # Core type definitions
│   ├── index.ts              # Story creation page logic
│   └── story.ts              # Story display & interaction logic
├── docs/
│   ├── FEATURES.md           # Complete feature documentation
│   └── PAGE_TYPES.md         # Page types reference guide
├── index.html                # Story creation page
├── story.html                # Story reading experience
├── test-flip.html            # Test page for all page types
├── styles.css                # Creation page styles
├── story-styles.css          # Story book styles
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
└── package.json              # Dependencies & scripts
```

## 📖 Features

- **Beautiful Book UI** - Classic book design with page flip animations
- **Multiple Page Types** - Cover, branching story pages (single/multiple options), conversations, endings
- **Dynamic Back Cover** - Automatically generated with story summary and metadata
- **PDF Export (placeholder)** - Feature planned; currently a no-op button
- **Responsive Design** - Works on desktop, tablet, and mobile
- **TypeScript** - Fully typed codebase for reliability
- **AI Integration Ready** - Built to integrate with Gemini API and image generation

## 🎯 Usage

### Creating a Story

1. Open `index.html` in your browser
2. Choose between Custom (your own story) or Random (select a genre)
3. Configure length, density, and image model
4. Enter your Gemini API key
5. Click "Create Story"

### Reading a Story

- Click on the cover to begin
- Make choices as they appear
- Experience different page types
- Reach the ending to see the back cover with story summary

### Testing

Open `test-flip.html` to see all page types in action with detailed examples.

## 📚 Documentation

- **[FEATURES.md](docs/FEATURES.md)** - Complete feature list and capabilities
- **[PAGE_TYPES.md](docs/PAGE_TYPES.md)** - Guide to all supported page types

## 🔧 Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

## 🛠️ Technical Stack

- **Frontend**: TypeScript, HTML5, CSS3
- **Build Tool**: Vite
- **PDF Export**: TBD
- **AI Integration**: Gemini API (planned)
- **Image Generation**: Nanobanana/imagegen (planned)

## 📝 License

MIT

---

**Built by Team A from SharkByte**  
*Powered by Story Untold*
