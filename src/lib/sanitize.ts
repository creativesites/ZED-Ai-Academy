import sanitizeHtml from "sanitize-html";

/**
 * Sanitise author- or AI-supplied rich text before rendering it with dangerouslySetInnerHTML.
 * Allows what the TipTap editor and the AI generators produce (headings, lists, links, code,
 * tables, images) and strips scripts, event handlers, iframes, styles and javascript: URLs.
 * Works on server and client (no DOM required).
 */
export function sanitizeRichHtml(dirty: unknown): string {
  if (typeof dirty !== "string" || !dirty) return "";
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "del", "mark", "sub", "sup", "small", "span",
      "a", "ul", "ol", "li", "blockquote", "code", "pre", "kbd",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
      "img", "figure", "figcaption", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      code: ["class"],
      pre: ["class"],
      span: ["class"],
      ol: ["start", "type"],
      li: ["data-checked", "data-type"],
      ul: ["data-type"],
    },
    allowedClasses: {
      code: [/^language-[\w-]+$/, /^hljs.*/],
      pre: [/^language-[\w-]+$/],
      span: [/^hljs-[\w-]+$/],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank" ? { rel: "noopener noreferrer nofollow" } : {}),
        },
      }),
    },
  });
}

/** Escape plain text so it can be safely embedded in HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
