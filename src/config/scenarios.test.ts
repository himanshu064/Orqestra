import { describe, expect, test } from "vitest";

import { agentKey } from "@/db/schema";
import { FEATURED_TEMPLATES, TEMPLATES, getTemplate } from "@/config/scenarios";

const VALID_AGENTS = new Set<string>(agentKey.enumValues);

describe("scenario templates (§41, §42)", () => {
  test("ids are unique and slug-shaped", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  test("every template has content and a valid agent set", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const t of TEMPLATES) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.objective.length).toBeGreaterThan(20);
      expect(t.agents.length).toBeGreaterThan(0);
      expect(t.agents).toContain("manager");
      for (const a of t.agents) expect(VALID_AGENTS.has(a)).toBe(true);
    }
  });

  test("exactly the featured templates cover the three §41 scenarios", () => {
    expect(FEATURED_TEMPLATES.length).toBe(3);
    expect(FEATURED_TEMPLATES.every((t) => t.featured)).toBe(true);
    const ids = FEATURED_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["customer-recovery", "invoice-recovery", "executive-reporting"]),
    );
  });

  test("getTemplate resolves known ids and returns undefined otherwise", () => {
    expect(getTemplate("invoice-recovery")?.title).toBe("Invoice Recovery");
    expect(getTemplate("nope")).toBeUndefined();
  });
});
