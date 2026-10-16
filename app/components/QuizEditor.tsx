import { widgetEmbedCode } from "../widget-embed";
import UnsavedChangesBar from "./UnsavedChangesBar";
import { useEffect, useRef, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import MappingEditor from "./MappingEditor";
import WidgetPreview from "./WidgetPreview";
import type { WidgetPreviewAssets } from "../widget-preview.server";
import type { MappingDraft } from "./MappingEditor";
import { useFetcher } from "react-router";
import { recommendedQuizDesign, scoresForTag, slugTag, WIDGET_TEXT_GROUPS, SCAN_TEXT_GROUP } from "../quiz-shared";
import type { DeepQuestion, ProductMapping, QuickQuestion, ResultTag, ShopProduct, StoredQuiz } from "../quiz-shared";

type SaveResult = { ok: true; quiz: StoredQuiz } | { ok: false; error: string };
type Kind = "quick" | "deep" | "scan";
type Tab = "edit" | "design" | "tags" | "products" | "content" | "settings";

const TABS: Array<{ id: Tab; label: string; icon: "edit" | "paint-brush-flat" | "hashtag" | "link" | "text" | "settings" }> = [
  { id: "edit", label: "Quiz edit", icon: "edit" },
  { id: "design", label: "Quiz design", icon: "paint-brush-flat" },
  { id: "tags", label: "Answer tags", icon: "hashtag" },
  { id: "products", label: "Link product", icon: "link" },
  { id: "content", label: "Personalized content", icon: "text" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const RESULTS = ["vata", "pitta", "kapha", "dual-vata-pitta", "dual-vata-kapha", "dual-kapha-pitta", "balanced"] as const;
const DEFAULT_CARD_ICON_URLS: Record<Kind, string> = {
  scan: "/images/onboarding/scan.svg",
  quick: "/images/onboarding/quiz.svg",
  deep: "/images/onboarding/dosha.svg",
};

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
  scanConfigured = false,
  code,
  previewAssets,
}: {
  initial: StoredQuiz & { name?: string };
  shop: string;
  products: ShopProduct[];
  productsError?: boolean;
  scanConfigured?: boolean;
  code: string;
  previewAssets?: WidgetPreviewAssets;
}) {
  const fetcher = useFetcher<SaveResult>();
  const [quiz, setQuiz] = useState(initial);
  const [savedQuiz, setSavedQuiz] = useState(initial);
  const submittedQuiz = useRef(initial);
  const [embedCopyStatus, setEmbedCopyStatus] = useState("");
  const embedCode = widgetEmbedCode(code);
  const [kind, setKind] = useState<Kind>(initial.layout === "scan" ? "scan" : initial.singleFlow === "deep" || (initial.enabledPaths && !initial.enabledPaths.includes("quick")) ? "deep" : "quick");
  const [index, setIndex] = useState(0);
  const [previewMobile, setPreviewMobile] = useState(false);
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
    if (saveResult?.ok) { setSavedQuiz(submittedQuiz.current); shopify.toast.show("Quiz saved"); }
    // The error banner sits at the top of the page; a toast makes a failed save visible wherever the merchant is.
    else if (saveResult && !saveResult.ok) shopify.toast.show(saveResult.error || "Could not save the quiz.", { isError: true, duration: 8000 });
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
    submittedQuiz.current = quiz;
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

  function addQuestion(position?: number) {
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
        const target = position === undefined ? quick.length - 1 : Math.max(0, Math.min(position, quick.length - 1));
        if (target < quick.length - 1) quick.splice(target, 0, quick.pop()!);
        setIndex(target);
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
      const target = position === undefined ? deep.length - 1 : Math.max(0, Math.min(position, deep.length - 1));
      if (target < deep.length - 1) deep.splice(target, 0, deep.pop()!);
      setIndex(target);
      return { ...current, deep };
    });
  }

  function moveQuestion(target: number) {
    if (!Number.isInteger(target) || target < 0 || target >= questions.length || target === safeIndex) return;
    setQuiz(current => {
      if (kind === "quick") {
        const quick = [...current.quick];
        quick.splice(target, 0, quick.splice(safeIndex, 1)[0]);
        return { ...current, quick };
      }
      const deep = [...current.deep];
      deep.splice(target, 0, deep.splice(safeIndex, 1)[0]);
      return { ...current, deep };
    });
    setIndex(target);
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
    submittedQuiz.current = next;
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
  const scanOnly = quiz.layout === "scan";
  const editorTabs = scanOnly ? TABS.filter(item => item.id === "edit" || item.id === "design" || item.id === "settings").map(item => ({ ...item, label: item.id === "edit" ? "Skin Scan settings" : item.id === "design" ? "Scan design" : item.label })) : TABS.filter(item => quiz.resultMode !== "products" || item.id !== "content");
  const showQuestions = tab === "edit" || tab === "tags";
  const design = { ...recommendedQuizDesign, ...quiz.design };
  const showSidebar = (showQuestions && quiz.layout !== "scan" && !(tab === "edit" && questionOpen)) || tab === "content";
  const usedMappingTags = new Set(quiz.mappings.filter(mapping => mapping.id !== mappingDraft?.id).flatMap(mapping => mapping.tags));
  const availableMappingTags = selectableTags(quiz, products).filter(tag => !usedMappingTags.has(tag) || mappingDraft?.tags.includes(tag));

  return (
    <s-page heading={`${quiz.name || "Quiz"} · ${editorTabs.find(item => item.id === tab)?.label || "Quiz editor"}`} inlineSize="large">
      <UnsavedChangesBar id="quiz-editor-save-bar" dirty={JSON.stringify(quiz) !== JSON.stringify(savedQuiz)} pending={pending} onSave={save} onDiscard={() => { setQuiz(savedQuiz); setTagDrafts({}); setMappingDraft(null); setPickedRows([]); setQuestionOpen(false); }} />
      <s-button slot="breadcrumb-actions" href="/app/quizzes" accessibilityLabel="Back to Quizzes and Skin Scan">Quizzes &amp; Skin Scan</s-button>
      {!(tab === "products" && mappingDraft) ? <s-button slot="primary-action" variant="primary" loading={pending} disabled={JSON.stringify(quiz) === JSON.stringify(savedQuiz)} onClick={save}>Save quiz</s-button> : null}
      <s-stack gap="base">
        {quiz.profileImage ? <s-stack direction="inline" justifyContent="space-between" alignItems="center"><s-heading>{quiz.name || "Quiz"}</s-heading><s-box inlineSize="80px"><s-image src={quiz.profileImage} alt={`${quiz.name || "Quiz"} image`} aspectRatio="1 / 1" objectFit="cover" borderRadius="large" /></s-box></s-stack> : null}
        <s-stack direction="inline" gap="small">
          {editorTabs.map(item => <s-button key={item.id} icon={item.icon} variant={tab === item.id ? "primary" : "tertiary"} onClick={() => setTab(item.id)}>{item.label}</s-button>)}
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
                  {quiz.layout === "three" || enabledPaths.length > 1 ? <s-select label="Quiz flow" value={kind} onChange={event => {
                    const nextKind: Kind = event.currentTarget.value === "scan" ? "scan" : event.currentTarget.value === "deep" ? "deep" : "quick";
                    setKind(nextKind);
                    setIndex(0);
                    if (quiz.layout === "three" && !enabledPaths.includes(nextKind)) {
                      setQuiz(current => ({ ...current, enabledPaths: [...(current.enabledPaths || enabledPaths), nextKind] }));
                    }
                  }}>
                    {(quiz.layout === "three" || enabledPaths.includes("quick")) ? <s-option value="quick">Quick Quiz ({quiz.quick.length} questions)</s-option> : null}
                    {(quiz.layout === "three" || enabledPaths.includes("deep")) ? <s-option value="deep">Deep Quiz ({quiz.deep.length} questions)</s-option> : null}
                    {(quiz.layout === "three" || enabledPaths.includes("scan")) ? <s-option value="scan">AI Skin Scan</s-option> : null}
                  </s-select> : null}
                  <s-stack direction="inline" gap="base" justifyContent="space-between" alignItems="center">
                    <s-text color="subdued">{kind === "scan" ? "Configure camera and photo upload for the scan block." : "Select a question to edit, or add a new one."}</s-text>
                    {tab === "edit" && kind !== "scan" ? <s-button icon="plus" variant="primary" onClick={() => addQuestion()} disabled={questions.length >= (kind === "deep" || quiz.layout === "single" ? 40 : 12)}>Add question</s-button> : null}
                  </s-stack>
                  {kind !== "scan" && !questions.length ? <s-banner tone="warning" heading="No questions yet">Click Add question to create the first question for this quiz, then Save.</s-banner> : null}
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
            {tab === "design" ? <div className="quiz-design-workspace"><style>{`.quiz-design-workspace{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:24px;align-items:start}.quiz-design-controls,.quiz-design-preview{min-width:0}.quiz-design-preview{position:sticky;top:20px}.quiz-design-controls .quiz-design-fields{grid-template-columns:minmax(0,1fr)!important}@media(max-width:1050px){.quiz-design-workspace{grid-template-columns:minmax(0,1fr)}.quiz-design-preview{position:static}}`}</style><div className="quiz-design-controls"><s-section heading="Widget appearance settings">
              <s-stack gap="base">
                <s-paragraph color="subdued">{scanOnly ? "Customize this Skin Scan widget on your storefront. These settings are saved for this widget." : "Colors and font sizes are saved only for this widget and apply to its theme block and embed code."}</s-paragraph>
                <s-paragraph color="subdued">Heading and body fonts follow your Shopify theme.</s-paragraph>
                {kind === "scan" && !scanOnly ? <div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:20,background:"#FFFFFF"}}><s-stack gap="base">
                  <s-heading>Skin Scan colors</s-heading>
                  <s-paragraph color="subdued">Used on this widget&apos;s Skin Scan screen. Leave a field empty to use the quiz colors. The floating popup has its own colors in Skin Scan appearance.</s-paragraph>
                  {([["scanCard", "Card background", design.cardColor], ["scanText", "Text color", design.text], ["scanHeading", "Heading color", design.headingColor], ["scanButton", "Button background", design.accent], ["scanButtonText", "Button text color", design.buttonText], ["scanAccent", "Steps and checkbox color", design.accent], ["scanNoticeBg", "Notice background", "#F7EEE2"], ["scanBoxBg", "Consent box background", "#FFFFFF"]] as const).map(([key, label, fallback]) => <s-stack key={key} direction="inline" gap="small" alignItems="end">
                    <div style={{flex:1,minWidth:0}}><s-color-field label={label} placeholder={fallback || ""} value={quiz.design?.[key] || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, [key]: value } })); }} /></div>
                    {quiz.design?.[key] ? <s-button variant="tertiary" onClick={() => setQuiz(current => { const next = { ...design, ...current.design }; delete next[key]; return { ...current, design: next }; })}>Use quiz color</s-button> : null}
                  </s-stack>)}
<s-number-field label="Desktop step title size" suffix="px" min={14} max={48} value={String(design.scanTitleSize ?? 26)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, scanTitleSize: value } })); }} />
<s-number-field label="Mobile step title size" suffix="px" min={14} max={40} value={String(design.mobileScanTitleSize ?? 22)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileScanTitleSize: value } })); }} />
<s-number-field label="Desktop text size" suffix="px" min={10} max={22} value={String(design.scanTextSize ?? 15)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, scanTextSize: value } })); }} />
<s-number-field label="Mobile text size" suffix="px" min={10} max={20} value={String(design.mobileScanTextSize ?? 14)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileScanTextSize: value } })); }} />
                </s-stack></div> : null}
                {kind !== "scan" || scanOnly ? <>
                <div className="quiz-design-fields" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:16}}>
                  <div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:20,background:"#FFFFFF"}}><s-stack gap="base"><s-heading>1. Page</s-heading>
<s-color-field label="Background color" value={design.background} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, background: value } })); }} />
<s-color-field label="Body text color" value={design.text} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, text: value } })); }} />
<s-number-field label="Desktop body text size" suffix="px" min={10} max={64} value={String(design.bodySize ?? 14)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, bodySize: value } })); }} />
</s-stack></div>
                  <div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:20,background:"#FFFFFF"}}><s-stack gap="base"><s-heading>2. Header (brand line, title, subtitle)</s-heading>
{([["brandColor", "Brand line color", "#8f6330"], ["titleColor", "Title color", design.headingColor || "#000000"]] as const).map(([key, label, fallback]) => <s-color-field key={key} label={label} placeholder={fallback} value={quiz.design?.[key] || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, [key]: value } })); }} />)}
<s-color-field label="Highlight word color" placeholder={design.accent} value={quiz.design?.headingAccent || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, headingAccent: value } })); }} />
<s-color-field label="Subtitle color" placeholder="#6b6158" value={quiz.design?.subtitleColor || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, subtitleColor: value } })); }} />
<s-number-field label="Desktop title size" suffix="px" min={10} max={64} value={String(design.headingSize ?? 36)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, headingSize: value } })); }} />
<s-number-field label="Mobile title size" suffix="px" min={14} max={48} value={String(design.mobileHeadingSize ?? 28)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileHeadingSize: value } })); }} />
<s-number-field label="Desktop brand line size" suffix="px" min={8} max={24} value={String(design.brandSize ?? 11)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, brandSize: value } })); }} />
<s-number-field label="Mobile brand line size" suffix="px" min={8} max={20} value={String(design.mobileBrandSize ?? 10)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileBrandSize: value } })); }} />
<s-number-field label="Mobile subtitle size" suffix="px" min={10} max={24} value={String(design.mobileSubtitleSize ?? 13)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileSubtitleSize: value } })); }} />
<s-number-field label="Desktop space above header" suffix="px" min={0} max={120} value={String(design.headerTop ?? 40)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, headerTop: value } })); }} />
<s-number-field label="Mobile space above header" suffix="px" min={0} max={80} value={String(design.mobileHeaderTop ?? 24)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileHeaderTop: value } })); }} />
<s-number-field label="Desktop space below header" suffix="px" min={0} max={120} value={String(design.headerGap ?? 40)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, headerGap: value } })); }} />
<s-number-field label="Mobile space below header" suffix="px" min={0} max={80} value={String(design.mobileHeaderGap ?? 24)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileHeaderGap: value } })); }} />
</s-stack></div>
                </div>
                {quiz.layout === "three" || !quiz.layout ? <s-section heading="3. Entry cards"><s-stack gap="base"><s-paragraph>The three cards customers choose from first, top to bottom: card, icon, title, text, time line and button. Leave a color empty to keep the current look.</s-paragraph>
<div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16}}><s-stack gap="base"><s-text type="strong">1. Card</s-text>
<s-color-field label="Card background" placeholder={"#FFFFFF"} value={quiz.design?.entryBg || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryBg: value } })); }} />
<s-color-field label="Card border color" placeholder={"#E8E2D6"} value={quiz.design?.entryBorder || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryBorder: value } })); }} />
<s-color-field label="Featured card color (Skin Insights border, badge and button)" placeholder={design.accent} value={quiz.design?.entryFeatured || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryFeatured: value } })); }} />
<s-number-field label="Card corner radius" suffix="px" min={0} max={48} value={String(design.entryRadius ?? 24)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryRadius: value } })); }} />
</s-stack></div>
<div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16}}><s-stack gap="base"><s-text type="strong">2. Icon</s-text>
<s-color-field label="Icon background color" placeholder={"#F3F1E9"} value={quiz.design?.entryIconBg || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryIconBg: value } })); }} />
<s-number-field label="Desktop icon box size" suffix="px" min={40} max={180} value={String(design.entryIconSize ?? 116)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryIconSize: value } })); }} />
<s-number-field label="Mobile icon box size" suffix="px" min={40} max={160} value={String(design.mobileEntryIconSize ?? 104)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileEntryIconSize: value } })); }} />
</s-stack></div>
<div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16}}><s-stack gap="base"><s-text type="strong">3. Title</s-text>
<s-color-field label="Card title color" placeholder={"#1a1208"} value={quiz.design?.entryTitleColor || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryTitleColor: value } })); }} />
<s-number-field label="Desktop card title size" suffix="px" min={14} max={48} value={String(design.entryTitleSize ?? 26)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryTitleSize: value } })); }} />
<s-number-field label="Mobile card title size" suffix="px" min={14} max={40} value={String(design.mobileEntryTitleSize ?? 24)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileEntryTitleSize: value } })); }} />
</s-stack></div>
<div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16}}><s-stack gap="base"><s-text type="strong">4. Text</s-text>
<s-color-field label="Card text color" placeholder={"#6b6158"} value={quiz.design?.entryTextColor || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryTextColor: value } })); }} />
<s-number-field label="Desktop card text size" suffix="px" min={10} max={24} value={String(design.entryTextSize ?? 14)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryTextSize: value } })); }} />
<s-number-field label="Mobile card text size" suffix="px" min={10} max={22} value={String(design.mobileEntryTextSize ?? 14)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileEntryTextSize: value } })); }} />
</s-stack></div>
<div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16}}><s-stack gap="base"><s-text type="strong">5. Time line</s-text>
<s-color-field label="Time line color" placeholder={"#8f6330"} value={quiz.design?.entryTimeColor || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryTimeColor: value } })); }} />
<s-number-field label="Desktop time line size" suffix="px" min={8} max={20} value={String(design.entryTimeSize ?? 11)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryTimeSize: value } })); }} />
<s-number-field label="Mobile time line size" suffix="px" min={8} max={18} value={String(design.mobileEntryTimeSize ?? 10)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileEntryTimeSize: value } })); }} />
</s-stack></div>
<div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16}}><s-stack gap="base"><s-text type="strong">6. Button</s-text>
<s-color-field label="Outline button color (Take Quiz, Begin Reading)" placeholder={design.accent} value={quiz.design?.entryGhost || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryGhost: value } })); }} />
</s-stack></div>
<div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16}}><s-stack gap="base"><s-text type="strong">7. Spacing</s-text>
<s-number-field label="Desktop card padding" suffix="px" min={8} max={64} value={String(design.entryPadding ?? 30)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryPadding: value } })); }} />
<s-number-field label="Mobile card padding" suffix="px" min={8} max={48} value={String(design.mobileEntryPadding ?? 22)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileEntryPadding: value } })); }} />
<s-number-field label="Desktop gap between cards" suffix="px" min={0} max={60} value={String(design.entryGap ?? 26)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, entryGap: value } })); }} />
<s-number-field label="Mobile gap between cards" suffix="px" min={0} max={40} value={String(design.mobileEntryGap ?? 16)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileEntryGap: value } })); }} />
</s-stack></div>
</s-stack></s-section> : null}
                <div className="quiz-design-fields" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:16}}>
                  <div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:20,background:"#FFFFFF"}}><s-stack gap="base"><s-heading>4. Question card</s-heading>
<s-color-field label="Question heading color" value={design.headingColor || "#000000"} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, headingColor: value } })); }} />
<s-color-field label="Question card background" value={design.cardColor || "#fff9ee"} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, cardColor: value } })); }} />
<s-number-field label="Desktop question size" suffix="px" min={10} max={64} value={String(design.questionSize ?? 26)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, questionSize: value } })); }} />
<s-number-field label="Mobile question size" suffix="px" min={14} max={48} value={String(design.mobileQuestionSize ?? 20)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileQuestionSize: value } })); }} />
<s-number-field label="Desktop question to answers gap" suffix="px" min={0} max={80} value={String(design.questionGap ?? 28)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, questionGap: value } })); }} />
<s-number-field label="Mobile question to answers gap" suffix="px" min={0} max={60} value={String(design.mobileQuestionGap ?? 20)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileQuestionGap: value } })); }} />
<s-number-field label="Desktop card maximum width" suffix="px" min={320} max={1800} value={String(design.desktopWidth ?? 1120)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, desktopWidth: value } })); }} />
<s-number-field label="Desktop card padding" suffix="px" min={0} max={100} value={String(design.desktopPadding ?? 48)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, desktopPadding: value } })); }} />
<s-number-field label="Mobile card width" suffix="%" min={60} max={100} value={String(design.mobileWidth ?? 100)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileWidth: value } })); }} />
<s-number-field label="Mobile card padding" suffix="px" min={0} max={48} value={String(design.mobilePadding ?? 24)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobilePadding: value } })); }} />
</s-stack></div>
                  <div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:20,background:"#FFFFFF"}}><s-stack gap="base"><s-heading>5. Answers</s-heading>
<s-color-field label="Answer background" value={design.answerColor || "#e4c3a0"} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, answerColor: value } })); }} />
<s-color-field label="Answer text color" value={design.answerText || "#651d30"} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, answerText: value } })); }} />
<s-color-field label="Selected answer background" value={design.selectedColor || "#571c29"} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, selectedColor: value } })); }} />
<s-color-field label="Selected answer text" value={design.selectedText || "#ffffff"} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, selectedText: value } })); }} />
<s-number-field label="Desktop answer text size" suffix="px" min={10} max={64} value={String(design.answerSize ?? 18)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, answerSize: value } })); }} />
<s-number-field label="Mobile answer text size" suffix="px" min={12} max={32} value={String(design.mobileAnswerSize ?? 18)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileAnswerSize: value } })); }} />
<s-number-field label="Desktop answer padding" suffix="px" min={0} max={40} value={String(design.answerPadding ?? 12)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, answerPadding: value } })); }} />
<s-number-field label="Mobile answer padding" suffix="px" min={0} max={40} value={String(design.mobileAnswerPadding ?? 12)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileAnswerPadding: value } })); }} />
<s-number-field label="Desktop space between answers" suffix="px" min={0} max={40} value={String(design.answerSpacing ?? 14)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, answerSpacing: value } })); }} />
<s-number-field label="Mobile space between answers" suffix="px" min={0} max={32} value={String(design.mobileAnswerSpacing ?? 10)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileAnswerSpacing: value } })); }} />
</s-stack></div>
                  <div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:20,background:"#FFFFFF"}}><s-stack gap="base"><s-heading>6. Continue button</s-heading>
<s-color-field label="Button background" value={design.accent} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, accent: value } })); }} />
<s-color-field label="Button text color" value={design.buttonText} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, buttonText: value } })); }} />
<s-number-field label="Desktop button text size" suffix="px" min={10} max={64} value={String(design.buttonSize ?? 20)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, buttonSize: value } })); }} />
<s-number-field label="Mobile button text size" suffix="px" min={10} max={32} value={String(design.mobileButtonSize ?? 16)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileButtonSize: value } })); }} />
<s-number-field label="Desktop button width" suffix="%" min={20} max={100} value={String(design.desktopButtonWidth ?? 100)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, desktopButtonWidth: value } })); }} />
<s-number-field label="Mobile button width" suffix="%" min={20} max={100} value={String(design.mobileButtonWidth ?? 100)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileButtonWidth: value } })); }} />
<s-number-field label="Desktop button height" suffix="px" min={32} max={80} value={String(design.desktopButtonHeight ?? 48)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, desktopButtonHeight: value } })); }} />
<s-number-field label="Mobile button height" suffix="px" min={32} max={80} value={String(design.mobileButtonHeight ?? 44)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileButtonHeight: value } })); }} />
<s-select label="Continue button alignment" value={design.buttonAlignment || "center"} onChange={event => { const buttonAlignment = event.currentTarget.value === "left" ? "left" : event.currentTarget.value === "right" ? "right" : "center"; setQuiz(current => ({ ...current, design: { ...design, ...current.design, buttonAlignment } })); }}><s-option value="left">Left</s-option><s-option value="center">Center</s-option><s-option value="right">Right</s-option></s-select>
<s-select label="Button shape" value={design.radius} onChange={event => { const radius = event.currentTarget.value === "square" ? "square" : event.currentTarget.value === "pill" ? "pill" : "rounded"; setQuiz(current => ({ ...current, design: { ...design, radius } })); }}><s-option value="square">Square</s-option><s-option value="rounded">Rounded</s-option><s-option value="pill">Pill</s-option></s-select>
<s-number-field label="Desktop answers to button gap" suffix="px" min={0} max={80} value={String(design.buttonGap ?? 28)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, buttonGap: value } })); }} />
<s-number-field label="Mobile answers to button gap" suffix="px" min={0} max={60} value={String(design.mobileButtonGap ?? 24)} onInput={event => { const value = Number(event.currentTarget.value); setQuiz(current => ({ ...current, design: { ...design, ...current.design, mobileButtonGap: value } })); }} />
</s-stack></div>
                  <div style={{border:"1px solid #E1E3E1",borderRadius:12,padding:20,background:"#FFFFFF"}}><s-stack gap="base"><s-heading>7. Back button</s-heading>
{([["backBg", "Back button background", "#F3E8DA"], ["backText", "Back button text color", "#651D30"], ["backBorder", "Back button border color", "#D4BDA8"]] as const).map(([key, label, fallback]) => <s-color-field key={key} label={label} placeholder={fallback} value={quiz.design?.[key] || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, design: { ...design, ...current.design, [key]: value } })); }} />)}
</s-stack></div>
                </div>
                <s-section heading="8. Texts">
                  <s-stack gap="base">
                    <s-paragraph>Change any text on the widget, or tick Hide to remove it. Leave a field empty to keep the built-in text shown as the placeholder.</s-paragraph>
                    <div className="quiz-design-fields" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))",gap:16}}>
                      {[...WIDGET_TEXT_GROUPS.filter(group => quiz.layout === "three" || !quiz.layout || !/card|Entry|Below/.test(group.title)), ...((quiz.enabledPaths || ["quick", "deep", "scan"]).includes("scan") ? [SCAN_TEXT_GROUP] : [])].map(group => <div key={group.title} style={{border:"1px solid #E1E3E1",borderRadius:12,padding:16,background:"#FFFFFF"}}><s-stack gap="base">
                        <s-text type="strong">{group.title}</s-text>
                        {group.items.map(item => { const required = "required" in item; const hidden = !required && (quiz.hiddenTexts || []).includes(item.key); return <s-stack key={item.key} gap="small-200">
                          <s-text-field label={item.label} placeholder={item.placeholder} disabled={hidden} value={quiz.texts?.[item.key] || ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({ ...current, texts: { ...(current.texts || {}), [item.key]: value } })); }} />
                          {required ? null : <s-checkbox label="Hide" checked={hidden} onChange={event => { const checked = event.currentTarget.checked; setQuiz(current => { const list = (current.hiddenTexts || []).filter(key => key !== item.key); return { ...current, hiddenTexts: checked ? [...list, item.key] : list }; }); }} />}
                        </s-stack>; })}
                      </s-stack></div>)}
                    </div>
                  </s-stack>
                </s-section>
                </> : null}
                <s-stack direction="inline" justifyContent="end" gap="small">{!scanOnly ? <><s-button commandFor="restore-design-modal" command="--show">Restore recommended design</s-button>
                  <s-modal id="restore-design-modal" heading="Restore recommended design?">
                    <s-paragraph>All colors, font sizes, button and layout settings in Quiz design go back to the recommended design. Your questions, products and other settings stay as they are.</s-paragraph>
                    <s-paragraph color="subdued">Nothing is saved until you click Save design, so you can still discard it.</s-paragraph>
                    <s-button slot="primary-action" variant="primary" commandFor="restore-design-modal" command="--hide" onClick={() => setQuiz(current => ({ ...current, design: { ...recommendedQuizDesign } }))}>Restore design</s-button>
                    <s-button slot="secondary-actions" commandFor="restore-design-modal" command="--hide">Cancel</s-button>
                  </s-modal></> : null}<s-button variant="primary" loading={pending} onClick={save}>Save design</s-button></s-stack>
              </s-stack>
            </s-section></div><div className="quiz-design-preview"><s-section heading={scanOnly ? "Scan design preview" : "Quiz design preview"}>
              <s-stack gap="base">
                <s-paragraph color="subdued">This is your live storefront widget with your unsaved changes. On your store, heading and body fonts follow your theme.</s-paragraph>
                <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:16,alignItems:"end"}}>
                <div style={{minWidth:0}}><s-select label="Preview flow" value={kind} onChange={event => { setKind(event.currentTarget.value as Kind); setIndex(0); }}>
                  {enabledPaths.map(path => <s-option key={path} value={path}>{path === "scan" ? "Skin Scan" : path === "deep" ? "Deep Quiz" : "Quick Quiz"}</s-option>)}
                </s-select></div>
                <div role="group" aria-label="Preview device" style={{display:"flex",gap:6,alignItems:"center"}}>
                  {([false, true] as const).map(mobile => <button key={String(mobile)} type="button" title={mobile ? "Mobile preview (375px)" : "Desktop preview"} aria-label={mobile ? "Mobile preview" : "Desktop preview"} aria-pressed={previewMobile === mobile} onClick={() => setPreviewMobile(mobile)} style={{width:40,height:40,display:"grid",placeItems:"center",border:0,borderRadius:10,cursor:"pointer",background:previewMobile === mobile ? "#e9efff" : "#f1f1f1",color:previewMobile === mobile ? "#005bd3" : "#555"}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{mobile ? <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/></> : <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4M7 21h10"/></>}</svg>
                  </button>)}
                </div>
                </div>
                {previewAssets ? <WidgetPreview assets={previewAssets} quiz={{ ...quiz, handle: code }} kind={kind} index={0} mobile={previewMobile} /> : null}
              </s-stack>
            </s-section></div></div> : null}
            {showQuestions && kind === "scan" ? <s-section heading="AI Skin Scan settings">
              <s-stack gap="base">
                {!scanConfigured ? <s-banner tone="warning" heading="Analysis setup required">Camera and photo upload are available. Select OpenAI and save its API key in Global Settings to enable skin observations.<s-button slot="primary-action" href="/app/settings">Connect AI</s-button></s-banner> : null}
                <s-stack direction="inline"><s-button href={`https://${shop}/?dosha_scan=${encodeURIComponent(code)}`} target="_blank">Start scan</s-button></s-stack>
                <s-text-field label="Scan title" value={scanner.title} onInput={event => { const title = event.currentTarget.value; setQuiz(current => ({ ...current, scanner: { ...scanner, title } })); }} />
                <s-text-area label="Scan description" value={scanner.description} onInput={event => { const description = event.currentTarget.value; setQuiz(current => ({ ...current, scanner: { ...scanner, description } })); }} />
                <s-checkbox label="Allow live camera" checked={scanner.camera} onChange={event => { const camera = event.currentTarget.checked; setQuiz(current => ({ ...current, scanner: { ...scanner, camera } })); }} />
                <s-checkbox label="Allow photo upload" checked={scanner.upload} onChange={event => { const upload = event.currentTarget.checked; setQuiz(current => ({ ...current, scanner: { ...scanner, upload } })); }} />
                <s-paragraph color="subdued">Keep at least one capture method enabled. Customers can use the camera or upload a photo for skin observations.</s-paragraph>
              </s-stack>
            </s-section> : null}
            {tab === "products" ? <s-section>
              <s-stack direction="inline" gap="small" justifyContent="end">
                {tab === "products" ? <>
                  <s-button commandFor="quiz-bulk-actions">Bulk actions</s-button>
                  <s-menu id="quiz-bulk-actions" accessibilityLabel="Bulk actions">
                    <s-button tone="critical" disabled={!pickedRows.length || pending} commandFor="delete-mappings-modal" command="--show">Delete selected</s-button>
                  </s-menu>
                  <s-button icon="plus" onClick={() => setMappingDraft({ id: "", tags: [], productHandle: "", grouping: "or" })}>New mapping</s-button>
                </> : null}
              </s-stack>
            </s-section> : null}
            {tab === "settings" ? <s-section heading={scanOnly ? "Skin Scan widget settings" : "Quiz settings"}>
          <s-stack gap="base">
                <div style={{display:"inline-flex",alignItems:"center",gap:7,padding:"6px 10px",borderRadius:8,background:"#EEF3EF",color:"#344E3E",width:"fit-content",fontSize:12,fontWeight:600,lineHeight:"18px"}}><s-icon type="clipboard" size="small" /><span>{quiz.layout === "scan" ? "AI Skin Scan" : quiz.layout === "single" ? "Single Quiz" : "Combined Quiz"}</span></div>
                <s-text-field label={scanOnly ? "Skin Scan name" : "Quiz name"} value={quiz.name || ""} onInput={event => { const name = event.currentTarget.value; setQuiz(current => ({ ...current, name })); }} />
                <s-text-field label={scanOnly ? "Skin Scan cover image URL" : "Quiz cover image URL"} id="quiz-cover-image" value={quiz.coverImage || ""} details="Use an HTTPS image URL from Shopify Files." onInput={event => { const coverImage = event.currentTarget.value; setQuiz(current => ({ ...current, coverImage })); }} />
                {quiz.coverImage ? <s-stack direction="inline" gap="small"><s-button icon="edit" onClick={() => document.getElementById("quiz-cover-image")?.focus()}>Change cover image</s-button><s-button icon="delete" tone="critical" onClick={() => setQuiz(current => ({...current,coverImage:""}))}>Reset to default</s-button></s-stack> : null}
                <s-text-field label="Profile image URL" id="quiz-profile-image" value={quiz.profileImage || ""} details="Shown on the right of this widget header." onInput={event => { const profileImage = event.currentTarget.value; setQuiz(current => ({ ...current, profileImage })); }} />
                {quiz.profileImage ? <s-stack direction="inline" gap="small"><s-button icon="edit" onClick={() => document.getElementById("quiz-profile-image")?.focus()}>Change profile image</s-button><s-button icon="delete" tone="critical" onClick={() => setQuiz(current => ({...current,profileImage:""}))}>Remove profile image</s-button></s-stack> : null}
                <s-text-field label="App block widget ID" details="Generated automatically. Use this ID when adding this widget to your theme." readOnly value={code} />
                <s-text-area label="Shopify Custom Liquid embed code" rows={5} readOnly value={embedCode} />
                <s-stack direction="inline" gap="base"><s-button icon="clipboard" onClick={async () => { try { await navigator.clipboard.writeText(embedCode); setEmbedCopyStatus("Embed code copied."); } catch { setEmbedCopyStatus("Select and copy the code above."); } }}>Copy code</s-button><s-text>{embedCopyStatus}</s-text></s-stack>
                <s-paragraph>In your Shopify theme editor, add a Custom Liquid section, paste this complete code, and save. It loads this saved widget, including its Widget CSS. The iframe stays visible if the theme editor skips its resize script. If you already pasted an older embed, replace all of it with this version; existing theme code does not update itself.</s-paragraph>
                <s-paragraph color="subdued">Or open Quizzes &amp; Skin Scan, choose Add to theme from the widget actions menu, paste its widget ID into the matching block, and save the theme.</s-paragraph>
                <s-stack direction="inline" gap="small"><s-button href="/app/quizzes">All widgets</s-button></s-stack>
              </s-stack>
            </s-section> : null}
            {tab === "settings" ? <s-section heading={scanOnly ? "Skin Scan icon" : "Quiz card icons"}>
              <s-stack gap="base">
                <s-paragraph>Each path starts with the matching illustrated icon. Upload an SVG, PNG, JPG or WebP image (up to 64 KB), or enter an HTTPS image URL, to customize it. Remove your image to restore the default.</s-paragraph>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 420px), 1fr))",gap:16}}>
                {(["scan", "quick", "deep"] as const).map(path => <div key={path} style={{display:"grid",gap:12,padding:16,border:"1px solid #E3E8E4",borderRadius:12}}>
                  <s-heading>{path === "scan" ? "AI Skin Scan" : path === "quick" ? "Quick Quiz" : "Deep Dosha"}</s-heading>
                  <s-box inlineSize="72px" paddingBlock="small"><s-image src={quiz.cardIcons?.[path] || DEFAULT_CARD_ICON_URLS[path]} alt={`${path} card icon preview`} aspectRatio="5 / 4" objectFit="contain" /></s-box>
                  <s-drop-zone id={`card-icon-upload-${path}`} label={quiz.cardIcons?.[path] ? "Change card icon" : "Upload card icon"} accept=".svg,.png,.jpg,.jpeg,.webp" accessibilityLabel={`Upload ${path} card icon`} onDropRejected={event => { event.currentTarget.error = "Choose an SVG, PNG, JPG or WebP image."; }} onChange={event => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];
                    if (!file) return;
                    if (file.size > 65536 || !["image/svg+xml","image/png","image/jpeg","image/webp"].includes(file.type)) { input.error = "Choose an SVG, PNG, JPG or WebP file under 64 KB."; input.value=""; return; }
                    input.error = "";
                    const reader = new FileReader();
                    reader.onload = () => { const value = reader.result; if (typeof value === "string") setQuiz(current => ({...current,cardIcons:{...current.cardIcons,[path]:value}})); };
                    reader.onerror = () => { input.error = "Could not read this file. Please try again."; };
                    reader.readAsDataURL(file);
                  }} />
                  <s-text-field label="Or HTTPS icon image URL" value={quiz.cardIcons?.[path]?.startsWith("https://") ? quiz.cardIcons[path] : ""} onInput={event => { const value = event.currentTarget.value; setQuiz(current => ({...current,cardIcons:{...current.cardIcons,[path]:value}})); }} />
                  <s-button icon="delete" variant="secondary" disabled={!quiz.cardIcons?.[path]} onClick={() => setQuiz(current => ({...current,cardIcons:{...current.cardIcons,[path]:""}}))}>Remove image / use default</s-button>
                </div>)}
                </div>
                <s-stack direction="inline"><s-button variant="primary" loading={pending} onClick={save}>Save icons</s-button></s-stack>
              </s-stack>
            </s-section> : null}
            {tab === "settings" ? <s-section heading="Widget CSS">
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 420px), 1fr))",gap:24,alignItems:"start"}}>
                <s-paragraph color="subdued">Add custom CSS for this widget. Leave empty to use the defaults. Rules apply only inside this widget.</s-paragraph>
                <s-stack gap="base">
                  <s-text-area label="Custom CSS" rows={12} placeholder=".entry-card { border-radius: 24px; }" value={quiz.widgetCss || ""} onInput={event => { const widgetCss = event.currentTarget.value; setQuiz(current => ({ ...current, widgetCss })); }} />
                  <s-stack direction="inline" gap="base">
                    <s-button variant="primary" loading={pending} onClick={save}>Save CSS</s-button>
                    <s-button disabled={!quiz.widgetCss} onClick={() => setQuiz(current => ({ ...current, widgetCss: "" }))}>Reset to default</s-button>
                  </s-stack>
                </s-stack>
              </div>
            </s-section> : null}
            {tab === "settings" && enabledPaths.includes("scan") ? <s-section heading="AI Skin Scan provider">
              <s-paragraph>Provider configuration is shared across all quizzes in this store.</s-paragraph>
              <s-link href="/app/settings">Open Global Settings</s-link>
            </s-section> : null}

            {tab === "products" ? <>
              <s-paragraph color="subdued">Save mapping applies the product link immediately. No additional Save quiz is needed.</s-paragraph>
              {productsError ? <s-banner tone="warning" heading="Products could not be loaded">Refresh the page to try again. Existing mappings are kept.</s-banner> : null}
              <s-modal id="delete-mappings-modal" heading="Delete product mappings?">
                <s-paragraph>{`${pickedRows.length} selected ${pickedRows.length === 1 ? "mapping" : "mappings"} will be removed and the change is saved right away.`}</s-paragraph>
                <s-button slot="primary-action" variant="primary" tone="critical" commandFor="delete-mappings-modal" command="--hide" onClick={() => deleteMappings(pickedRows)}>Delete</s-button>
                <s-button slot="secondary-actions" commandFor="delete-mappings-modal" command="--hide">Cancel</s-button>
              </s-modal>
              {mappingDraft?.id ? <s-modal ref={mappingModal} id="edit-content-mapping" heading="Edit product mapping" onAfterHide={() => setMappingDraft(current => current?.id ? null : current)}>
                <MappingEditor key={mappingDraft.id} draft={mappingDraft} products={products} tags={availableMappingTags} onChange={setMappingDraft} onSave={commitMapping} onCancel={() => setMappingDraft(null)} pending={pending} compact />
                <s-button slot="primary-action" variant="primary" loading={pending} disabled={!mappingDraft.tags.length || !mappingDraft.productHandle} onClick={commitMapping}>Save mapping</s-button>
              </s-modal> : mappingDraft ? <MappingEditor key="new" draft={mappingDraft} products={products} tags={availableMappingTags} onChange={setMappingDraft} onSave={commitMapping} onCancel={() => setMappingDraft(null)} pending={pending} /> : null}
              <s-section heading="Product mappings" padding="none">
                {(quiz.mappings || []).length ? <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="labeled">Order</s-table-header>
                    <s-table-header><s-checkbox label="Select all mappings" checked={pickedRows.length === quiz.mappings.length} indeterminate={pickedRows.length > 0 && pickedRows.length < quiz.mappings.length} onChange={event => setPickedRows(event.currentTarget.checked ? quiz.mappings.map(item => item.id) : [])} /></s-table-header>
                    <s-table-header listSlot="labeled">Selected tags</s-table-header><s-table-header listSlot="inline">Resource type</s-table-header><s-table-header listSlot="primary">Resource name</s-table-header><s-table-header listSlot="labeled">Actions</s-table-header>
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
                        <s-table-cell><s-badge>{mapping.variantId ? "Variant" : "Product"}</s-badge></s-table-cell><s-table-cell><s-stack direction="inline" gap="base" alignItems="center">{variant?.image || product?.image ? <s-thumbnail src={variant?.image || product?.image || ""} alt={title} /> : <s-icon type="product" />}<s-text>{title}</s-text></s-stack></s-table-cell>
                        <s-table-cell><s-stack direction="inline" gap="small">
                          <s-button icon="edit" accessibilityLabel={`Edit ${title}`} onClick={() => setMappingDraft({ id: mapping.id, tags: mapping.tags, productHandle: mapping.productHandle, grouping: mapping.grouping || "or", variantId: mapping.variantId })} />
                          <s-button icon="delete" tone="critical" accessibilityLabel={`Delete ${title}`} disabled={pending} commandFor="delete-mappings-modal" command="--show" onClick={() => setPickedRows([mapping.id])} />
                        </s-stack></s-table-cell>
                      </s-table-row>;
                    })}
                  </s-table-body>
                </s-table> : <s-empty-state heading="No product mappings yet"><s-icon slot="graphic" type="product" /><s-text slot="subheading">Use New mapping to link answer tags to a product or variant.</s-text></s-empty-state>}
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
                {tab === "edit" ? <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
                  <s-button icon="arrow-left" onClick={() => setQuestionOpen(false)}>Back to questions</s-button>
                  <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <div style={{width:160}}><s-select label="Position" labelAccessibilityVisibility="exclusive" value={String(safeIndex)} onChange={event => moveQuestion(Number(event.currentTarget.value))}>
                      {questions.map((_, at) => <s-option key={at} value={String(at)}>Question {at + 1}</s-option>)}
                    </s-select></div>
                    <s-button icon="plus" onClick={() => addQuestion(safeIndex)} disabled={questions.length >= (kind === "deep" || quiz.layout === "single" ? 40 : 12)}>Add question before</s-button>
                    <s-button icon="delete" tone="critical" variant="secondary" commandFor="delete-question-modal" command="--show" disabled={questions.length <= 1}>Delete question</s-button>
                  </div>
                </div> : null}
                <s-text-area label="Question" rows={3} value={question.text} onInput={event => patch({ text: event.currentTarget.value })} />
                <s-grid gridTemplateColumns={tab === "tags" ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(240px, 1fr))"} gap="base">
                  {question.options.map((option, optionIndex) => <s-box key={optionIndex} border="base" borderRadius="base" padding="base">
                    <s-stack gap="small">
                      {tab === "tags" ? <s-text type="strong">{option.label}</s-text> : <>
                        <s-text-field label={`Answer ${optionIndex + 1}`} value={option.label} onInput={event => patchOption(optionIndex, { label: event.currentTarget.value })} />
                        <s-button variant="secondary" tone="critical" disabled={question.options.length <= 2} onClick={() => removeOption(optionIndex)}>Delete answer</s-button>
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
      <s-modal id="delete-question-modal" heading="Delete question?">
        <s-paragraph>This question and its answers will be removed from this quiz. Save the quiz to apply the change.</s-paragraph>
        <s-button slot="primary-action" variant="primary" tone="critical" commandFor="delete-question-modal" command="--hide" onClick={removeQuestion}>Delete question</s-button>
        <s-button slot="secondary-actions" commandFor="delete-question-modal" command="--hide">Cancel</s-button>
      </s-modal>
    </s-page>
  );
}
