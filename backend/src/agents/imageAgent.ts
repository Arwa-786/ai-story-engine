// backend/src/agents/imageAgent.ts
import axios from 'axios';

// 🚨 DANGER: REPLACE THIS WITH YOUR REAL GEMINI KEY
const GEMINI_API_KEY = "AIzaSyDUuyKT1WEhodle9m12u-IPIOudxWatGJ8"; 

export async function generateImage(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "AIzaSyDUuyKT1WEhodle9m12u-IPIOudxWatGJ8") {
      return `https://via.placeholder.com/1024x576.png?text=ERROR%20KEY%20MISSING`;
  }
  
  const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages";

  try {
    const fullPrompt = `Cinematic video game concept art of a ${prompt}. Focus on lighting and high-quality detail.`;

    const response = await axios.post(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
      },
      { timeout: 30000 } 
    );

    // The API returns image data encoded in base64 within the JSON response.
    const image_data = response.data.generatedImages[0].image.imageBytes;
    
    if (image_data) {
      // Returns the image as a Data URL for the frontend
      return `data:image/jpeg;base64,${image_data}`;
    } else {
      throw new Error("Gemini did not return a valid image.");
    }
    
  } catch (error: any) {
    console.error("Gemini Image Generation Error:", error.response?.data || error.message);
    return `https://via.placeholder.com/1024x576.png?text=ERROR%20API%20FAIL`;
  }
}