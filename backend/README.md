# Backend Service

This service orchestrates AI-powered text generation using Cloudflare AI Gateway with Google Gemini models.

## Prerequisites

- Node.js 18+ (for native `fetch` support and `ts-node` ESM loader)
- npm

## Installation

```bash
cd /Users/samarminana/Documents/GitHub/Untitled/ai-story-engine/backend
npm install
```

## Environment Configuration

Create `/Users/samarminana/Documents/GitHub/Untitled/ai-story-engine/.env` with the required configuration:

```
# Server Configuration
PORT=3000

# Cloudflare AI Gateway Configuration (Required)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_AI_GATEWAY_ID=your_gateway_id

# Google AI Studio Configuration (Required for Cloudflare Gateway)
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL_ID=gemini-2.0-flash-exp

# Optional: Additional Configuration
# CLOUDFLARE_AI_GATEWAY_KEY=your_cf_token_here  # If your gateway requires authentication
# TEXT_AGENT_HASH_MODELS_DEFAULT=gemini-2.0-flash-exp,gemini-1.5-flash-latest
# TEXT_AGENT_HASH_TEMPERATURE=0.7
# TEXT_AGENT_HASH_MAX_OUTPUT_TOKENS=1024
```

> The system uses Cloudflare AI Gateway to access Google's Gemini models. You need both Cloudflare Gateway credentials and a Google AI Studio API key.

## Development

```bash
npm run dev
```

The server listens on `http://localhost:3000` and exposes the text generation endpoints:
- `POST http://localhost:3000/api/text/generate` - Hash-based text generation
- `POST http://localhost:3000/api/agents/text` - Text agent endpoint
- `POST http://localhost:3000/api/agents/image` - Image generation endpoint
- `POST http://localhost:3000/api/agents/audio` - Audio generation endpoint

## Type Checking

```bash
npx tsc --noEmit
```

## API Usage

The text generation endpoints expect a POST request with hash-based inputs:

```json
{
  "inputs": {
    "topic": "example topic",
    "style": "formal"
  },
  "instructions": "Generate content based on the inputs"
}
```

