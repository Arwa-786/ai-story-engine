# Speech Generation API - Setup and Testing Guide

## Prerequisites

1. **Environment Variables**: Make sure you have a `.env` file (in the project root or `backend/` directory) with the following variables:

```env
# ElevenLabs API Token
ELEVENLABS_TOKEN=your_elevenlabs_api_token_here

# Cloudflare AI Gateway Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_AI_GATEWAY_ID=your_cloudflare_gateway_id

# Optional: Server Port (defaults to 3000)
PORT=3000
```

2. **Install Dependencies**: Make sure all dependencies are installed:
```bash
cd backend
npm install
```

## Running the Server

### Development Mode (with auto-reload):
```bash
cd backend
npm run dev
```

### Production Mode:
```bash
cd backend
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## Testing the Speech Endpoint

### Option 1: Using the Test Script

1. Make sure the server is running
2. Make the test script executable:
```bash
chmod +x backend/test-speech.sh
```

3. Run the test script:
```bash
cd backend
./test-speech.sh
```

This will create test audio files for different genres.

### Option 2: Using curl

#### Basic Test (Default Voice):
```bash
curl -X POST http://localhost:3000/api/speech/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test of the speech generation system."}' \
  --output test-audio.mp3
```

#### Test with Genre (Fantasy):
```bash
curl -X POST http://localhost:3000/api/speech/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "In a land far away, magic flows through every tree and stone.", "genre": "fantasy"}' \
  --output test-audio-fantasy.mp3
```

#### Test with Genre (Horror):
```bash
curl -X POST http://localhost:3000/api/speech/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "The shadows whispered secrets that should never be spoken.", "genre": "horror"}' \
  --output test-audio-horror.mp3
```

### Option 3: Using JavaScript/TypeScript

```javascript
const response = await fetch('http://localhost:3000/api/speech/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Your text here',
    genre: 'fantasy' // Optional: adventure, fantasy, scifi, horror, mystery, romance, comedy, drama, action, historical
  })
});

if (response.ok) {
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
} else {
  const error = await response.json();
  console.error('Error:', error);
}
```

## Available Genres

The following genres are supported (case-insensitive):

- `adventure` - George (British, warm narration)
- `fantasy` - Callum (Intense, character-driven)
- `scifi` - Daniel (Authoritative, news-like)
- `horror` - Bill (Old, trustworthy narration)
- `mystery` - Bill (Old, trustworthy narration)
- `romance` - Sarah (Soft, gentle voice)
- `comedy` - Aria (Expressive, energetic)
- `drama` - Matilda (Friendly, warm narration)
- `action` - Callum (Intense, character-driven)
- `historical` - George (British, warm narration)

If no genre is provided, it defaults to George (warm narration).

## API Endpoint Details

**Endpoint**: `POST /api/speech/generate`

**Request Body**:
```json
{
  "text": "The text you want to convert to speech",
  "genre": "fantasy" // Optional
}
```

**Response**: 
- Success: Audio stream (MP3 format, `audio/mpeg`)
- Error: JSON object with error message

**Status Codes**:
- `200` - Success (audio stream)
- `400` - Bad request (invalid text)
- `500` - Server configuration error (missing env variables)
- `502` - Speech generation failed

## Troubleshooting

### Server won't start
- Check that all dependencies are installed: `npm install`
- Verify your `.env` file exists and has the required variables
- Check the console for error messages

### "Missing required environment variables" error
- Make sure your `.env` file has:
  - `ELEVENLABS_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_AI_GATEWAY_ID`

### Audio generation fails
- Verify your ElevenLabs API token is valid
- Check that your Cloudflare AI Gateway is properly configured
- Check the server console logs for detailed error messages

### Port already in use
- Change the `PORT` in your `.env` file
- Or kill the process using port 3000: `lsof -ti:3000 | xargs kill`

## Health Check

You can check if the server is running:
```bash
curl http://localhost:3000/
```

Should return: `{"status":"ok"}`

