# Backend Service

This service orchestrates AI-powered branching story generation and exposes the `/api/story` HTTP endpoints. It can run against multiple model providers, currently Google Gemini and Cloudflare Workers AI.

## Prerequisites

- Node.js 18+ (for native `fetch` support and `ts-node` ESM loader)
- npm

## Installation

```bash
cd /Users/samarminana/Documents/GitHub/Untitled/ai-story-engine/backend
npm install
```

## Environment Configuration

Create `/Users/samarminana/Documents/GitHub/Untitled/ai-story-engine/.env` with the appropriate secrets for the provider you plan to use.

### Shared

```
PORT=3000
AI_PROVIDER=cloudflare      # Options: cloudflare, gemini (defaults to gemini)
ENABLE_HYBRID_ENRICH=false  # When true and GEMINI_API_KEY is set, enriches Cloudflare output with Gemini
```

### Google Gemini

```
GEMINI_API_KEY=your_api_key
GEMINI_MODEL_ID=gemini-1.5-pro-latest
# Optional overrides for enrichment agents
# GEMINI_TEXT_MODEL_ID=gemini-1.5-pro-latest
# GEMINI_TEXT_MAX_OUTPUT_TOKENS=1024
# GEMINI_TEXT_TEMPERATURE=0.7
```

### Cloudflare Workers AI

```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=token_with_ai_gateway_scope
CLOUDFLARE_MODEL=@cf/meta/llama-3.1-70b-instruct
```

> The Workers AI token needs access to the AI Gateway for the specified account. Adjust the `CLOUDFLARE_MODEL` slug to target a different deployed model if required.

## Development

```bash
npm run dev
```

The server listens on `http://localhost:3000` and exposes the story orchestration endpoint at `http://localhost:3000/api/story/start`.

## Type Checking

```bash
npx tsc --noEmit
```

## Switching Providers

Set `AI_PROVIDER` in `.env` and restart the server.

- `gemini` (default): Gemini orchestrates and enriches the entire story tree.
- `cloudflare`: Workers AI produces the branching structure, then the backend automatically uses Gemini agents (if `GEMINI_API_KEY` is present) to enrich node prose. Keep both the Cloudflare and Gemini secrets populated to run in hybrid mode.

