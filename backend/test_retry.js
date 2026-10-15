const apiKey = 'ac22b5562b311404dae8d2b2e8e1bd4f35ef6a9295634952520ee13868edf8f3';

async function synthesizeWithRetry(text, id, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch('https://api.abair.ie/v4/synthesis', {
      method: 'POST',
      headers: {
        'abair-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        voice: 'anb.piper',
        speed: 1,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return `Success on attempt ${attempt}, bytes=${data.audioContent?.length}`;
    }

    console.warn(`Attempt ${attempt} failed with ${res.status}. Waiting 600ms before retry...`);
    await new Promise(r => setTimeout(r, 600));
  }
  return 'Failed all attempts';
}

async function test() {
  const texts = [
    'Seo an chéad cheist.',
    'Seo an dara ceist.',
    'Seo an tríú ceist.',
    'Seo an ceathrú ceist.',
    'Seo an cúigiú ceist.'
  ];
  for (let i = 0; i < texts.length; i++) {
    console.log(`Running item ${i + 1}...`);
    const r = await synthesizeWithRetry(texts[i], `q_${i}`);
    console.log(`Result ${i + 1}:`, r);
    // Add small pacing delay
    await new Promise(res => setTimeout(res, 400));
  }
  process.exit(0);
}
test().catch(console.error);
