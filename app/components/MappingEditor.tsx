import { useId, useRef, useState } from "react";
import type { ShopProduct } from "../quiz-shared";

export type MappingDraft = { id: string; tags: string[]; productHandle: string; grouping: "and" | "or"; variantId?: string };

export default function MappingEditor({ draft, products, tags, onChange, onSave, onCancel, pending, compact = false }: {
  draft: MappingDraft; products: ShopProduct[]; tags: string[]; onChange: (draft: MappingDraft) => void;
  onSave: () => void; onCancel: () => void; pending: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const modal = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [resourceType, setResourceType] = useState<"product" | "variant">("product");
  const [resourceQuery, setResourceQuery] = useState("");
  const product = products.find(item => item.handle === draft.productHandle);
  const variant = product?.variants?.find(item => item.id === draft.variantId);
  const resourceName = product ? `${product.title}${variant ? ` — ${variant.title}` : ""}` : draft.productHandle;
  const filteredTags = tags.filter(tag => tag.toLowerCase().includes(tagQuery.trim().toLowerCase()));
  const resources = products.flatMap<{ handle: string; variantId?: string; title: string; image: string; price: string }>(item => resourceType === "variant"
    ? (item.variants || []).map(value => ({ handle: item.handle, variantId: value.id, title: `${item.title} - ${value.title}`, image: value.image || item.image, price: value.price }))
    : [{ handle: item.handle, title: item.title, image: item.image, price: item.price }]).filter(item => item.title.toLowerCase().includes(resourceQuery.trim().toLowerCase()));

  function openResources(type: "product" | "variant") {
    setResourceType(type); setResourceQuery(""); modal.current?.showOverlay();
  }

  const Container = compact ? "s-box" : "s-section";
  return (
    <Container {...(compact ? {} : { heading: draft.id ? "Edit mapping" : "New mapping" })}>
      <s-stack gap="base">
        <s-grid gridTemplateColumns={compact ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(240px, 1fr))"} gap={compact ? "small" : "large"} alignItems="start">
          <s-stack gap="small">
            {compact ? <s-stack direction="inline" gap="small">
              {draft.tags.map(tag => <s-clickable-chip key={tag} removable accessibilityLabel={`Remove ${tag}`} onRemove={() => onChange({ ...draft, tags: draft.tags.filter(value => value !== tag) })}>{tag}</s-clickable-chip>)}
            </s-stack> : null}
            {compact ? <s-clickable accessibilityLabel="Select one or more tags" commandFor={`${id}-tags`} command="--toggle" border="base" borderRadius="base" padding="small" inlineSize="100%"><s-stack direction="inline" gap="small" alignItems="center"><s-icon type="search" /><s-text color="subdued">Select one or more tags</s-text></s-stack></s-clickable> : <s-button icon="search" commandFor={`${id}-tags`} command="--toggle" inlineSize="fill">Select one or more tags</s-button>}
            <s-popover id={`${id}-tags`} inlineSize="300px">
              <s-box padding="base">
                <s-stack gap="small">
                  <s-search-field label="Search tags" value={tagQuery} onInput={event => setTagQuery(event.currentTarget.value)} />
                  <s-scroll-box maxBlockSize="250px" accessibilityLabel="Available tags">
                    <s-stack gap="small">
                      {filteredTags.map(tag => <s-checkbox key={tag} label={tag} checked={draft.tags.includes(tag)} disabled={draft.tags.length >= 12 && !draft.tags.includes(tag)}
                        onChange={event => onChange({ ...draft, tags: event.currentTarget.checked ? [...draft.tags, tag] : draft.tags.filter(value => value !== tag) })} />)}
                      {!filteredTags.length ? <s-paragraph color="subdued">No matching tags. Add tags in Answer tags.</s-paragraph> : null}
                    </s-stack>
                  </s-scroll-box>
                </s-stack>
              </s-box>
            </s-popover>
            {!compact ? <s-stack direction="inline" gap="small">
              {draft.tags.map(tag => <s-clickable-chip key={tag} removable accessibilityLabel={`Remove ${tag}`} onRemove={() => onChange({ ...draft, tags: draft.tags.filter(value => value !== tag) })}>{tag}</s-clickable-chip>)}
            </s-stack> : null}
          </s-stack>
          {!compact || draft.tags.length > 1 ? <s-choice-list label="Tag grouping" name="mapping-grouping" values={[draft.grouping]} disabled={draft.tags.length < 2}
            details="AND requires all selected tags. OR requires any selected tag."
            onChange={event => onChange({ ...draft, grouping: event.currentTarget.values[0] === "and" ? "and" : "or" })}>
            <s-choice value="and">AND</s-choice><s-choice value="or">OR</s-choice>
          </s-choice-list> : null}
          <s-stack gap="small">
            {!compact || !draft.productHandle ? <s-box border="base" borderRadius="base" padding="small">
              <s-stack direction="inline" gap="small" alignItems="center" justifyContent="center">
                <s-button onClick={() => openResources("product")}>Add product</s-button><s-text>OR</s-text><s-button onClick={() => openResources("variant")}>Add variant</s-button>
              </s-stack>
            </s-box> : null}
            {draft.productHandle ? compact ? <s-box border="base" borderRadius="base" padding="none"><s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="none" alignItems="center"><s-clickable accessibilityLabel={`Replace ${resourceName}`} padding="small" onClick={() => openResources(draft.variantId ? "variant" : "product")}><s-text>{resourceName}</s-text></s-clickable><s-button icon="x" variant="tertiary" accessibilityLabel="Remove selected resource" onClick={() => onChange({ ...draft, productHandle: "", variantId: undefined })} /></s-grid></s-box> : <s-clickable-chip removable accessibilityLabel="Remove selected resource" onRemove={() => onChange({ ...draft, productHandle: "", variantId: undefined })}>{resourceName}</s-clickable-chip> : null}
          </s-stack>
        </s-grid>
        {!compact ? <s-stack direction="inline" gap="small" justifyContent="end">
          <s-button variant="tertiary" onClick={onCancel}>Cancel</s-button><s-button onClick={onSave} loading={pending} disabled={!draft.tags.length || !draft.productHandle}>Save mapping</s-button>
        </s-stack> : null}
      </s-stack>
      <s-modal ref={modal} id={`${id}-resources`} heading={`Select ${resourceType}`}>
        <s-stack gap="base">
          <s-search-field label={`Search ${resourceType}`} value={resourceQuery} onInput={event => setResourceQuery(event.currentTarget.value)} />
          <s-scroll-box maxBlockSize="400px" accessibilityLabel="Available resources">
            <s-stack gap="small">
              {resources.map(item => <s-clickable key={item.variantId || item.handle} accessibilityLabel={`Select ${item.title}`} border="base" borderRadius="base" padding="small" onClick={() => { onChange({ ...draft, productHandle: item.handle, variantId: item.variantId }); modal.current?.hideOverlay(); }}>
                <s-grid gridTemplateColumns="48px minmax(0, 1fr) auto" gap="base" alignItems="center">
                  {item.image ? <s-thumbnail src={item.image} alt={item.title} /> : <s-icon type="product" />}
                  <s-stack gap="small"><s-text type="strong">{item.title}</s-text><s-text color="subdued">{item.price}</s-text></s-stack>
                  <s-icon type="chevron-right" />
                </s-grid>
              </s-clickable>)}
              {!resources.length ? <s-paragraph color="subdued">{products.length ? "No matching resources." : "No products loaded. Check the store products and refresh."}</s-paragraph> : null}
            </s-stack>
          </s-scroll-box>
        </s-stack>
        <s-button slot="secondary-actions" commandFor={`${id}-resources`} command="--hide">Cancel</s-button>
      </s-modal>
    </Container>
  );
}
