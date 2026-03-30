import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripMarkdown } from "../src/strip-markdown.js";

describe("stripMarkdown", () => {
  it("returns empty string for falsy input", () => {
    assert.equal(stripMarkdown(""), "");
    assert.equal(stripMarkdown(null), "");
    assert.equal(stripMarkdown(undefined), "");
  });

  it("passes through plain text unchanged", () => {
    assert.equal(stripMarkdown("Hello world"), "Hello world");
  });

  it("strips heading markers", () => {
    assert.equal(stripMarkdown("## Status Update"), "Status Update");
    assert.equal(stripMarkdown("# Title"), "Title");
    assert.equal(stripMarkdown("### Sub heading"), "Sub heading");
  });

  it("strips bold markers", () => {
    assert.equal(stripMarkdown("This is **bold** text"), "This is bold text");
    assert.equal(stripMarkdown("This is __bold__ text"), "This is bold text");
  });

  it("strips italic markers", () => {
    assert.equal(stripMarkdown("This is *italic* text"), "This is italic text");
  });

  it("strips bold-italic markers", () => {
    assert.equal(stripMarkdown("This is ***important***"), "This is important");
  });

  it("strips strikethrough markers", () => {
    assert.equal(stripMarkdown("This is ~~deleted~~ text"), "This is deleted text");
  });

  it("strips inline code backticks", () => {
    assert.equal(stripMarkdown("Run `npm install` now"), "Run npm install now");
  });

  it("strips fenced code blocks", () => {
    const input = "Before\n```js\nconsole.log('hi');\n```\nAfter";
    const result = stripMarkdown(input);
    assert.ok(result.includes("console.log('hi');"));
    assert.ok(!result.includes("```"));
  });

  it("strips blockquote markers", () => {
    assert.equal(stripMarkdown("> This is a quote"), "This is a quote");
  });

  it("strips unordered list markers", () => {
    const input = "- Item one\n- Item two\n* Item three";
    const result = stripMarkdown(input);
    assert.ok(result.includes("Item one"));
    assert.ok(!result.includes("- "));
    assert.ok(!result.includes("* "));
  });

  it("strips ordered list markers", () => {
    const input = "1. First\n2. Second\n3. Third";
    const result = stripMarkdown(input);
    assert.ok(result.includes("First"));
    assert.ok(!result.match(/^\d+\./m));
  });

  it("converts links to text only", () => {
    assert.equal(
      stripMarkdown("Visit [Google](https://google.com) today"),
      "Visit Google today"
    );
  });

  it("converts images to alt text", () => {
    assert.equal(
      stripMarkdown("![screenshot](image.png)"),
      "screenshot"
    );
  });

  it("strips horizontal rules", () => {
    const input = "Above\n---\nBelow";
    const result = stripMarkdown(input);
    assert.ok(!result.includes("---"));
    assert.ok(result.includes("Above"));
    assert.ok(result.includes("Below"));
  });

  it("strips HTML tags", () => {
    assert.equal(stripMarkdown("Hello <b>world</b>"), "Hello world");
  });

  it("handles a complex real-world markdown response", () => {
    const input = [
      "## Smart Home Status",
      "",
      "Here's what's happening:",
      "",
      "- **Living Room** temp is *72°F*",
      "- **Kitchen** light is `on`",
      "- The [front door](sensor/door) is ~~locked~~ unlocked",
      "",
      "> Note: check the garage",
      "",
      "1. Turn off lights",
      "2. Lock doors"
    ].join("\n");

    const result = stripMarkdown(input);

    assert.ok(!result.includes("##"));
    assert.ok(!result.includes("**"));
    assert.ok(!result.includes("*72"));
    assert.ok(!result.includes("`on`"));
    assert.ok(!result.includes("~~"));
    assert.ok(!result.includes("> "));
    assert.ok(result.includes("Living Room"));
    assert.ok(result.includes("72°F"));
    assert.ok(result.includes("front door"));
    assert.ok(result.includes("unlocked"));
  });
});
