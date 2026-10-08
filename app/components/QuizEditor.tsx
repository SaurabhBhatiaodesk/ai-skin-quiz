import referenceQuizCss from "../reference-quiz.css?raw";
import { useEffect, useRef, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
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

// Keep an option's scoring in sync with its dosha tag; removing the dosha tag makes the answer neutral.
function withTags<T extends { tags?: string[]; label: string }>(option: T, tags: string[], kind: Kind, layer: number): T {
  const dosha = tags.find(isDosha);
  if (dosha) return kind === "quick" ? { ...option, tags, tag: dosha, value: dosha } : { ...option, tags, tag: dosha, scores: scoresForTag(dosha, layer) };
  if (!tagsFor(option).some(isDosha)) return { ...option, tags };
  return kind === "quick" ? { ...option, tags, tag: "balanced", value: "balanced" } : { ...option, tags, tag: "balanced", scores: {} };
}

export default function QuizEditor({
  initial,
  shop,
  products,
  productsError = false,
  code,
}: {
  initial: StoredQuiz & { name?: string };
  shop: string;
  products: ShopProduct[];
  productsError?: boolean;
  code: string;
}) {
  const fetcher = useFetcher<SaveResult>();
  const [quiz, setQuiz] = useState(initial);
  const [embedCopyStatus, setEmbedCopyStatus] = useState("");
  const embedCode = `<iframe src="/apps/dosha-quiz/widget?code=${encodeURIComponent(code)}" title="Skin quiz" style="display:block;width:100%;height:700px;border:0;" loading="lazy" allow="camera"></iframe>
<script>(function(){var frame=document.currentScript.previousElementSibling;window.addEventListener('message',function(event){if(event.source!==frame.contentWindow||event.origin!==window.location.origin||!event.data||event.data.type!=='prana-widget-height')return;var height=Number(event.data.height);if(Number.isFinite(height)&&height>0&&height<20000)frame.style.height=Math.ceil(height)+'px';});})();</script>`;
  const [kind, setKind] = useState<Kind>(initial.layout === "scan" ? "scan" : initial.singleFlow === "deep" || (initial.enabledPaths && !initial.enabledPaths.includes("quick")) ? "deep" : "quick");
  const [index, setIndex] = useState(0);
  const [questionOpen, setQuestionOpen] = useState(false);
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
  const shopify = useAppBridge();
  const saveResult = fetcher.data;
  useEffect(() => {
    if (saveResult?.ok) shopify.toast.show("Quiz saved");
  }, [saveResult, shopify]);
  const enabledPaths = quiz.enabledPaths || (quiz.layout === "scan" ? ["scan"] : quiz.layout === "single" ? [quiz.singleFlow || "quick"] : ["quick", "deep", "scan"]);
  const questions = kind === "scan" ? [] : kind === "quick" ? quiz.quick : quiz.deep;
  const scanner = quiz.scanner || { title: "AI Skin Scan", description: "Use a camera or photo upload for cosmetic skin observations.", camera: true, upload: true };
  const safeIndex = Math.min(index, Math.max(questions.length - 1, 0));
  const question = questions[safeIndex];
  const questionPage = Math.floor(safeIndex / 5);
  const pageStart = questionPage * 5;
  const visibleQuestions = questions.slice(pageStart, pageStart + 5);

  function save() {
    // Save to the dedicated editor route.
    fetcher.submit(quiz, { method: "POST", encType: "application/json", action: `/app/editor?quiz=${encodeURIComponent(code)}` });
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
    const layer = "layer" in question ? question.layer : 1;
    const options = question.options.map((option, itemIndex) => (itemIndex === optionIndex ? withTags(option, stored, kind, layer) : option));
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
      return withTags(option, tags, kind, "layer" in question ? question.layer : 1);
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
    // Open the new question straight away so it can be filled in.
    if (tab === "edit") setQuestionOpen(true);
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
          phase: "Prakriti · Your baseline nature",
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
    fetcher.submit(next, { method: "POST", encType: "application/json", action: `/app/editor?quiz=${encodeURIComponent(code)}` });
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

  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : "";
  const result = quiz.profiles[resultKey];
  const showQuestions = tab === "edit" || tab === "tags";
  const design = quiz.design || { background: "#faf7f2", text: "#1a1208", accent: "#8f6330", buttonText: "#ffffff", font: "classic" as const, radius: "rounded" as const };
  const showSidebar = (showQuestions && quiz.layout !== "scan" && !(tab === "edit" && questionOpen)) || tab === "content";

  return (
    <s-page heading={`${quiz.name || "Quiz"} · ${TABS.find(item => item.id === tab)?.label || "Quiz editor"}`} inlineSize="large">
      <s-button slot="breadcrumb-actions" href="/app/quizzes" accessibilityLabel="Back to quizzes">Quizzes</s-button>
      <s-button slot="primary-action" variant="primary" loading={pending} onClick={save}>Save</s-button>
      <s-stack gap="base">
        {quiz.profileImage ? <s-stack direction="inline" justifyContent="space-between" alignItems="center"><s-heading>{quiz.name || "Quiz"}</s-heading><s-box inlineSize="80px"><s-image src={quiz.profileImage} alt="Quiz profile" aspectRatio="1" objectFit="cover" borderRadius="large" /></s-box></s-stack> : null}
        <s-stack direction="inline" gap="small">
          {TABS.map(item => <s-button key={item.id} variant={tab === item.id ? "primary" : "tertiary"} onClick={() => setTab(item.id)}>{item.label}</s-button>)}
        </s-stack>
        {error ? <s-banner tone="critical" heading="Could not save quiz">{error}</s-banner> : null}
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
                  {enabledPaths.length > 1 ? <s-select label="Quiz flow" value={kind} onChange={event => { setKind(event.currentTarget.value === "scan" ? "scan" : event.currentTarget.value === "deep" ? "deep" : "quick"); setIndex(0); }}>
                    {enabledPaths.includes("quick") ? <s-option value="quick">Quick Quiz ({quiz.quick.length} questions)</s-option> : null}
                    {enabledPaths.includes("deep") ? <s-option value="deep">Deep Quiz ({quiz.deep.length} questions)</s-option> : null}
                    {enabledPaths.includes("scan") ? <s-option value="scan">AI Skin Scan</s-option> : null}
                  </s-select> : null}
                  <s-text color="subdued">{kind === "scan" ? "Configure camera and photo upload for the scan block." : "Select a question to edit"}</s-text>
                  {kind !== "scan" && !questions.length ? <s-banner heading="No questions yet">Click Add question to create the first question for this quiz, then Save.</s-banner> : null}
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
                  <s-button onClick={() => setQuiz(current => ({ ...current, widgetCss: referenceQuizCss, design: { ...design, background: "#f3ecd9", text: "#180d0c", accent: "#4c1428", buttonText: "#ffffff", font: "classic", radius: "rounded" } }))}>Apply cream and burgundy design</s-button>
                  <s-paragraph color="subdued">Matches the reference question layout. Edit its CSS in Settings ? Widget CSS, then Save.</s-paragraph>
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
                    <s-button tone="critical" disabled={!pickedRows.length || pending} commandFor="delete-mappings-modal" command="--show">Delete selected</s-button>
                  </s-menu>
                  <s-button icon="plus" onClick={() => setMappingDraft({ id: "", tags: [], productHandle: "", grouping: "or" })}>New mapping</s-button>
                </> : null}
              </s-stack>
            </s-section> : null}
            {tab === "settings" ? <s-section heading="Quiz settings">
          <s-stack gap="base">
                <s-badge>{quiz.layout === "scan" ? "AI Skin Scan" : quiz.layout === "single" ? "Single Quiz" : "Combined Quiz"}</s-badge>
                <s-text-field label="Quiz name" value={quiz.name || ""} onInput={event => { const name = event.currentTarget.value; setQuiz(current => ({ ...current, name })); }} />
                <s-text-field label="Quiz cover image URL" value={quiz.coverImage || ""} details="Use an HTTPS image URL from Shopify Files." onInput={event => { const coverImage = event.currentTarget.value; setQuiz(current => ({ ...current, coverImage })); }} />
                <s-text-field label="Profile image URL" value={quiz.profileImage || ""} details="Shown on the right of this quiz header." onInput={event => { const profileImage = event.currentTarget.value; setQuiz(current => ({ ...current, profileImage })); }} />
                <s-text-field label="App block widget ID" readOnly value={code} />
                <s-text-area label="Shopify Custom Liquid embed code" rows={5} readOnly value={embedCode} />
                <s-stack direction="inline" gap="base"><s-button icon="clipboard" onClick={async () => { try { await navigator.clipboard.writeText(embedCode); setEmbedCopyStatus("Embed code copied."); } catch { setEmbedCopyStatus("Select and copy the code above."); } }}>Copy code</s-button><s-text>{embedCopyStatus}</s-text></s-stack>
                <s-paragraph>In your Shopify theme editor, add a Custom Liquid section, paste this complete code, and save. It loads this saved quiz, including its Widget CSS. The embed adjusts its height automatically.</s-paragraph>
                <s-paragraph color="subdued">Or add this quiz from Quizzes: open the actions menu on the quiz card, choose Add to theme, paste the App block widget ID above into the block, and save the theme.</s-paragraph>
                <s-stack direction="inline" gap="small"><s-button href="/app/quizzes">All quizzes</s-button></s-stack>
              </s-stack>
            </s-section> : null}
            {tab === "settings" ? <s-section heading="Widget CSS">
              <s-stack gap="base">
                <s-paragraph color="subdued">Add custom CSS on top of the default quiz styles. Leave empty to use the defaults. Rules apply only inside this widget and override the defaults, for example: .entry-card {"{"} border-radius: 24px; {"}"}</s-paragraph>
                <s-text-area label="Custom CSS" rows={12} placeholder=".entry-card { border-radius: 24px; }" value={quiz.widgetCss || ""} onInput={event => { const widgetCss = event.currentTarget.value; setQuiz(current => ({ ...current, widgetCss })); }} />
                <s-stack direction="inline" gap="base">
                  <s-button variant="primary" loading={pending} onClick={save}>Save CSS</s-button>
                  <s-button disabled={!quiz.widgetCss} onClick={() => setQuiz(current => ({ ...current, widgetCss: "" }))}>Reset to default</s-button>
                </s-stack>
              </s-stack>
            </s-section> : null}
            {tab === "settings" && enabledPaths.includes("scan") ? <s-section heading="AI Skin Scan provider">
              <s-paragraph>Provider configuration is shared across all quizzes in this store.</s-paragraph>
              <s-link href="/app/settings">Open Global Settings</s-link>
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
              {productsError ? <s-banner tone="warning" heading="Products could not be loaded">Refresh the page to try again. Existing mappings are kept.</s-banner> : null}
              <s-modal id="delete-mappings-modal" heading="Delete product mappings?">
                <s-paragraph>{`${pickedRows.length} selected ${pickedRows.length === 1 ? "mapping" : "mappings"} will be removed and the change is saved right away.`}</s-paragraph>
                <s-button slot="primary-action" variant="primary" tone="critical" commandFor="delete-mappings-modal" command="--hide" onClick={() => deleteMappings(pickedRows)}>Delete</s-button>
                <s-button slot="secondary-actions" commandFor="delete-mappings-modal" command="--hide">Cancel</s-button>
              </s-modal>
              {mappingDraft?.id ? <s-modal ref={mappingModal} id="edit-content-mapping" heading="Edit product mapping" onAfterHide={() => setMappingDraft(current => current?.id ? null : current)}>
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
                                for (const row of mappingRows.current.values()) for (const cell of row.children) ((cell.shadowRoot?.firstElementChild ?? cell) as HTMLElement).style.backgroundColor = "";
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
                                  const cells = Array.from(row.children).map((cell) => (cell.shadowRoot?.firstElementChild ?? cell) as HTMLElement);
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
            {showQuestions && question && (tab !== "edit" || questionOpen) ? <s-section heading={`Question ${safeIndex + 1}`}>
              <s-stack gap="base">
                {tab === "edit" ? <s-stack direction="inline"><s-button icon="arrow-left" onClick={() => setQuestionOpen(false)}>Back to questions</s-button></s-stack> : null}
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
            </s-section> : null}
          </s-stack>
        </s-grid>
        </s-query-container>
        {tab === "edit" && kind !== "scan" ? <s-section heading="Final step: Email capture">
          <s-stack gap="base">
            <s-paragraph color="subdued">Shown after all questions, before the result.</s-paragraph>
            <s-checkbox label="Add email capture at the end of this quiz" checked={quiz.emailCapture?.enabled === true} onChange={event => { const enabled = event.currentTarget.checked; setQuiz(current => ({...current, emailCapture: { heading: "Where should we send your ritual?", button: "See my ritual", allowSkip: true, ...current.emailCapture, enabled }})); }} />
            {quiz.emailCapture?.enabled ? <>
              <s-text-field label="Heading" value={quiz.emailCapture.heading} onInput={event => { const heading = event.currentTarget.value; setQuiz(current => ({...current, emailCapture: {...current.emailCapture!, heading}})); }} />
              <s-text-field label="Button text" value={quiz.emailCapture.button} onInput={event => { const button = event.currentTarget.value; setQuiz(current => ({...current, emailCapture: {...current.emailCapture!, button}})); }} />
              <s-checkbox label="Allow Skip" checked={quiz.emailCapture.allowSkip} onChange={event => { const allowSkip = event.currentTarget.checked; setQuiz(current => ({...current, emailCapture: {...current.emailCapture!, allowSkip}})); }} />
            </> : null}
          </s-stack>
        </s-section> : null}

      </s-stack>
    </s-page>
  );
}
