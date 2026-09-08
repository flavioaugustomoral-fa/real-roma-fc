/**
 * Utility functions for player name normalization, comparison,
 * and duplicate detection for Pelada soccer matches.
 */

/**
 * Normalizes a player name according to official project rules:
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips accents and diacritics (e.g. ã, é, ó, ç)
 * - Collapses multiple spaces
 *
 * Example:
 * "JOÃO" -> "joao"
 * "João" -> "joao"
 * "ANDRÉ" -> "andre"
 * "André" -> "andre"
 */
export function normalizePlayerName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^\w\s-]/g, '') // remove special symbols except hyphen
    .replace(/\s+/g, ' '); // collapse spaces
}

/**
 * Capitalizes names nicely for display while preserving accents if present
 */
export function formatDisplayName(rawName: string): string {
  if (!rawName) return '';
  const cleaned = rawName.trim().replace(/\s+/g, ' ');
  return cleaned
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      // Prepositions in Portuguese remain lowercase
      const lower = word.toLowerCase();
      if (['da', 'de', 'do', 'dos', 'das', 'e'].includes(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export interface ParseResult {
  parsedPlayers: Array<{
    originalName: string;
    displayName: string;
    normalizedName: string;
  }>;
  duplicates: string[];
  totalLinesProcessed: number;
}

/**
 * Parses raw text input (one player per line) from the administrator.
 * - Handles empty lines
 * - Cleans whitespace
 * - Detects internal duplicates after normalization
 */
export function parsePlayerListInput(rawText: string): ParseResult {
  if (!rawText) {
    return { parsedPlayers: [], duplicates: [], totalLinesProcessed: 0 };
  }

  const lines = rawText.split(/\r?\n/);
  const seenMap = new Map<string, string>(); // normalized -> original
  const duplicatesSet = new Set<string>();
  const parsedPlayers: Array<{
    originalName: string;
    displayName: string;
    normalizedName: string;
  }> = [];

  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    count++;

    const normalized = normalizePlayerName(trimmed);
    if (!normalized) continue;

    if (seenMap.has(normalized)) {
      duplicatesSet.add(trimmed);
    } else {
      seenMap.set(normalized, trimmed);
      parsedPlayers.push({
        originalName: trimmed,
        displayName: formatDisplayName(trimmed),
        normalizedName: normalized,
      });
    }
  }

  return {
    parsedPlayers,
    duplicates: Array.from(duplicatesSet),
    totalLinesProcessed: count,
  };
}
