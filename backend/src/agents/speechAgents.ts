// This is your new file: backend/src/agents/speechAgent.ts

// This tells TypeScript what's in your 'env'
export interface Env {
    ELEVENLABS_TOKEN: string;
    // These are for your AI Gateway
    AI_GATEWAY_ACCOUNT_ID: string;
    AI_GATEWAY_ID: string;
  }

// Genre to Voice ID mapping based on genre characteristics
const GENRE_VOICE_MAP: Record<string, string> = {
  // Adventure: Warm, engaging narration for exciting journeys
  adventure: "JBFqnCBsd6RMkjVDRZzb", // George - male, middle aged, British, warm, narration
  
  // Fantasy: Intense, character-driven voice for magical worlds
  fantasy: "N2lVS1w4EtoT3dr4eOWO", // Callum - male, middle-aged, Transatlantic, intense, characters
  
  // SciFi: Authoritative, news-like voice for futuristic stories
  scifi: "cjVigY5qzO86Huf0OWal", // Daniel - male, middle-aged, British, authoritative, news
  
  // Horror: Old, trustworthy narration for spooky tales
  horror: "pqHfZKP75CvOlQylNhV4", // Bill - male, old, American, trustworthy, narration
  
  // Mystery: Old, trustworthy narration for detective stories
  mystery: "pqHfZKP75CvOlQylNhV4", // Bill - male, old, American, trustworthy, narration
  
  // Romance: Soft, gentle voice for love stories
  romance: "EXAVITQu4vr4xnSDxMaL", // Sarah - female, young, American, soft, news
  
  // Comedy: Expressive, energetic voice for funny stories
  comedy: "9BWtsMINqrJLrRacOk9x", // Aria - female, middle-aged, American, expressive, social media
  
  // Drama: Friendly, warm narration for emotional stories
  drama: "SAz9YHcvj6GT2YYXdXww", // Matilda - female, middle-aged, American, friendly, narration
  
  // Action: Intense, character-driven voice for fast-paced stories
  action: "N2lVS1w4EtoT3dr4eOWO", // Callum - male, middle-aged, Transatlantic, intense, characters
  
  // Historical: British, warm narration for period stories
  historical: "JBFqnCBsd6RMkjVDRZzb", // George - male, middle aged, British, warm, narration
};

// Default voice ID (used when genre is not specified or doesn't match)
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George - safe default for narration

/**
 * Get voice ID based on genre
 * @param genre - The genre string (e.g., "adventure", "fantasy", "scifi", etc.)
 * @returns The corresponding voice ID or default if genre not found
 */
function getVoiceIdForGenre(genre?: string): string {
  if (!genre) {
    return DEFAULT_VOICE_ID;
  }
  
  const normalizedGenre = genre.toLowerCase().trim();
  return GENRE_VOICE_MAP[normalizedGenre] || DEFAULT_VOICE_ID;
}

// This is the function you will call from index.ts
export async function generateSpeech(text: string, env: Env, genre?: string): Promise<Response> {
  // Get the appropriate voice ID based on genre
  const voiceId = getVoiceIdForGenre(genre);
  
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/elevenlabs/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  const body = {
    text: text, // Use the text passed into the function
    model_id: "eleven_multilingual_v2",
  };

  const headers = {
    'Content-Type': 'application/json',
    // The Worker securely adds the key. The browser never sees it.
    'xi-api-key': env.ELEVENLABS_TOKEN,
  };

  // Make the API call to the AI Gateway
  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  // Check if the API call was successful
  if (!response.ok) {
    const errorText = await response.text();
    // Return a clear error with proper content type
    return new Response(`ElevenLabs API Error: ${errorText}`, { 
      status: response.status || 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  // Send the audio stream directly back
  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  });
}