import crypto from 'node:crypto';

const secret = process.env.AUTH_SECRET || 'local-development-secret-change-me';
const tokenLifetimeSeconds = 60 * 60 * 8;

function sign(value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function createToken(user) {
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds,
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  const [payload, signature] = token?.split('.') || [];
  const expectedSignature = payload ? sign(payload) : '';
  if (!payload || !signature || signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Math.floor(Date.now() / 1000) ? data : null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  req.user = user;
  next();
}