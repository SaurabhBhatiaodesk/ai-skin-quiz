import combined from "../public/images/onboarding/preview-three.svg?raw";
import scan from "../public/images/onboarding/preview-scan.svg?raw";
import single from "../public/images/onboarding/preview-single.svg?raw";
import products from "../public/images/onboarding/preview-products.svg?raw";

const previews: Record<string, string> = { three: combined, scan, single, products };
type PreviewQuiz = { name?: string; singleFlow?: string; quick: Array<{ text: string; options: Array<{ label: string }> }>; deep: Array<{ text: string; options: Array<{ label: string }> }> };
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shorten = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 3)}...` : value;
export function quizPreview(type: string, quiz?: PreviewQuiz) {
  let svg = previews[type] || single;
  if (quiz && type === "single") {
    const question = (quiz.singleFlow === "deep" ? quiz.deep : quiz.quick)[0];
    const content = [quiz.name || "Your quiz", question?.text || "Add your first question", ...[0, 1, 2].map(index => question?.options[index]?.label || "")];
    let index = 0;
    svg = svg.replace(/(<text\b[^>]*>)[\s\S]*?(<\/text>)/g, (match, start, end) => {
      if (index >= content.length) return match;
      const limit = index === 0 ? 30 : index === 1 ? 43 : 46;
      return `${start}${escape(shorten(content[index++], limit))}${end}`;
    });
  } else if (quiz?.name) {
    svg = svg.replace(/(<text\b[^>]*>)[\s\S]*?(<\/text>)/, `$1${escape(shorten(quiz.name, 30)).replace(/\$/g, "$$$$")}$2`);
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
