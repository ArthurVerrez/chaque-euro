# Public-role data handling

Implementation record, 2 November 2026. This is a minimisation assessment for the integrated implementation, not confirmation of the site's publication formalities.

The purpose is to explain public offices, public parliamentary votes, campaign accounts and the means authorised for public functions. Public officials and election candidates are named only in those roles. The proposed Article 6 basis is the site's legitimate interest in public accountability, subject to the balancing assessment and information obligations. The public authority's statutory mission is not borrowed as the site's own basis.

For nominal votes and parliamentary affiliations, the reuse is limited to the public exercise of the office. The proposed Article 9 condition is the public nature of positions deliberately expressed in that role, under Article 9(2)(e). This legal assessment remains to be confirmed before publication. No private political belief, union membership, religion, health condition or inference of misconduct is produced.

The interests importer accepts only DI, DIM, DIA and DIAM inventory rows with delivered status and a publication date. It requires a unique identity, official role and filing-date match to a bulk XML declaration whose type is DI or DIA. The public projection contains declaration metadata and section counts only. It contains neither organisations nor remuneration, free observations, spouse, family, collaborators, attachments, addresses, contact details or birth data. This deliberately leaves detailed activity values at the official publisher. Ministers have a link to their official HATVP person page when the AN reference exists or exact identity and ministry agree; no asset content is copied.

A complete rebuild replaces the declaration inventory, section summaries, SQLite tables, seed and downloadable CSV/Parquet. A withdrawn publication therefore disappears after a refreshed source import and rebuild. Cached inputs are private pipeline material, not public downloads. Source refresh must precede the rebuild; the general pipeline cache is not itself a publication monitor. The elected-official directory and national and local elected-official HTML responses use `Cache-Control: no-store`. The prepared proxy applies the same header to the two HATVP CSV/Parquet export families. The proxy guard is tested with local bindings; its deployed runtime and any existing external caches are outside this isolated task.

The RNE publishes names only for mayors, with function, commune and dates. The source birth date and sex are used only to derive aggregate age/sex counts, then dropped from every public person row. The row identifier excludes birth data. Multiple offices are not treated as different unique people or automatically joined by name.

CADA opinion text, requester, administration free text, case narratives and sanctions are excluded. Only dossier identifier, type, session and overlapping outcome flags reach the public table. Campaign data excludes political nuance, donor or lender identities and bank details. The source's administrative decision is not a judicial or criminal finding.

The Article 14 notice is published at `/mentions-legales`: controller identity, correction and objection contact, retention, sources, recipients and the legal basis above. Requests are answered within one month.

The current HATVP inventory also contains four explicit non-filing rows for local offices, without an origin ID or publication date. They are not among the reconciled national profiles or mayor rows. No named alert is generated until the identity and current public office have been corroborated. This is a crosswalk gap, not a deduction that publication absence means late filing.
