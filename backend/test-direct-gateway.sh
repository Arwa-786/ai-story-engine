#!/bin/bash

# Direct test of Cloudflare Gateway + ElevenLabs
# This tests the gateway directly without going through our backend

# Configuration - UPDATE THESE VALUES
ACCOUNT_ID="5e616d704e8aeb6ad3ec3e06f3274d28"
GATEWAY_NAME="first"
VOICE_ID="JBFqnCBsd6RMkjVDRZzb"  # George - default voice
ELEVENLABS_TOKEN="${ELEVENLABS_TOKEN:-YOUR_TOKEN_HERE}"

# Check if token is set
if [ "$ELEVENLABS_TOKEN" = "YOUR_TOKEN_HERE" ] || [ -z "$ELEVENLABS_TOKEN" ]; then
  echo "❌ Error: ELEVENLABS_TOKEN environment variable not set"
  echo ""
  echo "Please set it:"
  echo "  export ELEVENLABS_TOKEN='your_actual_token'"
  echo ""
  echo "Or run:"
  echo "  ELEVENLABS_TOKEN='your_token' ./test-direct-gateway.sh"
  exit 1
fi

GATEWAY_URL="https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/elevenlabs/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128"

echo "🎤 Testing Cloudflare Gateway + ElevenLabs Directly"
echo "===================================================="
echo ""
echo "Account ID: ${ACCOUNT_ID}"
echo "Gateway: ${GATEWAY_NAME}"
echo "Voice ID: ${VOICE_ID} (George - default)"
echo ""

# Test 1: Basic text
echo "Test 1: Basic text generation"
echo "-------------------------------"
curl -X POST "${GATEWAY_URL}" \
  --header 'content-type: application/json' \
  --header "xi-api-key: ${ELEVENLABS_TOKEN}" \
  --data '{
    "text": "Welcome to Cloudflare - AI Gateway!",
    "model_id": "eleven_multilingual_v2"
}' \
  --output test-direct-gateway.mp3 \
  --write-out "\nHTTP Status: %{http_code}\nContent-Type: %{content_type}\n" \
  -s

if [ -f "test-direct-gateway.mp3" ] && [ -s "test-direct-gateway.mp3" ]; then
  FILE_SIZE=$(stat -f%z test-direct-gateway.mp3 2>/dev/null || stat -c%s test-direct-gateway.mp3 2>/dev/null)
  echo "✅ Audio file saved: test-direct-gateway.mp3 (${FILE_SIZE} bytes)"
  echo ""
else
  echo "❌ Failed to generate audio or file is empty"
  echo ""
fi

# Test 2: Different text
echo "Test 2: Different text"
echo "-----------------------"
curl -X POST "${GATEWAY_URL}" \
  --header 'content-type: application/json' \
  --header "xi-api-key: ${ELEVENLABS_TOKEN}" \
  --data '{
    "text": "This is a test of the speech generation system through Cloudflare AI Gateway.",
    "model_id": "eleven_multilingual_v2"
}' \
  --output test-direct-gateway-2.mp3 \
  --write-out "\nHTTP Status: %{http_code}\nContent-Type: %{content_type}\n" \
  -s

if [ -f "test-direct-gateway-2.mp3" ] && [ -s "test-direct-gateway-2.mp3" ]; then
  FILE_SIZE=$(stat -f%z test-direct-gateway-2.mp3 2>/dev/null || stat -c%s test-direct-gateway-2.mp3 2>/dev/null)
  echo "✅ Audio file saved: test-direct-gateway-2.mp3 (${FILE_SIZE} bytes)"
  echo ""
else
  echo "❌ Failed to generate audio or file is empty"
  echo ""
fi

echo "===================================================="
echo "✅ Direct gateway tests completed!"
echo ""
echo "To play the audio files:"
echo "  - macOS: open test-direct-gateway*.mp3"
echo "  - Linux: mpg123 test-direct-gateway*.mp3"
echo ""

