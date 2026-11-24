// Where a trip goes: the cities picked for it, and the base city and area for each day.
// Popular cities and areas are hand-picked so the trip form and day picker can offer
// one-tap choices instead of a blank box; anything else is searched on Photon.

import { arrivals } from "./travel.js";

// Popular cities per country, roughly in order of how often people visit them.
const CITIES = {
  JP: "Tokyo|Osaka|Kyoto|Sapporo|Fukuoka|Nara|Hiroshima|Yokohama|Nagoya|Hakone|Kanazawa|Okinawa",
  KR: "Seoul|Busan|Jeju|Incheon|Gyeongju|Daegu|Sokcho|Jeonju",
  TW: "Taipei|Taichung|Tainan|Kaohsiung|Hualien|Jiufen|Yilan",
  HK: "Hong Kong",
  MO: "Macau",
  CN: "Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Xi'an|Hangzhou|Chongqing|Guilin|Zhangjiajie",
  TH: "Bangkok|Chiang Mai|Phuket|Krabi|Pattaya|Hua Hin|Koh Samui|Chiang Rai|Ayutthaya",
  MY: "Kuala Lumpur|Penang|Malacca|Johor Bahru|Langkawi|Ipoh|Kota Kinabalu|Cameron Highlands|Kuching",
  ID: "Bali|Jakarta|Yogyakarta|Batam|Bintan|Bandung|Lombok|Labuan Bajo|Surabaya",
  VN: "Ho Chi Minh City|Hanoi|Da Nang|Hoi An|Nha Trang|Ha Long|Hue|Phu Quoc|Sapa|Da Lat",
  PH: "Manila|Cebu|Boracay|Palawan|Bohol|Siargao|Baguio",
  KH: "Siem Reap|Phnom Penh|Sihanoukville|Kampot",
  SG: "Singapore",
  IN: "Delhi|Mumbai|Jaipur|Agra|Goa|Bangalore|Kerala|Varanasi|Udaipur",
  AU: "Sydney|Melbourne|Brisbane|Gold Coast|Perth|Cairns|Adelaide|Hobart",
  NZ: "Auckland|Queenstown|Christchurch|Wellington|Rotorua|Lake Tekapo",
  GB: "London|Edinburgh|Manchester|Liverpool|Oxford|Bath|York|Cambridge|Glasgow",
  FR: "Paris|Nice|Lyon|Marseille|Bordeaux|Strasbourg|Annecy",
  IT: "Rome|Florence|Venice|Milan|Naples|Amalfi|Pisa|Lake Como|Cinque Terre",
  ES: "Barcelona|Madrid|Seville|Granada|Valencia|Malaga|Ibiza",
  DE: "Berlin|Munich|Frankfurt|Hamburg|Cologne|Heidelberg",
  CH: "Zurich|Lucerne|Interlaken|Geneva|Zermatt|Bern",
  NL: "Amsterdam|Rotterdam|The Hague|Utrecht",
  AT: "Vienna|Salzburg|Hallstatt|Innsbruck",
  CZ: "Prague|Cesky Krumlov|Brno",
  TR: "Istanbul|Cappadocia|Antalya|Izmir|Pamukkale",
  AE: "Dubai|Abu Dhabi",
  US: "New York|Los Angeles|San Francisco|Las Vegas|Honolulu|Orlando|Chicago|Seattle|Washington",
  CA: "Vancouver|Toronto|Banff|Montreal|Quebec City",
};

// Popular areas to base a day in, for the big cities.
const AREAS = {
  "JP|Tokyo": "Shinjuku|Shibuya|Asakusa|Ginza|Harajuku|Akihabara|Ueno|Roppongi|Ikebukuro|Odaiba|Tokyo Station|Tsukiji",
  "JP|Osaka": "Namba|Umeda|Shinsekai|Shinsaibashi|Osaka Castle|Tennoji|Universal City",
  "JP|Kyoto": "Gion|Arashiyama|Higashiyama|Fushimi|Kyoto Station|Kawaramachi",
  "JP|Sapporo": "Susukino|Odori|Sapporo Station|Otaru",
  "JP|Fukuoka": "Hakata|Tenjin|Nakasu|Dazaifu",
  "KR|Seoul": "Myeongdong|Hongdae|Gangnam|Insadong|Itaewon|Dongdaemun|Bukchon|Jamsil|Seongsu",
  "KR|Busan": "Haeundae|Seomyeon|Nampo-dong|Gwangalli|Gamcheon",
  "TW|Taipei": "Ximending|Xinyi|Zhongshan|Da'an|Shilin|Beitou|Wanhua",
  "HK|Hong Kong": "Tsim Sha Tsui|Mong Kok|Central|Causeway Bay|Wan Chai|Sheung Wan|Lantau",
  "CN|Shanghai": "The Bund|Lujiazui|Nanjing Road|Xintiandi|Jing'an|French Concession",
  "CN|Beijing": "Wangfujing|Dongcheng|Sanlitun|Houhai|Qianmen",
  "TH|Bangkok": "Sukhumvit|Siam|Silom|Rattanakosin|Chinatown|Khao San Road|Ari|Riverside",
  "TH|Chiang Mai": "Old City|Nimman|Night Bazaar|Doi Suthep",
  "TH|Phuket": "Patong|Kata|Karon|Phuket Town|Kamala",
  "MY|Kuala Lumpur": "Bukit Bintang|KLCC|Chinatown|Bangsar|Brickfields|Kampung Baru",
  "MY|Penang": "George Town|Batu Ferringhi|Gurney Drive|Air Itam",
  "ID|Bali": "Seminyak|Ubud|Canggu|Kuta|Uluwatu|Nusa Dua|Sanur|Jimbaran",
  "ID|Jakarta": "Menteng|Kota Tua|Senayan|Kemang",
  "VN|Ho Chi Minh City": "District 1|District 3|Thao Dien|Cho Lon|Ben Thanh",
  "VN|Hanoi": "Old Quarter|Hoan Kiem|Tay Ho|Ba Dinh",
  "VN|Da Nang": "My Khe|Son Tra|Han Market",
  "SG|Singapore": "Marina Bay|Orchard|Chinatown|Bugis|Sentosa|Little India|Kampong Glam|Clarke Quay|Tiong Bahru|Jurong East",
  "AU|Sydney": "Circular Quay|The Rocks|Darling Harbour|Bondi|Surry Hills|Manly|Newtown",
  "AU|Melbourne": "CBD|Southbank|Fitzroy|St Kilda|Docklands|Carlton",
  "GB|London": "Westminster|Covent Garden|Soho|South Bank|Kensington|Camden|Shoreditch|The City|Greenwich|Notting Hill",
  "FR|Paris": "Le Marais|Saint-Germain-des-Prés|Montmartre|Latin Quarter|Champs-Élysées|Eiffel Tower|Louvre|Opéra",
  "IT|Rome": "Centro Storico|Trastevere|Vatican|Monti|Colosseum|Spanish Steps",
  "ES|Barcelona": "Gothic Quarter|El Born|Eixample|Gràcia|Barceloneta|El Raval",
  "TR|Istanbul": "Sultanahmet|Beyoğlu|Karaköy|Kadıköy|Beşiktaş",
  "AE|Dubai": "Downtown Dubai|Dubai Marina|Deira|Jumeirah|Al Fahidi|Palm Jumeirah",
  "US|New York": "Midtown|Times Square|Lower Manhattan|SoHo|Greenwich Village|Upper West Side|Brooklyn|Chinatown",
  "US|Los Angeles": "Hollywood|Santa Monica|Downtown LA|Beverly Hills|Venice",
  "US|San Francisco": "Union Square|Fisherman's Wharf|Mission District|Chinatown|SoMa",
};

const list = (s) => (s ? s.split("|") : []);
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Popular cities for a country, e.g. "JP" -> ["Tokyo", "Osaka", ...]. */
export function popularCities(countryCode) {
  return list(CITIES[String(countryCode ?? "").toUpperCase()]);
}

/** Popular areas for a city in a country, matched loosely by name ("tokyo" works too). */
export function popularAreas(countryCode, cityName) {
  const cc = String(countryCode ?? "").toUpperCase();
  const want = norm(cityName);
  if (!want) return [];
  for (const [key, areas] of Object.entries(AREAS)) {
    const [c, city] = key.split("|");
    if ((!cc || c === cc) && norm(city) === want) return list(areas);
  }
  return [];
}

/** "Tokyo & Osaka" -> ["Tokyo", "Osaka"]: how older trips wrote their cities. */
export function parseDestination(text) {
  return [...new Set(String(text ?? "")
    .split(/\s*(?:,|&|\/|\+|;|\band\b|\bthen\b|→|->)\s*/i).map((s) => s.trim()).filter((s) => s.length >= 2))].slice(0, 8);
}

/** ["Tokyo", "Kyoto", "Osaka"] -> "Tokyo, Kyoto & Osaka" */
export function destinationText(cities) {
  const names = cities.map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** The trip's cities as [{ name, country?, lat?, lon? }]. Older trips only have the destination text. */
export function tripCities(trip) {
  if (Array.isArray(trip?.cities)) return trip.cities.filter((c) => c?.name);
  return parseDestination(trip?.destination).map((name) => ({ name }));
}

/**
 * Where you are on a day: { city, area, lat, lon, set, from }.
 * A day you set yourself is `set: true`. A day you haven't set carries on in the
 * city of the last day you did set (`from` is that day's index), or, if the trip
 * has only one city, is in that city. Areas never carry over: each day is its own.
 */
export function dayBase(trip, date, days) {
  const bases = trip?.dayBases ?? {};
  const own = bases[date];
  if (own?.city) return { ...own, set: true };
  const cities = tripCities(trip);
  const cityAt = (name) => cities.find((c) => norm(c.name) === norm(name));
  // A flight or train that lands in one of the trip's cities moves you there, until a later 📍 says otherwise.
  const landed = arrivals(trip?.items, (name) => Boolean(cityAt(name)));
  const arrive = (name, extra) => {
    const city = cityAt(name);
    return { city: city.name, area: "", lat: city.lat, lon: city.lon, set: false, arrived: true, ...extra };
  };
  if (landed[date]) return arrive(landed[date]);
  const i = days.indexOf(date);
  for (let j = i - 1; j >= 0; j--) {
    const prev = bases[days[j]];
    if (prev?.city) {
      const city = cityAt(prev.city);
      return { city: prev.city, area: "", lat: city?.lat, lon: city?.lon, set: false, from: j };
    }
    if (landed[days[j]]) return arrive(landed[days[j]], { from: j });
  }
  if (cities.length === 1) return { city: cities[0].name, area: "", lat: cities[0].lat, lon: cities[0].lon, set: false };
  return null;
}

/** "Tokyo › Shibuya", or just "Tokyo". */
export const baseLabel = (b) => (b ? [b.city, b.area].filter(Boolean).join(" › ") : "");

/** The point to search around for a base: the area if we found it, else its city. */
export function basePoint(trip, base) {
  if (!base) return null;
  if (Number.isFinite(base.lat) && Number.isFinite(base.lon)) return { lat: base.lat, lon: base.lon };
  const city = tripCities(trip).find((c) => norm(c.name) === norm(base.city));
  return city && Number.isFinite(city.lat) ? { lat: city.lat, lon: city.lon } : null;
}

export const sameName = (a, b) => norm(a) === norm(b);

/**
 * The trip's countries, in the order you'll visit them: ["ES", "FR"].
 * Trips made before multi-country trips have a single `country`.
 */
export function tripCountries(trip) {
  if (Array.isArray(trip?.countries) && trip.countries.some(Boolean)) return [...new Set(trip.countries.filter(Boolean))];
  return trip?.country ? [trip.country] : [];
}

/** The country a trip city is in. Cities saved before multi-country trips are in the trip's (first) country. */
export function cityCountry(trip, cityName) {
  const city = tripCities(trip).find((c) => norm(c.name) === norm(cityName));
  return city?.country || tripCountries(trip)[0] || "";
}

/**
 * The country you're in on a day: the country of that day's city (set, or carried over
 * from an earlier day). One-country trips are in that country every day; a day of a
 * multi-country trip with no city yet counts as the first country.
 */
export function dayCountry(trip, date, days) {
  const countries = tripCountries(trip);
  if (countries.length <= 1) return countries[0] ?? "";
  const b = date && days.includes(date) ? dayBase(trip, date, days) : null;
  return (b?.city && cityCountry(trip, b.city)) || countries[0];
}
