const normalizeJournal = (value) => String(value || "")
  .normalize("NFKD")
  .toLowerCase()
  .replace(/&/g, "and")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const createJournalMetricLookup = (payload = {}) => {
  const lookup = new Map();
  for (const journal of payload.journals || []) {
    for (const name of [journal.name, ...(journal.aliases || [])]) lookup.set(normalizeJournal(name), journal);
  }
  return lookup;
};

export const journalMetricFor = (journal, lookup) => lookup.get(normalizeJournal(journal)) || null;

export const withJournalMetric = (candidate, lookup) => {
  if (candidate.candidate_type !== "research") return candidate;
  const metric = journalMetricFor(candidate.journal, lookup);
  return {
    ...candidate,
    journal_impact_factor: metric?.impact_factor ?? null,
    journal_impact_factor_year: metric?.metric_year ?? null,
    journal_impact_factor_source: metric?.source_url || null
  };
};
