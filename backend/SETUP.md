# Quick Setup Guide

## Step 1: Create/Update .env file

Create or edit `backend/.env` with your credentials:

```env
# ElevenLabs API Token (get from https://elevenlabs.io)
ELEVENLABS_TOKEN=your_elevenlabs_token_here

# Cloudflare AI Gateway Configuration
CLOUDFLARE_ACCOUNT_ID=5e616d704e8aeb6ad3ec3e06f3274d28
CLOUDFLARE_AI_GATEWAY_ID=first

# Optional: Server Port (defaults to 3000)
PORT=3000
```

## Step 2: Run the Server

### Development Mode (recommended - auto-reloads on changes):
```bash
cd backend
npm run dev
```

### Production Mode:
```bash
cd backend
npm start
```

You should see: `Backend listening on http://localhost:3000`

## Step 3: Test It

### Quick Health Check:
```bash
curl http://localhost:3000/
# Should return: {"status":"ok"}
```

### Test Speech Generation:
```bash
curl -X POST http://localhost:3000/api/speech/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test!", "genre": "fantasy"}' \
  --output test.mp3
```

### Or use the test script:
```bash
cd backend
./test-speech.sh
```

## Troubleshooting

- **Port already in use**: Change `PORT` in `.env` or kill the process: `lsof -ti:3000 | xargs kill`
- **Missing env variables**: Make sure `.env` file exists in `backend/` directory
- **Module not found**: Run `npm install` again

