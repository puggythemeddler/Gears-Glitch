import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { getPool, query, runSchema } from "../server/db-helpers";
import { createPage, updatePage, deletePage, listPages, listPublishedPages, getPageBySlug, getPageById } from "../server/db";

const HAS_DB = !!process.env.DATABASE_URL;

// DB-backed coverage of the Page Builder CMS lifecycle at the exact layer the
// /api/pages and /api/admin/pages routes delegate to. Gated the same way as
// tests/migrations.integration.test.ts (CI provides Postgres via DATABASE_URL;
// locally these skip). Covers create → draft → edit → publish → unpublish →
// delete, slug uniqueness, and public/draft visibility semantics.
describe("page builder CMS lifecycle (DB)", { skip: !HAS_DB && "DATABASE_URL not set (CI/isolated DB only)" }, () => {
  before(() => { getPool(); return Promise.resolve(); });

  before(async () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "server", "schema.sql"), "utf8");
    await query(`DROP TABLE IF EXISTS schema_migrations CASCADE`);
    await runSchema(schema);
  });

  beforeEach(async () => {
    await query(`TRUNCATE pages CASCADE`);
  });

  it("creates a valid page as a draft", async () => {
    const row = await createPage({ slug: "qa-test-page", title: "QA Test Page", description: "desc", config: { sections: [], colors: {} }, is_published: 0 });
    assert.equal(row.slug, "qa-test-page");
    assert.equal(row.title, "QA Test Page");
    assert.equal(row.is_published, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(row.config.sections || [])), []);
    assert.ok(row.id > 0);
    assert.ok(row.created_at);
    assert.ok(row.updated_at);
  });

  it("enforces slug uniqueness at the database", async () => {
    await createPage({ slug: "qa-test-page", title: "First" });
    await assert.rejects(
      () => createPage({ slug: "qa-test-page", title: "Second" }),
      /duplicate key|unique constraint/i,
      "duplicate slug must be rejected by the UNIQUE constraint"
    );
  });

  it("keeps drafts out of the published list", async () => {
    await createPage({ slug: "draft-page", title: "Draft", is_published: 0 });
    const live = await createPage({ slug: "live-page", title: "Live", is_published: 1 });
    assert.equal(listPages2(await listPages()), 2, "admin list includes drafts");
    const published = await listPublishedPages();
    assert.equal(published.length, 1);
    assert.equal(published[0].slug, "live-page");
    assert.ok(live.is_published === 1);
  });

  it("round-trips a nested JSON config", async () => {
    const config = {
      sections: [{ type: "text", title: "Hello", content: "World", align: "center" }],
      colors: { accent: "#a11", heroBg: "#000" },
    };
    const row = await createPage({ slug: "config-page", title: "Config", config });
    const refetched = await getPageById(row.id);
    assert.ok(refetched);
    assert.deepEqual(refetched.config, config);
    assert.deepEqual(refetched.config.sections[0].align, "center");
  });

  it("finds pages by slug and id", async () => {
    const row = await createPage({ slug: "find-me", title: "Find me" });
    const bySlug = await getPageBySlug("find-me");
    const byId = await getPageById(row.id);
    assert.equal(bySlug?.id, row.id);
    assert.equal(byId?.slug, "find-me");
    assert.equal(await getPageBySlug("does-not-exist"), undefined);
    assert.equal(await getPageById(999999), undefined);
  });

  it("publishes and unpublishes through partial updates", async () => {
    let row = await createPage({ slug: "switcher", title: "Switcher", is_published: 0 });
    assert.equal((await listPublishedPages()).length, 0);

    row = await updatePage(row.id, { is_published: 1 }) as any;
    assert.equal(row.is_published, 1);
    let published = await listPublishedPages();
    assert.equal(published.length, 1);
    assert.equal(published[0].slug, "switcher");

    const draftBySlug = await getPageBySlug("switcher");
    assert.equal(draftBySlug?.is_published, 1, "slug lookup still resolves the row, visibility filter is list-level");

    row = await updatePage(row.id, { is_published: 0 }) as any;
    assert.equal(row.is_published, 0);
    assert.equal((await listPublishedPages()).length, 0, "unpublished page leaves the public list");
  });

  it("keeps unrelated fields when updating a single field (publication state preserved)", async () => {
    const before = await createPage({ slug: "partial-update", title: "Original title", description: "keep me", config: { sections: [] } });
    const updated = await updatePage(before.id, { title: "New title" }) as any;
    assert.equal(updated.title, "New title");
    assert.equal(updated.description, "keep me");
    assert.equal(updated.slug, "partial-update");
    assert.equal(updated.is_published, 0, "publish state untouched by a title-only save");
  });

  it("bumps updated_at on update but keeps created_at", async () => {
    const row = await createPage({ slug: "timestamps", title: "T" });
    const earlierUpdated = row.updated_at;
    await new Promise((r) => setTimeout(r, 25));
    const updated = await updatePage(row.id, { title: "T2" }) as any;
    assert.equal(updated.created_at, row.created_at);
    assert.notEqual(new Date(updated.updated_at).getTime(), new Date(earlierUpdated).getTime());
  });

  it("deletes a page and reports missing pages", async () => {
    const row = await createPage({ slug: "bye", title: "Bye" });
    assert.equal(await deletePage(row.id), true, "existing page deletes");
    assert.equal(await getPageById(row.id), undefined, "deleted page no longer resolves");
    assert.equal(await getPageById(row.id), undefined);
    assert.equal(await deletePage(row.id), false, "second delete reports not-found");
    assert.equal(await deletePage(999999), false, "deleting a missing id reports not-found");
  });
});

function listPages2(rows: Awaited<ReturnType<typeof listPages>>): number {
  return rows.length;
}