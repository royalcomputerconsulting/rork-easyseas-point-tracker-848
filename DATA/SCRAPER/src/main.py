
import re, sys, time
import pandas as pd
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

BASE_DIR = Path(__file__).resolve().parents[1]
EXPORT_DIR = BASE_DIR / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

URL = "https://www.royalcaribbean.com/club-royale/offers/"

OFFERS = [
    {"order":9, "name":"Last Chance Pays", "code":"25CLS405", "type":"Balcony or Interior Room for Two", "exp":"10-02-2025"},
    {"order":8, "name":"September Monthly Mix", "code":"25SCL906", "type":"Ocean View or Interior Room for Two", "exp":"10-01-2025"},
    {"order":7, "name":"Queen of Hearts", "code":"25MIX505", "type":"Ocean View or Interior Room for Two", "exp":"09-24-2025"},
    {"order":6, "name":"Payline Paradise", "code":"25SCH407", "type":"Cruise Fare for One + Discounted Guest", "exp":"09-20-2025"},
    {"order":5, "name":"Quick Getaways", "code":"25SHC505", "type":"Balcony GTY or Interior Room for Two", "exp":"09-17-2025"},
    {"order":4, "name":"Odds on October", "code":"25OCT06", "type":"Exclusive Stateroom Offer", "exp":"09-13-2025"},
    {"order":3, "name":"Longtime Paylines", "code":"25LNS207", "type":"Cruise Fare for One + Discounted Guest", "exp":"09-11-2025"},
    {"order":2, "name":"2025 August Instant Rewards", "code":"2508A05", "type":"Exclusive Stateroom Offer", "exp":"10-03-2025"},
    {"order":1, "name":"2025 August Instant Rewards", "code":"2508A08", "type":"$250 Off Your Choice of Room", "exp":"09-18-2025"},
]

FLEET = [
    "Wonder of the Seas","Harmony of the Seas","Oasis of the Seas","Allure of the Seas","Symphony of the Seas",
    "Icon of the Seas","Utopia of the Seas","Freedom of the Seas","Independence of the Seas","Liberty of the Seas",
    "Adventure of the Seas","Explorer of the Seas","Mariner of the Seas","Navigator of the Seas","Voyager of the Seas",
    "Quantum of the Seas","Anthem of the Seas","Ovation of the Seas","Spectrum of the Seas","Odyssey of the Seas",
    "Radiance of the Seas","Brilliance of the Seas","Jewel of the Seas","Serenade of the Seas","Enchantment of the Seas",
    "Grandeur of the Seas","Vision of the Seas","Rhapsody of the Seas"
]

ALIASES = {}
for canon in FLEET:
    ALIASES[canon.upper()] = canon
    ALIASES[canon.replace(" OF THE SEAS","").upper()] = canon
    ALIASES[(canon.replace(" OF THE SEAS"," OTS")).upper()] = canon

TARGET_COLS = [
    "Sailing Date","Ship Name","Departure Port","Itinerary","Nights",
    "Cabin Type","CASINO OVERVIEW OFFER TYPE","Offer Name","Offer Code","OFFER EXPIRE DATE"
]

HEADER_RE = re.compile(r"^\s*(Interior|Balcony|Ocean\s?View)(?:\s+Stateroom)?\s*\((\d+)\s*Sailings?\)\s*$", re.I)
DATE_RE = re.compile(r"(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})")

def fmt_mmddyyyy_token(tok):
    m = DATE_RE.search(tok.replace("\\","/"))
    if not m: 
        return ""
    mm, dd, yy = m.groups()
    y = int(yy)
    if y < 100:
        y = 2000 + y if y < 70 else 1900 + y
    try:
        return f"{int(mm):02d}-{int(dd):02d}-{y:04d}"
    except:
        return ""

def normalize_ship(line):
    up = (line or "").upper()
    for alias, canon in ALIASES.items():
        if alias in up:
            return canon
    return None

def detect_default_cabin(offer_type):
    t = (offer_type or "").lower()
    if "balcony" in t and "interior" not in t and "ocean" not in t:
        return "Balcony"
    if "ocean" in t and "interior" not in t and "balcony" not in t:
        return "Ocean View"
    return "Interior"

def get_panel(page):
    panel = page.locator("div:has-text('Sailings')").first
    panel.wait_for(state="visible", timeout=30000)
    return panel

def scroll_panel_until_stable(panel, max_passes=14):
    last_h = -1
    for _ in range(max_passes):
        h = panel.evaluate("el => { el.scrollTo(0, el.scrollHeight); return el.scrollHeight }")
        if h == last_h and h != -1:
            panel.page.wait_for_timeout(250)
            hh = panel.evaluate("el => { el.scrollTo(0, el.scrollHeight); return el.scrollHeight }")
            if hh == h: break
        last_h = h
        panel.page.wait_for_timeout(250)

def get_lines(panel):
    text = panel.inner_text()
    lines = [ln.strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln]

def find_all_headers(lines):
    headers = []
    for i, ln in enumerate(lines):
        m = HEADER_RE.match(ln)
        if m:
            cab = m.group(1).title()
            if "Ocean" in cab: cab = "Ocean View"
            headers.append((i, cab, int(m.group(2))))
    return headers

def segments_from_headers(lines, headers):
    segs = []
    if headers:
        for i, (idx, cab, exp) in enumerate(headers):
            start = idx + 1
            end = headers[i+1][0] if i+1 < len(headers) else len(lines)
            segs.append((cab, exp, start, end))
    else:
        segs.append(("", 0, 0, len(lines)))
    return segs

def parse_segment(lines, start, end, cabin_label, default_cabin):
    rows = []
    seen = set()
    cur_cabin = cabin_label if cabin_label else default_cabin
    j = start
    while j < end:
        ln = lines[j].strip()
        if not ln:
            j += 1; continue
        mh = HEADER_RE.match(ln)
        if mh:
            cur_cabin = mh.group(1).title()
            if "Ocean" in cur_cabin: cur_cabin = "Ocean View"
            j += 1; continue

        ship = normalize_ship(ln)
        if not ship:
            j += 1; continue

        itin, nights = "", ""
        k = j + 1
        while k < min(j + 4, end):
            if "NIGHT" in lines[k].upper():
                itin = lines[k].strip()
                mN = re.search(r"(\d+)\s*NIGHT", itin.upper())
                nights = mN.group(1) if mN else ""
                k += 1
                break
            k += 1

        port = ""
        while k < end and not lines[k].strip(): k += 1
        if k < end and not HEADER_RE.match(lines[k]) and not DATE_RE.search(lines[k]):
            port = lines[k].strip()
            if port.lower().startswith("from "):
                port = port[5:].strip()
            k += 1

        dates = []
        while k < end:
            nx = lines[k].strip()
            if not nx: 
                k += 1; continue
            if HEADER_RE.match(nx) or normalize_ship(nx) or ("NIGHT" in nx.upper() and not DATE_RE.search(nx)):
                break
            for md in DATE_RE.finditer(nx.replace("\\","/")):
                dates.append(fmt_mmddyyyy_token(md.group(0)))
            k += 1

        for sail in dates:
            if not sail: continue
            key = (ship, sail, port, itin, cur_cabin)
            if key in seen: continue
            seen.add(key)
            rows.append({
                "Sailing Date": sail,
                "Ship Name": ship,
                "Departure Port": port,
                "Itinerary": itin,
                "Nights": nights,
                "Cabin Type": cur_cabin
            })
        j = k
    return rows

def by_cabin_count(rows):
    out = {}
    for r in rows:
        c = r.get("Cabin Type","")
        out[c] = out.get(c,0)+1
    return out

def enforce_expected(rows, expected_map):
    buckets = {}
    for r in rows:
        buckets.setdefault(r["Cabin Type"], []).append(r)
    result = []
    for cab, exp in expected_map.items():
        lst = buckets.get(cab, [])
        if len(lst) > exp:
            result.extend(lst[:exp])
        else:
            result.extend(lst)
    for cab, lst in buckets.items():
        if cab not in expected_map:
            result.extend(lst)
    return result

def to_df(rows, offer):
    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=TARGET_COLS)
    df["CASINO OVERVIEW OFFER TYPE"] = offer["type"]
    df["Offer Name"] = offer["name"]
    df["Offer Code"] = offer["code"]
    df["OFFER EXPIRE DATE"] = offer["exp"]
    for col in TARGET_COLS:
        if col not in df.columns:
            df[col] = ""
    df = df[TARGET_COLS]
    df["Sailing Date"] = df["Sailing Date"].astype(str).str.replace("/", "-")
    return df

def save_offer(df, offer):
    safe = "".join(ch for ch in offer["name"] if ch.isalnum())
    prefix = f"{offer['order']:02d}_{safe}"
    df.to_csv(EXPORT_DIR/f"{prefix}.csv", index=False)
    df.to_excel(EXPORT_DIR/f"{prefix}.xlsx", index=False)
    print(f"💾 Saved → exports/{prefix}.xlsx ({len(df)} rows)")

def scrape_current_offer(page, offer):
    panel = get_panel(page)
    last_rows = []
    for attempt in range(1, 6):
        scroll_panel_until_stable(panel)
        lines = get_lines(panel)
        headers = find_all_headers(lines)
        segs = segments_from_headers(lines, headers)
        expected = {cab: exp for (_, cab, exp) in headers} if headers else {}
        default_cabin = detect_default_cabin(offer["type"])

        all_rows = []
        for (cab, exp, start, end) in segs:
            all_rows.extend(parse_segment(lines, start, end, cab, default_cabin))

        if expected:
            enforced = enforce_expected(all_rows, expected)
            byH = expected
            byS = by_cabin_count(enforced)
            print(f"Attempt {attempt}: Headers → {byH} | Scraped → {byS}")
            if sum(byS.values()) == sum(byH.values()) and all(byS.get(k,0)==v for k,v in byH.items()):
                print("✅ Counts match.")
                return enforced
            last_rows = enforced
            panel.page.wait_for_timeout(500)
            continue
        else:
            print(f"{offer['name']}: parsed {len(all_rows)} rows (no headers).")
            return all_rows
    print("⚠️ Using last attempt despite header mismatch.")
    return last_rows

def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(URL)
        print("👉 Log in, open Offer 9 panel. Press Q to scrape; auto-stops after Offer 1.")
        idx = 0
        while idx < len(OFFERS):
            if input().strip().lower() != "q":
                continue
            offer = OFFERS[idx]
            print(f"🔎 Scraping {offer['name']}")
            rows = scrape_current_offer(page, offer)
            df = to_df(rows, offer)
            save_offer(df, offer)
            idx += 1
            if idx < len(OFFERS):
                print(f"✅ {offer['name']} complete. Press Q for {OFFERS[idx]['name']}")
            else:
                print("✅ All 9 offers done. Exiting.")
                break

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
