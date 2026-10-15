import { generateIrishAudio } from './ttsService.js';

async function testRateLimit() {
  const tests = [
    { id: 'rate_1', text: 'Seo an chéad cheist le haghaidh tástála.' },
    { id: 'rate_2', text: 'Seo an dara ceist le haghaidh tástála.' },
    { id: 'rate_3', text: 'Seo an tríú ceist le haghaidh tástála.' },
    { id: 'rate_4', text: 'Seo an ceathrú ceist le haghaidh tástála.' },
    { id: 'rate_5', text: 'Seo an cúigiú ceist le haghaidh tástála.' },
  ];

  for (const t of tests) {
    const start = Date.now();
    console.log(`Starting ${t.id}...`);
    const res = await generateIrishAudio(t.text, t.id);
    console.log(`Finished ${t.id} in ${Date.now() - start}ms: res=${res}`);
  }
  process.exit(0);
}
testRateLimit().catch(console.error);
