export function formatDate(dateString: string, format: "short" | "long" = "short"): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    if (format === "short") {
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const year = date.getFullYear();
      return `${month}-${day}-${year}`;
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    return dateString;
  }
}

export function parseItinerary(itineraryDescription: string): {
  nights: number;
  ports: string[];
} {
  const nightsMatch = itineraryDescription.match(/(\d+)\s*night/i);
  const nights = nightsMatch ? parseInt(nightsMatch[1], 10) : 0;

  const portsString = itineraryDescription.replace(/\d+\s*night[^:]*:\s*/i, "");
  const ports = portsString
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return { nights, ports };
}

export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function toPortTitleCase(portName: string): string {
  if (!portName) return portName;

  const exceptions = [
    "and",
    "of",
    "the",
    "at",
    "by",
    "for",
    "in",
    "on",
    "to",
    "with",
  ];

  return portName
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index === 0 || !exceptions.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

export function formatTradeValue(value: string | number): string {
  if (typeof value === "number") {
    return `$${value.toFixed(2)}`;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      return `$${num.toFixed(2)}`;
    }
  }

  return String(value);
}

export function normalizeTradeValue(value: string | number): number {
  if (typeof value === "number") return value;

  const cleaned = String(value).replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function computePerks(sailing: any): string[] {
  const perks: string[] = [];

  if (sailing.freePlay) {
    perks.push(`Free Play: ${formatTradeValue(sailing.freePlay)}`);
  }

  if (sailing.onboardCredit) {
    perks.push(`OBC: ${formatTradeValue(sailing.onboardCredit)}`);
  }

  if (sailing.discountedCruise === "Y" || sailing.discountedCruise === true) {
    perks.push("Discounted");
  }

  if (sailing.freeCruise === "Y" || sailing.freeCruise === true) {
    perks.push("Free Cruise");
  }

  if (sailing.upgrades) {
    perks.push("Upgrades");
  }

  return perks;
}

export function getShipClass(shipName: string): string {
  const shipClasses: Record<string, string> = {
    "Oasis": "Oasis Class",
    "Allure": "Oasis Class",
    "Harmony": "Oasis Class",
    "Symphony": "Oasis Class",
    "Wonder": "Oasis Class",
    "Quantum": "Quantum Class",
    "Anthem": "Quantum Class",
    "Ovation": "Quantum Class",
    "Spectrum": "Quantum Class",
    "Odyssey": "Quantum Class",
    "Freedom": "Freedom Class",
    "Liberty": "Freedom Class",
    "Independence": "Freedom Class",
    "Voyager": "Voyager Class",
    "Explorer": "Voyager Class",
    "Adventure": "Voyager Class",
    "Navigator": "Voyager Class",
    "Mariner": "Voyager Class",
    "Radiance": "Radiance Class",
    "Brilliance": "Radiance Class",
    "Serenade": "Radiance Class",
    "Jewel": "Radiance Class",
    "Icon": "Icon Class",
    "Star": "Icon Class",
  };

  for (const [key, value] of Object.entries(shipClasses)) {
    if (shipName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return "Unknown Class";
}

export function normalizeShipName(shipName: string): string {
  if (!shipName) return shipName;

  const prefix = /^(Royal Caribbean|Celebrity)\s*/i;
  const suffix = /\s*(of the seas|cruise|ship)$/i;

  let normalized = shipName.replace(prefix, "").replace(suffix, "").trim();
  normalized = toTitleCase(normalized);

  return normalized;
}

export function parseGuestCount(guestsText: string): number {
  if (!guestsText) return 2;

  const match = guestsText.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 2;
}

export function calculateNightsFromDates(
  departureDate: string,
  returnDate: string
): number {
  try {
    const start = new Date(departureDate);
    const end = new Date(returnDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return 0;
  }
}

export function sortByColumn(
  data: any[],
  column: string,
  direction: "asc" | "desc" | null
): any[] {
  if (!direction) return data;

  return [...data].sort((a, b) => {
    const aVal = getColumnValue(a, column);
    const bVal = getColumnValue(b, column);

    if (column === "tradeInValue") {
      const aNum = normalizeTradeValue(aVal);
      const bNum = normalizeTradeValue(bVal);
      return direction === "asc" ? aNum - bNum : bNum - aNum;
    }

    if (column === "sailDate" || column === "expirationDate") {
      const aDate = new Date(aVal).getTime();
      const bDate = new Date(bVal).getTime();
      return direction === "asc" ? aDate - bDate : bDate - aDate;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return direction === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    return direction === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });
}

export function getColumnValue(row: any, column: string): any {
  const columnMap: Record<string, string> = {
    offerCode: "offerCode",
    offerName: "offerName",
    ship: "shipName",
    sailDate: "sailDate",
    nights: "nights",
    destination: "itineraryDescription",
    tradeInValue: "tradeInValue",
    roomCategory: "roomCategory",
    guests: "numberOfGuests",
    expirationDate: "expirationDate",
  };

  const key = columnMap[column] || column;
  return row[key] ?? "";
}
