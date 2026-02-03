import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/auth/verify
 * Verifies the provided password against APP_PASSWORD environment variable.
 * Returns success if password matches, 401 if not.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appPassword = process.env.APP_PASSWORD;

  // If no password is configured, allow access (for development without auth)
  if (!appPassword) {
    return res.status(200).json({ success: true, message: 'No password configured' });
  }

  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password === appPassword) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid password' });
}
