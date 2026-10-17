import { test } from "node:test";
import assert from "node:assert/strict";
import { trainingReadiness } from "../../shared/training.js";

test("training readiness reports every shortfall for one saved relevant answer", () => {
  const readiness = trainingReadiness([{ label: 0, groupId: "family-01" }]);
  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.checks.map((check) => check.remaining),
    [19, 3, 4, 5],
  );
});

test("many positive labels cannot hide a missing negative class", () => {
  const readiness = trainingReadiness(
    Array.from({ length: 25 }, (_, i) => ({
      label: 0,
      groupId: `family-${i % 4}`,
    })),
  );
  assert.equal(readiness.ready, false);
  assert.equal(readiness.checks[3]?.remaining, 5);
});

test("whitespace in family names does not create independent businesses", () => {
  const readiness = trainingReadiness(
    Array.from({ length: 20 }, (_, i) => ({
      label: i % 2,
      groupId: i % 2 ? " family-01 " : "family-01",
    })),
  );
  assert.equal(readiness.checks[1]?.current, 1);
  assert.equal(readiness.ready, false);
});
