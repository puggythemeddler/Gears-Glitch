import assert from "node:assert/strict";
import { after, test } from "node:test";

const originalFetch = globalThis.fetch;
const originalRenderApiKey = process.env.RENDER_API_KEY;
const originalControlPlaneUrl = process.env.CONTROL_PLANE_URL;

type PushControlPlaneSecret = typeof import("../server/provision").pushControlPlaneSecret;
let pushControlPlaneSecret: PushControlPlaneSecret;

after(() => {
  globalThis.fetch = originalFetch;
  if (originalRenderApiKey === undefined) delete process.env.RENDER_API_KEY;
  else process.env.RENDER_API_KEY = originalRenderApiKey;
  if (originalControlPlaneUrl === undefined) delete process.env.CONTROL_PLANE_URL;
  else process.env.CONTROL_PLANE_URL = originalControlPlaneUrl;
});

test("pushControlPlaneSecret uses Render's env-var API and checks failures", async (t) => {
  process.env.RENDER_API_KEY = "test-render-api-key";
  process.env.CONTROL_PLANE_URL = "https://gear-glitch-control-plane.onrender.com/";
  ({ pushControlPlaneSecret } = await import("../server/provision"));

  await t.test("updates each variable before triggering a deploy", async () => {
    const requests: Array<{ url: URL; method: string; body: unknown }> = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      requests.push({
        url: new URL(String(input)),
        method: init?.method || "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    await pushControlPlaneSecret("srv-test123", "cps-test-secret");

    assert.deepEqual(requests.map(({ method, url }) => [method, url.pathname]), [
      ["PUT", "/v1/services/srv-test123/env-vars/CONTROL_PLANE_SECRET"],
      ["PUT", "/v1/services/srv-test123/env-vars/CONTROL_PLANE_URL"],
      ["POST", "/v1/services/srv-test123/deploys"],
    ]);
    assert.deepEqual(requests[0].body, { value: "cps-test-secret" });
    assert.deepEqual(requests[1].body, { value: "https://gear-glitch-control-plane.onrender.com" });
  });

  await t.test("does not deploy if a Render env-var update fails", async () => {
    const requests: URL[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      requests.push(new URL(String(input)));
      return new Response(null, { status: 403 });
    }) as typeof fetch;

    await assert.rejects(
      pushControlPlaneSecret("srv-test123", "cps-test-secret"),
      /Failed to set Render environment variable CONTROL_PLANE_SECRET: HTTP 403/,
    );
    assert.equal(requests.length, 1, "must not deploy after an env-var update fails");
  });
});
