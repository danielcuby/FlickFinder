const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const suggestionsEl = document.getElementById('suggestions');
const resultEl = document.getElementById('result');
const trendingSection = document.getElementById('trending');
const trendingGrid = document.getElementById('trending-grid');
const posterWall = document.getElementById('poster-wall');
const mainEl = document.querySelector('main');
const vpnSticky = document.getElementById('vpn-sticky');

let debounceTimer;

// Real ZoogVPN affiliate/tracking link.
const ZOOGVPN_URL = 'https://zoogvpn.com/?utm_source=zoog_affiliate&utm_medium=revshare&utm_campaign=affx03boa09okh2n&a_aid=x03boa09okh2n';

const VPN_MESSAGES = [
  'Unlock this and thousands of other titles',
  'Fast, secure streaming from anywhere',
  'One click, no more region-locked libraries',
];

let vpnMessageInterval = null;

function startVpnMessageRotation() {
  clearInterval(vpnMessageInterval);
  const el = vpnSticky.querySelector('.vpn-banner-message');
  if (!el) return;
  let i = 0;
  vpnMessageInterval = setInterval(() => {
    i = (i + 1) % VPN_MESSAGES.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = VPN_MESSAGES[i];
      el.style.opacity = '1';
    }, 300);
  }, 3500);
}

// Renders once and stays on screen permanently -- not tied to search
// results, so it's visible whether or not anything's been searched yet.
function renderVpnSticky() {
  vpnSticky.innerHTML = `
    <a class="vpn-banner" href="${ZOOGVPN_URL}" target="_blank" rel="noopener sponsored">
      <span class="vpn-banner-message">${VPN_MESSAGES[0]}</span>
      <span class="vpn-banner-cta">Get ZoogVPN →</span>
    </a>
    <p class="vpn-disclosure">FlickFinder may earn a commission if you sign up through this link.</p>
  `;
  const link = vpnSticky.querySelector('.vpn-banner');
  if (link && typeof gtag === 'function') {
    link.addEventListener('click', () => gtag('event', 'affiliate_click', { link_type: 'zoogvpn' }));
  }
}

function resetHome() {
  input.value = '';
  suggestionsEl.classList.add('hidden');
  suggestionsEl.innerHTML = '';
  resultEl.classList.add('hidden');
  resultEl.innerHTML = '';
  trendingSection.classList.remove('hidden');
  mainEl.classList.remove('wide');
}

document.getElementById('logo').addEventListener('click', resetHome);

function backLinkHtml() {
  return `<button type="button" class="back-link">← Back to search</button>`;
}

function resultLeftHtml(item, certification) {
  const badges = [];
  if (item.rating) badges.push(`<span class="badge">★ ${item.rating}</span>`);
  if (certification) badges.push(`<span class="badge">${certification}</span>`);

  return `
    <div class="result-left">
      ${item.poster ? `<img src="${item.poster}" class="result-poster-large" alt="" />` : ''}
      <h2>${item.title}</h2>
      ${badges.length ? `<div class="result-meta">${badges.join('')}</div>` : ''}
      ${item.overview ? `<p class="result-overview">${item.overview}</p>` : ''}
    </div>
  `;
}

function bindBackLink() {
  const back = resultEl.querySelector('.back-link');
  if (back) back.addEventListener('click', resetHome);
}

input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = input.value.trim();
  if (!q) {
    suggestionsEl.classList.add('hidden');
    return;
  }
  debounceTimer = setTimeout(() => runSearch(q), 300);
});

form.addEventListener('submit', (e) => e.preventDefault());

async function runSearch(q) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    renderSuggestions(data.results || []);
  } catch (err) {
    suggestionsEl.classList.add('hidden');
  }
}

function renderSuggestions(results) {
  if (!results.length) {
    suggestionsEl.classList.add('hidden');
    return;
  }
  suggestionsEl.innerHTML = '';
  results.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <img src="${item.poster || ''}" alt="" />
      <div>
        <div>${item.title}</div>
        <div class="meta">${item.year || ''} · ${item.type === 'tv' ? 'Series' : 'Movie'}</div>
      </div>
    `;
    li.addEventListener('click', () => selectTitle(item));
    suggestionsEl.appendChild(li);
  });
  suggestionsEl.classList.remove('hidden');
}

async function selectTitle(item) {
  input.value = item.title;
  suggestionsEl.classList.add('hidden');
  trendingSection.classList.add('hidden');
  resultEl.classList.remove('hidden');
  mainEl.classList.add('wide');
  resultEl.innerHTML = `
    ${backLinkHtml()}
    <div class="result-body">
      ${resultLeftHtml(item)}
      <div class="result-right"><p class="tagline">Checking where it's streaming…</p></div>
    </div>
  `;
  bindBackLink();

  try {
    const res = await fetch(`/api/availability?tmdbId=${item.tmdbId}&type=${item.type}`);
    const data = await res.json();
    renderResult(item, data);
  } catch (err) {
    resultEl.innerHTML = `
      ${backLinkHtml()}
      <div class="result-body">
        ${resultLeftHtml(item)}
        <div class="result-right"><p class="tagline">Couldn't load streaming info. Try again.</p></div>
      </div>
    `;
    bindBackLink();
  }
}

function platformRowsHtml(platformList, checkedCount, idPrefix) {
  return platformList
    .map((p, idx) => {
      const logoHtml = p.logo ? `<img class="platform-logo" src="${p.logo}" alt="" />` : '';

      if (p.count === 0) {
        return `
          <div class="platform unavailable">
            <div class="platform-top">
              <div class="platform-name-group">
                ${logoHtml}
                <span class="platform-name">${p.name}</span>
              </div>
              <span class="platform-count">Not available</span>
            </div>
          </div>
        `;
      }

      const isAll = p.count === checkedCount;
      const summary = isAll ? 'Available in all regions' : `Available in ${p.count} of ${checkedCount} regions`;
      const mainTags = (p.mainCountries || []).map((c) => `<span class="region-tag">${c}</span>`).join('');
      const otherCountries = p.otherCountries || [];
      const moreId = `${idPrefix}-more-${idx}`;
      const visitLink = p.homepage
        ? `<a class="visit-link" href="${p.homepage}" target="_blank" rel="noopener">Visit site ↗</a>`
        : '';

      const seeMore = otherCountries.length
        ? `<button type="button" class="see-more" data-target="${moreId}">+${otherCountries.length} more</button>`
        : '';
      const moreList = otherCountries.length
        ? `<div class="more-regions hidden" id="${moreId}">${otherCountries
            .map((c) => `<span class="region-tag">${c}</span>`)
            .join('')}</div>`
        : '';

      return `
        <div class="platform">
          <div class="platform-top">
            <div class="platform-name-group">
              ${logoHtml}
              <span class="platform-name">${p.name}</span>
              ${visitLink}
            </div>
            <span class="platform-count">${summary}</span>
          </div>
          <div class="platform-regions">${mainTags}${seeMore}</div>
          ${moreList}
        </div>
      `;
    })
    .join('');
}

function renderResult(item, data) {
  const platforms = data.platforms || [];
  const regionalPlatforms = data.regionalPlatforms || [];
  const checkedCount = data.checkedCount || 0;

  const rows = platformRowsHtml(platforms, checkedCount, 'main');
  const regionalRows = regionalPlatforms.length
    ? `
      <div class="regional-section">
        <h3 class="regional-heading">Also available regionally</h3>
        ${platformRowsHtml(regionalPlatforms, checkedCount, 'regional')}
      </div>
    `
    : '';

  resultEl.innerHTML = `
    ${backLinkHtml()}
    <div class="result-body">
      ${resultLeftHtml(item, data.certification)}
      <div class="result-right">
        ${rows}
        ${regionalRows}
        ${data.hadErrors ? `<p class="note">Couldn't check a few regions just now — results may be incomplete.</p>` : ''}
      </div>
    </div>
  `;
  bindBackLink();

  resultEl.querySelectorAll('.see-more').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.target).classList.toggle('hidden');
    });
  });
}

// One call powers both the clickable "popular today" row and the
// drifting background -- no need to fetch trending data twice.
async function loadTrending() {
  try {
    const res = await fetch('/api/trending');
    const data = await res.json();
    const results = data.results || [];
    renderTrendingGrid(results);
    renderPosterWall(results);
  } catch (err) {
    trendingSection.classList.add('hidden');
  }
}

function renderTrendingGrid(results) {
  if (!results.length) {
    trendingSection.classList.add('hidden');
    return;
  }
  trendingGrid.innerHTML = '';
  results.slice(0, 12).forEach((item) => {
    const div = document.createElement('div');
    div.className = 'trending-item';
    div.innerHTML = `
      <img src="${item.poster}" alt="" />
      <div class="trending-title">${item.title}</div>
    `;
    div.addEventListener('click', () => selectTitle(item));
    trendingGrid.appendChild(div);
  });
}

function renderPosterWall(results) {
  const posters = results.filter((r) => r.poster);
  if (posters.length < 4 || !posterWall) return;

  posterWall.innerHTML = '';
  // Phones get a single thin row instead of three -- fewer images
  // actually requested, not just fewer shown, since a hidden <img> with
  // a src still downloads.
  const isPhone = window.innerWidth <= 480;
  const rowCount = isPhone ? 1 : 3;
  const perRow = Math.ceil(posters.length / rowCount);

  for (let i = 0; i < rowCount; i++) {
    const offset = i * perRow;
    const rowPosters = [...posters.slice(offset), ...posters.slice(0, offset)];
    if (!rowPosters.length) continue;

    const row = document.createElement('div');
    row.className = i % 2 === 1 ? 'poster-row reverse' : 'poster-row';
    row.style.animationDuration = `${70 + i * 25}s`;
    // Doubled so the translateX(-50%) loop is seamless.
    const doubled = [...rowPosters, ...rowPosters];
    row.innerHTML = doubled.map((p) => `<img src="${p.poster}" alt="" />`).join('');
    posterWall.appendChild(row);
  }
}

loadTrending();
renderVpnSticky();
startVpnMessageRotation();

// On mobile the contact card isn't shown permanently -- it pops up for
// 3 seconds, first after a 2-second delay, then every 30 seconds after
// that, so it never sits on screen long enough to cover the sticky
// banner or clutter a small screen.
const contactUs = document.getElementById('contact-us');
if (contactUs && window.innerWidth <= 640) {
  const showContactUsBriefly = () => {
    contactUs.classList.add('mobile-visible');
    setTimeout(() => {
      contactUs.classList.remove('mobile-visible');
    }, 5000);
  };
  setTimeout(() => {
    showContactUsBriefly();
    setInterval(showContactUsBriefly, 30000);
  }, 2000);
}

document.getElementById('trending-prev').addEventListener('click', () => {
  trendingGrid.scrollBy({ left: -320, behavior: 'smooth' });
});

document.getElementById('trending-next').addEventListener('click', () => {
  trendingGrid.scrollBy({ left: 320, behavior: 'smooth' });
});

// Lets a normal vertical mouse wheel scroll this row sideways too, since
// not everyone has a trackpad or a horizontal scroll wheel.
trendingGrid.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    trendingGrid.scrollBy({ left: e.deltaY });
  }
});
