import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, sanitizeRichHtml } from "./sanitize.ts";

test("strips scripts, event handlers and javascript: links", () => {
  const out = sanitizeRichHtml(
    `<p onclick="steal()">Hi<script>alert(1)</script></p><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a><iframe src="https://evil"></iframe>`
  );
  assert.ok(!/script|onerror|onclick|javascript:|iframe/i.test(out), out);
  assert.match(out, /<p>Hi<\/p>/);
});

test("keeps normal editor formatting and safe links", () => {
  const html = `<h2>Title</h2><p><strong>Bold</strong> <em>it</em> <a href="https://example.com">link</a></p><ul><li>one</li></ul><pre><code class="language-js">x</code></pre>`;
  const out = sanitizeRichHtml(html);
  assert.match(out, /<h2>Title<\/h2>/);
  assert.match(out, /<a href="https:\/\/example.com">link<\/a>/);
  assert.match(out, /<code class="language-js">x<\/code>/);
});

test("target=_blank links get rel=noopener", () => {
  assert.match(sanitizeRichHtml(`<a href="https://x.com" target="_blank">x</a>`), /rel="noopener noreferrer nofollow"/);
});

test("non-strings become empty, escapeHtml escapes", () => {
  assert.equal(sanitizeRichHtml(undefined), "");
  assert.equal(sanitizeRichHtml(42), "");
  assert.equal(escapeHtml(`<b a="1">'&`), "&lt;b a=&quot;1&quot;&gt;&#39;&amp;");
});
