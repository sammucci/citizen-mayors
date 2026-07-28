// Very small "Markdown-lite" renderer for proposal body text — not a
// real Markdown parser, just enough to let people break a proposal into
// headings and paragraphs without needing a full rich-text editor.
// Supports:
//   # Heading       -> a section heading
//   ## Subheading   -> a smaller section heading
//   (blank line)    -> starts a new paragraph
// Anything else renders as plain paragraph text exactly like before this
// existed, so proposals written before this feature shipped still
// display exactly as they did. Renders to real JSX text nodes (never
// dangerouslySetInnerHTML), so this can't be used to inject markup —
// React escapes everything automatically.
export function renderMarkdownLite(body: string) {
  const lines = (body ?? "").split("\n");
  const blocks: { type: "h2" | "h3" | "p"; text: string }[] = [];
  let currentParagraph: string[] = [];

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      blocks.push({ type: "p", text: currentParagraph.join("\n") });
      currentParagraph = [];
    }
  }

  for (const line of lines) {
    const h3Match = line.match(/^##\s+(.*)/);
    const h2Match = line.match(/^#\s+(.*)/);
    if (h3Match) {
      flushParagraph();
      blocks.push({ type: "h3", text: h3Match[1] });
    } else if (h2Match) {
      flushParagraph();
      blocks.push({ type: "h2", text: h2Match[1] });
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      currentParagraph.push(line);
    }
  }
  flushParagraph();

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h2 key={i} className="mt-4 text-lg font-semibold first:mt-0">
              {block.text}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={i} className="mt-3 text-base font-semibold first:mt-0">
              {block.text}
            </h3>
          );
        }
        return (
          <p key={i} className="mt-2 whitespace-pre-wrap text-sm first:mt-0">
            {block.text}
          </p>
        );
      })}
    </>
  );
}
