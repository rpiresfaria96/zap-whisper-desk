import { Fragment } from "react";

// WhatsApp usa *negrito*, _itálico_, ~tachado~ e ```monoespaçado```.
// Não usamos innerHTML, para nunca interpretar HTML recebido como código.
const tokens = /(```[\s\S]+?```|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_|~[^~\s][^~\n]*?~|https?:\/\/[^\s<>]+)/g;
const emojiFont = '"Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif';

function safeLink(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}

function marked(value: string, query: string) {
  const term = query.trim();
  if (!term) return value;
  const lower = value.toLocaleLowerCase("pt-BR");
  const sought = term.toLocaleLowerCase("pt-BR");
  const fragments = [];
  let cursor = 0;
  let index = lower.indexOf(sought, cursor);
  while (index !== -1 && fragments.length < 150) {
    if (index > cursor) fragments.push(value.slice(cursor, index));
    fragments.push(<mark key={index} className="rounded bg-yellow-300 px-0.5 text-black">
      {value.slice(index, index + term.length)}</mark>);
    cursor = index + term.length;
    index = lower.indexOf(sought, cursor);
  }
  if (cursor < value.length) fragments.push(value.slice(cursor));
  return fragments;
}

export function FormattedMessage({ text, highlight = "" }: { text: string; highlight?: string }) {
  return (
    <span className="whitespace-pre-wrap break-words" style={{ fontFamily: emojiFont }}>
      {text.split(tokens).filter((token) => token !== "").map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          return <code key={i} className="rounded bg-black/10 px-1 font-mono text-[0.92em]">{marked(part.slice(3, -3), highlight)}</code>;
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <strong key={i}>{marked(part.slice(1, -1), highlight)}</strong>;
        }
        if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
          return <em key={i}>{marked(part.slice(1, -1), highlight)}</em>;
        }
        if (part.startsWith("~") && part.endsWith("~") && part.length > 2) {
          return <del key={i}>{marked(part.slice(1, -1), highlight)}</del>;
        }
        if (/^https?:\/\//.test(part)) {
          const href = safeLink(part);
          if (href) return <a key={i} href={href} target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2">{marked(part, highlight)}</a>;
        }
        return <Fragment key={i}>{marked(part, highlight)}</Fragment>;
      })}
    </span>
  );
}
