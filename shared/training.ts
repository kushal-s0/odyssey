export function trainingReadiness(rows: { label: number; groupId: string }[]) {
  const groups = new Set(rows.map((row) => row.groupId.trim()).filter(Boolean))
    .size;
  const checks = [
    { label: "reviewed answers", current: rows.length, required: 20 },
    { label: "business families entered", current: groups, required: 4 },
    {
      label: "relevant answers",
      current: rows.filter((row) => row.label === 0).length,
      required: 5,
    },
    {
      label: "off-topic answers",
      current: rows.filter((row) => row.label === 1).length,
      required: 5,
    },
  ].map((check) => ({
    ...check,
    remaining: Math.max(0, check.required - check.current),
  }));
  return {
    ready: checks.every((check) => check.remaining === 0),
    checks,
  };
}
