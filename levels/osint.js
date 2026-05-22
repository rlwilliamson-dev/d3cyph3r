// OSINT track levels.
//
// See levels/linux.js for the full schema documentation. OSINT-specific
// fields used by js/commands/osint.js:
//
//   sherlockResults  — { username: ["Twitter: https://...", "GitHub: ...", ...] }
//                      Each entry is a single result line as Sherlock prints it.
//   hibpResults      — { email: [{ breach, date, exposed, description? }, ...] }
//                      Have I Been Pwned breach lookup.
//   waybackResults   — { url: [{ timestamp, snapshot_url, status }, ...] }
//                      Internet Archive snapshot timeline.
//   crtshResults     — { domain: [{ subdomain, issuer, issued }, ...] }
//                      Certificate transparency search results.
//   harvesterResults — { domain: { emails: [], subdomains: [], hosts: [] } }
//                      theHarvester output.
//   shodanResults    — { query: [{ ip, hostname, org, country, ports, banner?, tags? }, ...] }
//                      Shodan host search.
//   ipinfoResults    — { ip: { hostname, city, region, country, loc, org, postal, timezone, asn? } }
//                      ipinfo.io IP geolocation / ASN.
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm. Each track introduces a new client engagement to
// diversify the post-mortems' compliance contexts.

export const osintLevels = {

  // No levels yet. The OSINT engine surface ships in v0.4; the first
  // level0@osint will land in a follow-up PR.

};
