// Basic facts for the Good to know tab: plug types, mains voltage, which side
// traffic drives on, and emergency numbers. Sources: IEC World Plugs and
// Wikipedia's lists of emergency numbers and left/right-hand traffic, checked
// November 2026. Countries we weren't sure about leave the emergency field
// empty, and the page says to check locally rather than guess.
//
// Format: CODE|plug types|volts|L or R|emergency
// emergency is one number for everything ("112"), or "p..,a..,f.." for police,
// ambulance and fire, or empty.
const FACTS = `
AD|C F|230|R|p110,a116,f118
AE|G C D|230|R|p999,a998,f997
AL|C F|230|R|p129,a127,f128
AM|C F|230|R|112
AR|C I|220|R|p911,a107,f100
AT|C F|230|R|112
AU|I|230|L|000
AZ|C F|220|R|p102,a103,f101
BA|C F|230|R|p122,a124,f123
BB|A B|115|L|p211,a511,f311
BD|C D G K|220|L|999
BE|C E|230|R|112
BG|C F|230|R|112
BH|G|230|R|999
BN|G|240|L|p993,a991,f995
BO|A C|230|R|p110,a118,f119
BR|C N|127/220|R|p190,a192,f193
BS|A B|120|L|919
BT|C D G|230|L|p113,a112,f110
BW|D G|230|L|p999,a997,f998
BY|C F|220|R|p102,a103,f101
BZ|A B G|110/220|R|911
CA|A B|120|R|911
CH|C J|230|R|p117,a144,f118
CL|C L|220|R|p133,a131,f132
CN|A C I|220|R|p110,a120,f119
CO|A B|110|R|123
CR|A B|120|R|911
CU|A B C L|110/220|R|p106,a104,f105
CY|G|230|L|112
CZ|C E|230|R|112
DE|C F|230|R|p110,a112,f112
DK|C E F K|230|R|112
DO|A B|120|R|911
DZ|C F|230|R|p17,a14,f14
EC|A B|120|R|911
EE|C F|230|R|112
EG|C F|220|R|p122,a123,f180
ES|C F|230|R|112
FI|C F|230|R|112
FJ|I|240|L|p917,a911,f911
FO|C E F K|230|R|112
FR|C E|230|R|112
GB|G|230|L|999
GE|C F|220|R|112
GH|D G|230|R|p191,a193,f192
GL|C E F K|230|R|112
GR|C F|230|R|112
GU|A B|110|R|911
HK|G|220|L|999
HN|A B|120|R|911
HR|C F|230|R|112
HU|C F|230|R|112
ID|C F|230|L|112
IE|G|230|L|112
IL|C H|230|R|p100,a101,f102
IN|C D M|230|L|112
IR|C F|220|R|p110,a115,f125
IS|C F|230|R|112
IT|C F L|230|R|112
JM|A B|110|L|p119,a110,f110
JO|B C D F G J|230|R|911
JP|A B|100|L|p110,a119,f119
KE|G|240|L|999
KG|C F|220|R|p102,a103,f101
KH|A C G|230|R|p117,a119,f118
KR|C F|220|R|p112,a119,f119
KW|C G|240|R|112
KZ|C F|220|R|112
LA|A B C E F|230|R|p191,a195,f190
LB|A B C D G|220|R|p112,a140,f175
LI|C J|230|R|112
LK|D G M|230|L|p119,a1990,f110
LT|C F|230|R|112
LU|C F|230|R|112
LV|C F|230|R|112
MA|C E|220|R|p19,a15,f15
MC|C D E F|230|R|112
MD|C F|230|R|112
ME|C F|230|R|112
MK|C F|230|R|p192,a194,f193
MM|C D F G|230|R|199
MN|C E|220|R|p102,a103,f101
MO|G|220|L|999
MT|G|230|L|112
MU|C G|230|L|p999,a114,f115
MV|C D G J K L|230|L|p119,a102,f118
MX|A B|127|R|911
MY|G|240|L|999
MZ|C F M|220|L|
NA|D M|220|L|
NC|C F|220|R|p17,a15,f18
NG|D G|240|R|112
NL|C F|230|R|112
NO|C F|230|R|112
NP|C D M|230|L|p100,a102,f101
NZ|I|230|L|111
OM|C G|240|R|9999
PA|A B|120|R|911
PE|A C|220|R|p105,a106,f116
PF|C E|220|R|p17,a15,f18
PG|I|240|L|
PH|A B C|220|R|911
PK|C D|230|L|p15,a1122,f1122
PL|C E|230|R|112
PR|A B|120|R|911
PT|C F|230|R|112
PY|C|220|R|911
QA|D G|240|R|999
RO|C F|230|R|112
RS|C F|230|R|p192,a194,f193
RU|C F|220|R|112
RW|C J|230|R|112
SA|G|220|R|911
SC|G|240|L|999
SE|C F|230|R|112
SG|G|230|L|p999,a995,f995
SI|C F|230|R|112
SK|C E|230|R|112
SN|C D E K|230|R|p17,a15,f18
SV|A B|115|R|911
TH|A B C O|220|L|p191,a1669,f199
TJ|C F|220|R|p102,a103,f101
TL|C E F I|220|L|112
TN|C E|230|R|p197,a190,f198
TR|C F|230|R|112
TT|A B|115|L|p999,a811,f990
TW|A B|110|R|p110,a119,f119
TZ|D G|230|L|112
UA|C F|230|R|112
UG|G|240|L|999
US|A B|120|R|911
UY|C F I L|220|R|911
UZ|C I|220|R|p102,a103,f101
VA|C F L|230|R|112
VN|A C F|220|R|p113,a115,f114
WS|I|230|L|911
XK|C F|230|R|p192,a194,f193
ZA|C D M N|230|L|p10111,a10177,f10177
ZM|C D G|230|L|
ZW|D G|220|L|
`;

function parseEmergency(s) {
  if (!s) return null;
  if (!s.includes(",")) return { all: s };
  const out = {};
  for (const part of s.split(",")) out[{ p: "police", a: "ambulance", f: "fire" }[part[0]]] = part.slice(1);
  return out;
}

const TABLE = new Map(FACTS.trim().split("\n").map((line) => {
  const [code, plugs, volts, side, sos] = line.split("|");
  return [code, { plugs: plugs.split(" "), volts, drive: side === "L" ? "left" : "right", emergency: parseEmergency(sos) }];
}));

export function getFacts(code) {
  return TABLE.get(String(code || "").toUpperCase()) ?? null;
}

/** [[label, number]] for the emergency card; empty when we don't know. Police, ambulance and fire sharing a number are merged. */
export function emergencyRows(facts) {
  const e = facts?.emergency;
  if (!e) return [];
  if (e.all) return [["Police, ambulance and fire", e.all]];
  const byNum = new Map();
  for (const k of ["police", "ambulance", "fire"]) {
    if (!e[k]) continue;
    byNum.set(e[k], [...(byNum.get(e[k]) ?? []), k]);
  }
  return [...byNum].map(([n, ks]) => {
    const label = ks.length === 1 ? ks[0] : `${ks.slice(0, -1).join(", ")} and ${ks.at(-1)}`;
    return [label[0].toUpperCase() + label.slice(1), n];
  });
}

const lowVolt = (v) => /^1\d\d$/.test(String(v).split("/")[0]) && !String(v).includes("/");

const typeList = (plugs) => (plugs.length === 1 ? `Type ${plugs[0]}` : `Types ${plugs.slice(0, -1).join(", ")} and ${plugs.at(-1)}`);

/** One or two sentences on plugs, tailored to the traveller's home plugs when we know them. */
export function plugAdvice(dest, home, homeName) {
  if (!dest) return null;
  const base = `${typeList(dest.plugs)}, ${dest.volts} V.`;
  if (!home || !homeName) return base;
  const fits = home.plugs.filter((p) => dest.plugs.includes(p));
  let fit;
  if (fits.length && fits.length === home.plugs.length) fit = `Plugs from ${homeName} fit.`;
  else if (fits.length) fit = `Some plugs from ${homeName} fit (${typeList(fits)}); bring an adapter for the others.`;
  else fit = `Plugs from ${homeName} (${typeList(home.plugs)}) need an adapter.`;
  const volt = lowVolt(dest.volts) !== lowVolt(home.volts)
    ? ` The voltage is different from ${homeName}'s (${home.volts} V). Phone and laptop chargers usually handle both, but check hair dryers and other appliances.`
    : "";
  return `${base} ${fit}${volt}`;
}
