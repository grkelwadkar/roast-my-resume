# RedPen — Roast My Resume

Paste or upload a resume (.txt, .docx, .pdf) and get a brutally honest,
specific roast: a score out of 100, three red-pen margin notes, the
biggest problem, one genuine strength, and one concrete blue-pen fix.

## Local development

```bash
npm install
npm run dev
```

Note: the "Grade Me" button calls `/api/roast`, which only exists once
deployed to Netlify (or run via `netlify dev`, see below). Plain
`npm run dev` will show a network error when you submit -- that's expected.

To test the full flow locally, install the Netlify CLI and run:

```bash
npm install -g netlify-cli
netlify dev
```

This runs both the Vite dev server and the local function together, and
picks up environment variables from a `.env` file in the project root
(create one with `ANTHROPIC_API_KEY=sk-ant-...` -- this file is gitignored).
If you see an "invalid x-api-key" error, double-check that the key is an
Anthropic API key (`sk-ant-...`), not an OpenAI-style project key like `sk-proj-...`.

## Deploy to Netlify

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

Or connect the GitHub repo directly in the Netlify dashboard -- it will
read `netlify.toml` automatically.

**Required environment variable** (Site settings -> Environment variables
in the Netlify dashboard):

- `ANTHROPIC_API_KEY` -- your key from console.anthropic.com

Redeploy after adding it.

## Cost note

Every roast triggers one Claude API call billed to whichever
`ANTHROPIC_API_KEY` is set. Before sharing the URL publicly, set a spend
cap in the Anthropic Console and consider adding rate limiting to
`netlify/functions/roast.js`.
