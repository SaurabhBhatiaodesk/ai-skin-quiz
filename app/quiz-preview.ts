import combined from "../public/images/onboarding/preview-three.svg?raw";
import scan from "../public/images/onboarding/preview-scan.svg?raw";
import single from "../public/images/onboarding/preview-single.svg?raw";

const previews: Record<string, string> = { three: combined, scan, single };
type PreviewQuiz = { name?: string; singleFlow?: string; quick: Array<{ text: string; options: Array<{ label: string }> }>; deep: Array<{ text: string; options: Array<{ label: string }> }> };
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shorten = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 3)}...` : value;
export function quizPreview(type: string, quiz?: PreviewQuiz) {
  if (type === "three") return "/images/onboarding/premium-combined-quiz.webp";
  if (type === "scan") return "/images/onboarding/premium-skin-scan.webp";
  if (type === "products") return "/images/onboarding/premium-skincare-trio.webp";
  if (type === "single") return "/images/onboarding/premium-single-quiz.webp";
  let svg = previews[type] || single;
  if (quiz && type === "single") {
    const question = (quiz.singleFlow === "deep" ? quiz.deep : quiz.quick)[0];
    const content = [quiz.singleFlow === "deep" ? "Discover your balance" : quiz.name === "Sample Skin Quiz" ? "Find your daily essentials" : "Find your skin routine", question?.text || "Add your first question", ...[0, 1, 2].map(index => question?.options[index]?.label || "")];
    let index = 0;
    svg = svg.replace(/(<text\b[^>]*>)[\s\S]*?(<\/text>)/g, (match, start, end) => {
      if (index >= content.length) return match;
      const limit = index === 0 ? 30 : index === 1 ? 43 : 46;
      return `${start}${escape(shorten(content[index++], limit))}${end}`;
    });
  }
  return `data:image/svg+xml;base64,${btoa(Array.from(new TextEncoder().encode(svg), byte => String.fromCharCode(byte)).join(""))}`;
}
