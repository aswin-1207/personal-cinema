// Vercel Serverless Function: High-Performance TMDB API Proxy
// Ensures 100% connectivity worldwide regardless of regional ISP DNS blocks
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage & { query?: Record<string, string> }, res: ServerResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const endpoint = urlObj.searchParams.get('endpoint');

    if (!endpoint) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing endpoint parameter' }));
      return;
    }

    // Determine TMDB API Key from environment or verified fallback
    const apiKey =
      process.env.VITE_TMDB_API_KEY ||
      process.env.TMDB_API_KEY ||
      process.env.VITE_TMDB_ACCESS_TOKEN ||
      '15d2ea6d0dc1d476efbca3eba2b9bbfb';

    // Clone query params, excluding 'endpoint'
    const forwardParams = new URLSearchParams();
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (key !== 'endpoint') {
        forwardParams.append(key, value);
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'PersonalCinema/1.0',
    };

    let tmdbTargetUrl = '';
    if (apiKey.startsWith('ey') && apiKey.length > 50) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      const qs = forwardParams.toString();
      tmdbTargetUrl = `https://api.themoviedb.org/3${endpoint}${qs ? `?${qs}` : ''}`;
    } else {
      forwardParams.set('api_key', apiKey);
      tmdbTargetUrl = `https://api.themoviedb.org/3${endpoint}?${forwardParams.toString()}`;
    }

    const tmdbRes = await fetch(tmdbTargetUrl, { headers });
    const data = await tmdbRes.text();

    res.statusCode = tmdbRes.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.end(data);
  } catch (err: any) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'TMDB proxy error', message: err?.message || 'Upstream request failed' }));
  }
}
