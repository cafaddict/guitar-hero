import { Fragment } from 'react';

const SEPARATOR = ' · ';

/**
 * A title made of " · "-separated parts (exercise · subject · tempo) that wraps between parts only, each separator
 * ending its line: "D D D D" or "60 BPM" never splits and no line starts with "·" (H9, D-094). A part wider than
 * the line still wraps inside (`max-w-full`). The text content is the same string, so tests and screen readers
 * read it unchanged.
 */
export function Phrases({ text }: { text: string }) {
  const parts = text.split(SEPARATOR);
  let offset = 0;
  return parts.map((part, i) => {
    const key = offset;
    offset += part.length + SEPARATOR.length;
    const last = i === parts.length - 1;
    return (
      <Fragment key={key}>
        <span className="inline-block max-w-full">{last ? part : `${part} ·`}</span>
        {!last && ' '}
      </Fragment>
    );
  });
}
