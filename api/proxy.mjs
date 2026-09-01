import app from '../backend/server.js';

export default function handler(req, res) {
  // If Vercel passed the subpath via query, reconstruct the URL for Express
  if (req.query && req.query.path) {
    const subpath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
    // Strip query string from url so Express matches the clean path
    const urlObj = new URL(req.url, 'http://localhost');
    urlObj.pathname = '/api/' + subpath;
    req.url = urlObj.pathname + urlObj.search;
  }
  return app(req, res);
}
