/**
 * Normalize a Chinese company name for dedup matching.
 * - Removes leading/trailing whitespace
 * - Normalizes full-width characters to half-width
 * - Lowercases Latin letters
 * - Strips common company suffixes and legal forms
 * - Removes parentheses with content at the end
 */
export function normalizeCompanyName(name: string): string {
  let s = name.trim();

  // Full-width to half-width
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0),
  );

  // Normalize whitespace: consecutive spaces to one
  s = s.replace(/\s+/g, " ");

  // Lowercase
  s = s.toLowerCase();

  // Remove trailing parentheses with content (e.g., "（集团）", "(有限)")
  s = s.replace(/[（(][^）)]*[）)]$/g, "");

  // Remove common suffixes in order (repeated pass to handle stacked suffixes)
  const suffixes = [
    "（有限责任公司）", "(有限责任公司)", "有限责任公司",
    "（有限公司）", "(有限公司)", "有限公司",
    "（集团）", "(集团)", "集团",
    "（股份）", "(股份)", "股份",
    "（有限）", "(有限)", "有限",
    "（公司）", "(公司)", "公司",
    "（厂）", "(厂)", "厂",
    "（店）", "(店)", "店",
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (s.endsWith(suffix)) {
        s = s.slice(0, -suffix.length).trim();
        changed = true;
        break;
      }
    }
  }

  // Remove any remaining parentheses with content anywhere (safety pass)
  s = s.replace(/[（(][^）)]*[）)]/g, "").trim();

  return s;
}

/**
 * Validate Chinese mobile phone number format.
 */
export function isValidMobile(mobile: string): boolean {
  return /^1[3-9]\d{9}$/.test(mobile);
}
