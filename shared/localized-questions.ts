import translations from "./question-translations.json" with { type: "json" };

const aliases: Record<string, string> = {
  hi: "hi",
  hindi: "hi",
  mr: "mr",
  marathi: "mr",
  te: "te",
  telugu: "te",
  bn: "bn",
  bengali: "bn",
  bangla: "bn",
  od: "od",
  or: "od",
  odia: "od",
  oriya: "od",
};
export function fixedQuestionTranslations(
  questions: { id: string; question: string }[],
  language: string,
) {
  const code =
    aliases[
      language
        .trim()
        .toLowerCase()
        .split(/[-\s(]/)[0]!
    ];
  if (!code) return null;
  const catalog =
    (translations as Record<string, Record<string, string>>)[code] ?? {};
  const prefix =
    "The input contains conflicting or unclear answers. Please confirm: ";
  return questions.flatMap((question) => {
    const conflicted = question.question.startsWith(prefix);
    const text = conflicted
      ? question.question.slice(prefix.length)
      : question.question;
    const translated = catalog[text];
    return translated
      ? [
          {
            id: question.id,
            translation:
              (conflicted
                ? (catalog[prefix.trim()] ?? prefix.trim()) + " "
                : "") + translated,
          },
        ]
      : [];
  });
}
