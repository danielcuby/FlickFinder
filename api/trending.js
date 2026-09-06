function truncate(text, max) {
  if (!text || text.length <= max) return text || null;
  return text.slice(0, max - 1).trimEnd() + '…';
}

module.exports = async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    res.status(400).json({ error: 'Missing search query' });
    return;
  }

  const apiKey = process.env.TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(
    q
  )}&include_adult=false`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.results || [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 8)
      .map((item) => ({
        tmdbId: item.id,
        type: item.media_type,
        title: item.title || item.name,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
        rating: item.vote_average > 0 ? item.vote_average.toFixed(1) : null,
        overview: truncate(item.overview, 160),
      }));

    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
};
