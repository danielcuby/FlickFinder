// TMDB's watch/providers endpoint (powered by JustWatch) returns every
// country's data in a single call, so this replaces the old per-country
// RapidAPI lookups entirely -- no daily request quota to manage.
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Full country names for display -- a comprehensive ISO list, since
// JustWatch/TMDB cover many more countries than the old data source did
// (that's why some were falling back to raw codes like "UG").
const COUNTRY_NAMES = {
  AD: 'Andorra', AE: 'United Arab Emirates', AF: 'Afghanistan', AG: 'Antigua and Barbuda',
  AI: 'Anguilla', AL: 'Albania', AM: 'Armenia', AO: 'Angola', AR: 'Argentina',
  AS: 'American Samoa', AT: 'Austria', AU: 'Australia', AW: 'Aruba', AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina', BB: 'Barbados', BD: 'Bangladesh', BE: 'Belgium',
  BF: 'Burkina Faso', BG: 'Bulgaria', BH: 'Bahrain', BI: 'Burundi', BJ: 'Benin',
  BM: 'Bermuda', BN: 'Brunei', BO: 'Bolivia', BR: 'Brazil', BS: 'Bahamas', BT: 'Bhutan',
  BW: 'Botswana', BY: 'Belarus', BZ: 'Belize', CA: 'Canada', CD: 'DR Congo',
  CF: 'Central African Republic', CG: 'Congo', CH: 'Switzerland', CI: 'Ivory Coast',
  CK: 'Cook Islands', CL: 'Chile', CM: 'Cameroon', CN: 'China', CO: 'Colombia',
  CR: 'Costa Rica', CU: 'Cuba', CV: 'Cape Verde', CW: 'Curaçao', CY: 'Cyprus',
  CZ: 'Czech Republic', DE: 'Germany', DJ: 'Djibouti', DK: 'Denmark', DM: 'Dominica',
  DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador', EE: 'Estonia', EG: 'Egypt',
  ER: 'Eritrea', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland', FJ: 'Fiji', FK: 'Falkland Islands',
  FM: 'Micronesia', FO: 'Faroe Islands', FR: 'France', GA: 'Gabon', GB: 'United Kingdom',
  GD: 'Grenada', GE: 'Georgia', GF: 'French Guiana', GG: 'Guernsey', GH: 'Ghana',
  GI: 'Gibraltar', GL: 'Greenland', GM: 'Gambia', GN: 'Guinea', GP: 'Guadeloupe',
  GQ: 'Equatorial Guinea', GR: 'Greece', GT: 'Guatemala', GU: 'Guam', GW: 'Guinea-Bissau',
  GY: 'Guyana', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HT: 'Haiti', HU: 'Hungary',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IM: 'Isle of Man', IN: 'India',
  IQ: 'Iraq', IR: 'Iran', IS: 'Iceland', IT: 'Italy', JE: 'Jersey', JM: 'Jamaica',
  JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia', KI: 'Kiribati',
  KM: 'Comoros', KN: 'Saint Kitts and Nevis', KP: 'North Korea', KR: 'South Korea',
  KW: 'Kuwait', KY: 'Cayman Islands', KZ: 'Kazakhstan', LA: 'Laos', LB: 'Lebanon',
  LC: 'Saint Lucia', LI: 'Liechtenstein', LK: 'Sri Lanka', LR: 'Liberia', LS: 'Lesotho',
  LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MC: 'Monaco',
  MD: 'Moldova', ME: 'Montenegro', MG: 'Madagascar', MH: 'Marshall Islands',
  MK: 'North Macedonia', ML: 'Mali', MM: 'Myanmar', MN: 'Mongolia', MO: 'Macau',
  MP: 'Northern Mariana Islands', MQ: 'Martinique', MR: 'Mauritania', MS: 'Montserrat',
  MT: 'Malta', MU: 'Mauritius', MV: 'Maldives', MW: 'Malawi', MX: 'Mexico', MY: 'Malaysia',
  MZ: 'Mozambique', NA: 'Namibia', NC: 'New Caledonia', NE: 'Niger', NF: 'Norfolk Island',
  NG: 'Nigeria', NI: 'Nicaragua', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal',
  NR: 'Nauru', NU: 'Niue', NZ: 'New Zealand', OM: 'Oman', PA: 'Panama', PE: 'Peru',
  PF: 'French Polynesia', PG: 'Papua New Guinea', PH: 'Philippines', PK: 'Pakistan',
  PL: 'Poland', PM: 'Saint Pierre and Miquelon', PR: 'Puerto Rico', PS: 'Palestine',
  PT: 'Portugal', PW: 'Palau', PY: 'Paraguay', QA: 'Qatar', RE: 'Réunion', RO: 'Romania',
  RS: 'Serbia', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia', SB: 'Solomon Islands',
  SC: 'Seychelles', SD: 'Sudan', SE: 'Sweden', SG: 'Singapore', SH: 'Saint Helena',
  SI: 'Slovenia', SK: 'Slovakia', SL: 'Sierra Leone', SM: 'San Marino', SN: 'Senegal',
  SO: 'Somalia', SR: 'Suriname', SS: 'South Sudan', ST: 'São Tomé and Príncipe',
  SV: 'El Salvador', SX: 'Sint Maarten', SY: 'Syria', SZ: 'Eswatini',
  TC: 'Turks and Caicos Islands', TD: 'Chad', TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan',
  TK: 'Tokelau', TL: 'Timor-Leste', TM: 'Turkmenistan', TN: 'Tunisia', TO: 'Tonga',
  TR: 'Turkey', TT: 'Trinidad and Tobago', TV: 'Tuvalu', TW: 'Taiwan', TZ: 'Tanzania',
  UA: 'Ukraine', UG: 'Uganda', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VA: 'Vatican City', VC: 'Saint Vincent and the Grenadines', VE: 'Venezuela',
  VG: 'British Virgin Islands', VI: 'U.S. Virgin Islands', VN: 'Vietnam', VU: 'Vanuatu',
  WF: 'Wallis and Futuna', WS: 'Samoa', XK: 'Kosovo', YE: 'Yemen', YT: 'Mayotte',
  ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
};

// A few codes get their common short form instead of the full name.
const DISPLAY_OVERRIDES = { GB: 'UK', US: 'USA', AE: 'UAE' };

function displayName(code) {
  return DISPLAY_OVERRIDES[code] || COUNTRY_NAMES[code] || code;
}

// Shown immediately for an available platform, before "see more".
const PRIORITY_CODES = ['US', 'GB', 'CA'];

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

// Age rating lives on a different endpoint than watch/providers, and movies
// and TV shows use different endpoints from each other. Prefers a US
// rating (most globally recognizable) and falls back to whichever country
// has one set.
async function getCertification(type, tmdbId, apiKey) {
  try {
    if (type === 'tv') {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/content_ratings?api_key=${apiKey}`);
      if (!res.ok) return null;
      const data = await res.json();
      const results = data.results || [];
      const match = results.find((r) => r.iso_3166_1 === 'US' && r.rating) || results.find((r) => r.rating);
      return match ? match.rating : null;
    }

    const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${apiKey}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    const certOf = (entry) => (entry.release_dates || []).find((rd) => rd.certification)?.certification;
    const us = results.find((r) => r.iso_3166_1 === 'US');
    if (us) {
      const cert = certOf(us);
      if (cert) return cert;
    }
    for (const entry of results) {
      const cert = certOf(entry);
      if (cert) return cert;
    }
    return null;
  } catch (err) {
    return null;
  }
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
    const [response, certification] = await Promise.all([
      fetch(url),
      getCertification(type, tmdbId, apiKey),
    ]);

    if (!response.ok) {
      console.error(`TMDB watch/providers error for ${type}/${tmdbId}: ${response.status}`);
      res.status(200).json({ platforms: [], checkedCount: 0, hadErrors: true, certification });
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
      .map((p) => {
        const allCodes = Array.from(p.countries);
        const mainCountries = PRIORITY_CODES.filter((code) => p.countries.has(code)).map(displayName);
        const otherCountries = allCodes
          .filter((code) => !PRIORITY_CODES.includes(code))
          .map(displayName)
          .sort();
        return {
          name: p.name,
          count: allCodes.length,
          mainCountries,
          otherCountries,
        };
      })
      .sort((a, b) => b.count - a.count);

    // checkedCount here means "regions with any known listing for this
    // title" (what JustWatch actually returned), not every country in the
    // world -- so "available in all regions" means all regions this title
    // has any presence in, not literally everywhere on Earth.
    const responseBody = { platforms, checkedCount: countryCodes.length, hadErrors: false, certification };
    cache.set(cacheKey, { time: Date.now(), data: responseBody });
    res.status(200).json(responseBody);
  } catch (err) {
    console.error(`TMDB watch/providers request failed for ${type}/${tmdbId}:`, err);
    res.status(200).json({ platforms: [], checkedCount: 0, hadErrors: true, certification: null });
  }
};
