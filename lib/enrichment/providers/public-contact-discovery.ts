import { normalizeWhitespace } from "@/lib/connectors/shared/normalization";
import {
  BuilderEnrichmentContribution,
  BuilderEnrichmentInput,
  BuilderEnrichmentProvider
} from "@/lib/enrichment/types";

const DISCOVERY_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function buildWebsiteSlug(name: string | null | undefined) {
  return normalizeWhitespace(name)
    .toLowerCase()
    .replace(/\b(and|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function looksLikeCompanyIdentity(name: string | null | undefined) {
  return /\b(builder|builders|homes|construction|contracting|contractor|development|developer|communities|llc|inc|corp|company|co)\b/i.test(
    normalizeWhitespace(name)
  );
}

function extractPhone(html: string) {
  const telMatch = html.match(/tel:([+()\-\d.\s]{7,})/i);
  if (telMatch) {
    return normalizeWhitespace(telMatch[1]);
  }

  const visibleMatch = html.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  return visibleMatch ? normalizeWhitespace(visibleMatch[0]) : null;
}

function extractEmail(html: string) {
  const mailtoMatch = html.match(/mailto:([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (mailtoMatch) {
    return mailtoMatch[1].toLowerCase();
  }

  const visibleMatch = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return visibleMatch ? visibleMatch[0].toLowerCase() : null;
}

function looksRelevant(html: string, name: string) {
  const normalizedHtml = html.toLowerCase();
  const tokens = name
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 4);

  return tokens.some((token) => normalizedHtml.includes(token));
}

async function tryDiscoverWebsite(name: string) {
  const slug = buildWebsiteSlug(name);

  if (!slug) {
    return null;
  }

  const candidates = [`https://${slug}.com`, `https://www.${slug}.com`, `https://${slug}.net`];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          "user-agent": DISCOVERY_USER_AGENT,
          accept: "text/html"
        },
        signal: AbortSignal.timeout(4000)
      });

      if (!response.ok) {
        continue;
      }

      const html = await response.text();

      if (!looksRelevant(html, name)) {
        continue;
      }

      return {
        website: candidate,
        phone: extractPhone(html),
        email: extractEmail(html)
      };
    } catch {
      continue;
    }
  }

  return null;
}

export const publicContactDiscoveryProvider: BuilderEnrichmentProvider = {
  key: "public-contact-discovery",
  label: "Public website/contact discovery",
  async enrich(input: BuilderEnrichmentInput): Promise<BuilderEnrichmentContribution> {
    const existingWebsite =
      input.builder.website ??
      input.builder.company.website ??
      input.builder.contacts.find((contact) => contact.isPrimary)?.sourceUrl ??
      null;
    const existingPhone =
      input.builder.phone ??
      input.builder.company.phone ??
      input.builder.contacts.find((contact) => contact.phone)?.phone ??
      null;
    const existingEmail =
      input.builder.email ??
      input.builder.company.email ??
      input.builder.contacts.find((contact) => contact.email)?.email ??
      null;
    const hasUsableContact = Boolean(existingWebsite || existingPhone || existingEmail);
    const candidateName = input.primaryCandidate?.rawName ?? input.builder.company.legalName ?? input.builder.name;
    const strongRole =
      input.primaryCandidate != null &&
      ["builder", "general_contractor", "developer"].includes(input.primaryCandidate.matchedField);
    const shouldDiscover =
      !hasUsableContact &&
      Boolean(candidateName) &&
      looksLikeCompanyIdentity(candidateName) &&
      strongRole;

    let discovered = null;

    if (shouldDiscover && candidateName) {
      discovered = await tryDiscoverWebsite(candidateName);
    }

    const website = existingWebsite ?? discovered?.website ?? null;
    const phone = existingPhone ?? discovered?.phone ?? null;
    const email = existingEmail ?? discovered?.email ?? null;

    return {
      provider: this.key,
      phone,
      email,
      website,
      entityConfidenceDelta: website ? 8 : 0,
      fieldCandidates: [
        {
          fieldName: "website",
          fieldValue: website,
          confidence: website ? 74 : 0,
          sourceLabel: this.label,
          sourceUrl: website,
          rationale: website
            ? "Public-facing company site discovered from the best matched business identity."
            : "No public company site confidently discovered."
        },
        {
          fieldName: "phone",
          fieldValue: phone,
          confidence: phone ? 72 : 0,
          sourceLabel: this.label,
          sourceUrl: website,
          rationale: phone
            ? "Public business phone discovered from the company site or stored public contact history."
            : "No public business phone confidently discovered."
        },
        {
          fieldName: "email",
          fieldValue: email,
          confidence: email ? 66 : 0,
          sourceLabel: this.label,
          sourceUrl: website,
          rationale: email
            ? "Public email discovered from the company site or stored public contact history."
            : "No public business email confidently discovered."
        }
      ]
    };
  }
};
