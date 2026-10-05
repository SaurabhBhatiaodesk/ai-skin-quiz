import { useState } from "react";
import type { ShopProduct } from "../quiz-shared";

export type MappingDraft = {
  id: string;
  tags: string[];
  productHandle: string;
  grouping: "and" | "or";
  variantId?: string;
};

export default function MappingEditor({ draft, products, tags, onChange, onSave, onCancel, pending }: {
  draft: MappingDraft;
  products: ShopProduct[];
  tags: string[];
  onChange: (draft: MappingDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [tagQuery, setTagQuery] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [resourceType, setResourceType] = useState<"product" | "variant" | null>(null);
  const [resourceQuery, setResourceQuery] = useState("");
  const product = products.find(item => item.handle === draft.productHandle);
  const variant = product?.variants?.find(item => item.id === draft.variantId);
  const resourceName = product ? `${product.title}${variant ? ` — ${variant.title}` : ""}` : draft.productHandle;
  const resources = products.flatMap<{ handle: string; variantId?: string; title: string }>(item => resourceType === "variant"
    ? (item.variants || []).map(value => ({ handle: item.handle, variantId: value.id, title: `${item.title} — ${value.title}` }))
    : [{ handle: item.handle, variantId: undefined, title: item.title }])
    .filter(item => item.title.toLowerCase().includes(resourceQuery.trim().toLowerCase()));

  return (
    <section className="si-mapping-card" aria-label={draft.id ? "Edit mapping" : "New mapping"}>
      <div className="si-mapping-row">
        <div className="si-mapping-tags">
          <div className="si-search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></svg>
            <input aria-label="Select one or more tags" placeholder="Select one or more tags" value={tagQuery}
              onFocus={() => setTagsOpen(true)} onChange={event => { setTagQuery(event.target.value); setTagsOpen(true); }}
              onKeyDown={event => { if (event.key === "Escape") setTagsOpen(false); }} />
            <button type="button" className="si-tags-toggle" aria-label={tagsOpen ? "Close tag choices" : "Open tag choices"} aria-expanded={tagsOpen} onClick={() => setTagsOpen(!tagsOpen)}>⌄</button>
          </div>
          {tagsOpen ? <div className="si-mapping-popover">
            {tags.filter(tag => tag.toLowerCase().includes(tagQuery.trim().toLowerCase())).map(tag => (
              <label className="si-mapping-choice" key={tag}>
                <input type="checkbox" checked={draft.tags.includes(tag)} disabled={draft.tags.length >= 12 && !draft.tags.includes(tag)}
                  onChange={() => onChange({ ...draft, tags: draft.tags.includes(tag) ? draft.tags.filter(value => value !== tag) : [...draft.tags, tag] })} />
                {tag}
              </label>
            ))}
            {!tags.some(tag => tag.toLowerCase().includes(tagQuery.trim().toLowerCase())) ? <p className="si-picker-empty">No matching tags. Add tags in Answer tags.</p> : null}
            <button type="button" className="si-picker-done" onClick={() => setTagsOpen(false)}>Done</button>
          </div> : null}
          {draft.tags.length ? <div className="si-selected-tags">{draft.tags.map(tag => <span className="si-chip" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange({ ...draft, tags: draft.tags.filter(value => value !== tag) })}>×</button></span>)}</div> : null}
        </div>
        <fieldset className="si-tag-grouping" disabled={draft.tags.length < 2}>
          <legend className="si-sr-only">Tag grouping</legend>
          <span>Tag grouping <span className="si-group-help" title="AND requires all selected tags. OR requires any selected tag." aria-label="AND requires all selected tags; OR requires any selected tag">?</span> :</span>
          <label><input type="radio" name="mapping-grouping" checked={draft.grouping === "and"} onChange={() => onChange({ ...draft, grouping: "and" })} /> AND</label>
          <label><input type="radio" name="mapping-grouping" checked={draft.grouping === "or"} onChange={() => onChange({ ...draft, grouping: "or" })} /> OR</label>
        </fieldset>
        <div className="si-resource-wrap">
          <div className="si-resource-buttons">
            <button className="si-add" type="button" onClick={() => { setResourceType("product"); setResourceQuery(""); setTagsOpen(false); }}>Add product</button>
            <span>OR</span>
            <button className="si-add" type="button" onClick={() => { setResourceType("variant"); setResourceQuery(""); setTagsOpen(false); }}>Add variant</button>
          </div>
          {draft.productHandle ? <div className="si-selected-resource"><span>{resourceName}</span><button type="button" aria-label="Remove selected resource" onClick={() => onChange({ ...draft, productHandle: "", variantId: undefined })}>×</button></div> : null}
          {resourceType ? <div className="si-mapping-popover si-resource-picker">
            <div className="si-picker-heading"><strong>Select {resourceType}</strong><button type="button" aria-label="Close resource choices" onClick={() => setResourceType(null)}>×</button></div>
            <input className="si-picker-search" aria-label={`Search ${resourceType}`} placeholder={`Search ${resourceType}`} value={resourceQuery} onChange={event => setResourceQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setResourceType(null); }} />
            {resources.map(item => <button type="button" className="si-resource-choice" key={item.variantId || item.handle} onClick={() => { onChange({ ...draft, productHandle: item.handle, variantId: item.variantId }); setResourceType(null); }}>{item.title}</button>)}
            {!resources.length ? <p className="si-picker-empty">{products.length ? "No matching resources." : "No products loaded. Check the store products and refresh."}</p> : null}
          </div> : null}
        </div>
      </div>
      <div className="si-mapping-actions"><button type="button" className="si-mapping-cancel" onClick={onCancel}>Cancel</button><button className="si-add" type="button" onClick={onSave} disabled={pending || !draft.tags.length || !draft.productHandle}>Save mapping</button></div>
    </section>
  );
}
