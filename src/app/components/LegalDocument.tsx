import type { ReactNode } from "react";

function inlineMarkdown(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^\)]+\))/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push(value.slice(cursor, start));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${start}-strong`}>{token.slice(2, -2)}</strong>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const [label, href] = [link[1], link[2]];
        parts.push(<a key={`${start}-link`} href={href}>{label}</a>);
      } else {
        parts.push(token);
      }
    }
    cursor = start + token.length;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

export function LegalDocument({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line === "---") {
      blocks.push(<hr key={`rule-${index}`} />);
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const content = inlineMarkdown(heading[2]);
      blocks.push(level === 1 ? <h1 key={`heading-${index}`}>{content}</h1> : level === 2 ? <h2 key={`heading-${index}`}>{content}</h2> : <h3 key={`heading-${index}`}>{content}</h3>);
      index += 1;
      continue;
    }
    if (/^[*-]\s+/.test(line)) {
      const items: ReactNode[] = [];
      const start = index;
      while (index < lines.length && /^[*-]\s+/.test(lines[index].trim())) {
        items.push(<li key={`${start}-${index}`}>{inlineMarkdown(lines[index].trim().replace(/^[*-]\s+/, ""))}</li>);
        index += 1;
      }
      blocks.push(<ul key={`list-${start}`}>{items}</ul>);
      continue;
    }
    const paragraph: string[] = [line];
    const start = index;
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || next === "---" || /^(#{1,3})\s+/.test(next) || /^[*-]\s+/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${start}`}>{paragraph.flatMap((part, lineIndex) => [lineIndex > 0 ? <br key={`${start}-${lineIndex}-break`} /> : null, ...inlineMarkdown(part)]).filter(Boolean)}</p>);
  }
  return <div className="legalText">{blocks}</div>;
}
