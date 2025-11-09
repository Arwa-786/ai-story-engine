import { generateAudio } from '../../backend/_BACKUP/src/agents/audioAgent.js';
import { generateImage } from '../../backend/_BACKUP/src/agents/imageAgent.js';

async function testFunctions() {
  console.log('Testing AI Story Engine Agents...\n');

  // Test Image Generation
  console.log('1. Testing Image Generation...');
  try {
    const imageUrl = await generateImage('a mystical forest');
    console.log('✅ Image generated:', imageUrl.substring(0, 50) + '...');
  } catch (error) {
    console.error('❌ Image generation failed:', error);
  }

  // Test Audio Generation
  console.log('\n2. Testing Audio Generation...');
  try {
    const audioUrl = await generateAudio('Hello, this is a test.');
    console.log('✅ Audio generated:', audioUrl);
  } catch (error) {
    console.error('❌ Audio generation failed:', error);
  }

  console.log('\n✅ All tests completed!');
}

testFunctions();
