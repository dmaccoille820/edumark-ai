
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import 'dotenv/config';
import express from 'express';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { createToken, requireAuth } from './auth.js';
import { initDb, findUser, listUsers, getAssessments, createAssessment, listSubmissions, saveSubmission, usePostgreSQL } from './database.js';

const app = express();
app.use(express.json({limit: process?.env?.API_PAYLOAD_MAX_SIZE || "7mb"}));

// Initialize database
initDb().catch(err => console.error('Database connection failed:', err));

const PORT = process?.env?.API_BACKEND_PORT || 5000;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || "127.0.0.1";

const GOOGLE_CLOUD_LOCATION = process?.env?.GOOGLE_CLOUD_LOCATION;
const GOOGLE_CLOUD_PROJECT = process?.env?.GOOGLE_CLOUD_PROJECT;
const PROXY_HEADER = process?.env?.PROXY_HEADER;

// Only exit the process if running locally. On Vercel, we handle this inside the request to prevent build-time crashes.
if (!process.env.VERCEL) {
  if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
    console.error("Error: Environment variables GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION must be set.");
    process.exit(1);
  }
  if (!PROXY_HEADER) {
    console.error("Error: Environment variables PROXY_HEADER must be set.");
    process.exit(1);
  }
}

app.set('trust proxy', 1 /* number of proxies between user and server */);

// IMPORTANT: Vertex AI Studio Rate Limiting
// This rate limiting configuration protects your backend APIs from abuse.
// Removing it exposes your service to DoS attacks and unexpected costs.
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set ratelimit window at 15min (in ms)
    max: 100, // Limit each IP to 100 requests per window 
    standardHeaders: true, // Return rate limit info in the "RateLimit-*" headers
    legacyHeaders: false, // no "X-RateLimit-*" headers
    message: {
      error: 'Too many requests',
      message: 'You have exceed the request limit, please try again later.'
    },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});
// Apply the rate limiter to the /api-proxy route before the main proxy logic
app.use('/api-proxy', proxyLimiter);

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await findUser(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    res.json({ token: createToken(user), user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

app.post('/api/submissions', requireAuth, async (req, res) => {
  if (req.user.role !== 'student' || req.user.sub !== req.body?.studentId) {
    return res.status(403).json({ error: 'Students may only submit their own assessments.' });
  }
  const submission = req.body;
  if (!submission.id || !submission.assessmentId || !submission.answers ||
      !['pending', 'graded'].includes(submission.status) ||
      typeof submission.submittedAt !== 'string') {
    return res.status(400).json({ error: 'Invalid submission.' });
  }
  await saveSubmission(submission);
  res.status(201).json(submission);
});

app.get('/api/submissions', requireAuth, async (req, res) => {
  const submissions = await listSubmissions();
  if (req.user.role === 'teacher') return res.json(submissions);
  res.json(submissions.filter((submission) => submission.studentId === req.user.sub));
});

const API_CLIENT_MAP = [
 {
    name: "VertexGenAi:generateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:generateContent`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:predict",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:predict`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:streamGenerateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:streamGenerateContent`;
    },
    isStreaming: true,
    transformFn: (response) => {
        let normalizedResponse = response.trim();
        while (normalizedResponse.startsWith(',') || normalizedResponse.startsWith('[')) {
          normalizedResponse = normalizedResponse.substring(1).trim();
        }
        while (normalizedResponse.endsWith(',') || normalizedResponse.endsWith(']')) {
          normalizedResponse = normalizedResponse.substring(0, normalizedResponse.length - 1).trim();
        }

        if (!normalizedResponse.length) {
          return {result: null, inProgress: false};
        }

        if (!normalizedResponse.endsWith('}')) {
          return {result: normalizedResponse, inProgress: true};
        }

        try {
          const parsedResponse = JSON.parse(`${normalizedResponse}`);
          const transformedResponse = `data: ${JSON.stringify(parsedResponse)}\n\n`;
          return {result: transformedResponse, inProgress: false};
        } catch (error) {
          throw new Error(`Failed to parse response: ${error}.`);
        }
    },
  },
].map((client) => ({ ...client, patternInfo: parsePattern(client.patternForProxy) }));

// IMPORTANT: Vertex AI Studio SSRF Protection
// The set below is the exhaustive allow-list of upstream hostnames this
// proxy may forward authenticated requests to. It is sourced at code
// generation time from the RestApiClient.getAllowedUpstreamHosts() of every
// client embedded in API_CLIENT_MAP. Removing, weakening, or widening this
// check (for example, by adding wildcards or computing entries from request
// data) re-introduces the SSRF vulnerability that allows the deployed
// service account's OAuth access token to be exfiltrated to an
// attacker-controlled host.
const ALLOWED_UPSTREAM_HOSTS = new Set([
  "aiplatform.clients6.google.com",
]);

// Check if credentials are provided in the environment (e.g. for Vercel production).
let googleCredentialsOption = {};
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    googleCredentialsOption = { credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS) };
  } catch (err) {
    console.error("Failed to parse GOOGLE_CREDENTIALS environment variable. Ensure it is a valid JSON string.", err);
  }
}

// Uses Google Application Default Credentials (ADC) or credentials object.
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  ...googleCredentialsOption,
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePattern(pattern) {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params = [];
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    const literalPart = pattern.substring(lastIndex, match.index);
    parts.push(escapeRegex(literalPart));
    parts.push(`(?<${match[1]}>[^/]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));
  const regexString = parts.join('');

  return {regex: new RegExp(`^${regexString}$`), params};
}

function extractParams(patternInfo, url) {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params = {};
  patternInfo.params.forEach((paramName, index) => {
    params[paramName] = match[index + 1];
  });
  return params;
}

async function getAccessToken(res) {
  try {
    const authClient = await auth.getClient();
    const token = await authClient.getAccessToken();
    return token.token;
  } catch (error) {
    console.error('[Node Proxy] Authentication error:', error);
    if (!res) return null;
    if (error.code === 'ERR_GCLOUD_NOT_LOGGED_IN' || (error.message && error.message.includes('Could not load the default credentials'))) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'Google Cloud Application Default Credentials not found or invalid. Please run "gcloud auth application-default login" and try again.',
      });
    } else {
      res.status(500).json({ error: `Authentication failed: ${error.message}` });
    }
    return null;
  }
}

function getRequestHeaders(accessToken) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'X-Goog-User-Project': GOOGLE_CLOUD_PROJECT,
    'Content-Type': 'application/json',
  };
}

// Dynamic route-rewriting middleware to make paths unified between local Vite proxy and production Vercel
app.use((req, res, next) => {
  if (req.url.startsWith('/api-proxy/')) {
    req.url = req.url.replace('/api-proxy/', '/api/');
  } else if (req.url.startsWith('/api/proxy/')) {
    req.url = req.url.replace('/api/proxy/', '/api/');
  }
  next();
});

// --- Database backed API endpoints ---

// Fetch users listing (optional role query param)
app.get('/api/users', requireAuth, async (req, res) => {
  const role = req.query.role || null;
  try {
    const list = await listUsers(role);
    return res.json(list);
  } catch (err) {
    console.error('Fetch users error:', err);
    return res.status(500).json({ error: 'Internal server error fetching users.' });
  }
});

// Fetch all assessments (including questions)
app.get('/api/assessments', requireAuth, async (req, res) => {
  try {
    const list = await getAssessments();
    return res.json(list);
  } catch (err) {
    console.error('Fetch assessments error:', err);
    return res.status(500).json({ error: 'Internal server error fetching assessments.' });
  }
});

// Save newly generated assessment
app.post('/api/assessments', requireAuth, async (req, res) => {
  const assessment = req.body;
  if (!assessment || !assessment.id || !assessment.questions) {
    return res.status(400).json({ error: 'Invalid assessment payload.' });
  }
  try {
    const created = await createAssessment(assessment);
    return res.json(created);
  } catch (err) {
    console.error('Create assessment error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error creating assessment.' });
  }
});

// --- Proxy Endpoint ---
app.post('/api-proxy', async (req, res) => {
  // Gracefully check for missing environment variables at request time
  if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION || !PROXY_HEADER) {
    return res.status(500).json({
      error: 'Configuration Error',
      message: 'Missing required environment variables (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, or PROXY_HEADER) in the server environment.'
    });
  }

  // Check for the custom header added by the shim
  if (req.headers['x-app-proxy'] !== PROXY_HEADER) {
    return res.status(403).send('Forbidden: Request must originate from the Vertex App shim.');
  }

  const { originalUrl, method, headers, body } = req.body;
  if (!originalUrl) {
    return res.status(400).send('Bad Request: originalUrl is required.');
  }

  // 1. Find the matching API client
  const apiClient = API_CLIENT_MAP.find(p => {
    // We store extractedParams on req for use later if needed, though getVertexUrl takes it as arg.
    req.extractedParams = extractParams(p.patternInfo, originalUrl);
    return req.extractedParams !== null;
  });

  if (!apiClient) {
    console.error(`[Node Proxy] No API client handler found for URL: ${originalUrl}`);
    return res.status(404).json({ error: `No proxy handler found for URL: ${originalUrl}` });
  }

  const extractedParams = req.extractedParams;
  console.log(`[Node Proxy] Matched API client: ${apiClient.name}`);
  try {
    // 2. Get authenticated access token
    const accessToken = await getAccessToken(res);
    if (!accessToken) return;

    // 3. Construct the full API URL using env-set GOOGLE_CLOUD_PROJECT/LOCATION and extracted params
    const context = {projectId: GOOGLE_CLOUD_PROJECT, region: GOOGLE_CLOUD_LOCATION};
    const apiUrl = apiClient.getApiEndpoint(context, extractedParams);

    // IMPORTANT: Vertex AI Studio SSRF Protection
    // Parse the constructed apiUrl with the standard URL parser (not a
    // regex) and require the resulting hostname to be in the hardcoded
    // ALLOWED_UPSTREAM_HOSTS set. This neutralizes attacks that smuggle a
    // URL-grammar delimiter (e.g. '#') into a pattern parameter to redirect
    // the authenticated upstream request to an attacker-controlled host.
    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch (e) {
      console.error(`[Node Proxy] Invalid API URL: ${apiUrl}`);
      return res.status(400).json({ error: 'Invalid API URL.' });
    }
    if (!ALLOWED_UPSTREAM_HOSTS.has(parsedApiUrl.hostname.toLowerCase())) {
      console.error(`[Node Proxy] Upstream host not allowed: ${parsedApiUrl.hostname}`);
      return res.status(400).json({ error: 'Upstream host not allowed.' });
    }
    console.log(`[Node Proxy] Forwarding to Vertex API: ${apiUrl}`);

    // 4. Prepare headers for the API call
    const apiHeaders = getRequestHeaders(accessToken);

    const apiFetchOptions = {
      method: method || 'POST',
      headers: {...apiHeaders, ...headers},
      body: body ? body : undefined,
    };

    // 5. Make the call to the API
    const apiResponse = await fetch(apiUrl, apiFetchOptions);

    // 6. Respond to the client based on stream type
    if (apiClient.isStreaming) {
      console.log(`[Node Proxy] Sending STREAMING response for ${apiClient.name}`);
      // Set headers for a streaming JSON response
      res.writeHead(apiResponse.status, {
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive',
      });
      // Immediately send headers
      res.flushHeaders();

      if (!apiResponse.body) {
        console.error('[Node Proxy] Streaming response has no body.');
        return res.end(JSON.stringify({ error: 'Streaming response body is null' }));
      }

      const decoder = new TextDecoder();
      let deltaChunk = '';
      apiResponse.body.on('data', (encodedChunk) => {
        if (res.writableEnded) return; // Prevent writing after res.end()

        try {
          if (!apiClient.transformFn) {
            res.write(encodedChunk);
          } else {
            const decodedChunk = decoder.decode(encodedChunk, { stream: true });
            deltaChunk = deltaChunk + decodedChunk;

            const {result, inProgress} = apiClient.transformFn(deltaChunk);
            if (result && !inProgress) {
              deltaChunk = '';
              res.write(new TextEncoder().encode(result));
            }
          }
        } catch (error) {
          console.error(`[Node Proxy] Error processing streaming response for ${apiClient.name}`);
          console.error(error);
        }
      });

      apiResponse.body.on('end', () => {
        deltaChunk = '';
        console.log(`[Node Proxy] Vertex stream finished and all data processed for ${apiClient.name}`);
        res.end();
      });

      apiResponse.body.on('error', (streamError) => {
        console.error('[Node Proxy] Error from Vertex stream:', streamError);
        if (!res.writableEnded) {
          res.end(JSON.stringify({ proxyError: 'Stream error from Vertex AI', details: streamError.message }));
        }
      });

      res.on('error', (resError) => {
        console.error('[Node Proxy] Error writing to client response:', resError);
        // The source stream might need to be destroyed if an error occurs here.
        if (apiResponse.body && typeof apiResponse.body.destroy === 'function') {
             apiResponse.body.destroy(resError);
        }
      });
    } else {
      // Non-streaming response handling
      console.log(`[Node Proxy] Sending JSON response for ${apiClient.name}`);
      const data = await apiResponse.json();
      res.status(apiResponse.status).json(data);
    }
  } catch (error) {
    console.error(`[Node Proxy] Error proxying request for ${apiClient.name}`);
    console.error(error)
    res.status(500).json({ error: error });
  }
});

export default app;

if (!process.env.VERCEL) {
  const server = app.listen(PORT, API_BACKEND_HOST, () => {
    console.log(`Vertex AI Backend listening at http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/ws-proxy') {
      
      let targetUrl = url.searchParams.get('target');
      if (!targetUrl) {
        console.log('[Node Proxy] Missing target URL');
        socket.destroy();
        return;
      }

      if (targetUrl === 'wss://aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent') {
        const location = GOOGLE_CLOUD_LOCATION === 'global' ? 'us-central1' : GOOGLE_CLOUD_LOCATION;
        targetUrl = `wss://${location}-aiplatform.googleapis.com//ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
      } else {
        console.log('[Node Proxy] Invalid target URL');
        socket.destroy();
        return;
      }

      let accessToken;

      try {
        accessToken = await getAccessToken();
        if (!accessToken) throw new Error('No token');
      } catch (err) {
        console.log('[Node Proxy] Authentication failed');
        socket.destroy();
        return;
      }

      console.log(`[Node Proxy] Initiating upstream connection to: ${targetUrl}`);

      let upstreamWs;

      try {
        upstreamWs = new WebSocket(targetUrl, {
          headers: getRequestHeaders(accessToken)
        });
      } catch (e) {
        console.error('[Node Proxy] Invalid Upstream URL');
        socket.destroy();
        return;
      }

      const initialErrorHandler = (error) => {
        console.error('[Node Proxy] Upstream connection failed:', error);
        upstreamWs.removeEventListener('open', onUpstreamOpen);

        if (socket.writable) {
          socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          socket.destroy();
        }
      };

      upstreamWs.once('error', initialErrorHandler);

      // 5. Handle Successful Upstream Connection
      const onUpstreamOpen = () => {
        // Remove the "bootstream" error handler
        upstreamWs.removeListener('error', initialErrorHandler);

        // Perform the HTTP -> WebSocket upgrade for the Client
        wss.handleUpgrade(request, socket, head, (ws) => {

          upstreamWs.on('message', (data, isBinary) => {
            const logMsg = isBinary ? '<Binary Data>' : data.toString();
            console.log(`[Upstream -> Client] [${new Date().toISOString()}]: ${logMsg}`);

            if (ws.readyState === WebSocket.OPEN) {
              if (data === undefined || data === null) {
                console.warn('[Node Proxy] Attempted to send undefined/null data to client');
                return;
              }
              ws.send(data, { binary: isBinary });
            }
          });

          ws.on('message', (data, isBinary) => {
            const logMsg = isBinary ? '<Binary Data>' : data.toString();

            let dataJson = {};
            try {
              dataJson = JSON.parse(data.toString());
            } catch (error) {
              console.error('[Node Proxy] Failed to parse message from client:', error);
              ws.close(1011, 'Failed to parse message');
            }

            if (dataJson['setup']) {
              dataJson['setup']['model'] = `projects/${GOOGLE_CLOUD_PROJECT}/locations/${GOOGLE_CLOUD_LOCATION}/${dataJson['setup']['model']}`;
            }

            if (upstreamWs.readyState === WebSocket.OPEN) {
              upstreamWs.send(JSON.stringify(dataJson), { binary: false });
            }
          });

          upstreamWs.on('error', (error) => {
            console.error('[Node Proxy] Upstream error:', error);
            ws.close(1011, error.message);
          });

          upstreamWs.on('close', (code, reason) => {
            console.log(`[Node Proxy] Upstream closed: ${code} ${reason}`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(code, reason);
            }
          });

          ws.on('error', (error) => {
            console.error('[Node Proxy] Client error:', error);
            upstreamWs.close(1011, error.message);
          });

          ws.on('close', (code, reason) => {
            console.log(`[Node Proxy] Client closed: ${code} ${reason}`);
            if (upstreamWs.readyState === WebSocket.OPEN) {
              upstreamWs.close(1000, reason);
            }
          });

          wss.emit('connection', ws, request);
        });
      };

      upstreamWs.once('open', onUpstreamOpen);

    } else {
      // Path did not match
      socket.destroy();
    }
  });
}


