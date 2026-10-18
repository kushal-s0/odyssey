import type { Page, BrowserContext } from "@playwright/test";
import { examples } from "../../server/src/examples";
import { decisionSupport } from "../../server/src/domain/decision-support";
export async function mockWorkspace(
  page: Page | BrowserContext,
  role: "entrepreneur" | "assessor" | null = "assessor",
) {
  let user = role
    ? {
        id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        name: "Test Entrepreneur",
        email: "test@example.test",
        role,
      }
    : null;
  const records = examples.map((s, i) => ({
    ...structuredClone(s),
    id: String(i + 1).padStart(24, "a"),
    example: false,
  }));
  const requests: string[] = [];
  const health = {
    database: true,
    gemini: true,
    groq: true,
    sarvam: true,
    classifier: false,
    examples: true,
    maxUploadMb: 10,
    audioProvider: "sarvam",
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.slice(4);
    requests.push(path);
    let json: any = {};
    if (path === "/session") json = { user, health };
    else if (path === "/health") json = health;
    else if (path === "/auth/login") {
      user = {
        id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        name: "Test Entrepreneur",
        email: "test@example.test",
        role: role ?? "entrepreneur",
      };
      json = { user };
    } else if (
      path === "/auth/logout" ||
      path === "/auth/logout-all" ||
      path === "/auth/password"
    ) {
      user = null;
      json = { ok: true };
    } else if (path === "/cohorts") json = { cohorts: [] };
    else if (path === "/submissions") json = { submissions: records };
    else if (path === "/dashboard")
      json = {
        summary: {
          scope: user?.role === "entrepreneur" ? "personal" : "programme",
          total: records.length,
          processing: 0,
          assessed: records.length,
          awaitingReview: 2,
          needsClarification: 3,
          failed: 0,
          meanScore: 50,
          latestScore: records[0].assessment?.score,
          latestCompleteness: 75,
          latestSubmissionId: records[0].id,
        },
      };
    else if (path === "/training/annotations") json = { annotations: [] };
    else if (path === "/training/model")
      json = { ready: false, reason: "Endpoint not configured" };
    else if (path.endsWith("/local-context"))
      json = {
        context: {
          place: null,
          category: "",
          radius: 3000,
          observations: [],
          revision: 0,
        },
      };
    else if (path.endsWith("/similar")) json = { matches: [] };
    else if (path.endsWith("/decision-support")) {
      const assessment = records.find(
        (s) => s.id === path.split("/")[2],
      )?.assessment;
      json = { support: assessment ? decisionSupport(assessment) : null };
    } else if (path.startsWith("/submissions/"))
      json = { submission: records.find((s) => s.id === path.split("/")[2]) };
    await route.fulfill({ json });
  });
  return { records, requests, health };
}
