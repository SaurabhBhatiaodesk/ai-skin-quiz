import { useState } from "react";
import MappingEditor from "./MappingEditor";
import type { MappingDraft } from "./MappingEditor";
import { useFetcher } from "react-router";
import { scoresForTag, slugTag } from "../quiz-shared";
import type { DeepQuestion, ProductMapping, QuickQuestion, ResultTag, ShopProduct, StoredQuiz } from "../quiz-shared";

type SaveResult = { ok: true; quiz: StoredQuiz } | { ok: false; error: string };
type Kind = "quick" | "deep";
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

function Icon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "edit") return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>;
  if (name === "design") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></svg>;
  if (name === "tag") return <svg {...common}><path d="M20 13.5 12.5 21a2 2 0 0 1-2.8 0L3 14.3V4h10.3Z" /><circle cx="7.5" cy="8.5" r="1" /></svg>;
  if (name === "link") return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" /></svg>;
  if (name === "content") return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
  if (name === "branch") return <svg {...common}><path d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>;
}

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
  const [kind, setKind] = useState<Kind>("quick");
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<Tab>("edit");
  const [resultKey, setResultKey] = useState<(typeof RESULTS)[number]>("vata");
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [mappingDraft, setMappingDraft] = useState<MappingDraft | null>(null);
  const [pickedRows, setPickedRows] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const pending = fetcher.state !== "idle";
  const questions = kind === "quick" ? quiz.quick : quiz.deep;
  const safeIndex = Math.min(index, Math.max(questions.length - 1, 0));
  const question = questions[safeIndex];

  function save() {
    fetcher.submit(quiz, { method: "POST", encType: "application/json", action: `/app?quiz=${code}` });
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
    fetcher.submit(next, { method: "POST", encType: "application/json", action: `/app?quiz=${code}` });
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
    setBulkOpen(false);
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
  const showQuestions = tab !== "products" && tab !== "content";

  return (
    <div className="si">
      <style>{`
        .si, .si * { box-sizing: border-box; }
        .si { min-height: 100%; background: #f3f3f3; color: #202223; font: 14px/1.4 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .si-tabs { display: flex; gap: 4px; align-items: center; padding: 14px 16px 8px; overflow-x: auto; }
        .si-tab { display: inline-flex; align-items: center; gap: 8px; border: 0; background: transparent; color: #5c5f62; border-radius: 10px; padding: 8px 12px; cursor: pointer; white-space: nowrap; font: inherit; }
        .si-tab.active { background: #e7e7e7; color: #202223; font-weight: 600; }
        .si-body { display: grid; grid-template-columns: 320px 1fr; gap: 16px; padding: 8px 16px 24px; align-items: start; }
        .si-body-products { grid-template-columns: minmax(0, 1fr); }
        .si-body-products .si-side { display: none; }
        .si-body-products .si-toolbar { padding: 14px 16px; min-height: 74px; }
        .si-body-products .si-toolbar > button, .si-body-products .si-bulk > button { padding: 10px 16px; }
        .si button:disabled { color: #b5b5b5; cursor: not-allowed; }
        .si-mapping-card { margin-bottom: 14px; padding: 22px 20px 18px; border: 1px solid #dedede; border-radius: 16px; background: #fff; }
        .si-mapping-row { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(280px, .95fr) minmax(300px, .98fr); gap: 34px; align-items: start; }
        .si-mapping-tags, .si-resource-wrap { position: relative; min-width: 0; }
        .si-search-wrap { display: flex; gap: 10px; align-items: center; min-height: 40px; border: 1px solid #919191; border-radius: 9px; padding: 0 10px; color: #919191; }
        .si-search-wrap input { border: 0; outline: none; font: inherit; color: #202223; background: transparent; width: 100%; min-width: 0; padding: 9px 0; }
        .si-search-wrap:focus-within { outline: 2px solid #202223; outline-offset: 2px; }
        .si-tags-toggle { border: 0; background: transparent; color: #6d7175; cursor: pointer; padding: 0; font: inherit; }
        .si-selected-tags { margin-top: 8px; }
        .si-tag-grouping { border: 0; padding: 8px 0; margin: 0; display: flex; justify-content: center; gap: 18px; align-items: center; min-height: 40px; white-space: nowrap; }
        .si-tag-grouping label { display: flex; align-items: center; gap: 8px; }
        .si-tag-grouping:disabled label { color: #b5b5b5; }
        .si-tag-grouping input { width: 18px; height: 18px; margin: 0; accent-color: #202223; }
        .si-group-help { display: inline-flex; align-items: center; justify-content: center; border: 2px solid currentColor; border-radius: 50%; width: 16px; height: 16px; font-size: 11px; font-weight: 700; margin-left: 4px; }
        .si-resource-buttons { display: flex; justify-content: center; align-items: center; gap: 10px; padding: 8px 12px; min-height: 50px; border: 1px solid #919191; border-radius: 4px; }
        .si-resource-buttons .si-add { padding: 6px 12px; font-size: 13px; box-shadow: 0 1px 1px #0000000d; white-space: nowrap; }
        .si-mapping-actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 17px; }
        .si-mapping-actions .si-add { padding: 6px 13px; font-size: 13px; }
        .si-mapping-cancel { border: 0; background: transparent; color: #6d7175; cursor: pointer; font: inherit; font-size: 13px; }
        .si-mapping-popover { position: absolute; top: 48px; left: 0; right: 0; z-index: 5; max-height: 300px; overflow: auto; background: #fff; border: 1px solid #dedede; border-radius: 10px; box-shadow: 0 8px 24px #0000001a; padding: 6px; }
        .si-mapping-choice { display: flex; gap: 10px; align-items: center; padding: 9px 8px; cursor: pointer; border-radius: 6px; overflow-wrap: anywhere; }
        .si-mapping-choice:hover, .si-resource-choice:hover { background: #f3f3f3; }
        .si-mapping-choice input { accent-color: #202223; }
        .si-picker-done { width: 100%; border: 0; border-top: 1px solid #eee; padding: 8px; background: #fff; font: inherit; cursor: pointer; }
        .si-resource-picker { top: 58px; min-width: 300px; }
        .si-picker-heading { display: flex; justify-content: space-between; padding: 6px 8px 10px; }
        .si-picker-heading button, .si-selected-resource button { border: 0; background: transparent; cursor: pointer; font: inherit; }
        .si-picker-search { width: 100%; border: 1px solid #c9cccf; border-radius: 6px; padding: 8px; font: inherit; margin-bottom: 6px; }
        .si-resource-choice { display: block; width: 100%; text-align: left; padding: 10px 8px; border: 0; border-radius: 6px; background: #fff; font: inherit; cursor: pointer; }
        .si-picker-empty { padding: 8px; color: #6d7175; }
        .si-selected-resource { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; padding: 6px 10px; background: #f3f3f3; border-radius: 8px; font-size: 13px; }
        .si-group-operator { color: #6d7175; margin: 0 4px; }
        .si-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        @media (max-width: 1100px) { .si-mapping-row { grid-template-columns: 1fr 1fr; gap: 16px; } .si-mapping-tags { grid-column: 1 / -1; } }
        @media (max-width: 600px) { .si-mapping-row { grid-template-columns: 1fr; } .si-tag-grouping { flex-wrap: wrap; gap: 12px; } .si-resource-picker { min-width: 0; } }
        .si-side, .si-toolbar, .si-canvas { background: #fff; border-radius: 16px; box-shadow: 0 0 0 1px #e6e6e6; }
        .si-side { padding: 18px 16px 22px; max-height: calc(100vh - 120px); overflow: auto; }
        .si-side h2 { margin: 0 0 14px; font-size: 20px; }
        .si-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; }
        .si-label { font-weight: 700; }
        .si-muted { color: #6d7175; }
        .si-check { display: flex; align-items: center; gap: 8px; padding: 8px 0 12px; }
        .si-split { border-top: 1px dashed #dedede; margin-top: 8px; padding-top: 12px; }
        .si-field { display: grid; gap: 6px; margin-top: 10px; font-size: 13px; color: #6d7175; }
        .si-field input, .si-field select, .si-field textarea { width: 100%; font: inherit; color: #202223; border: 1px solid #c9cccf; border-radius: 8px; padding: 8px 10px; background: #fff; }
        .si-qlist { display: grid; gap: 6px; margin: 4px 0 12px; }
        .si-qitem { text-align: left; border: 1px solid #e3e3e3; background: #fff; border-radius: 8px; padding: 8px 10px; cursor: pointer; font: inherit; color: #202223; }
        .si-qitem.on { border-color: #202223; background: #f6f6f6; }
        .si-qitem small { display: block; color: #6d7175; font-size: 12px; }
        .si-qgroup { margin: 8px 0 4px; font-size: 12px; font-weight: 700; color: #6d7175; }
        .si-main { display: grid; gap: 12px; }
        .si-toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 12px 14px; min-height: 58px; }
        .si-status { margin-right: auto; color: #0d7a32; font-size: 13px; }
        .si-status.bad { color: #8e1f0b; }
        .si-delete, .si-add, .si-save { border-radius: 8px; padding: 8px 14px; font: inherit; cursor: pointer; }
        .si-delete { border: 0; background: transparent; color: #d72c0d; }
        .si-add { border: 1px solid #c9cccf; background: #fff; }
        .si-save { border: 0; background: #2c2c2c; color: #fff; }
        .si-canvas { padding: 28px 22px 36px; }
        .si-qbox { border: 1px solid #d9d9d9; border-radius: 8px; display: grid; place-items: center; padding: 36px 20px; }
        .si-qbox > div { width: 100%; }
        .si-qbox textarea { width: 100%; border: 0; resize: none; text-align: center; font-size: 28px; font-weight: 600; line-height: 1.35; color: #202223; outline: none; background: transparent; }
        .si-products { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
        .si-product { display: flex; gap: 12px; align-items: center; text-align: left; border: 1px solid #e3e3e3; border-radius: 12px; padding: 10px; background: #fff; cursor: pointer; font: inherit; color: #202223; }
        .si-product.on { border-color: #202223; background: #f6f6f6; }
        .si-product img { width: 54px; height: 54px; object-fit: cover; border-radius: 8px; background: #f3f3f3; }
        .si-product b { display: block; font-weight: 600; }
        .si-product small { color: #6d7175; }
        .si-copy textarea { min-height: 90px; text-align: left; }
        .si-qbox img { max-width: 180px; max-height: 90px; object-fit: contain; margin-bottom: 8px; }
        .si-answers { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; max-width: 760px; margin: 22px auto 0; }
        .si-opt { display: grid; gap: 8px; min-width: 0; }
        .si-opt-head { display: flex; align-items: center; gap: 10px; }
        .si-opt-head span { font-size: 13px; font-weight: 700; color: #202223; }
        .si-opt-delete { border: 0; background: transparent; color: #d72c0d; cursor: pointer; font: inherit; font-size: 13px; padding: 0; }
        .si-answer { border: 1px solid #c9cccf; background: #fff; border-radius: 8px; min-height: 44px; text-align: center; font: inherit; padding: 8px 12px; width: 100%; outline: none; }
        .si-answer:focus { border-color: #202223; }
        .si-opt-row { display: flex; justify-content: center; margin-top: 14px; }
        .si-continue { display: block; margin: 26px auto 0; min-width: 148px; border: 1px solid #c9cccf; background: #fff; border-radius: 10px; padding: 10px 18px; font: inherit; }
        .si-note { color: #6d7175; margin: 8px 0 0; }
        .si-map { padding: 0 0 18px; background: transparent; box-shadow: none; }
        .si-table-wrap { background: #fff; border-radius: 12px; box-shadow: 0 0 0 1px #e6e6e6; overflow: auto; }
        .si-table { width: 100%; border-collapse: collapse; }
        .si-table th { text-align: left; font-size: 13px; padding: 14px 12px; border-bottom: 1px solid #ececec; }
        .si-table td { padding: 14px 12px; border-bottom: 1px solid #f1f1f1; vertical-align: middle; }
        .si-grip { color: #b5b5b5; letter-spacing: -2px; }
        .si-chip { display: inline-flex; align-items: center; gap: 6px; background: #f1f1f1; border-radius: 999px; padding: 4px 8px 4px 10px; font-size: 13px; margin: 2px; }
        .si-chip button { border: 0; background: transparent; cursor: pointer; color: #6d7175; font: inherit; padding: 0 2px; }
        .si-pill { display: inline-flex; background: #f1f1f1; border-radius: 999px; padding: 4px 10px; font-size: 13px; }
        .si-iconbtn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e3e3e3; background: #fff; cursor: pointer; }
        .si-iconbtn.danger { color: #d72c0d; }
        .si-bulk { position: relative; }
        .si-menu { position: absolute; right: 0; top: 40px; z-index: 2; background: #fff; border: 1px solid #e3e3e3; border-radius: 8px; padding: 8px 12px; cursor: pointer; white-space: nowrap; }
        .si-tagcard { border: 1px solid #e3e3e3; border-radius: 12px; padding: 12px; background: #fff; display: grid; gap: 8px; }
        .si-tagcard small { color: #6d7175; }
        .si-suggest { display: grid; border: 1px solid #e3e3e3; border-radius: 8px; overflow: hidden; background: #fff; }
        .si-suggest button { text-align: left; border: 0; border-bottom: 1px solid #f1f1f1; background: #fff; padding: 8px 10px; cursor: pointer; font: inherit; }
        .si-taglist { max-height: 260px; overflow: auto; border: 1px solid #e3e3e3; border-radius: 10px; background: #fff; margin-top: 6px; }
        .si-tagrow { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; border: 0; border-bottom: 1px solid #f3f3f3; background: #fff; padding: 9px 12px; cursor: pointer; font: inherit; }
        .si-tagrow.on, .si-tagrow:hover { background: #f3f3f3; }
        .si-tagrow.auto { font-weight: 700; }
        .si-modal-back { position: fixed; inset: 0; background: rgba(32, 34, 35, 0.45); display: grid; place-items: center; z-index: 20; padding: 24px; }
        .si-modal { width: min(560px, 100%); background: #fff; border-radius: 16px; padding: 18px 18px 16px; box-shadow: 0 20px 50px rgba(0,0,0,.18); }
        .si-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .si-modal-head h3 { margin: 0; font-size: 18px; }
        .si-modal-head button { border: 0; background: transparent; font-size: 20px; cursor: pointer; }
        .si-modal-actions { display: flex; justify-content: flex-end; margin-top: 14px; }
        @media (max-width: 860px) { .si-body { grid-template-columns: 1fr; } .si-answers { grid-template-columns: 1fr; } }
      `}</style>

      <div className="si-tabs">
        {TABS.map((item) => (
          <button key={item.id} className={`si-tab${tab === item.id ? " active" : ""}`} type="button" onClick={() => setTab(item.id)}>
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>

      <div className={`si-body${tab === "products" ? " si-body-products" : ""}`}>
        <aside className="si-side" hidden={tab === "products"}>
          <h2>{TABS.find((item) => item.id === tab)?.label}</h2>
          {tab === "products" ? (
            <p className="si-note">Pick tags from the answers, then link each tag to a product. Customers who choose that tag see the product.</p>
          ) : null}
          {tab === "content" ? (
            <div className="si-qlist">
              {RESULTS.map((key) => (
                <button key={key} type="button" className={`si-qitem${resultKey === key ? " on" : ""}`} onClick={() => setResultKey(key)}>
                  <small>{quiz.profiles[key].name}</small>
                  {quiz.profiles[key].sub}
                </button>
              ))}
            </div>
          ) : null}
          {showQuestions ? <div className="si-qgroup">{quiz.layout === "single" ? "Single quiz" : "Quick"} · {quiz.quick.length}</div> : null}
          {showQuestions ? <div className="si-qlist">
            {quiz.quick.map((item, itemIndex) => (
              <button
                key={`quick-${itemIndex}`}
                type="button"
                className={`si-qitem${kind === "quick" && safeIndex === itemIndex ? " on" : ""}`}
                onClick={() => { setKind("quick"); setIndex(itemIndex); }}
              >
                <small>Question {itemIndex + 1}</small>
                {item.text}
              </button>
            ))}
          </div> : null}
          {showQuestions && quiz.layout !== "single" ? <div className="si-qgroup">Deep · {quiz.deep.length}</div> : null}
          {showQuestions && quiz.layout !== "single" ? <div className="si-qlist">
            {quiz.deep.map((item, itemIndex) => (
              <button
                key={`deep-${itemIndex}`}
                type="button"
                className={`si-qitem${kind === "deep" && safeIndex === itemIndex ? " on" : ""}`}
                onClick={() => { setKind("deep"); setIndex(itemIndex); }}
              >
                <small>Question {itemIndex + 1}</small>
                {item.text}
              </button>
            ))}
          </div> : null}
        </aside>

        <div className="si-main">
          <div className="si-toolbar">
            <span className={`si-status${error ? " bad" : ""}`}>{error || (saved ? "Saved" : "")}</span>
            {showQuestions ? <button className="si-delete" type="button" onClick={removeQuestion}>Delete question</button> : null}
            {showQuestions ? <button className="si-add" type="button" onClick={addQuestion} disabled={questions.length >= (kind === "deep" || quiz.layout === "single" ? 40 : 12)}>Add question</button> : null}
            {tab === "products" ? (
              <div className="si-bulk">
                <button className="si-add" type="button" onClick={() => setBulkOpen((open) => !open)}>Bulk actions</button>
                {bulkOpen ? (
                  <button className="si-menu" type="button" onClick={() => deleteMappings(pickedRows)} disabled={!pickedRows.length}>
                    Delete selected
                  </button>
                ) : null}
              </div>
            ) : null}
            {tab === "products" ? (
              <button
                className="si-add"
                type="button"
                onClick={() => {
                  setMappingDraft({ id: "", tags: [], productHandle: "", grouping: "or" });
                }}
              >
                + New mapping
              </button>
            ) : null}
            <button className="si-save" type="button" onClick={save}>{pending ? "Saving…" : "Save"}</button>
          </div>
          {tab === "products" ? (
            <div className="si-map">
              {mappingDraft ? <MappingEditor key={mappingDraft.id || "new"} draft={mappingDraft} products={products} tags={selectableTags(quiz, products)} onChange={setMappingDraft} onSave={commitMapping} onCancel={() => setMappingDraft(null)} pending={pending} /> : null}
              <div className="si-table-wrap">
                <table className="si-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Selected tags</th>
                      <th>Resource type</th>
                      <th>Resource name</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(quiz.mappings || []).map((mapping) => {
                      const product = products.find((item) => item.handle === mapping.productHandle);
                      const variant = product?.variants?.find((item) => item.id === mapping.variantId);
                      const title = `${product?.title || mapping.productHandle}${variant ? ` — ${variant.title}` : ""}`;
                      return (
                        <tr key={mapping.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${title}`}
                              checked={pickedRows.includes(mapping.id)}
                              onChange={() => setPickedRows((current) => current.includes(mapping.id) ? current.filter((id) => id !== mapping.id) : [...current, mapping.id])}
                            />
                          </td>
                          <td>
                            <span className="si-grip" aria-hidden="true">⋮⋮</span>
                            {mapping.tags.map((tag, tagIndex) => <span key={tag}>{tagIndex > 0 ? <small className="si-group-operator">{(mapping.grouping || "or").toUpperCase()}</small> : null}<span className="si-chip">{tag}</span></span>)}
                          </td>
                          <td><span className="si-pill">{mapping.variantId ? "Variant" : "Product"}</span></td>
                          <td>{title}</td>
                          <td>
                            <button
                              className="si-iconbtn"
                              type="button"
                              aria-label={`Edit ${title}`}
                              onClick={() => {
                                setMappingDraft({
                                  id: mapping.id,
                                  tags: mapping.tags,
                                  productHandle: mapping.productHandle,
                                  grouping: mapping.grouping || "or",
                                  variantId: mapping.variantId,
                                });
                              }}
                            >
                              ✎
                            </button>
                            {" "}
                            <button className="si-iconbtn danger" type="button" aria-label={`Delete ${title}`} onClick={() => deleteMappings([mapping.id])}>
                              🗑
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(quiz.mappings || []).length === 0 ? (
                      <tr>
                        <td colSpan={5}>No mappings yet. Press + New mapping, pick a tag, then pick a product.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {tab === "content" && result ? (
            <div className="si-canvas si-copy">
              <div className="si-label">What the customer reads for {result.name}</div>
              <label className="si-field">
                Result name
                <input value={result.name} onChange={(event) => patchProfile({ name: event.target.value })} />
              </label>
              <label className="si-field">
                Short line
                <input value={result.sub} onChange={(event) => patchProfile({ sub: event.target.value })} />
              </label>
              <label className="si-field">
                One sentence
                <textarea value={result.essence} onChange={(event) => patchProfile({ essence: event.target.value })} />
              </label>
              <label className="si-field">
                Full reading
                <textarea value={result.insight} onChange={(event) => patchProfile({ insight: event.target.value })} />
              </label>
            </div>
          ) : null}
          {showQuestions && question ? (
            <div className="si-canvas">
              {tab === "tags" ? (
                <p className="si-note">Each answer gets a tag. Link product uses these tags to choose products. Add vata, pitta, or kapha when that answer should count toward the result.</p>
              ) : null}
              {tab === "design" ? (
                <>
                  <label className="si-field">
                    Section name
                    <input value={question.phase} onChange={(event) => patch({ phase: event.target.value })} />
                  </label>
                  <label className="si-field">
                    Help text
                    <textarea value={question.sub} onChange={(event) => patch({ sub: event.target.value })} />
                  </label>
                </>
              ) : null}
              {tab === "branching" && kind === "deep" ? (
                <label className="si-field">
                  Part of the quiz
                  <select value={(question as DeepQuestion).layer} onChange={(event) => patch({ layer: Number(event.target.value) })}>
                    <option value={1}>Who they are</option>
                    <option value={2}>How they feel now</option>
                    <option value={3}>Where they live</option>
                  </select>
                </label>
              ) : null}
              {tab === "settings" ? (
                <p className="si-note">
                  This quiz shortcode is <b>[dosha-quiz:{code}]</b>. Open <a href="/app/blocks">Blocks</a> and press Add block.
                  In the theme block, paste that shortcode into Quiz code.
                </p>
              ) : null}
              <div className="si-qbox">
                <div>
                  <textarea rows={3} value={question.text} aria-label="Question" onChange={(event) => patch({ text: event.target.value })} />
                </div>
              </div>
              <div className="si-answers">
                {question.options.map((option, optionIndex) => (
                  <div className="si-opt" key={optionIndex}>
                    <div className="si-opt-head">
                      <span>Answer {optionIndex + 1}</span>
                      <button className="si-opt-delete" type="button" onClick={() => removeOption(optionIndex)}>Delete</button>
                    </div>
                    <input
                      className="si-answer"
                      value={option.label}
                      aria-label={`Answer ${optionIndex + 1}`}
                      onChange={(event) => patchOption(optionIndex, { label: event.target.value })}
                    />
                    {tab === "tags" ? (
                      <div className="si-tagcard">
                        <div>
                          {tagsFor(option).map((tag) => (
                            <span className="si-chip" key={tag}>
                              {tag}
                              <button type="button" aria-label={`Remove ${tag}`} onClick={() => applyTags(optionIndex, tagsFor(option).filter((item) => item !== tag))}>×</button>
                            </span>
                          ))}
                        </div>
                        <input
                          className="si-answer"
                          placeholder="Enter tags here"
                          aria-label={`Tags for answer ${optionIndex + 1}`}
                          value={tagDrafts[`${kind}-${safeIndex}-${optionIndex}`] || ""}
                          onChange={(event) => setTagDrafts((current) => ({ ...current, [`${kind}-${safeIndex}-${optionIndex}`]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitTagDraft(optionIndex);
                            }
                          }}
                        />
                        <small>Multiple tags can be added by separating them with commas</small>
                        <button className="si-save" type="button" onClick={() => commitTagDraft(optionIndex)}>Save tags</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="si-opt-row">
                <button
                  className="si-add"
                  type="button"
                  onClick={() => {
                    if (question.options.length >= 8) return;
                    const options = kind === "quick"
                      ? [...question.options, { value: "balanced", tag: "balanced" as const, label: "New answer", hint: "" }]
                      : [...(question as DeepQuestion).options, { label: "New answer", hint: "", tag: "vata" as const, scores: { V: 3 } }];
                    patch({ options } as Partial<QuickQuestion & DeepQuestion>);
                  }}
                >
                  Add answer
                </button>
              </div>
              <button
                className="si-continue"
                type="button"
                onClick={() => {
                  const list = kind === "quick" ? quiz.quick : quiz.deep;
                  if (safeIndex < list.length - 1) setIndex(safeIndex + 1);
                  else if (kind === "quick" && quiz.deep.length) {
                    setKind("deep");
                    setIndex(0);
                  }
                }}
              >
                {question.continueLabel || "Continue"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
