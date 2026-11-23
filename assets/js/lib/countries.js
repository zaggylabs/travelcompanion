// Countries and the currency each one uses, so picking a destination sets the
// trip currency. Names come from the browser (Intl.DisplayNames) when it can.
const COUNTRY_CURRENCY = `
AD:EUR AE:AED AF:AFN AG:XCD AL:ALL AM:AMD AO:AOA AR:ARS AT:EUR AU:AUD AW:AWG AZ:AZN
BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:BGN BH:BHD BI:BIF BJ:XOF BN:BND BO:BOB BR:BRL
BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD CA:CAD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD
CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK
DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FM:USD
FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GQ:XAF
GR:EUR GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR
IL:ILS IN:INR IQ:IQD IR:IRR IS:ISK IT:EUR JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR
KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF
LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MG:MGA
MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MR:MRU MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN
MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NZ:NZD
OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PR:USD PS:ILS PT:EUR PW:USD
PY:PYG QA:QAR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD
SI:EUR SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SY:SYP SZ:SZL
TD:XAF TG:XOF TH:THB TJ:TJS TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD
TZ:TZS UA:UAH UG:UGX US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES VN:VND VU:VUV WS:WST
XK:EUR YE:YER ZA:ZAR ZM:ZMW ZW:ZWG`;

// Names the browser might not know, or that read better spelled out.
const NAME_OVERRIDES = { XK: "Kosovo", KR: "South Korea", KP: "North Korea", HK: "Hong Kong", MO: "Macau" };

// Other names people type for a country.
const ALIASES = {
  GB: ["UK", "England", "Scotland", "Wales", "Britain"], US: ["USA", "America"], AE: ["UAE", "Dubai"],
  KR: ["Korea"], NL: ["Holland"], CZ: ["Czech Republic"], TR: ["Turkey", "Türkiye"], MM: ["Burma"],
  CI: ["Ivory Coast"], CN: ["China"], TW: ["Taiwan"], VN: ["Vietnam"], LA: ["Laos"], RU: ["Russia"],
};

let displayNames = null;
try { displayNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch { /* old browser */ }

export const COUNTRIES = COUNTRY_CURRENCY.trim().split(/\s+/).map((pair) => {
  const [code, currency] = pair.split(":");
  let name = NAME_OVERRIDES[code];
  if (!name) {
    try { name = displayNames?.of(code); } catch { /* unknown code */ }
  }
  name = (name || code).replace(/ SAR China$/, "");
  return { code, name, currency, aliases: ALIASES[code] ?? [] };
}).sort((a, b) => a.name.localeCompare(b.name));

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code) {
  return byCode.get(String(code || "").toUpperCase()) ?? null;
}

export function currencyForCountry(code) {
  return getCountry(code)?.currency ?? null;
}

/** "JP" -> 🇯🇵 */
export function flag(code) {
  if (!/^[A-Za-z]{2}$/.test(code || "")) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
}

const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Countries matching what's typed: names starting with it first, then any word or alias match. */
export function searchCountries(query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const c of COUNTRIES) {
    const names = [c.name, ...c.aliases].map(norm);
    let score = 0;
    if (names.some((n) => n === q) || norm(c.code) === q) score = 4;
    else if (names.some((n) => n.startsWith(q))) score = 3;
    else if (names.some((n) => n.split(/[\s-]+/).some((w) => w.startsWith(q)))) score = 2;
    else if (q.length >= 3 && names.some((n) => n.includes(q))) score = 1;
    if (score) scored.push({ c, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.c);
}

/** Exact name/alias/code match, for when someone types a country and doesn't pick from the list. */
export function findCountry(text) {
  const q = norm(text);
  if (!q) return null;
  return COUNTRIES.find((c) => norm(c.code) === q || [c.name, ...c.aliases].some((n) => norm(n) === q)) ?? null;
}

/** Every currency a country uses, popular ones for Singapore travellers first. */
export const ALL_CURRENCIES = (() => {
  const popular = ["SGD", "MYR", "IDR", "THB", "JPY", "KRW", "USD", "EUR", "GBP", "AUD", "CNY", "HKD", "TWD", "VND", "PHP", "INR"];
  const rest = [...new Set(COUNTRIES.map((c) => c.currency))].filter((c) => !popular.includes(c)).sort();
  return [...popular, ...rest];
})();
