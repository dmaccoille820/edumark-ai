import { generateEnglishAudio } from './ttsService.js';

async function testEn() {
  console.log('Testing generateEnglishAudio...');
  const res = await generateEnglishAudio('This is a test question for audio generation.', 'test_debug_en');
  console.log('Result:', res);
}
testEn().catch(console.error);
