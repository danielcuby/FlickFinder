// Powers both the "popular today" row and the drifting poster background,
// so this one call does double duty. Cached for a few hours since trending
// doesn't need to be second-by-second fresh.
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

module.exports = async (req, res) => {
  const cacheKey = 'trending';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    res.status(200).json(cached.data);
    return;
  }

  const apiKey = process.env.TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/trending/all/day?api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.results || [])
      .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
      .slice(0, 20)
      .map((item) => ({
        tmdbId: item.id,
        type: item.media_type,
        title: item.title || item.name,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        poster: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
      }));

    const responseBody = { results };
    cache.set(cacheKey, { time: Date.now(), data: responseBody });
    res.status(200).json(responseBody);
  } catch (err) {
    console.error('Trending fetch failed:', err);
    res.status(200).json({ results: [] });
  }
};
