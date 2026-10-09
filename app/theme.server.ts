// Reports whether the quiz app blocks are placed in the shop's live (main) theme.
type AdminGraphql = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> };

export type ThemeStatus = {
  // false when the theme could not be read (for example, before read_themes is granted).
  checked: boolean;
  themeName: string;
  // Placed quiz blocks; an empty code means the merchant has not pasted a widget ID yet.
  blocks: Array<{ layout: string; code: string }>;
};

const LAYOUTS: Record<string, string> = { "dosha-quiz": "three", "single-quiz": "single", "skin-scan": "scan" };

const BLOCK_TYPE = /\/blocks\/(dosha-quiz|single-quiz|skin-scan)\//;

function quizHandle(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  const wrapped = raw.match(/^\[dosha-quiz:([^\]]+)\]$/i);
  return (wrapped ? wrapped[1] : raw).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// Theme JSON files may start with a /* comment */ header.
function parseThemeJson(content: string) {
  try {
    return JSON.parse(content.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "")) as unknown;
  } catch {
    return null;
  }
}

function collectBlocks(node: unknown, found: ThemeStatus["blocks"]) {
  if (!node || typeof node !== "object") return;
  const item = node as { type?: unknown; disabled?: unknown; settings?: { quiz_code?: unknown } };
  if (item.disabled === true) return;
  const match = typeof item.type === "string" ? item.type.match(BLOCK_TYPE) : null;
  if (match && item.disabled !== true) found.push({ layout: LAYOUTS[match[1]], code: quizHandle(item.settings?.quiz_code) });
  for (const value of Object.values(node)) collectBlocks(value, found);
}

export async function themeStatus(admin: AdminGraphql): Promise<ThemeStatus> {
  try {
    const response = await admin.graphql(`#graphql
      query QuizThemeStatus {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            name
            files(filenames: ["templates/*.json", "sections/*.json"], first: 250) {
              nodes {
                body {
                  ... on OnlineStoreThemeFileBodyText { content }
                }
              }
            }
          }
        }
      }
    `);
    const json = await response.json();
    const theme = json?.data?.themes?.nodes?.[0];
    if (json.errors?.length || !theme) return { checked: false, themeName: "", blocks: [] };
    const found: ThemeStatus["blocks"] = [];
    for (const file of theme.files?.nodes || []) {
      const content = file?.body?.content;
      if (typeof content === "string" && BLOCK_TYPE.test(content.replaceAll("\\/", "/"))) collectBlocks(parseThemeJson(content), found);
    }
    return { checked: true, themeName: theme.name || "", blocks: found };
  } catch (error) {
    console.error("Theme status check failed", error);
    return { checked: false, themeName: "", blocks: [] };
  }
}

// A block shows a quiz when its widget ID matches, or when the ID is empty (or the default "dosha-quiz") and this is the only quiz of the block's layout
// (the storefront picks that quiz automatically).
export function isQuizLive(status: ThemeStatus, quiz: { handle: string; layout: string; legacyHandles?: string[] }, onlyOfLayout: boolean) {
  return status.blocks.some((block) => block.layout === quiz.layout && (block.code === quiz.handle || quiz.legacyHandles?.includes(block.code) || ((!block.code || block.code === "dosha-quiz") && onlyOfLayout)));
}
