// Enriched item descriptions for the actor sheets' inventory row summaries (#111). Foundry-coupled (async text
// enrichment: enrichHTML strips unrevealed secrets and resolves enrichers but does NOT sanitize; the stored HTML is
// sanitized by the server on write); dev-world verified.
interface DescribedItem {
  id: string;
  isOwner?: boolean;
  system: unknown;
}

/** item id -> sanitized, enriched description HTML, for every item that has a non-blank description. */
export async function enrichItemDescriptions(items: Iterable<DescribedItem>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const editor = (foundry.applications.ux as unknown as {
    TextEditor: { implementation: { enrichHTML(html: string, options: Record<string, unknown>): Promise<string> } };
  }).TextEditor.implementation;
  for (const item of items) {
    const raw = String((item.system as { description?: unknown }).description ?? "").trim();
    if (!raw) continue;
    out.set(item.id, await editor.enrichHTML(raw, { secrets: item.isOwner === true, relativeTo: item }));
  }
  return out;
}
