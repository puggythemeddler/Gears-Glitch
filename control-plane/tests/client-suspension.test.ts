import test from "node:test";
import assert from "node:assert/strict";
import { suspendClientWithConfirmation } from "../server/client-suspension";

test("records suspension when the tenant app confirms it", async () => {
  let markedSuspended = 0;
  const result = await suspendClientWithConfirmation({
    suspendApp: async () => true,
    suspendRender: async () => false,
    markSuspended: async () => { markedSuspended += 1; },
  });

  assert.deepEqual(result, { appSuspended: true, renderSuspended: false });
  assert.equal(markedSuspended, 1);
});

test("records suspension when Render confirms it", async () => {
  let markedSuspended = 0;
  const result = await suspendClientWithConfirmation({
    suspendApp: async () => false,
    suspendRender: async () => true,
    markSuspended: async () => { markedSuspended += 1; },
  });

  assert.deepEqual(result, { appSuspended: false, renderSuspended: true });
  assert.equal(markedSuspended, 1);
});

test("does not record suspension when neither remote mechanism confirms", async () => {
  let markedSuspended = 0;
  await assert.rejects(
    suspendClientWithConfirmation({
      suspendApp: async () => false,
      suspendRender: async () => false,
      markSuspended: async () => { markedSuspended += 1; },
    }),
    /not confirmed by the tenant app or Render/,
  );
  assert.equal(markedSuspended, 0);
});

test("a failed suspension request does not prevent the other confirmation", async () => {
  let markedSuspended = 0;
  const result = await suspendClientWithConfirmation({
    suspendApp: async () => { throw new Error("unavailable"); },
    suspendRender: async () => true,
    markSuspended: async () => { markedSuspended += 1; },
  });

  assert.deepEqual(result, { appSuspended: false, renderSuspended: true });
  assert.equal(markedSuspended, 1);
});
