# FlickFinder

Search a movie or show, see which streaming platforms have it and in which countries. Built to pair with a VPN affiliate CTA for titles that aren't available where the user is.

## Stack

- Frontend: plain HTML/CSS/JS, no framework, no build step
- Backend: two Vercel serverless functions (`/api/search`, `/api/availability`) that keep API keys off the client
- Data: TMDB (title search) + Streaming Availability API by Movie of the Night (per-country platform data)

## Setup

1. Push this folder to a GitHub repo.
2. Go to vercel.com, sign in with GitHub, and import the repo. Vercel auto-detects the `/api` folder as serverless functions — no config needed.
3. In the Vercel project's Settings > Environment Variables, add:
   - `TMDB_API_KEY` — your TMDB v3 API key
   - `RAPIDAPI_KEY` — your RapidAPI key, subscribed to the Streaming Availability API
4. Redeploy. The site is live at your Vercel URL, and every push to `main` auto-deploys.

## Local development

Install the Vercel CLI (`npm i -g vercel`), then run `vercel dev` in this folder. It links the project, pulls your env vars, and serves the site with the `/api` functions working locally.

## Next steps

- Verify the exact request shape in `api/availability.js` against the real Streaming Availability API docs once signed in — the id format may need a small adjustment.
- Move the in-memory cache in `api/availability.js` to Vercel KV or Upstash Redis so cached results survive across requests and cold starts. This is the main lever for handling a traffic spike without hitting API rate limits.
- Add a country selector so a user's own country is checked by default, not just the fixed shortlist.
- Layer in typo-tolerant search (e.g. Fuse.js) on top of TMDB's own fuzzy matching.
