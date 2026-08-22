import * as simpleIcons from "simple-icons";

const companySuffixes = /\b(the|co|company|corp|corporation|inc|incorporated|ltd|limited|plc|holdings?|group|sa|ag|nv|se|llc|pte|kabushiki kaisha)\b/g;

function companyKey(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(companySuffixes, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const iconsByCompany = new Map();
for (const icon of Object.values(simpleIcons)) {
  if (!icon?.title || !icon?.svg) continue;
  const key = companyKey(icon.title);
  if (!key) continue;
  const matches = iconsByCompany.get(key) ?? [];
  matches.push(icon);
  iconsByCompany.set(key, matches);
}

export function findSimpleIconsLogoCandidates(rows) {
  const candidates = new Map();
  for (const row of rows) {
    const matches = iconsByCompany.get(companyKey(row.name));
    if (matches?.length !== 1) continue;
    const icon = matches[0];
    candidates.set(`${row.exchange}:${row.symbol}`, {
      bytes: Buffer.from(icon.svg.replace("<svg ", `<svg fill="#${icon.hex}" `)),
      company: icon.title,
      hex: `#${icon.hex}`,
      license: icon.license?.type ?? null,
      licenseUrl: icon.license?.url ?? null,
      slug: icon.slug,
      sourceUrl: icon.source,
    });
  }
  return candidates;
}

export function findSimpleIconsBrandColourCandidates(rows) {
  const candidates = new Map();
  for (const row of rows) {
    const matches = iconsByCompany.get(companyKey(row.name));
    if (matches?.length !== 1) continue;
    const icon = matches[0];
    candidates.set(`${row.exchange}:${row.symbol}`, {
      colour: `#${icon.hex}`,
      company: icon.title,
      slug: icon.slug,
      sourceUrl: icon.source,
    });
  }
  return candidates;
}

export async function downloadSimpleIconsLogo(candidate) {
  return {
    bytes: candidate.bytes,
    provider: "simple-icons",
    lookup: "visual-consensus-company-name",
    query: candidate.company,
    sourceFormat: "svg",
    sourceUrl: candidate.sourceUrl,
    simpleIconsSlug: candidate.slug,
    sourceLicense: candidate.license,
    sourceLicenseUrl: candidate.licenseUrl,
    sourceCollection: "Simple Icons",
    sourceCollectionLicense: "CC0-1.0",
    sourceCollectionLicenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceTrademarkNotice: true,
  };
}
