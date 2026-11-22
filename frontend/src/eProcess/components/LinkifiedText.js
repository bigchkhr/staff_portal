const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

function trimTrailingPunctuation(url) {
  return url.replace(/[),.;!?]+$/g, '');
}

export default function LinkifiedText({ text, className }) {
  const source = text == null ? '' : String(text);
  if (!source) return null;

  const nodes = [];
  let cursor = 0;
  for (const match of source.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const url = trimTrailingPunctuation(raw);
    const index = match.index || 0;
    if (index > cursor) nodes.push(source.slice(cursor, index));
    nodes.push(
      <a key={`${url}-${index}`} className="task-link" href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
    const trailing = raw.slice(url.length);
    if (trailing) nodes.push(trailing);
    cursor = index + raw.length;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));

  return <span className={className}>{nodes}</span>;
}
