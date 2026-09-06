// TMDB's watch/providers endpoint (powered by JustWatch) returns every
// country's data in a single call, so this replaces the old per-country
// RapidAPI lookups entirely -- no daily request quota to manage.
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Full country names for display, falling back to the raw code if TMDB
// returns one we don't have a label for.
const COUNTRY_NAMES = {
  AE: 'United Arab Emirates', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  AZ: 'Azerbaijan', BE: 'Belgium', BG: 'Bulgaria', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CL: 'Chile', CO: 'Colombia', CY: 'Cyprus', CZ: 'Czech Republic',
  DE: 'Germany', DK: 'Denmark', EC: 'Ecuador', EE: 'Estonia', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', GR: 'Greece', HK: 'Hong Kong',
  HR: 'Croatia', HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland', IL: 'Israel',
  IN: 'India', IS: 'Iceland', IT: 'Italy', JP: 'Japan', KR: 'South Korea',
  LT: 'Lithuania', MD: 'Moldova', MK: 'North Macedonia', MX: 'Mexico', MY: 'Malaysia',
  NL: 'Netherlands', NO: 'Norway', NZ: 'New Zealand', PA: 'Panama', PE: 'Peru',
  PH: 'Philippines', PL: 'Poland', PT: 'Portugal', RO: 'Romania', RS: 'Serbia',
  RU: 'Russia', SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', TH: 'Thailand',
  TR: 'Turkey', UA: 'Ukraine', US: 'United States', VN: 'Vietnam', ZA: 'South Africa',
};

// Always shown, matched by substring against whatever name JustWatch
// returns for that country (naming varies slightly by region, e.g.
// "Amazon Prime Video" vs "Prime Video").
const MAIN_PLATFORMS = [
  { id: 'netflix', name: 'Netflix', match: ['netflix'] },
  { id: 'prime', name: 'Prime Video', match: ['prime video', 'amazon prime'] },
  { id: 'disney', name: 'Disney+', match: ['disney'] },
  { id: 'max', name: 'Max', match: ['max', 'hbo'] },
  { id: 'apple', name: 'Apple TV', match: ['apple tv'] },
  { id: 'hulu', name: 'Hulu', match: ['hulu'] },
  { id: 'peacock', name: 'Peacock', match: ['peacock'] },
  { id: 'paramount', name: 'Paramount+', match: ['paramount'] },
  { id: 'starz', name: 'Starz', match: ['starz'] },
];

function matchMainPlatform(providerName) {
  const lower = providerName.toLowerCase();
  return MAIN_PLATFORMS.find((p) => p.match.some((m) => lower.includes(m)));
}

module.exports = async (req, res) => {
  const { tmdbId, type } = req.query;
  if (!tmdbId || !type) {
    res.status(400).json({ error: 'Missing tmdbId or type' });
    return;
  }

  const cacheKey = `${type}-${tmdbId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    res.status(200).json(cached.data);
    return;
  }

  const apiKey = process.env.TMDB_API_KEY;
  const mediaPath = type === 'tv' ? 'tv' : 'movie';
  const url = `https://api.themoviedb.org/3/${mediaPath}/${tmdbId}/watch/providers?api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`TMDB watch/providers error for ${type}/${tmdbId}: ${response.status}`);
      res.status(200).json({ platforms: [], checkedCount: 0, hadErrors: true });
      return;
    }

    const data = await response.json();
    const results = data.results || {};
    const countryCodes = Object.keys(results);

    // Only track the main platforms — anything else JustWatch returns
    // (regional or niche services) is dropped rather than shown, so the
    // list stays to well-known names and popular platforms never get
    // outranked by an obscure one with wider incidental coverage.
    const byPlatform = {};
    countryCodes.forEach((country) => {
      const flatrate = results[country].flatrate || [];
      flatrate.forEach((provider) => {
        const mainMatch = matchMainPlatform(provider.provider_name);
        if (!mainMatch) return;
        if (!byPlatform[mainMatch.id]) byPlatform[mainMatch.id] = { name: mainMatch.name, countries: new Set() };
        byPlatform[mainMatch.id].countries.add(country);
      });
    });

    MAIN_PLATFORMS.forEach(({ id, name }) => {
      if (!byPlatform[id]) byPlatform[id] = { name, countries: new Set() };
    });

    const platforms = Object.values(byPlatform)
      .map((p) => ({
        name: p.name,
        count: p.countries.size,
        countries: Array.from(p.countries).map((code) => COUNTRY_NAMES[code] || code).sort(),
      }))
      .sort((a, b) => b.count - a.count);

    // checkedCount here means "regions with any known listing for this
    // title" (what JustWatch actually returned), not every country in the
    // world -- so "available in all regions" means all regions this title
    // has any presence in, not literally everywhere on Earth.
    const responseBody = { platforms, checkedCount: countryCodes.length, hadErrors: false };
    cache.set(cacheKey, { time: Date.now(), data: responseBody });
    res.status(200).json(responseBody);
  } catch (err) {
    console.error(`TMDB watch/providers request failed for ${type}/${tmdbId}:`, err);
    res.status(200).json({ platforms: [], checkedCount: 0, hadErrors: true });
  }
};
