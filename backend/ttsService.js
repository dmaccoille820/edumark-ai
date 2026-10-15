import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import textToSpeech from '@google-cloud/text-to-speech';

// Cloudflare R2 Client setup
const r2AccountId = process.env.R2_ACCOUNT_ID?.replace(/["']/g, '');
const r2BucketName = process.env.R2_BUCKET_NAME?.replace(/["']/g, '') || 'edumark';
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID?.replace(/["']/g, '');
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.replace(/["']/g, '');

let r2Client = null;
if (r2AccountId && r2AccessKeyId && r2SecretAccessKey) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });
}

// Google Cloud Text-to-Speech Client
let googleTtsClient = null;
try {
  let options = {};
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      let raw = process.env.GOOGLE_CREDENTIALS.trim();
      if (raw.startsWith('"') && raw.endsWith('"')) {
        raw = JSON.parse(raw);
      }
      const creds = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (creds && creds.private_key) {
        let key = creds.private_key;
        key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
        const header = '-----BEGIN PRIVATE KEY-----';
        const footer = '-----END PRIVATE KEY-----';
        if (key.includes(header) && key.includes(footer)) {
          const body = key.replace(header, '').replace(footer, '').replace(/\s+/g, '');
          const formattedBody = body.match(/.{1,64}/g)?.join('\n') || body;
          key = `${header}\n${formattedBody}\n${footer}\n`;
        }
        creds.private_key = key;
        options = { credentials: creds, projectId: creds.project_id || process.env.GOOGLE_CLOUD_PROJECT };
      }
    } catch (e) {
      // Fallback to ADC
    }
  }
  googleTtsClient = new textToSpeech.TextToSpeechClient(options);
} catch (err) {
  console.warn('[TTS] Google Cloud TTS Client initialization warning:', err.message);
}

/**
 * Uploads an audio buffer to Cloudflare R2
 */
export async function uploadToR2(buffer, key, contentType = 'audio/mpeg') {
  if (!r2Client) {
    console.warn('[TTS] R2 client not configured. Skipping upload.');
    return null;
  }

  const command = new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // If a public custom domain is configured, use it; otherwise use the proxy route /api/audio/:key
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/["']/g, '').replace(/\/$/, '');
  if (publicBaseUrl && !publicBaseUrl.includes('.r2.cloudflarestorage.com')) {
    return `${publicBaseUrl}/${key}`;
  }

  // Fallback to internal API streaming route
  return `/api/audio/${encodeURIComponent(key)}`;
}

/**
 * Retrieves an audio stream from Cloudflare R2
 */
export async function getFromR2(key) {
  if (!r2Client) return null;
  const command = new GetObjectCommand({
    Bucket: r2BucketName,
    Key: key,
  });
  return await r2Client.send(command);
}

/**
 * Synthesize Irish audio using Abair API v4 (Ulster Female: anb.piper)
 */
export async function generateIrishAudio(textGa, questionId) {
  const apiKey = process.env.ABAIR_API_KEY?.replace(/["']/g, '');
  if (!apiKey) {
    console.warn('[TTS] ABAIR_API_KEY is not configured.');
    return null;
  }

  // Clean / sanitize text: remove diagram/figure tokens like [DFD image]
  const cleanText = (textGa || '').replace(/\[.*?\]/g, '').trim();
  if (!cleanText) return null;

  // Retry with backoff to handle Abair gateway concurrency / 500 limits
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.abair.ie/v4/synthesis', {
        method: 'POST',
        headers: {
          'abair-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: cleanText,
          voice: 'anb.piper', // Uladh / Ulster female voice (Áine)
          speed: 1,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[TTS] Abair API error (attempt ${attempt}/3, status ${res.status}):`, errText);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 600 * attempt));
          continue;
        }
        return null;
      }

      const data = await res.json();
      if (!data?.audioContent) {
        console.error(`[TTS] Abair returned no audioContent for question ${questionId}`);
        return null;
      }

      // Abair v4 returns base64-encoded WAV binary data in audioContent
      const buffer = Buffer.from(data.audioContent, 'base64');
      const key = `audio/questions/${questionId}_ga.wav`;

      return await uploadToR2(buffer, key, 'audio/wav');
    } catch (err) {
      console.warn(`[TTS] Irish audio attempt ${attempt} failed for question ${questionId}:`, err.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 600 * attempt));
      } else {
        return null;
      }
    }
  }
  return null;
}


/**
 * Synthesize English audio using Google Cloud Text-to-Speech
 */
export async function generateEnglishAudio(textEn, questionId) {
  const cleanText = (textEn || '').replace(/\[.*?\]/g, '').trim();
  if (!cleanText) return null;

  try {
    let client = googleTtsClient || new textToSpeech.TextToSpeechClient();
    let response;
    try {
      [response] = await client.synthesizeSpeech({
        input: { text: cleanText },
        voice: {
          languageCode: 'en-GB',
          name: 'en-GB-Neural2-A', // High quality Neural Female
          ssmlGender: 'FEMALE',
        },
        audioConfig: {
          audioEncoding: 'MP3',
        },
      });
    } catch (synthErr) {
      // If error was due to credential decoding or metadata, attempt ADC fallback
      if (synthErr.message?.includes('DECODER') || synthErr.message?.includes('credentials') || synthErr.message?.includes('metadata')) {
        client = new textToSpeech.TextToSpeechClient();
        [response] = await client.synthesizeSpeech({
          input: { text: textEn },
          voice: {
            languageCode: 'en-GB',
            name: 'en-GB-Neural2-A',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
          },
        });
      } else {
        throw synthErr;
      }
    }

    if (!response?.audioContent) {
      console.error(`[TTS] Google Cloud TTS returned empty audio content.`);
      return null;
    }

    const buffer = Buffer.from(response.audioContent);
    const key = `audio/questions/${questionId}_en.mp3`;

    return await uploadToR2(buffer, key, 'audio/mpeg');
  } catch (err) {
    console.error(`[TTS] English audio generation failed for question ${questionId}:`, err);
    return null;
  }
}

/**
 * Pre-generate audio for both English and Irish question texts
 */
export async function generateQuestionAudio(question) {
  const textEn = question.text?.en ?? (typeof question.text === 'string' ? question.text : null);
  const textGa = question.text?.ga ?? (typeof question.text === 'string' ? question.text : null);

  const [audioUrlEn, audioUrlGa] = await Promise.all([
    textEn ? generateEnglishAudio(textEn, question.id) : Promise.resolve(null),
    textGa ? generateIrishAudio(textGa, question.id) : Promise.resolve(null),
  ]);

  return { audioUrlEn, audioUrlGa };
}
