// Syncs WOS gift codes from whiteoutsurvival-community.com into the shared database.
// Runs on a schedule via GitHub Actions (.github/workflows/codes.yml).
const SOURCE = 'https://www.whiteoutsurvival-community.com/en/gift-codes.html';
const RPC = 'https://pxzkbrgmosykxmkevgek.supabase.co/rest/v1/rpc/set_community_codes';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4emticmdtb3N5a3hta2V2Z2VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTk5MjEsImV4cCI6MjEwMDU3NTkyMX0.KAOw0C45CLlVUeNPLubh6nQUQlpDNYCG5xhHMU8YQ3E';

const pass = process.env.SCRAPER_PASS;
if (!pass) { console.error('SCRAPER_PASS env var missing'); process.exit(1); }

const res = await fetch(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0 (WOS-HQ code sync; +https://github.com/ambriah83/wos-hq)' } });
if (!res.ok) { console.error('Source fetch failed:', res.status); process.exit(1); }
const html = await res.text();

const okCode = s => /^[A-Za-z0-9]{3,24}$/.test(s);
const expired = new Set([...html.matchAll(/aria-label="Gift code ([^,"]+), expired"/gi)].map(m => m[1].trim()).filter(okCode));
const dataCodes = new Set([...html.matchAll(/data-code="([^"]+)"/g)].map(m => m[1].trim()).filter(okCode));
for (const m of html.matchAll(/aria-label="Gift code ([^,"]+), active"/gi)) {
  const c = m[1].trim();
  if (okCode(c)) dataCodes.add(c);
}
const active = [...dataCodes].filter(c => !expired.has(c));

if (active.length === 0 && expired.size === 0) {
  console.error('Parsed zero codes — the site layout probably changed. Not writing.');
  process.exit(1);
}

const r = await fetch(RPC, {
  method: 'POST',
  headers: { apikey: ANON, authorization: 'Bearer ' + ANON, 'content-type': 'application/json' },
  body: JSON.stringify({ pass, active, expired: [...expired] })
});
if (!r.ok) { console.error('DB write failed:', r.status, await r.text()); process.exit(1); }
console.log(`Synced ${active.length} active + ${expired.size} expired codes.`);
console.log('Active:', active.join(', '));
