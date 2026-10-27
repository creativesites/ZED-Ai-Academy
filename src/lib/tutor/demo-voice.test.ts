import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_SCENARIOS } from "./demo-scenarios.ts";
import { demoVoiceUrl, lineHash, parseDemoVoiceQuery, scriptedSayText, scriptedVoiceUrls } from "./demo-voice.ts";

const zh = DEMO_SCENARIOS.find((s) => s.key === "zh-tea-house")!;

function query(url: string): URLSearchParams {
  return new URL(url, "https://example.test").searchParams;
}

test("lineHash is stable and 8 hex characters", () => {
  assert.equal(lineHash("你好"), lineHash("你好"));
  assert.notEqual(lineHash("你好"), lineHash("您好"));
  assert.match(lineHash("x"), /^[0-9a-f]{8}$/);
});

test("every scripted say line round-trips through its URL", () => {
  for (const scenario of DEMO_SCENARIOS) {
    const urls = scriptedVoiceUrls(scenario);
    assert.ok(urls.length > 0, scenario.key);
    for (const url of urls) {
      const parsed = parseDemoVoiceQuery(query(url));
      assert.ok(parsed.ok, `${scenario.key}: ${url}`);
      if (parsed.ok) assert.equal(parsed.value.voice, scenario.persona.voiceName);
    }
  }
});

test("the voice query rejects extra parameters, unknown lines and stale hashes", () => {
  const text = scriptedSayText(zh, 0, 0)!;
  const url = demoVoiceUrl(zh, 0, 0, text);
  assert.equal(parseDemoVoiceQuery(query(`${url}&x=1`)).ok, false);
  assert.equal(parseDemoVoiceQuery(query(url.replace(/v=[0-9a-f]+/, "v=00000000"))).ok, false);
  assert.equal(parseDemoVoiceQuery(query(url.replace("t=0", "t=99"))).ok, false);
  assert.equal(parseDemoVoiceQuery(query(url.replace("s=zh-tea-house", "s=nope"))).ok, false);
  assert.equal(parseDemoVoiceQuery(query(url.replace("i=0", "i=-1"))).ok, false);
});
