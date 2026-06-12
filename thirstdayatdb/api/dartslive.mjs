/**
 * Vercel serverless proxy for the DartsLive API.
 * Forwards requests from /api/dartslive/* to https://league.dartslive.com/*
 * and returns the JSON response.
 *
 * This replicates the Vite dev proxy so live data works in production.
 */

const BASE = 'https://league.dartslive.com';

export default async function handler(req, res) {
  // Extract the path after /api/dartslive
  // req.url looks like: /api/dartslive/sg/allSchedule?li=xxx&di=yyy
  const url = new URL(req.url, `http://${req.headers.host}`);
  const targetPath = url.pathname.replace(/^\/api\/dartslive/, '') + url.search;

  const targetUrl = `${BASE}${targetPath}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `DartsLive API returned ${response.status}` });
    }

    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach DartsLive API', details: err.message });
  }
}