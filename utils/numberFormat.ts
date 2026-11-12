import { AppLanguage } from '@/context/SettingsContext';

/**
 * Returns unified thousand ('.') and decimal/kuruş (',') separators across the entire app.
 * Example: 3725153 -> "3.725.153,00"
 */
export function getNumberSeparators(_language: AppLanguage = 'tr'): {
  thousand: string;
  decimal: string;
} {
  return { thousand: '.', decimal: ',' };
}

/**
 * Inserts thousand grouping separators into a plain integer digit string.
 */
function groupIntegerDigits(digits: string, thousandSep: string): string {
  const clean = digits.replace(/^0+(?=\d)/, '');
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
}

/**
 * Formats a numeric value cleanly across iOS, Android (Hermes), and Web
 * without relying on device Intl/ICU quirks.
 * Examples (TR): 3725153 -> "3.725.153,00", 0.8501 -> "0,8501"
 */
export function formatGroupedNumber(
  value: number,
  language: AppLanguage = 'tr',
  minDecimals = 2,
  maxDecimals = 2
): string {
  const { thousand, decimal } = getNumberSeparators(language);
  if (!Number.isFinite(value)) {
    return minDecimals > 0 ? `0${decimal}${'0'.repeat(minDecimals)}` : '0';
  }

  const effectiveMax = Math.max(minDecimals, maxDecimals);
  const abs = Math.abs(value);
  const fixed = abs.toFixed(effectiveMax);
  const [intPart, rawFracPart = ''] = fixed.split('.');
  let fracPart = rawFracPart;

  if (effectiveMax > minDecimals && fracPart.length > minDecimals) {
    fracPart = fracPart.replace(/0+$/, '');
    if (fracPart.length < minDecimals) {
      fracPart = fracPart.padEnd(minDecimals, '0');
    }
  }

  const groupedInt = groupIntegerDigits(intPart, thousand);
  const sign = value < 0 ? '-' : '';
  return fracPart.length > 0 ? `${sign}${groupedInt}${decimal}${fracPart}` : `${sign}${groupedInt}`;
}

/**
 * Formats an asset unit price with automatic precision (2 decimals for normal/large rates like 3.725.153,00,
 * up to 4 decimals for TEFAS funds or prices < 10).
 */
export function formatAssetUnitRate(
  value: number,
  language: AppLanguage = 'tr',
  isHighPrecision = false
): string {
  if (isHighPrecision) {
    return formatGroupedNumber(value, language, 2, 4);
  }
  return formatGroupedNumber(value, language, 2, 2);
}

/**
 * Parses a localized formatted number string (e.g. "3.725.153,00", "3,725,153.00", "3725153.45", "12,5")
 * back into a standard JavaScript number.
 */
export function parseLocaleNumber(raw: string, language: AppLanguage = 'tr'): number {
  if (!raw || typeof raw !== 'string') return NaN;
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed) return NaN;

  const hasDot = trimmed.includes('.');
  const hasComma = trimmed.includes(',');

  if (hasDot && hasComma) {
    // Whichever appears last is the decimal separator; earlier ones are thousand separators
    const lastDot = trimmed.lastIndexOf('.');
    const lastComma = trimmed.lastIndexOf(',');
    if (lastComma > lastDot) {
      return parseFloat(trimmed.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(trimmed.replace(/,/g, ''));
  }

  if (hasComma) {
    const commaCount = (trimmed.match(/,/g) || []).length;
    if (commaCount > 1) {
      return parseFloat(trimmed.replace(/,/g, ''));
    }
    return parseFloat(trimmed.replace(',', '.'));
  }

  if (hasDot) {
    const dotCount = (trimmed.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Support pasted values like "3.725.153.00" (thousands separated by dot + 1-2 decimal digits)
      const doubleDotMatch = trimmed.match(/^(\d{1,3}(?:\.\d{3})+)\.(\d{1,2})$/);
      if (doubleDotMatch) {
        return parseFloat(`${doubleDotMatch[1].replace(/\./g, '')}.${doubleDotMatch[2]}`);
      }
      return parseFloat(trimmed.replace(/\./g, ''));
    }
    // Single dot with exact 1-3 + '.' + 3 digits (like "3.725") is a thousand separator
    if (/^\d{1,3}\.\d{3}$/.test(trimmed)) {
      return parseFloat(trimmed.replace(/\./g, ''));
    }
    return parseFloat(trimmed);
  }

  return parseFloat(trimmed);
}

/**
 * Formats live user input inside numeric TextInputs with thousand grouping while preserving cursor ergonomics
 * and allowing both ',' and '.' keys to act as the decimal separator cleanly.
 * Returns `null` if the keystroke should be rejected.
 */
export function formatEditableNumberInput(
  nextText: string,
  prevText: string,
  maxDecimals = 4,
  language: AppLanguage = 'tr'
): string | null {
  if (nextText === '') return '';

  const { thousand, decimal } = getNumberSeparators(language);
  const altSep = decimal === ',' ? '.' : ',';

  // Reject characters other than digits, '.', or ','
  if (!/^[0-9.,]+$/.test(nextText)) return null;

  // Handle multi-character paste (e.g. pasting "3725153.00" or "3.725.153,45")
  if (nextText.length > prevText.length + 1) {
    const parsed = parseLocaleNumber(nextText, language);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    const rawStr = nextText.trim();
    const lastSepIdx = Math.max(rawStr.lastIndexOf(','), rawStr.lastIndexOf('.'));
    if (lastSepIdx !== -1 && (rawStr.length - lastSepIdx - 1) !== 3) {
      const fracLen = Math.min(maxDecimals, Math.max(0, rawStr.length - lastSepIdx - 1));
      return formatGroupedNumber(parsed, language, fracLen, fracLen);
    }
    return formatGroupedNumber(parsed, language, 0, maxDecimals);
  }

  let workingText = nextText;

  // Detect if user just pressed the alternate decimal key (e.g. pressing '.' on a TR keyboard)
  if (nextText.length === prevText.length + 1 && !prevText.includes(decimal)) {
    const prevAltCount = prevText.split(altSep).length - 1;
    const nextAltCount = nextText.split(altSep).length - 1;
    if (nextAltCount > prevAltCount) {
      // Find the position where the new alternate separator was inserted and replace it with decimal separator
      let diffIdx = nextText.length - 1;
      for (let i = 0; i < prevText.length; i++) {
        if (nextText[i] !== prevText[i]) {
          diffIdx = i;
          break;
        }
      }
      if (nextText[diffIdx] === altSep) {
        workingText = nextText.slice(0, diffIdx) + decimal + nextText.slice(diffIdx + 1);
      }
    }
  }

  const parts = workingText.split(decimal);
  if (parts.length > 2) return null;

  const escapedThousand = thousand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rawInt = parts[0].replace(new RegExp(escapedThousand, 'g'), '');
  if (!/^\d*$/.test(rawInt)) return null;
  if (rawInt.length > 13) return null;

  const rawFrac = parts[1];
  if (rawFrac !== undefined) {
    if (!/^\d*$/.test(rawFrac)) return null;
    if (rawFrac.length > maxDecimals) return null;
  }

  const formattedInt =
    rawInt === '' ? (parts.length === 2 ? '0' : '') : groupIntegerDigits(rawInt, thousand);

  return parts.length === 2 ? `${formattedInt}${decimal}${rawFrac}` : formattedInt;
}

