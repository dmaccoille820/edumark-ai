
const apiKey = process.env.ABAIR_API_KEY || 'ac22b5562b311404dae8d2b2e8e1bd4f35ef6a9295634952520ee13868edf8f3';

async function testAbair() {
  const res = await globalThis.fetch('https://api.abair.ie/v4/synthesis', {
    method: 'POST',
    headers: {
      'abair-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: 'Dia duit, conas atá tú inniu?',
      voice: 'anb.piper',
      speed: 1,
    }),
  });

  console.log('Status:', res.status, res.headers.get('content-type'));
  const data = await res.json();
  console.log('Keys in response:', Object.keys(data));
  if (data.audioContent) {
    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    console.log('Decoded audioBuffer length:', audioBuffer.length);
    console.log('Header hex:', audioBuffer.slice(0, 16).toString('hex'));
    console.log('Header ascii:', audioBuffer.slice(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));
  }
}
testAbair().catch(console.error);
