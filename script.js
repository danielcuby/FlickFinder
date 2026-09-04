const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const suggestionsEl = document.getElementById('suggestions');
const resultEl = document.getElementById('result');

let debounceTimer;

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
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `<h2>${item.title}</h2><p class="tagline">Checking where it's streaming…</p>`;

  try {
    const res = await fetch(`/api/availability?tmdbId=${item.tmdbId}&type=${item.type}`);
    const data = await res.json();
    renderResult(item, data);
  } catch (err) {
    resultEl.innerHTML = `<h2>${item.title}</h2><p class="tagline">Couldn't load streaming info. Try again.</p>`;
  }
}

function renderResult(item, data) {
  const platforms = Object.entries(data.platforms || {});

  if (!platforms.length) {
    resultEl.innerHTML = `
      <h2>${item.title}</h2>
      <div class="vpn-callout">
        <strong>Not currently streaming</strong> in any of the countries we checked.
        A VPN can get you into a region where it's live — try ZoogVPN.
      </div>
    `;
    return;
  }

  const rows = platforms
    .map(
      ([name, countries]) => `
      <div class="platform">
        <span class="platform-name">${name}</span>
        <span class="platform-countries">${countries.map((c) => c.toUpperCase()).join(', ')}</span>
      </div>
    `
    )
    .join('');

  resultEl.innerHTML = `
    <h2>${item.title}</h2>
    ${rows}
    <div class="vpn-callout">
      Not seeing it in your country? <strong>ZoogVPN</strong> can get you into one that has it.
    </div>
  `;
}
