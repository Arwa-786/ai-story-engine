// backend/src/agents/audioAgent.ts
import axios from "axios";

// NOTE: axios library needs to be installed by the team lead (npm install axios)
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY; 
// Replace this with your actual ElevenLabs Voice ID
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

export async function generateAudio(text: string): Promise<string> {
  const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  const historyUrl = "https://api.elevenlabs.io/v1/history";

  try {
    // Step 1: Generate the audio. The API stores the file in your ElevenLabs history.
    await axios.post(
      ttsUrl,
      {
        text: text,
        model_id: "eleven_multilingual_v2",
      },
      {
        headers: { "xi-api-key": ELEVEN_API_KEY },
        responseType: 'arraybuffer', // Indicates we expect an audio file, not JSON
      }
    );

    // Step 2: Query the history to get the permanent download URL
    const historyResponse = await axios.get(historyUrl, {
      headers: { "xi-api-key": ELEVEN_API_KEY },
    });

    // Step 3: Return the download URL of the most recently created file
    if (historyResponse.data.history.length > 0) {
      return historyResponse.data.history[0].download_url;
    } else {
      throw new Error("Could not find audio in history.");
    }

  } catch (error: any) {
    console.error("Error generating audio:", error.message);
    throw new Error("Failed to generate audio.");
  }
}