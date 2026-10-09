import quiz from "../../public/images/onboarding/quiz.svg?raw";
import theme from "../../public/images/onboarding/theme.svg?raw";
import results from "../../public/images/onboarding/results.svg?raw";
import emails from "../../public/images/onboarding/emails.svg?raw";
import scan from "../../public/images/onboarding/scan.svg?raw";

const icons: Record<string, string> = { quiz, theme, results, emails, scan };
const sources = Object.fromEntries(Object.entries(icons).map(([key, svg]) => [key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`]));

export default function HomeIllustration({ name }: { name: string }) {
  return <img src={sources[name] || sources.quiz} alt="" aria-hidden="true" width="160" height="128" loading="eager" style={{display:"block",width:"100%",height:"auto",aspectRatio:"5 / 4",objectFit:"contain"}} />;
}
