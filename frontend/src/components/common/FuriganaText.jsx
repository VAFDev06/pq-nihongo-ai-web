import React from 'react';

/**
 * Renders Japanese text with Furigana (ruby annotations).
 * Supports:
 * 1. tokens array: [{ surface: "日本", reading: "にほん", hasFurigana: true }, ...]
 * 2. raw text with bracket notation: "日本[にほん]へ行[い]く"
 */
export const FuriganaText = ({ tokens, text, className = '', showFurigana = true }) => {
  if (tokens && Array.isArray(tokens)) {
    return (
      <span className={`furigana-rendered font-jp ${className}`}>
        {tokens.map((token, idx) => {
          if (!showFurigana || !token.hasFurigana || !token.reading || token.surface === token.reading) {
            return <span key={idx}>{token.surface}</span>;
          }
          return (
            <ruby key={idx}>
              {token.surface}
              <rt>{token.reading}</rt>
            </ruby>
          );
        })}
      </span>
    );
  }

  if (!text) return null;

  // Clean empty or invalid brackets like [] or [null] or [undefined]
  const cleanSource = text.replace(/\[\s*(null|undefined)?\s*\]/g, '');

  if (!showFurigana) {
    // Strip bracket notation
    const cleanText = cleanSource.replace(/\[(.*?)\]/g, '');
    return <span className={`font-jp ${className}`}>{cleanText}</span>;
  }

  // Parse text like 漢字[かんじ]
  const regex = /([\u4e00-\u9faf\u3400-\u4dbf]+)\[([ぁ-んァ-ヶー]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleanSource)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanSource.substring(lastIndex, match.index));
    }
    parts.push(
      <ruby key={match.index}>
        {match[1]}
        <rt>{match[2]}</rt>
      </ruby>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanSource.length) {
    parts.push(cleanSource.substring(lastIndex));
  }

  return <span className={`furigana-rendered font-jp ${className}`}>{parts}</span>;
};

export default FuriganaText;
