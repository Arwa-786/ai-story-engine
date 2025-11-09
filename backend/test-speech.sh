#!/bin/bash

# Test script for the speech generation endpoint
# Make sure the backend server is running on port 3000

BASE_URL="http://localhost:3000"
ENDPOINT="${BASE_URL}/api/speech/generate"

echo "🎤 Testing Speech Generation Endpoint"
echo "======================================"
echo ""

# Test 1: Basic speech generation without genre
echo "Test 1: Basic speech generation (default voice)"
echo "-------------------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test of the speech generation system."}' \
  --output test-audio-default.mp3 \
  --write-out "\nHTTP Status: %{http_code}\nContent-Type: %{content_type}\n" \
  -s

if [ -f "test-audio-default.mp3" ]; then
  echo "✅ Audio file saved as: test-audio-default.mp3"
  echo ""
else
  echo "❌ Failed to generate audio"
  echo ""
fi

# Test 2: Speech generation with genre (Fantasy)
echo "Test 2: Speech generation with genre (Fantasy)"
echo "-----------------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"text": "In a land far away, magic flows through every tree and stone.", "genre": "fantasy"}' \
  --output test-audio-fantasy.mp3 \
  --write-out "\nHTTP Status: %{http_code}\nContent-Type: %{content_type}\n" \
  -s

if [ -f "test-audio-fantasy.mp3" ]; then
  echo "✅ Audio file saved as: test-audio-fantasy.mp3"
  echo ""
else
  echo "❌ Failed to generate audio"
  echo ""
fi

# Test 3: Speech generation with genre (Horror)
echo "Test 3: Speech generation with genre (Horror)"
echo "-----------------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"text": "The shadows whispered secrets that should never be spoken.", "genre": "horror"}' \
  --output test-audio-horror.mp3 \
  --write-out "\nHTTP Status: %{http_code}\nContent-Type: %{content_type}\n" \
  -s

if [ -f "test-audio-horror.mp3" ]; then
  echo "✅ Audio file saved as: test-audio-horror.mp3"
  echo ""
else
  echo "❌ Failed to generate audio"
  echo ""
fi

# Test 4: Error handling - empty text
echo "Test 4: Error handling (empty text)"
echo "-------------------------------------"
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d '{"text": ""}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -20

echo ""
echo "======================================"
echo "✅ All tests completed!"
echo ""
echo "To play the audio files:"
echo "  - macOS: open test-audio-*.mp3"
echo "  - Linux: mpg123 test-audio-*.mp3 or vlc test-audio-*.mp3"
echo "  - Windows: start test-audio-*.mp3"
echo ""

