// Build-time static UI translation only. No source records, account data or runtime requests.
import { readFile, writeFile } from "node:fs/promises";
import { config } from "../server/src/config.js";
import { PARAMETER_QUESTIONS } from "../shared/repair-questions.js";
const english: Record<string, string> = JSON.parse(
  await readFile("client/src/locales/en.json", "utf8"),
);
const languages = process.argv.includes("--probe")
  ? ["hi"]
  : ["hi", "mr", "te", "bn", "od"];
const publicLookup = process.argv.includes("--public");
if (!publicLookup && !config.SARVAM_API_KEY)
  throw new Error(
    "Configure SARVAM_API_KEY for the one-time UI catalogue build.",
  );
async function translate(input: string, target: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (publicLookup) {
      // Optional build helper only: this unauthenticated web endpoint has no SLA.
      // The running website depends solely on the checked-in catalogues.
      const url = new URL(
        "https://translate.googleapis.com/translate_a/single",
      );
      url.search = new URLSearchParams({
        client: "gtx",
        sl: "en",
        tl: target === "od" ? "or" : target,
        dt: "t",
        q: input,
      }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (response.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      if (!response.ok)
        throw new Error(`Static UI translation HTTP ${response.status}`);
      const result = (await response.json()) as any;
      const translated = result?.[0]
        ?.map((part: any) => part[0] ?? "")
        .join("");
      if (!translated) throw new Error("Empty UI translation");
      return translated as string;
    }
    const response = await fetch("https://api.sarvam.ai/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": config.SARVAM_API_KEY,
      },
      body: JSON.stringify({
        input,
        source_language_code: "en-IN",
        target_language_code: `${target}-IN`,
        model: "sarvam-translate:v1",
        numerals_format: "international",
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (!response.ok)
      throw new Error(`Static UI translation HTTP ${response.status}`);
    const json = (await response.json()) as { translated_text?: string };
    if (!json.translated_text) throw new Error("Empty UI translation");
    return json.translated_text;
  }
  throw new Error("Static UI translation rate limit");
}
const placeholders = (s: string) =>
  [...s.matchAll(/\{\w+\}/g)]
    .map((m) => m[0])
    .sort()
    .join("|");
for (const language of languages) {
  const file = `client/src/locales/${language}.json`;
  const catalog: Record<string, string> = JSON.parse(
    await readFile(file, "utf8").catch(() => "{}"),
  );
  const pending = Object.keys(english).filter((k) => !catalog[k]);
  const batches: string[][] = [];
  for (const text of pending) {
    const last = batches.at(-1);
    if (last && last.join("\n").length + text.length + last.length * 10 < 1650)
      last.push(text);
    else batches.push([text]);
  }
  if (process.argv.includes("--probe")) batches.splice(1);
  let cursor = 0,
    completed = 0,
    stopped = false;
  async function worker() {
    while (cursor < batches.length && !stopped) {
      const batch = batches[cursor++]!;
      try {
        const variables = batch.map((text) =>
          [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]),
        );
        const input = batch
          .map(
            (text, i) =>
              `[${String(i).padStart(4, "0")}] ${text.replace(/\{\w+\}/g, (token) => `{${variables[i]!.indexOf(token)}}`)}`,
          )
          .join("\n");
        const translated = await translate(input, language);
        const numbered = translated.replace(
          /\[\s*(\d{1,4})\s*\]/g,
          (_marker, n) => `[${n.padStart(4, "0")}]`,
        );
        let parts = [
          ...numbered.matchAll(/\[(\d{4})\]\s*([\s\S]*?)(?=\[\d{4}\]|$)/g),
        ];
        if (
          publicLookup &&
          (parts.length !== batch.length ||
            parts.some((part, i) => Number(part[1]) !== i || !part[2]?.trim()))
        ) {
          // Never guess which translation belongs to which label.
          parts = [];
          for (let i = 0; i < batch.length; i++) {
            const original = batch[i]!.replace(
              /\{\w+\}/g,
              (token) => `{${variables[i]!.indexOf(token)}}`,
            );
            parts.push([
              "",
              String(i),
              await translate(original, language),
            ] as unknown as RegExpMatchArray);
          }
        }
        if (parts.length !== batch.length)
          throw new Error("UI translation lost message boundaries");
        for (let i = 0; i < batch.length; i++) {
          const original = batch[i]!,
            match = parts[i]!;
          const output = match[2]!
            .trim()
            .replace(
              /\{\s*(\d+)\s*\}/g,
              (token, index) => variables[i]![Number(index)] ?? token,
            );
          match[2] = output;
          if (
            Number(match[1]) !== i ||
            !output ||
            placeholders(original) !== placeholders(output)
          )
            throw new Error(`UI translation changed placeholders: ${original}`);
        }
        for (let i = 0; i < batch.length; i++)
          catalog[batch[i]!] = parts[i]![2]!.trim();
        completed++;
        // Serialized snapshot writes avoid concurrent truncation.
      } catch (error) {
        stopped = true;
        console.log(
          JSON.stringify({
            language,
            ok: false,
            reason:
              error instanceof Error ? error.message : "Translation failed",
          }),
        );
      }
    }
  }
  // Two independent static translation requests at a time; no application quotas used.
  await Promise.all([worker(), worker()]);
  await writeFile(file, JSON.stringify(catalog, null, 2) + "\n");
  console.log(
    JSON.stringify({
      language,
      translated: Object.keys(catalog).length,
      total: Object.keys(english).length,
      batchesCompleted: completed,
    }),
  );
  if (stopped) {
    process.exitCode = 1;
    break;
  }
}
const questions: Record<string, Record<string, string>> = {};
for (const language of ["hi", "mr", "te", "bn", "od"]) {
  const catalog = JSON.parse(
    await readFile(`client/src/locales/${language}.json`, "utf8").catch(
      () => "{}",
    ),
  );
  const keys = [
    ...Object.values(PARAMETER_QUESTIONS).map((q) => q.question),
    "The input contains conflicting or unclear answers. Please confirm:",
  ];
  questions[language] = Object.fromEntries(
    keys.filter((key) => catalog[key]).map((key) => [key, catalog[key]]),
  );
}
await writeFile(
  "shared/question-translations.json",
  JSON.stringify(questions, null, 2) + "\n",
);
