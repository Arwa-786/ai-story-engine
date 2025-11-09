#!/bin/bash

# Script to play all test audio files

cd "$(dirname "$0")"

echo "🎵 Playing Test Audio Files"
echo "============================"
echo ""

# Check if files exist
if ! ls test-audio-*.mp3 1> /dev/null 2>&1; then
  echo "❌ No test audio files found in backend directory"
  echo "   Run ./test-speech.sh first to generate audio files"
  exit 1
fi

# Play each file
for file in test-audio-*.mp3; do
  if [ -f "$file" ] && [ -s "$file" ]; then
    FILE_SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    echo "▶️  Playing: $file (${FILE_SIZE} bytes)"
    open "$file"
    sleep 2  # Wait 2 seconds between files
  else
    echo "⚠️  Skipping empty file: $file"
  fi
done

echo ""
echo "✅ Done! All audio files have been opened in your default player"
echo ""
echo "Note: If files are very small (< 100 bytes), they might be error responses"
echo "      Make sure your .env file is configured correctly"

