// In-memory cache. This resets whenever the serverless function cold-starts
// and isn't shared across regions/instances, so it's a starting point, not
// the real fix for a traffic spike -- see README for moving this to
// Vercel KV or Upstash Redis.
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Shortlist of countries checked per title. Keeping this list short is what
// keeps a single search inside the Streaming Availability API's free-tier
// limits. Expand it once you're on a paid tier or want deeper coverage.
const COUNTRIES = ['us', 'gb', 'ca', 'au', 'de', 'fr', 'it', 'es', 'nl', 'jp', 'in', 'br', 'mx'];

module.exports = async (req, res) => {
  const { tmdbId, type } = req.query;
  if (!tmdbId || !type) {
    res.status(400).json({ error: 'Missing tmdbId or type' });
    return;
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  const host = 'streaming-availability.p.rapidapi.com';

  const lookups = COUNTRIES.map(async (country) => {
    const cacheKey = `${type}-${tmdbId}-${country}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      return { country, options: cached.options };
    }

    // The API needs the title type baked into the id (movie/1396 or
    // tv/1396) because TMDB reuses the same numeric id across movies and
    // TV shows -- a bare id is ambiguous.
    const url = `https://${host}/shows/${type}/${tmdbId}?country=${country}`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': host,
        },
      });
      if (!response.ok) {
        console.error(`Streaming Availability API error for ${type}/${tmdbId} (${country}): ${response.status} ${await response.text()}`);
        return { country, options: [] };
      }
      const data = await response.json();
      const options = (data.streamingOptions && data.streamingOptions[country]) || [];
      cache.set(cacheKey, { time: Date.now(), options });
      return { country, options };
    } catch (err) {
      console.error(`Streaming Availability API request failed for ${type}/${tmdbId} (${country}):`, err);
      return { country, options: [] };
    }
  });

  const results = await Promise.all(lookups);

  // Reshape from "per country" to "per platform": platform name -> list of
  // countries it's available in.
  const byPlatform = {};
  results.forEach(({ country, options }) => {
    options.forEach((opt) => {
      const platform = (opt.service && (opt.service.name || opt.service.id)) || 'Unknown';
      if (!byPlatform[platform]) byPlatform[platform] = [];
      if (!byPlatform[platform].includes(country)) byPlatform[platform].push(country);
    });
  });

  res.status(200).json({ platforms: byPlatform, checkedCountries: COUNTRIES });
};
