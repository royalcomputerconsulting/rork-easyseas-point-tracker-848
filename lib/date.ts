export function parseDateStrict(input: any): string | null {
  if (!input) return null;

  const dateStr = String(input).trim();
  if (!dateStr) return null;

  let date: Date | null = null;

  // MM/DD/YYYY or MM-DD-YYYY (4-digit year)
  let m = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      date = new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }

  // MM/DD/YY or MM-DD-YY (2-digit year)
  if (!date) {
    m = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
    if (m) {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      const yy = parseInt(m[3], 10);
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // For 2-digit years, use smart logic:
        // - If yy is 00-49, assume 2000-2049
        // - If yy is 50-99, assume 1950-1999
        // Then adjust if the result is too far in the past or future
        let year = yy < 50 ? 2000 + yy : 1900 + yy;
        
        // Create test date
        const testDate = new Date(year, month - 1, day, 12, 0, 0, 0);
        
        // If the date is more than 2 years in the past, it's likely meant to be in the near future
        // (e.g., "03" in October 2025 likely means 2025, not 2003)
        if (testDate.getTime() < now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000) {
          // Try current year first
          const thisYear = new Date(currentYear, month - 1, day, 12, 0, 0, 0);
          // If it's within 6 months in the past or any time in the future, use current year
          if (thisYear.getTime() > now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000) {
            date = thisYear;
          } else {
            // Otherwise use next year
            date = new Date(currentYear + 1, month - 1, day, 12, 0, 0, 0);
          }
        } else {
          date = testDate;
        }
      }
    }
  }

  // YYYY-MM-DD
  if (!date) {
    const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      let year = parseInt(iso[1], 10);
      const month = parseInt(iso[2], 10);
      const day = parseInt(iso[3], 10);
      date = new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }

  if (date && !isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

function normalizeToUpcomingYear(date: Date): Date {
  const result = new Date(date.getTime());
  // Only normalize if the year is clearly wrong (< 2000)
  // Don't modify dates that are already in a reasonable range (2020-2030)
  if (result.getFullYear() < 2000) {
    const now = new Date();
    result.setFullYear(now.getFullYear());
    // If this month/day already passed by > 30 days, push to next year
    const diff = result.getTime() - now.getTime();
    if (diff < -30 * 24 * 60 * 60 * 1000) {
      result.setFullYear(now.getFullYear() + 1);
    }
  }
  // CRITICAL FIX: For dates in reasonable range (2020-2030), return as-is
  // This ensures completed cruises from 2024 stay as 2024
  return result;
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return 'TBD';
  }

  try {
    const normalized = parseDateStrict(dateStr) ?? dateStr;
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      // CRITICAL FIX: Don't normalize years that are already reasonable (2020-2030)
      let date: Date;
      if (year >= 2020 && year <= 2030) {
        date = new Date(year, month, day, 12, 0, 0, 0);
      } else {
        date = normalizeToUpcomingYear(new Date(year, month, day, 12, 0, 0, 0));
      }
      
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    }

    const parsedDate = new Date(normalized);
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      if (year >= 2020 && year <= 2030) {
        parsedDate.setHours(12, 0, 0, 0);
        return parsedDate.toLocaleDateString();
      }
      const date = normalizeToUpcomingYear(parsedDate);
      return date.toLocaleDateString();
    }
    
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function toISOOrNull(date: Date | null): string | null {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function createLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDateForDisplay(dateStr: string | undefined | null): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return 'TBD';
  }

  try {
    const normalized = parseDateStrict(dateStr) ?? dateStr;
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      // For cruise dates, don't normalize the year if it's already reasonable (2020-2030)
      let date: Date;
      if (year >= 2020 && year <= 2030) {
        date = new Date(year, month, day, 12, 0, 0, 0);
      } else {
        date = normalizeToUpcomingYear(new Date(year, month, day, 12, 0, 0, 0));
      }

      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function createDateFromString(dateStr: any): Date {
  if (dateStr === null || dateStr === undefined) {
    console.log('createDateFromString: Null or undefined input');
    return new Date(NaN);
  }

  let cleanDateStr: string;
  try {
    cleanDateStr = String(dateStr).trim();
  } catch (error) {
    console.log('createDateFromString: Failed to convert to string:', dateStr, error);
    return new Date(NaN);
  }

  if (!cleanDateStr) {
    console.log('createDateFromString: Empty string after trim');
    return new Date(NaN);
  }

  try {
    // Handle Excel serial dates
    if (/^\d+(\.\d+)?$/.test(cleanDateStr)) {
      const serial = parseFloat(cleanDateStr);
      const base = new Date(1900, 0, 1, 12, 0, 0, 0);
      const ms = (serial - 2) * 24 * 60 * 60 * 1000;
      const excelDate = new Date(base.getTime() + ms);
      if (!isNaN(excelDate.getTime())) return excelDate;
    }

    // Use strict parsing first to avoid timezone issues
    const normalized = parseDateStrict(cleanDateStr);
    if (normalized) {
      const [yStr, mStr, dStr] = normalized.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      
      // CRITICAL FIX: Create date at noon local time to avoid timezone shifting
      // For dates in reasonable range (2020-2030), don't normalize - keep original year
      const date = new Date(y, m - 1, d, 12, 0, 0, 0);
      if (!isNaN(date.getTime()) && y >= 2020 && y <= 2030) {
        return date; // Return as-is for reasonable years (preserves 2024 dates)
      } else if (!isNaN(date.getTime())) {
        return normalizeToUpcomingYear(date); // Only normalize unreasonable years
      }
    }

    // Fallback to direct parsing, but be careful with timezone issues
    // If it looks like an ISO date (YYYY-MM-DD), create it at noon local time
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
      const [yStr, mStr, dStr] = cleanDateStr.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      const date = new Date(y, m - 1, d, 12, 0, 0, 0);
      if (!isNaN(date.getTime())) return date;
    }

    const direct = new Date(cleanDateStr);
    if (!isNaN(direct.getTime())) {
      // CRITICAL FIX: Don't normalize reasonable years from direct parsing
      const year = direct.getFullYear();
      if (year >= 2020 && year <= 2030) {
        direct.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
        return direct;
      }
      return normalizeToUpcomingYear(direct);
    }

    const fallback = normalizeToUpcomingYear(new Date(cleanDateStr));
    if (!isNaN(fallback.getTime())) return fallback;

    console.log('createDateFromString: Failed to parse date:', cleanDateStr);
    return new Date(NaN);
  } catch (error) {
    console.log('createDateFromString: Error parsing date:', error, cleanDateStr);
    return new Date(NaN);
  }
}
