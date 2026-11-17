/* global PH */
// Public Discovery (H4 design, T-400; built by T-405). All three are public pages the server
// renders with their content, metadata, hreflang and JSON-LD (D-019, D-051): the sitemap's
// dynamic section lists the category and card addresses. Everything shown is the approved,
// offered snapshot — real statistics or none (P14§2).
PH.screen({
  id: 'discovery',
  path: '/{language}/discovery  (?q=&category=&tags=&match=any|all&lang=&template=&page=)',
  status: 'planned',
  name: 'Discovery',
  summary:
    "The public catalog: popular games, categories with samples, the viewer's recently played, and the search whose whole input is the address.",
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Without a query: popular games now, each category with a few games and a link to its page, the list of categories, and — only for a signed person, guest included — a "recently played" row; nothing is invented when the catalog is thin (P14§2, D-029). With a query: the results for the text, one category, tags combined as "any of these / all of these", the language filter and the template-only filter, with the most popular tags offered as helpers (B: search). Every game shows its cover and name from the approved snapshot. The URL carries the whole search, so copying it reproduces the results (B: navigation); the server renders the page for crawlers and the sitemap points here.',
  actions: [
    { name: 'Read the sections (no query)', calls: 'GET:/v1/discovery', navigatesTo: null },
    {
      name: 'Search (the address is the input)',
      calls: 'GET:/v1/discovery/search',
      navigatesTo: null,
    },
    {
      name: 'Read categories and tag helpers',
      calls: 'GET:/v1/discovery/taxonomy',
      navigatesTo: null,
    },
    { name: 'Open a category', calls: null, navigatesTo: 'discovery-category' },
    { name: 'Open a game card', calls: null, navigatesTo: 'game-card-public' },
  ],
});

PH.screen({
  id: 'discovery-category',
  path: '/{language}/discovery/c/{categorySlug}',
  status: 'planned',
  name: 'Discovery category',
  summary:
    "One category's games by popularity, on its own crawlable address (D-019: category searches, not the brand).",
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'The category name in the page language, its games ordered by popularity then recency, paged; the same tag, language and template filters as the search. A retired or unknown category answers the real 404 page.',
  actions: [
    { name: 'Read the category games', calls: 'GET:/v1/discovery/search', navigatesTo: null },
    { name: 'Open a game card', calls: null, navigatesTo: 'game-card-public' },
    { name: 'Back to Discovery', calls: null, navigatesTo: 'discovery' },
  ],
});

PH.screen({
  id: 'game-card-public',
  path: '/{language}/g/{gameUUID}',
  status: 'planned',
  name: 'Public game card',
  summary:
    'The approved card of an offered game: exactly what the review approved, never the working card (P04§4).',
  mode: 'normal',
  access: 'anonymous',
  variants: 'horizontal+vertical',
  shows:
    'Cover, screenshots of the offered version, name, description, category, tags, languages, players admitted, devices or special controls, the academic mark, grade support when it exists, the template mark with its credits chain ("based on …", P05§3), and sessions-started-in-30-days only at or above the honest threshold (V-13) — otherwise no figures at all (P14§2). "Start a session" is the main action (through sign-in when the account level is missing); "Create a game based on this" appears only when the template permission is granted; the owner also sees the way into their workspace. A game that is withdrawn, blocked, deleted or was never approved explains it is not available and offers Discovery (P14§6). Reporting from the card arrives with H9. Server-rendered with title, description, canonical, hreflang and JSON-LD.',
  actions: [
    {
      name: 'Read the public card',
      calls: 'GET:/v1/discovery/games/{gameUUID}',
      navigatesTo: null,
    },
    { name: 'Start a session of this game', calls: null, navigatesTo: 'new-session' },
    { name: 'Create a game based on this (template)', calls: null, navigatesTo: 'create-game' },
    { name: 'Open my workspace (owner only)', calls: null, navigatesTo: 'game-workspace' },
    { name: 'Back to Discovery', calls: null, navigatesTo: 'discovery' },
  ],
});
