import { workflow, node, trigger, sticky, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const searchRequest = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.2,
  config: {
    name: 'Search Request',
    parameters: {
      httpMethod: 'POST',
      path: 'connectflow-search-leads',
      responseMode: 'responseNode',
      options: { allowedOrigins: '*' }
    }
  },
  output: [{ body: { token: 'eyJ...', query: 'parents looking for bhagavad gita classes', location: 'Bangalore', source: 'any', freshness: 'pm', page: '0' }, headers: {}, query: {}, params: {} }]
});

const testRun = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Test Search' },
  output: [{}]
});

const sampleInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Sample Search Input',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: 'return [{ json: { body: { query: "parents looking for bhagavad gita classes for kids", location: "Bangalore", source: "any", freshness: "py", page: "0" } } }];'
    }
  },
  output: [{ body: { query: 'parents looking for bhagavad gita classes for kids', location: 'Bangalore', source: 'any', freshness: 'py', page: '0' } }]
});

const checkLogin = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Check ConnectFlow Login',
    parameters: {
      method: 'GET',
      url: 'https://yqtuduxhbqkagzactrny.supabase.co/auth/v1/user',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'apikey', value: 'sb_publishable_vvqSpn8RCes6ObWZKtQP6g_XxWIatEn' },
          { name: 'Authorization', value: expr('Bearer {{ $json.body.token }}') }
        ]
      },
      options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 8000 }
    }
  },
  output: [{ statusCode: 200, body: { id: 'user-id', email: 'owner@example.com' } }]
});

const isSignedIn = ifElse({
  version: 2.2,
  config: {
    name: 'Is Signed In?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.statusCode }}'), operator: { type: 'number', operation: 'equals' }, rightValue: 200 }],
        combinator: 'and'
      }
    }
  }
});

const buildQuery = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Search Query',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "let b = {};\ntry { b = $(\"Search Request\").first().json.body || {}; } catch (e) { b = $input.first().json.body || {}; }\nconst clean = (s) => String(s || \"\").replace(/[\\r\\n]+/g, \" \").trim().slice(0, 150);\nconst parts = [clean(b.query)];\nif (b.location) parts.push(clean(b.location));\nif (b.ageGroup) parts.push(clean(b.ageGroup));\nif (b.requirement) parts.push(clean(b.requirement));\nif (b.category) parts.push(clean(b.category));\nconst intent = { recommendation: \"(recommend OR suggest OR \\\"any good\\\")\", looking: \"\\\"looking for\\\"\", question: \"(\\\"anyone know\\\" OR \\\"where can I\\\" OR \\\"please suggest\\\")\" };\nif (intent[b.enquiryType]) parts.push(intent[b.enquiryType]);\nconst sites = { reddit: \"site:reddit.com\", quora: \"site:quora.com\", facebook: \"site:facebook.com\", linkedin: \"site:linkedin.com\", twitter: \"(site:x.com OR site:twitter.com)\", forums: \"(site:reddit.com OR site:quora.com OR site:indusladies.com OR site:mouthshut.com)\" };\nif (sites[b.source]) parts.push(sites[b.source]);\nconst q = parts.filter(Boolean).join(\" \").slice(0, 390);\nconst fresh = [\"pd\", \"pw\", \"pm\", \"py\"].includes(b.freshness) ? b.freshness : \"\";\nconst page = Math.max(0, Math.min(9, parseInt(b.page || \"0\", 10) || 0));\nreturn [{ json: { q, freshness: fresh, offset: page, valid: q.length >= 3 } }];"
    }
  },
  output: [{ q: 'parents looking for bhagavad gita classes Bangalore', freshness: 'pm', offset: 0, valid: true }]
});

const braveSearch = node({
  type: '@brave/n8n-nodes-brave-search.braveSearch',
  version: 1.1,
  config: {
    name: 'Brave Web Search',
    parameters: {
      operation: 'web',
      query: expr('{{ $json.q }}'),
      count: 20,
      additionalParameters: {
        country: 'IN',
        search_lang: 'en',
        safesearch: 'strict',
        freshness: expr('{{ $json.freshness }}'),
        offset: expr('{{ $json.offset }}'),
        text_decorations: false,
        result_filter: ['web', 'discussions']
      }
    },
    credentials: { braveSearchApi: newCredential('Brave Search') }
  },
  output: [{ web: { results: [{ title: 'Looking for Gita classes for my 10 year old', url: 'https://www.reddit.com/r/bangalore/comments/abc', description: 'Any suggestions for Bhagavad Gita classes in Bangalore?', age: '2 weeks ago', page_age: '2026-11-01T00:00:00', profile: { name: 'Reddit' } }] } }]
});

const formatResults = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Lead Results',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const items = $input.all().map(i => i.json);\nlet raw = [];\nfor (const it of items) {\n  if (it.web && Array.isArray(it.web.results)) raw.push(...it.web.results);\n  if (it.discussions && Array.isArray(it.discussions.results)) raw.push(...it.discussions.results);\n  if (Array.isArray(it.results)) raw.push(...it.results);\n  if (it.url && it.title) raw.push(it);\n}\nconst strip = (s) => String(s || \"\").replace(/<[^>]+>/g, \"\").replace(/&#x27;|&#39;/g, \"'\").replace(/&quot;/g, \"\\\"\").replace(/&amp;/g, \"&\").trim();\nconst seen = new Set();\nconst results = [];\nfor (const r of raw) {\n  if (!r || !r.url || seen.has(r.url)) continue;\n  seen.add(r.url);\n  let host = \"\";\n  try { host = new URL(r.url).hostname.replace(/^www\\./, \"\"); } catch (e) {}\n  const text = strip(r.description) + \" \" + (Array.isArray(r.extra_snippets) ? r.extra_snippets.map(strip).join(\" \") : \"\");\n  const m = text.match(/(?:\\+91[\\s-]?)?[6-9]\\d{4}[\\s-]?\\d{5}/);\n  results.push({\n    title: strip(r.title),\n    url: r.url,\n    snippet: strip(r.description),\n    source: (r.profile && r.profile.name) || r.meta_url && r.meta_url.hostname || host,\n    domain: host,\n    published: r.page_age || null,\n    age: r.age || null,\n    public_phone: m ? m[0].replace(/[\\s-]/g, \"\") : null\n  });\n}\nlet q = \"\"; try { q = $(\"Build Search Query\").first().json.q; } catch (e) {}\nreturn [{ json: { ok: true, query: q, count: results.length, results, searched_at: new Date().toISOString() } }];"
    }
  },
  output: [{ ok: true, query: 'x', count: 1, results: [{ title: 't', url: 'https://reddit.com/x', snippet: 's', source: 'Reddit', domain: 'reddit.com', published: null, age: null, public_phone: null }], searched_at: '2026-11-21T00:00:00Z' }]
});

const sendResults = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Send Results',
    parameters: { respondWith: 'json', responseBody: expr('{{ JSON.stringify($json) }}'), options: { responseCode: 200 } }
  },
  output: [{}]
});

const rejectRequest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject Not Signed In',
    parameters: { respondWith: 'json', responseBody: '{"ok":false,"error":"Please sign in to ConnectFlow again."}', options: { responseCode: 401 } }
  },
  output: [{}]
});

const note = sticky('ConnectFlow AI – Lead search\n\nThe app sends the search with the signed-in user\'s token. The token is checked with Supabase before any search runs, so only ConnectFlow users can use this. Results come from Brave Search (country: India). Nothing is saved here – the user chooses which results to save as leads, and every saved lead starts with WhatsApp permission = Unknown.', [searchRequest, checkLogin], { color: 4 });

export default workflow('connectflow-search-leads', 'ConnectFlow AI – Search Leads')
  .add(searchRequest)
  .to(checkLogin)
  .to(isSignedIn
    .onTrue(buildQuery.to(braveSearch).to(formatResults).to(sendResults))
    .onFalse(rejectRequest))
  .add(testRun)
  .to(sampleInput)
  .to(buildQuery)
  .add(note);
