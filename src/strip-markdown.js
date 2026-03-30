/**
 * Strip common markdown formatting so TTS engines read clean plaintext.
 *
 * Handles: headings, bold, italic, strikethrough, inline code, fenced code
 * blocks, blockquotes, unordered/ordered list markers, links, images,
 * horizontal rules, and HTML tags.
 */
export function stripMarkdown(text) {
  if (!text) return "";

  let result = text;

  // Remove fenced code blocks (``` ... ```) — keep the inner text
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    // Strip the fence markers and optional language tag
    return match
      .replace(/^```[^\n]*\n?/, "")
      .replace(/\n?```$/, "");
  });

  // Remove inline code backticks
  result = result.replace(/`([^`]*)`/g, "$1");

  // Remove images ![alt](url) → alt
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Convert links [text](url) → text
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove heading markers (## Heading → Heading)
  result = result.replace(/^#{1,6}\s+/gm, "");

  // Remove bold/italic markers: ***text***, **text**, *text*, ___text___, __text__, _text_
  // Order matters — longest markers first
  result = result.replace(/\*{3}(.+?)\*{3}/g, "$1");
  result = result.replace(/\*{2}(.+?)\*{2}/g, "$1");
  result = result.replace(/\*(.+?)\*/g, "$1");
  result = result.replace(/_{3}(.+?)_{3}/g, "$1");
  result = result.replace(/_{2}(.+?)_{2}/g, "$1");
  result = result.replace(/(?<=\s|^)_(.+?)_(?=\s|$)/gm, "$1");

  // Remove strikethrough ~~text~~ → text
  result = result.replace(/~~(.+?)~~/g, "$1");

  // Remove blockquote markers
  result = result.replace(/^>\s?/gm, "");

  // Remove horizontal rules (---, ***, ___)
  result = result.replace(/^[-*_]{3,}\s*$/gm, "");

  // Remove unordered list markers (-, *, +) at start of line
  result = result.replace(/^[\t ]*[-*+]\s+/gm, "");

  // Remove ordered list markers (1., 2., etc.)
  result = result.replace(/^[\t ]*\d+\.\s+/gm, "");

  // Remove simple HTML tags
  result = result.replace(/<[^>]+>/g, "");

  // Collapse multiple blank lines into one
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
