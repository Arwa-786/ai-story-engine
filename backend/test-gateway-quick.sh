#!/bin/bash

# Quick test using your actual gateway configuration
# Based on your curl command

ACCOUNT_ID="5e616d704e8aeb6ad3ec3e06f3274d28"
GATEWAY_NAME="first"
VOICE_ID="JBFqnCBsd6RMkjVDRZzb"

# Get token from environment or prompt
if [ -z "$ELEVENLABS_TOKEN" ]; then
  echo "Please set ELEVENLABS_TOKEN environment variable:"
  echo "  export ELEVENLABS_TOKEN='your_token_here'"
  exit 1
fi

GATEWAY_URL="https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_NAME}/elevenlabs/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128"

echo "Testing your Cloudflare Gateway configuration..."
echo ""

curl -X POST "${GATEWAY_URL}" \
  --header 'content-type: application/json' \
  --header "xi-api-key: ${ELEVENLABS_TOKEN}" \
  --data '{
    "text": "Welcome to Cloudflare - AI Gateway!",
    "model_id": "eleven_multilingual_v2"
}' \
  --output test-gateway.mp3 \
  --write-out "\n✅ HTTP Status: %{http_code}\n" \
  -v 2>&1 | grep -E "(HTTP|Content-Type|xi-api-key|text|model_id)"

if [ -f "test-gateway.mp3" ] && [ -s "test-gateway.mp3" ]; then
  FILE_SIZE=$(stat -f%z test-gateway.mp3 2>/dev/null || stat -c%s test-gateway.mp3 2>/dev/null)
  echo ""
  echo "✅ Success! Audio file created: test-gateway.mp3 (${FILE_SIZE} bytes)"
  echo "   Play it with: open test-gateway.mp3"
else
  echo ""
  echo "❌ Failed - check the error messages above"
fi

