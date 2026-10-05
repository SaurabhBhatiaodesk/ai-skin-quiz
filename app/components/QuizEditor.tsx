import { useEffect, useRef, useState } from "react";
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
  shop,
  scanKeyPresent = false,
  products,
  code,
}: {
  initial: StoredQuiz;
  shop: string;
  scanKeyPresent?: boolean;
  products: ShopProduct[];
  code: string;
}) {
  const fetcher = useFetcher<SaveResult>();
  const [quiz, setQuiz] = useState(initial);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyCopyStatus, setKeyCopyStatus] = useState("");
  const [kind, setKind] = useState<Kind>(initial.layout === "scan" ? "scan" : "quick");
  const [index, setIndex] = useState(0);
  const [questionOpen, setQuestionOpen] = useState(false);
  const questionModal = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  useEffect(() => {
    if (questionOpen) questionModal.current?.showOverlay();
  }, [questionOpen]);
  const [tab, setTab] = useState<Tab>("edit");
  const [resultKey, setResultKey] = useState<(typeof RESULTS)[number]>("vata");
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [mappingDraft, setMappingDraft] = useState<MappingDraft | null>(null);
  const mappingModal = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  const editingMappingId = mappingDraft?.id;
  useEffect(() => {
    if (editingMappingId) mappingModal.current?.showOverlay();
  }, [editingMappingId]);
  const [pickedRows, setPickedRows] = useState<string[]>([]);
  const mappingRows = useRef(new Map<string, HTMLElement>());
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanup.current?.(), []);

  const pending = fetcher.state !== "idle";
  const questions = kind === "scan" ? [] : kind === "quick" ? quiz.quick : quiz.deep;
  const scanner = quiz.scanner || { title: "AI Skin Scan", description: "Try the skin scan demo with a live camera or photo upload.", camera: true, upload: true };
  const safeIndex = Math.min(index, Math.max(questions.length - 1, 0));
  const question = questions[safeIndex];
  const questionPage = Math.floor(safeIndex / 5);
  const pageStart = questionPage * 5;
  const visibleQuestions = questions.slice(pageStart, pageStart + 5);

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

  function saveAllTags() {
    if (!question) return;
    const options = question.options.map((option, optionIndex) => {
      const key = `${kind}-${safeIndex}-${optionIndex}`;
      const extra = (tagDrafts[key] || "").split(",").map(slugTag).filter(Boolean);
      const tags = [...new Set([...tagsFor(option), ...extra])].slice(0, 8);
      const dosha = tags.find(isDosha);
      return { ...option, tags, ...(dosha ? kind === "quick" ? { tag: dosha, value: dosha } : { tag: dosha, scores: scoresForTag(dosha, "layer" in question ? question.layer : 1) } : {}) };
    });
    const list = kind === "quick" ? quiz.quick : quiz.deep;
    const nextList = list.map((item, at) => at === safeIndex ? { ...item, options } : item);
    persist(kind === "quick" ? { ...quiz, quick: nextList as QuickQuestion[] } : { ...quiz, deep: nextList as DeepQuestion[] });
    setTagDrafts(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${kind}-${safeIndex}-`))));
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

  function moveMapping(id: string, targetId: string) {
    if (pending || id === targetId) return;
    setQuiz(current => {
      const mappings = [...current.mappings];
      const from = mappings.findIndex(item => item.id === id);
      const to = mappings.findIndex(item => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const [row] = mappings.splice(from, 1);
      mappings.splice(to, 0, row);
      return { ...current, mappings };
    });
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
  const QuestionContainer = tab === "edit" ? "s-modal" : "s-section";
  const showQuestions = tab === "edit" || tab === "tags";
  const design = quiz.design || { background: "#faf7f2", text: "#1a1208", accent: "#b07d3a", buttonText: "#ffffff", font: "classic" as const, radius: "rounded" as const };
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
        <s-grid gridTemplateColumns={tab === "tags" && showSidebar ? "minmax(240px, 1fr) minmax(0, 2fr)" : "minmax(0, 1fr)"} gap="base" alignItems="start">
          {showSidebar ? <s-section heading={tab === "content" ? "Results" : "Questions"}>
            <s-scroll-box maxBlockSize="600px" accessibilityLabel="Quiz questions and results">
              <s-stack gap="base">
                {tab === "content" ? <>
                  <s-text color="subdued">Select a personalized result to edit</s-text>
                  <s-stack direction="inline" gap="small">
                    {RESULTS.map(key => <s-button key={key} variant={resultKey === key ? "primary" : "secondary"} accessibilityLabel={`Edit ${quiz.profiles[key].name} result`} onClick={() => setResultKey(key)}>{quiz.profiles[key].name}</s-button>)}
                  </s-stack>
                </> : <>
                  {quiz.layout !== "single" ? <s-select label="Quiz flow" value={kind} onChange={event => { setKind(event.currentTarget.value === "scan" ? "scan" : event.currentTarget.value === "deep" ? "deep" : "quick"); setIndex(0); }}>
                    <s-option value="quick">Quick Quiz ({quiz.quick.length} questions)</s-option>
                    <s-option value="deep">Deep Quiz ({quiz.deep.length} questions)</s-option>
                    <s-option value="scan">AI Skin Scan</s-option>
                  </s-select> : null}
                  <s-text color="subdued">{kind === "scan" ? "Configure camera and photo upload for the scan block." : "Select a question to edit"}</s-text>
                  <s-grid gridTemplateColumns={tab === "tags" ? "minmax(0, 1fr)" : "repeat(auto-fit, minmax(220px, 1fr))"} gap="base">
                  {visibleQuestions.map((item, pageIndex) => { const itemIndex = pageStart + pageIndex; return <s-clickable key={`${kind}-${itemIndex}`} accessibilityLabel={`Edit question ${itemIndex + 1}: ${item.text}`} background={safeIndex === itemIndex ? "subdued" : "base"} border={safeIndex === itemIndex ? "base strong" : "base"} borderRadius="base" padding="base" onClick={() => { setIndex(itemIndex); if (tab === "edit") setQuestionOpen(true); }}>
                    {tab === "tags" ? <s-stack gap="small">
                      <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                        <s-text color="subdued">Question {itemIndex + 1}</s-text>
                        {safeIndex === itemIndex ? <s-icon type="check" /> : null}
                      </s-stack>
                      <s-paragraph><s-text type={safeIndex === itemIndex ? "strong" : "generic"}>{item.text}</s-text></s-paragraph>
                    </s-stack> : <s-grid gridTemplateColumns="auto minmax(0, 1fr) auto" gap="base" alignItems="center">
                      <s-badge tone={safeIndex === itemIndex ? "info" : "auto"}>{String(itemIndex + 1).padStart(2, "0")}</s-badge>
                      <s-paragraph><s-text type={safeIndex === itemIndex ? "strong" : "generic"}>{item.text}</s-text></s-paragraph>
                      {safeIndex === itemIndex ? <s-icon type="check" /> : <s-icon type="chevron-right" />}
                    </s-grid>}
                  </s-clickable>; })}
                  </s-grid>
                </>}
              </s-stack>
            </s-scroll-box>
            {showQuestions && questions.length > 5 ? <s-box paddingBlockStart="base">
              <s-stack gap="small">
                <s-text color="subdued">Questions {pageStart + 1}–{Math.min(pageStart + 5, questions.length)} of {questions.length}</s-text>
                <s-stack direction="inline" gap="small" justifyContent="space-between">
                  <s-button disabled={questionPage === 0} onClick={() => setIndex(pageStart - 5)}>Previous</s-button>
                  <s-button disabled={pageStart + 5 >= questions.length} onClick={() => setIndex(pageStart + 5)}>Next</s-button>
                </s-stack>
              </s-stack>
            </s-box> : null}
          </s-section> : null}
          <s-stack gap="base">
            {tab === "design" ? <s-section heading="Quiz design">
              <s-stack gap="base">
                <s-paragraph color="subdued">Customize the appearance of this quiz on your storefront.</s-paragraph>
                <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
                  {([{ key: "background", label: "Background color" }, { key: "text", label: "Text color" }, { key: "accent", label: "Button and accent color" }, { key: "buttonText", label: "Button text color" }] as const).map(field => <s-color-field key={field.key} label={field.label} value={design[field.key]} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, [field.key]: value } })); }} />)}
                  <s-select label="Font style" value={design.font} onChange={event => { const font = event.currentTarget.value === "sans" ? "sans" : "classic"; setQuiz(current => ({ ...current, design: { ...design, font } })); }}><s-option value="classic">Classic serif headings</s-option><s-option value="sans">Sans serif</s-option></s-select>
                  <s-select label="Button shape" value={design.radius} onChange={event => { const radius = event.currentTarget.value === "square" ? "square" : event.currentTarget.value === "pill" ? "pill" : "rounded"; setQuiz(current => ({ ...current, design: { ...design, radius } })); }}><s-option value="square">Square</s-option><s-option value="rounded">Rounded</s-option><s-option value="pill">Pill</s-option></s-select>
                </s-grid>
                <s-stack direction="inline" justifyContent="end"><s-button variant="primary" loading={pending} onClick={save}>Save design</s-button></s-stack>
              </s-stack>
            </s-section> : null}
            {showQuestions && kind === "scan" ? <s-section heading="AI Skin Scan settings">
              <s-stack gap="base">
                <s-banner heading="Analysis setup required">Camera and photo upload are available. Real skin analysis is not configured yet.</s-banner>
                <s-stack direction="inline"><s-button href={`https://${shop}/?dosha_scan=${encodeURIComponent(code)}`} target="_blank">Start scan</s-button></s-stack>
                <s-text-field label="Scan title" value={scanner.title} onInput={event => { const title = event.currentTarget.value; setQuiz(current => ({ ...current, scanner: { ...scanner, title } })); }} />
                <s-text-area label="Scan description" value={scanner.description} onInput={event => { const description = event.currentTarget.value; setQuiz(current => ({ ...current, scanner: { ...scanner, description } })); }} />
                <s-checkbox label="Allow live camera" checked={scanner.camera} onChange={event => { const camera = event.currentTarget.checked; setQuiz(current => ({ ...current, scanner: { ...scanner, camera } })); }} />
                <s-checkbox label="Allow photo upload" checked={scanner.upload} onChange={event => { const upload = event.currentTarget.checked; setQuiz(current => ({ ...current, scanner: { ...scanner, upload } })); }} />
                <s-paragraph color="subdued">Keep at least one capture method enabled. Scan results use the personalized content and product mappings configured for this quiz.</s-paragraph>
              </s-stack>
            </s-section> : null}
            {tab !== "settings" && tab !== "branching" && tab !== "tags" && tab !== "design" ? <s-section>
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
                <s-text-field label="Shopify widget code" readOnly value={code} />
                <s-paragraph color="subdued">Add this quiz to your storefront from Blocks. Paste the quiz code into the theme block, then save the theme.</s-paragraph>
                <s-stack direction="inline" gap="small"><s-button href="/app/blocks">Open Blocks</s-button><s-button variant="primary" loading={pending} onClick={save}>Save quiz</s-button></s-stack>
              </s-stack>
            </s-section> : null}
            {tab === "settings" && quiz.layout !== "single" ? <s-section heading="AI Skin Scan provider setup">
              <s-stack gap="base">
                <s-banner heading="Provider integration pending">Save your provider details here. Real analysis needs a provider-specific integration; saving these fields does not activate scanning.</s-banner>
                <s-paragraph><s-text type="strong">Required for the planned OpenAI integration: an OpenAI API key.</s-text> Create a project API key in the OpenAI dashboard and set OPENAI_API_KEY on your server.</s-paragraph>
                <s-link href="https://platform.openai.com/api-keys" target="_blank">Create an OpenAI API key</s-link>
                <s-paragraph color="subdued">The OpenAI scan integration is still pending. Adding a key alone does not activate real analysis.</s-paragraph>
                <s-text-field label="Provider name" placeholder="Your skin-analysis provider" value={quiz.scanIntegration?.provider || ""} onInput={event => { const provider = event.currentTarget.value; setQuiz(current => ({ ...current, scanIntegration: { endpoint: "", documentation: "", ...current.scanIntegration, provider } })); }} />
                <s-text-field label="API endpoint" placeholder="https://api.example.com/analyze" details="Do not include API keys or other secrets in this URL." value={quiz.scanIntegration?.endpoint || ""} onInput={event => { const endpoint = event.currentTarget.value; setQuiz(current => ({ ...current, scanIntegration: { provider: "", documentation: "", ...current.scanIntegration, endpoint } })); }} />
                <s-text-field label="API documentation URL" placeholder="https://example.com/docs" value={quiz.scanIntegration?.documentation || ""} onInput={event => { const documentation = event.currentTarget.value; setQuiz(current => ({ ...current, scanIntegration: { provider: "", endpoint: "", ...current.scanIntegration, documentation } })); }} />
                <s-badge tone={scanKeyPresent ? "success" : "warning"}>{scanKeyPresent ? "OpenAI API key present" : "OpenAI API key missing"}</s-badge>
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto auto" gap="small" alignItems="end">
                  {showApiKey ? <s-text-field label="OpenAI API key (temporary)" value={apiKeyDraft} onInput={event => { setApiKeyDraft(event.currentTarget.value); setKeyCopyStatus(""); }} /> : <s-password-field label="OpenAI API key (temporary)" value={apiKeyDraft} onInput={event => { setApiKeyDraft(event.currentTarget.value); setKeyCopyStatus(""); }} />}
                  <s-button icon={showApiKey ? "hide" : "view"} accessibilityLabel={showApiKey ? "Hide API key" : "Show API key"} onClick={() => setShowApiKey(current => !current)} />
                  <s-button icon="clipboard" accessibilityLabel="Copy API key" disabled={!apiKeyDraft} onClick={async () => {
                    try { await navigator.clipboard.writeText(apiKeyDraft); setKeyCopyStatus("API key copied."); }
                    catch { setKeyCopyStatus("Copy failed. Use Show API key and copy manually."); }
                  }} />
                </s-grid>
                {keyCopyStatus ? <s-text color="subdued">{keyCopyStatus}</s-text> : null}
                <s-paragraph color="subdued">This temporary field helps you copy a new key to your server configuration. It is not saved or connected by Save provider settings. Clear it after copying.</s-paragraph>
                <s-stack direction="inline"><s-button variant="tertiary" disabled={!apiKeyDraft} onClick={() => { setApiKeyDraft(""); setShowApiKey(false); setKeyCopyStatus(""); }}>Clear key</s-button></s-stack>
                <s-paragraph>OPENAI_API_KEY is checked on the server. The secret is never displayed here. Key presence does not verify the connection.</s-paragraph>
                <s-stack direction="inline" justifyContent="end"><s-button variant="primary" loading={pending} onClick={save}>Save provider settings</s-button></s-stack>
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
              {mappingDraft?.id ? <s-modal ref={mappingModal} id="edit-content-mapping" heading="Edit content mapping" onAfterHide={() => setMappingDraft(current => current?.id ? null : current)}>
                <MappingEditor key={mappingDraft.id} draft={mappingDraft} products={products} tags={selectableTags(quiz, products)} onChange={setMappingDraft} onSave={commitMapping} onCancel={() => setMappingDraft(null)} pending={pending} compact />
                <s-button slot="primary-action" variant="primary" loading={pending} disabled={!mappingDraft.tags.length || !mappingDraft.productHandle} onClick={commitMapping}>Save mapping</s-button>
              </s-modal> : mappingDraft ? <MappingEditor key="new" draft={mappingDraft} products={products} tags={selectableTags(quiz, products)} onChange={setMappingDraft} onSave={commitMapping} onCancel={() => setMappingDraft(null)} pending={pending} /> : null}
              <s-section heading="Product mappings" padding="none">
                {(quiz.mappings || []).length ? <s-table>
                  <s-table-header-row>
                    <s-table-header>Order</s-table-header>
                    <s-table-header><s-checkbox label="Select all mappings" checked={pickedRows.length === quiz.mappings.length} indeterminate={pickedRows.length > 0 && pickedRows.length < quiz.mappings.length} onChange={event => setPickedRows(event.currentTarget.checked ? quiz.mappings.map(item => item.id) : [])} /></s-table-header>
                    <s-table-header>Selected tags</s-table-header><s-table-header>Resource type</s-table-header><s-table-header listSlot="primary">Resource name</s-table-header><s-table-header>Actions</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {quiz.mappings.map((mapping, mappingIndex) => {
                      const product = products.find(item => item.handle === mapping.productHandle);
                      const variant = product?.variants?.find(item => item.id === mapping.variantId);
                      const title = `${product?.title || mapping.productHandle}${variant ? ` - ${variant.title}` : ""}`;
                      return <s-table-row key={mapping.id} ref={row => {
                        if (row) mappingRows.current.set(mapping.id, row);
                        else mappingRows.current.delete(mapping.id);
                      }}>
                        <s-table-cell>
                          <s-button variant="tertiary" accessibilityLabel={`Drag to move ${title}`} disabled={pending} ref={handle => {
                            if (!handle) return;
                            handle.draggable = false;
                            handle.style.cursor = "grab";
                            handle.style.touchAction = "none";
                            const beginDrag = (event: PointerEvent) => {
                              if (pending || event.button !== 0) return;
                              event.preventDefault();
                              dragCleanup.current?.();
                              const startY = event.clientY;
                              const source = mappingRows.current.get(mapping.id);
                              const previousSelection = document.body.style.userSelect;
                              document.body.style.userSelect = "none";
                              handle.style.cursor = "grabbing";
                              if (source) source.style.opacity = "0.5";
                              const clean = () => {
                                document.removeEventListener("pointerup", finish, true);
                                document.removeEventListener("pointermove", track, true);
                                document.removeEventListener("pointercancel", clean, true);
                                for (const row of mappingRows.current.values()) for (const cell of row.children) (cell as HTMLElement).style.backgroundColor = "";
                                document.body.style.userSelect = previousSelection;
                                handle.style.cursor = "grab";
                                if (source) source.style.opacity = "";
                                dragCleanup.current = null;
                              };
                              let target: string | null = null;
                              const track = (move: PointerEvent) => {
                                move.preventDefault();
                                target = null;
                                for (const [targetId, row] of mappingRows.current) {
                                  // Polaris table rows may use display:contents; measure rendered cells.
                                  const cells = Array.from(row.children) as HTMLElement[];
                                  const bounds = cells.map(cell => cell.getBoundingClientRect()).filter(rect => rect.height > 0);
                                  const over = bounds.some(rect => move.clientY >= rect.top && move.clientY <= rect.bottom);
                                  for (const cell of cells) cell.style.backgroundColor = over && targetId !== mapping.id ? "#eaf4ff" : "";
                                  if (over) target = targetId;
                                }
                              };
                              const finish = (up: PointerEvent) => {
                                track(up);
                                const destination = target;
                                clean();
                                if (Math.abs(up.clientY - startY) >= 4 && destination) moveMapping(mapping.id, destination);
                              };
                              dragCleanup.current = clean;
                              document.addEventListener("pointerup", finish, true);
                              document.addEventListener("pointermove", track, { capture: true, passive: false });
                              document.addEventListener("pointercancel", clean, true);
                            };
                            // Capture before the component's internal button handles the event.
                            const previous = (handle as typeof handle & { dragStart?: (event: PointerEvent) => void }).dragStart;
                            if (previous) handle.removeEventListener("pointerdown", previous, true);
                            handle.addEventListener("pointerdown", beginDrag, true);
                            (handle as typeof handle & { dragStart?: (event: PointerEvent) => void }).dragStart = beginDrag;
                            handle.onkeydown = event => {
                              const nextIndex = event.key === "ArrowUp" ? mappingIndex - 1 : event.key === "ArrowDown" ? mappingIndex + 1 : -1;
                              if (nextIndex >= 0 && nextIndex < quiz.mappings.length) { event.preventDefault(); moveMapping(mapping.id, quiz.mappings[nextIndex].id); }
                            };
                          }}>⠿</s-button>
                        </s-table-cell>
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
            {showQuestions && question && (tab !== "edit" || questionOpen) ? <QuestionContainer heading={`Question ${safeIndex + 1}`} {...(tab === "edit" ? { ref: questionModal, onAfterHide: () => setQuestionOpen(false) } : {})}>
              <s-stack gap="base">
                <s-text-area label="Question" rows={3} value={question.text} onInput={event => patch({ text: event.currentTarget.value })} />
                <s-grid gridTemplateColumns={tab === "tags" ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(240px, 1fr))"} gap="base">
                  {question.options.map((option, optionIndex) => <s-box key={optionIndex} border="base" borderRadius="base" padding="base">
                    <s-stack gap="small">
                      {tab === "tags" ? <s-text type="strong">{option.label}</s-text> : <>
                        <s-text-field label={`Answer ${optionIndex + 1}`} value={option.label} onInput={event => patchOption(optionIndex, { label: event.currentTarget.value })} />
                        <s-button variant="tertiary" tone="critical" disabled={question.options.length <= 2} onClick={() => removeOption(optionIndex)}>Delete answer</s-button>
                      </>}
                      {tab === "tags" ? <>
                        <s-stack direction="inline" gap="small">{tagsFor(option).map(tag => <s-clickable-chip key={tag} removable accessibilityLabel={`Remove ${tag}`} onRemove={() => applyTags(optionIndex, tagsFor(option).filter(item => item !== tag))}>{tag}</s-clickable-chip>)}</s-stack>
                        <s-text-field label={`Tags for answer ${optionIndex + 1}`} placeholder="Enter tags here" details="Separate multiple tags with commas." value={tagDrafts[`${kind}-${safeIndex}-${optionIndex}`] || ""} onInput={event => { const value = event.currentTarget.value; setTagDrafts(current => ({ ...current, [`${kind}-${safeIndex}-${optionIndex}`]: value })); }} />
                      </> : null}
                    </s-stack>
                  </s-box>)}
                </s-grid>
                {tab === "tags" ? <s-stack direction="inline" gap="base" justifyContent="space-between" alignItems="center"><s-text color="subdued">Multiple tags can be added by separating them with commas.</s-text><s-button variant="primary" loading={pending} onClick={saveAllTags}>Save tags</s-button></s-stack> : <s-stack direction="inline" gap="small" justifyContent="center">
                  <s-button disabled={question.options.length >= 8} onClick={() => {
                    const options = kind === "quick" ? [...question.options, { value: "balanced", tag: "balanced" as const, label: "New answer", hint: "" }] : [...(question as DeepQuestion).options, { label: "New answer", hint: "", tag: "vata" as const, scores: scoresForTag("vata", (question as DeepQuestion).layer) }];
                    patch({ options } as Partial<QuickQuestion & DeepQuestion>);
                  }}>Add answer</s-button>
                  <s-button onClick={() => { if (safeIndex < questions.length - 1) setIndex(safeIndex + 1); else if (kind === "quick" && quiz.deep.length) { setKind("deep"); setIndex(0); } }}>{question.continueLabel || "Continue"}</s-button>
                </s-stack>}
              </s-stack>
            </QuestionContainer> : null}
          </s-stack>
        </s-grid>
        </s-query-container>
      </s-stack>
    </s-page>
  );
}
