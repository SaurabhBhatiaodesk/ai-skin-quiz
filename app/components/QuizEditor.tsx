import { useState } from "react";
import MappingEditor from "./MappingEditor";
import type { MappingDraft } from "./MappingEditor";
import { useFetcher } from "react-router";
import { scoresForTag, slugTag } from "../quiz-shared";
import type { DeepQuestion, ProductMapping, QuickQuestion, ResultTag, ShopProduct, StoredQuiz } from "../quiz-shared";

type SaveResult = { ok: true; quiz: StoredQuiz } | { ok: false; error: string };
type Kind = "quick" | "deep" | "scan";
type Tab = "edit" | "design" | "tags" | "products" | "content" | "branching" | "settings";

const TABS: Array<{ id: Tab; label: string; icon: "edit" | "design" | "tag" | "link" | "content" | "branch" | "gear" }> = [
  { id: "edit", label: "Quiz edit", icon: "edit" },
  { id: "design", label: "Quiz design", icon: "design" },
  { id: "tags", label: "Answer tags", icon: "tag" },
  { id: "products", label: "Link product", icon: "link" },
  { id: "content", label: "Personalized content", icon: "content" },
  { id: "branching", label: "Branching", icon: "branch" },
  { id: "settings", label: "Settings", icon: "gear" },
];

const RESULTS = ["vata", "pitta", "kapha", "dual-vata-pitta", "dual-vata-kapha", "dual-kapha-pitta", "balanced"] as const;

function tagsFor(option: { tags?: string[]; label: string }) {
  if (option.tags?.length) return option.tags;
  const slug = slugTag(option.label);
  return slug ? [slug] : [];
}

function collectTags(quiz: StoredQuiz) {
  const tags = new Set<string>();
  for (const question of [...quiz.quick, ...quiz.deep]) {
    for (const option of question.options) tagsFor(option).forEach((tag) => tags.add(tag));
  }
  return [...tags];
}

function selectableTags(quiz: StoredQuiz, products: ShopProduct[]) {
  const tags = new Set(collectTags(quiz));
  products.forEach((product) => product.tags.forEach((tag) => {
    const slug = slugTag(tag);
    if (slug) tags.add(slug);
  }));
  return [...tags];
}

function isDosha(tag: string): tag is ResultTag {
  return tag === "vata" || tag === "pitta" || tag === "kapha" || tag === "balanced";
}

export default function QuizEditor({
  initial,
  products,
  code,
}: {
  initial: StoredQuiz;
  shop: string;
  products: ShopProduct[];
  code: string;
}) {
  const fetcher = useFetcher<SaveResult>();
  const [quiz, setQuiz] = useState(initial);
  const [kind, setKind] = useState<Kind>(initial.layout === "scan" ? "scan" : "quick");
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<Tab>("edit");
  const [resultKey, setResultKey] = useState<(typeof RESULTS)[number]>("vata");
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [mappingDraft, setMappingDraft] = useState<MappingDraft | null>(null);
  const [pickedRows, setPickedRows] = useState<string[]>([]);

  const pending = fetcher.state !== "idle";
  const questions = kind === "scan" ? [] : kind === "quick" ? quiz.quick : quiz.deep;
  const scanner = quiz.scanner || { title: "AI Skin Scan", description: "Try the skin scan demo with a live camera or photo upload.", camera: true, upload: true };
  const safeIndex = Math.min(index, Math.max(questions.length - 1, 0));
  const question = questions[safeIndex];

  function save() {
    // The index marker targets app._index instead of its parent app route.
    fetcher.submit(quiz, { method: "POST", encType: "application/json", action: `/app?index&quiz=${encodeURIComponent(code)}` });
  }

  function patch(partial: Partial<QuickQuestion & DeepQuestion>) {
    setQuiz((current) => {
      const list = kind === "quick" ? current.quick : current.deep;
      const next = list.map((item, itemIndex) => (itemIndex === safeIndex ? { ...item, ...partial } : item));
      return kind === "quick" ? { ...current, quick: next as QuickQuestion[] } : { ...current, deep: next as DeepQuestion[] };
    });
  }

  function patchOption(optionIndex: number, partial: Record<string, unknown>) {
    if (!question) return;
    const options = question.options.map((option, itemIndex) =>
      itemIndex === optionIndex ? { ...option, ...partial } : option,
    );
    patch({ options } as Partial<QuickQuestion & DeepQuestion>);
  }

  function applyTags(optionIndex: number, tags: string[]) {
    if (!question) return;
    const fallback = slugTag(question.options[optionIndex]?.label || "") || "tag";
    const unique = [...new Set(tags.map((tag) => slugTag(tag)).filter(Boolean))].slice(0, 8);
    const stored = unique.length ? unique : [fallback];
    const dosha = unique.find(isDosha);
    const options = question.options.map((option, itemIndex) => {
      if (itemIndex !== optionIndex) return option;
      if (kind === "quick") return { ...option, tags: stored, ...(dosha ? { tag: dosha, value: dosha } : {}) };
      if (dosha) return { ...option, tags: stored, tag: dosha, scores: scoresForTag(dosha, "layer" in question ? question.layer : 1) };
      return { ...option, tags: stored };
    });
    const list = kind === "quick" ? quiz.quick : quiz.deep;
    const nextList = list.map((item, itemIndex) => (itemIndex === safeIndex ? { ...item, options } : item));
    persist(kind === "quick"
      ? { ...quiz, quick: nextList as QuickQuestion[] }
      : { ...quiz, deep: nextList as DeepQuestion[] });
  }

  function commitTagDraft(optionIndex: number) {
    if (!question) return;
    const key = `${kind}-${safeIndex}-${optionIndex}`;
    const extra = (tagDrafts[key] || "").split(",").map((item) => slugTag(item)).filter(Boolean);
    applyTags(optionIndex, [...tagsFor(question.options[optionIndex]), ...extra]);
    setTagDrafts((current) => ({ ...current, [key]: "" }));
  }

  function removeOption(optionIndex: number) {
    if (!question || question.options.length <= 2) return;
    patch({
      options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex),
    } as Partial<QuickQuestion & DeepQuestion>);
  }

  function addQuestion() {
    if (questions.length >= (kind === "deep" || quiz.layout === "single" ? 40 : 12)) return;
    setQuiz((current) => {
      if (kind === "quick") {
        const quick = [
          ...current.quick,
          {
            phase: "New question",
            text: "New question",
            sub: "",
            continueLabel: "Continue",
            options: [
              { value: "vata", label: "Answer 1", hint: "" },
              { value: "pitta", label: "Answer 2", hint: "" },
            ],
          },
        ];
        setIndex(quick.length - 1);
        return { ...current, quick };
      }
      const deep = [
        ...current.deep,
        {
          layer: 1,
          phase: "Prakriti Â· Your baseline nature",
          text: "New question",
          sub: "",
          continueLabel: "Continue",
          options: [
            { label: "Answer 1", hint: "", scores: { V: 3 } },
            { label: "Answer 2", hint: "", scores: { P: 3 } },
          ],
        },
      ];
      setIndex(deep.length - 1);
      return { ...current, deep };
    });
  }

  function removeQuestion() {
    setQuiz((current) => {
      const list = kind === "quick" ? current.quick : current.deep;
      if (list.length <= 1) return current;
      const next = list.filter((_, itemIndex) => itemIndex !== safeIndex);
      setIndex(Math.max(0, safeIndex - 1));
      return kind === "quick"
        ? { ...current, quick: next as QuickQuestion[] }
        : { ...current, deep: next as DeepQuestion[] };
    });
  }

  function persist(next: StoredQuiz) {
    setQuiz(next);
    fetcher.submit(next, { method: "POST", encType: "application/json", action: `/app?index&quiz=${encodeURIComponent(code)}` });
  }

  function commitMapping() {
    if (!mappingDraft || !mappingDraft.tags.length || !mappingDraft.productHandle) return;
    const mappings = [...(quiz.mappings || [])];
    const id = mappingDraft.id || `m${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const row: ProductMapping = { id, tags: mappingDraft.tags, productHandle: mappingDraft.productHandle, grouping: mappingDraft.grouping, variantId: mappingDraft.variantId };
    const at = mappings.findIndex((item) => item.id === id);
    if (at >= 0) mappings[at] = row;
    else mappings.push(row);
    setMappingDraft(null);
    persist({ ...quiz, mappings });
  }

  function deleteMappings(ids: string[]) {
    const drop = new Set(ids);
    setPickedRows((current) => current.filter((id) => !drop.has(id)));

    persist({ ...quiz, mappings: (quiz.mappings || []).filter((item) => !drop.has(item.id)) });
  }

  function patchProfile(partial: Partial<(typeof quiz.profiles)[string]>) {
    setQuiz((current) => ({
      ...current,
      profiles: { ...current.profiles, [resultKey]: { ...current.profiles[resultKey], ...partial } },
    }));
  }

  const saved = fetcher.data?.ok === true;
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : "";
  const result = quiz.profiles[resultKey];
  const showQuestions = tab === "edit" || tab === "design" || tab === "tags";
  const showSidebar = (showQuestions && quiz.layout !== "scan") || tab === "content";

  return (
    <s-page heading="Quiz editor" inlineSize="large">
      <s-button slot="primary-action" variant="primary" loading={pending} onClick={save}>Save</s-button>
      <s-stack gap="base">
        <s-stack direction="inline" gap="small">
          {TABS.map(item => <s-button key={item.id} variant={tab === item.id ? "primary" : "tertiary"} onClick={() => setTab(item.id)}>{item.label}</s-button>)}
        </s-stack>
        {error ? <s-banner tone="critical" heading="Could not save quiz">{error}</s-banner> : saved ? <s-banner tone="success" heading="Saved" /> : null}
        <s-query-container>
        <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="base" alignItems="start">
          {showSidebar ? <s-section heading={tab === "content" ? "Results" : "Questions"}>
            <s-scroll-box maxBlockSize="600px" accessibilityLabel="Quiz questions and results">
              <s-stack gap="base">
                {tab === "content" ? <s-choice-list label="Personalized results" values={[resultKey]} onChange={event => setResultKey(event.currentTarget.values[0] as typeof resultKey)}>
                  {RESULTS.map(key => <s-choice key={key} value={key}>{quiz.profiles[key].name}</s-choice>)}
                </s-choice-list> : <>
                  {quiz.layout !== "single" ? <s-select label="Quiz flow" value={kind} onChange={event => { setKind(event.currentTarget.value === "scan" ? "scan" : event.currentTarget.value === "deep" ? "deep" : "quick"); setIndex(0); }}>
                    <s-option value="quick">Quick Quiz ({quiz.quick.length} questions)</s-option>
                    <s-option value="deep">Deep Quiz ({quiz.deep.length} questions)</s-option>
                    <s-option value="scan">AI Skin Scan</s-option>
                  </s-select> : null}
                  <s-text color="subdued">{kind === "scan" ? "Configure camera and photo upload for the scan block." : "Select a question to edit"}</s-text>
                  <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
                  {questions.map((item, itemIndex) => <s-clickable key={`${kind}-${itemIndex}`} accessibilityLabel={`Edit question ${itemIndex + 1}: ${item.text}`} background={safeIndex === itemIndex ? "subdued" : "base"} border={safeIndex === itemIndex ? "base strong" : "base"} borderRadius="base" padding="base" onClick={() => setIndex(itemIndex)}>
                    <s-stack gap="small">
                      <s-stack direction="inline" gap="small" justifyContent="space-between" alignItems="center">
                        <s-text color="subdued">Question {itemIndex + 1}</s-text>
                        {safeIndex === itemIndex ? <s-badge tone="info">Editing</s-badge> : null}
                      </s-stack>
                      <s-text type={safeIndex === itemIndex ? "strong" : "generic"}>{item.text}</s-text>
                    </s-stack>
                  </s-clickable>)}
                  </s-grid>
                </>}
              </s-stack>
            </s-scroll-box>
          </s-section> : null}
          <s-stack gap="base">
            {showQuestions && kind === "scan" ? <s-section heading="AI Skin Scan settings">
              <s-stack gap="base">
                <s-banner heading="Demo mode">Camera and photo upload are available. Results currently use demo data; photos are not analysed by an AI service yet.</s-banner>
                <s-text-field label="Scan title" value={scanner.title} onInput={event => { const title = event.currentTarget.value; setQuiz(current => ({ ...current, scanner: { ...scanner, title } })); }} />
                <s-text-area label="Scan description" value={scanner.description} onInput={event => { const description = event.currentTarget.value; setQuiz(current => ({ ...current, scanner: { ...scanner, description } })); }} />
                <s-checkbox label="Allow live camera" checked={scanner.camera} onChange={event => { const camera = event.currentTarget.checked; setQuiz(current => ({ ...current, scanner: { ...scanner, camera } })); }} />
                <s-checkbox label="Allow photo upload" checked={scanner.upload} onChange={event => { const upload = event.currentTarget.checked; setQuiz(current => ({ ...current, scanner: { ...scanner, upload } })); }} />
                <s-paragraph color="subdued">Keep at least one capture method enabled. Scan results use the personalized content and product mappings configured for this quiz.</s-paragraph>
              </s-stack>
            </s-section> : null}
            {tab !== "settings" && tab !== "branching" ? <s-section>
              <s-stack direction="inline" gap="small" justifyContent="end">
                {showQuestions && kind !== "scan" ? <>
                  <s-button tone="critical" variant="tertiary" onClick={removeQuestion} disabled={questions.length <= 1}>Delete question</s-button>
                  <s-button onClick={addQuestion} disabled={questions.length >= (kind === "deep" || quiz.layout === "single" ? 40 : 12)}>Add question</s-button>
                </> : null}
                {tab === "products" ? <>
                  <s-button commandFor="quiz-bulk-actions">Bulk actions</s-button>
                  <s-menu id="quiz-bulk-actions" accessibilityLabel="Bulk actions">
                    <s-button tone="critical" disabled={!pickedRows.length || pending} onClick={() => deleteMappings(pickedRows)}>Delete selected</s-button>
                  </s-menu>
                  <s-button icon="plus" onClick={() => setMappingDraft({ id: "", tags: [], productHandle: "", grouping: "or" })}>New mapping</s-button>
                </> : null}
                <s-button variant="primary" loading={pending} onClick={save}>Save</s-button>
              </s-stack>
            </s-section> : null}
            {tab === "settings" ? <s-section heading="Quiz settings">
          <s-stack gap="base">
                <s-badge>{quiz.layout === "scan" ? "AI Skin Scan" : quiz.layout === "single" ? "Single-block quiz" : "3-block quiz"}</s-badge>
                <s-text-field label="Quiz code" readOnly value={code} />
                <s-text-field label="Shortcode" readOnly value={`[dosha-quiz:${code}]`} />
                <s-paragraph color="subdued">Add this quiz to your storefront from Blocks. Paste the quiz code into the theme block, then save the theme.</s-paragraph>
                <s-stack direction="inline" gap="small"><s-button href="/app/blocks">Open Blocks</s-button><s-button variant="primary" loading={pending} onClick={save}>Save quiz</s-button></s-stack>
              </s-stack>
            </s-section> : null}
            {tab === "branching" ? <s-section heading="Quiz flow">
              <s-stack gap="base">
                <s-banner heading="Questions follow a fixed order">Answer-based branching is not available yet. Customers continue through the questions in their selected quiz flow.</s-banner>
                {quiz.layout === "scan" ? <s-paragraph>This block opens Skin Scan directly with camera or photo upload.</s-paragraph> : quiz.layout === "single" ? <s-paragraph>This single quiz contains {quiz.quick.length} questions in one flow.</s-paragraph> : <>
                  <s-paragraph>Quick Quiz has {quiz.quick.length} questions. Deep Quiz has {quiz.deep.length} questions grouped into the sections below.</s-paragraph>
                  <s-table><s-table-header-row><s-table-header listSlot="primary">Deep question</s-table-header><s-table-header>Section</s-table-header></s-table-header-row><s-table-body>
                    {quiz.deep.map((item, itemIndex) => <s-table-row key={itemIndex}><s-table-cell>{itemIndex + 1}. {item.text}</s-table-cell><s-table-cell>
                      <s-select label={`Section for question ${itemIndex + 1}`} labelAccessibilityVisibility="exclusive" value={String(item.layer)} onChange={event => {
                        const layer = Number(event.currentTarget.value);
                        setQuiz(current => ({ ...current, deep: current.deep.map((question, at) => {
                          if (at !== itemIndex) return question;
                          return { ...question, layer, options: question.options.map(option => {
                            const scores: Record<string, number> = {};
                            for (const [key, value] of Object.entries(option.scores)) { const base = key.replace(/v$/, ""); const next = layer === 2 ? `${base}v` : base; scores[next] = (scores[next] || 0) + value; }
                            return { ...option, scores };
                          }) };
                        }) }));
                      }}><s-option value="1">Baseline nature</s-option><s-option value="2">Current state</s-option><s-option value="3">Environment</s-option></s-select>
                    </s-table-cell></s-table-row>)}
                  </s-table-body></s-table>
                </>}
                <s-stack direction="inline" justifyContent="end"><s-button variant="primary" loading={pending} onClick={save}>Save flow</s-button></s-stack>
              </s-stack>
            </s-section> : null}
            {tab === "products" ? <>
              {mappingDraft ? <MappingEditor key={mappingDraft.id || "new"} draft={mappingDraft} products={products} tags={selectableTags(quiz, products)} onChange={setMappingDraft} onSave={commitMapping} onCancel={() => setMappingDraft(null)} pending={pending} /> : null}
              <s-section heading="Product mappings" padding="none">
                {(quiz.mappings || []).length ? <s-table>
                  <s-table-header-row>
                    <s-table-header><s-checkbox label="Select all mappings" checked={pickedRows.length === quiz.mappings.length} indeterminate={pickedRows.length > 0 && pickedRows.length < quiz.mappings.length} onChange={event => setPickedRows(event.currentTarget.checked ? quiz.mappings.map(item => item.id) : [])} /></s-table-header>
                    <s-table-header>Selected tags</s-table-header><s-table-header>Resource type</s-table-header><s-table-header listSlot="primary">Resource name</s-table-header><s-table-header>Actions</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {quiz.mappings.map(mapping => {
                      const product = products.find(item => item.handle === mapping.productHandle);
                      const variant = product?.variants?.find(item => item.id === mapping.variantId);
                      const title = `${product?.title || mapping.productHandle}${variant ? ` - ${variant.title}` : ""}`;
                      return <s-table-row key={mapping.id}>
                        <s-table-cell><s-checkbox label={`Select ${title}`} checked={pickedRows.includes(mapping.id)} onChange={event => { const checked = event.currentTarget.checked; setPickedRows(current => checked ? [...current, mapping.id] : current.filter(id => id !== mapping.id)); }} /></s-table-cell>
                        <s-table-cell><s-stack direction="inline" gap="small">{mapping.tags.map((tag, tagIndex) => <s-stack key={tag} direction="inline" gap="small" alignItems="center">{tagIndex > 0 ? <s-text color="subdued">{(mapping.grouping || "or").toUpperCase()}</s-text> : null}<s-chip>{tag}</s-chip></s-stack>)}</s-stack></s-table-cell>
                        <s-table-cell><s-badge>{mapping.variantId ? "Variant" : "Product"}</s-badge></s-table-cell><s-table-cell>{title}</s-table-cell>
                        <s-table-cell><s-stack direction="inline" gap="small">
                          <s-button icon="edit" accessibilityLabel={`Edit ${title}`} onClick={() => setMappingDraft({ id: mapping.id, tags: mapping.tags, productHandle: mapping.productHandle, grouping: mapping.grouping || "or", variantId: mapping.variantId })} />
                          <s-button icon="delete" tone="critical" accessibilityLabel={`Delete ${title}`} disabled={pending} onClick={() => deleteMappings([mapping.id])} />
                        </s-stack></s-table-cell>
                      </s-table-row>;
                    })}
                  </s-table-body>
                </s-table> : <s-box padding="base"><s-paragraph color="subdued">No mappings yet. Press New mapping, pick tags, then pick a product or variant.</s-paragraph></s-box>}
              </s-section>
            </> : null}
            {tab === "content" && result ? <s-section heading={`What the customer reads for ${result.name}`}>
              <s-stack gap="base">
                <s-text-field label="Result name" value={result.name} onInput={event => patchProfile({ name: event.currentTarget.value })} />
                <s-text-field label="Short line" value={result.sub} onInput={event => patchProfile({ sub: event.currentTarget.value })} />
                <s-text-area label="One sentence" value={result.essence} rows={3} onInput={event => patchProfile({ essence: event.currentTarget.value })} />
                <s-text-area label="Full reading" value={result.insight} rows={5} onInput={event => patchProfile({ insight: event.currentTarget.value })} />
              </s-stack>
            </s-section> : null}
            {showQuestions && question ? <s-section heading={`Question ${safeIndex + 1}`}>
              <s-stack gap="base">
                {tab === "tags" ? <s-paragraph color="subdued">Each answer gets tags used by product mappings. Add vata, pitta or kapha when the answer should count toward that result.</s-paragraph> : null}
                {tab === "design" ? <>
                  <s-text-field label="Section name" value={question.phase} onInput={event => patch({ phase: event.currentTarget.value })} />
                  <s-text-area label="Help text" value={question.sub} onInput={event => patch({ sub: event.currentTarget.value })} />
                </> : null}
                <s-text-area label="Question" rows={3} value={question.text} onInput={event => patch({ text: event.currentTarget.value })} />
                <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
                  {question.options.map((option, optionIndex) => <s-box key={optionIndex} border="base" borderRadius="base" padding="base">
                    <s-stack gap="small">
                      <s-text-field label={`Answer ${optionIndex + 1}`} value={option.label} onInput={event => patchOption(optionIndex, { label: event.currentTarget.value })} />
                      <s-button variant="tertiary" tone="critical" disabled={question.options.length <= 2} onClick={() => removeOption(optionIndex)}>Delete answer</s-button>
                      {tab === "tags" ? <>
                        <s-stack direction="inline" gap="small">{tagsFor(option).map(tag => <s-clickable-chip key={tag} removable accessibilityLabel={`Remove ${tag}`} onRemove={() => applyTags(optionIndex, tagsFor(option).filter(item => item !== tag))}>{tag}</s-clickable-chip>)}</s-stack>
                        <s-text-field label={`Tags for answer ${optionIndex + 1}`} placeholder="Enter tags here" details="Separate multiple tags with commas." value={tagDrafts[`${kind}-${safeIndex}-${optionIndex}`] || ""} onInput={event => { const value = event.currentTarget.value; setTagDrafts(current => ({ ...current, [`${kind}-${safeIndex}-${optionIndex}`]: value })); }} />
                        <s-button onClick={() => commitTagDraft(optionIndex)} disabled={pending}>Save tags</s-button>
                      </> : null}
                    </s-stack>
                  </s-box>)}
                </s-grid>
                <s-stack direction="inline" gap="small" justifyContent="center">
                  <s-button disabled={question.options.length >= 8} onClick={() => {
                    const options = kind === "quick" ? [...question.options, { value: "balanced", tag: "balanced" as const, label: "New answer", hint: "" }] : [...(question as DeepQuestion).options, { label: "New answer", hint: "", tag: "vata" as const, scores: scoresForTag("vata", (question as DeepQuestion).layer) }];
                    patch({ options } as Partial<QuickQuestion & DeepQuestion>);
                  }}>Add answer</s-button>
                  <s-button onClick={() => { if (safeIndex < questions.length - 1) setIndex(safeIndex + 1); else if (kind === "quick" && quiz.deep.length) { setKind("deep"); setIndex(0); } }}>{question.continueLabel || "Continue"}</s-button>
                </s-stack>
              </s-stack>
            </s-section> : null}
          </s-stack>
        </s-grid>
        </s-query-container>
      </s-stack>
    </s-page>
  );
}
