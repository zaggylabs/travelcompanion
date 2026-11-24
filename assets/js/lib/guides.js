// "Good to know" guides for popular destinations. Hand-written and checked
// against official and news sources in November 2026. Entry rules change, so
// the Guide tab always says so and links to the official source.
//
// visa.byHome holds a line for a specific passport only where it was checked.
// Any other passport gets the general line plus the official list to check.

export const GUIDES_CHECKED = "November 2026";

const L = (label, url) => ({ label, url });

export const GUIDES = {
  JP: {
    visa: {
      general: "Many nationalities can visit Japan visa-free for short tourist stays, often up to 90 days, but the list and the length of stay depend on your passport.",
      byHome: { SG: "Singapore passport: visa-free for tourist stays of up to 90 days." },
      steps: [
        { text: "Optional but faster: fill in your immigration and customs details on Visit Japan Web before you fly, and show the QR codes on arrival.", link: L("Visit Japan Web", "https://www.vjw.digital.go.jp/") },
        { text: "Some common cold and allergy medicines (for example ones with pseudoephedrine) are not allowed into Japan. Check before you pack medicines.", link: L("Bringing medicines into Japan (MHLW)", "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iyakuhin/kojinyunyu/topics/tp010401-1_00001.html") },
        { text: "Japan's departure tax is ¥3,000 per person from 1 July 2026. It's usually already in your flight price." },
      ],
      links: [L("Visa exemption list (Ministry of Foreign Affairs)", "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html")],
    },
    dos: [
      "Carry some cash. Small restaurants, shrines, markets and rural places are often cash only.",
      "Take your rubbish with you. Public bins are rare, so keep a small bag for it.",
      "Take your shoes off where you see a raised step at the entrance or slippers laid out.",
      "Carry your passport. Short-term visitors are required to have it on them.",
      "At an onsen, wash fully before getting in, and go in without a swimsuit.",
      "Queue at the marked lines on train platforms and let people off first.",
    ],
    donts: [
      "Don't take phone calls on trains, and keep your voice down.",
      "Don't tip. It isn't part of the culture and can cause confusion.",
      "Avoid eating while walking along busy streets or at shrines; it's frowned on in many places.",
      "Don't smoke on the street outside marked smoking areas. Many cities ban it.",
      "Don't stand chopsticks upright in rice or pass food from chopstick to chopstick (both are funeral customs).",
      "Visible tattoos can mean being turned away from some onsen and gyms. Look for tattoo-friendly places.",
    ],
    money: [
      "Currency: Japanese yen (JPY).",
      "Tipping isn't done.",
      "7-Eleven and Japan Post ATMs accept most foreign cards.",
      "Tax-free shopping changed on 1 November 2026: you now pay the tax at the shop and get it refunded when you leave Japan with the goods. Keep your receipts and passport handy.",
    ],
    plugs: "Type A and B (two flat pins), 100 V. Many Singapore chargers work with just a plug adapter.",
    emergency: [["Police", "110"], ["Fire and ambulance", "119"], ["Japan Visitor Hotline (JNTO, 24 hours, English)", "050-3816-2787"]],
    transport: [
      "Get an IC card (Suica, PASMO or ICOCA, or Welcome Suica for visitors) for trains, buses and convenience stores. Many phones can add one to the wallet app.",
      "Work out whether a JR Pass is worth it for your route before buying; it often isn't for short trips.",
      "On the Tokaido, Sanyo and Kyushu Shinkansen, large suitcases need a seat reservation with luggage space.",
      "In Tokyo people stand on the left of escalators; in Osaka, on the right.",
      "Most trains stop running around midnight.",
    ],
    links: [L("Japan National Tourism Organization", "https://www.japan.travel/en/")],
  },

  KR: {
    visa: {
      general: "Many nationalities can visit South Korea visa-free, but most must get a K-ETA (an online travel authorisation) before flying. Some countries are temporarily exempt from the K-ETA.",
      byHome: { SG: "Singapore passport: visa-free for up to 90 days, and exempt from the K-ETA until 31 December 2026." },
      steps: [
        { text: "Every foreign visitor fills in the e-Arrival Card online before arriving (it replaced the paper card on 1 January 2026).", link: L("e-Arrival Card", "https://www.e-arrivalcard.go.kr/") },
        { text: "If your passport isn't exempt, apply for the K-ETA at least 72 hours before you fly, and only on the official site.", link: L("K-ETA (official)", "https://www.k-eta.go.kr/") },
      ],
      links: [L("K-ETA official site", "https://www.k-eta.go.kr/"), L("Hi Korea (immigration)", "https://www.hikorea.go.kr/")],
    },
    dos: [
      "Use Naver Map or KakaoMap. Google Maps doesn't give walking or driving directions in Korea.",
      "Use both hands, or your right hand with your left touching your arm, when giving or receiving something from an older person.",
      "Take your shoes off in homes and in restaurants with floor seating.",
      "Bring some cash for markets and street food.",
    ],
    donts: [
      "Don't sit in the pink seats on the Seoul subway; they're kept free for pregnant women.",
      "Don't write someone's name in red ink.",
      "Don't tip; it isn't expected.",
      "Keep your voice down on the subway and buses.",
    ],
    money: [
      "Currency: South Korean won (KRW).",
      "Cards work almost everywhere, though some kiosks don't take foreign cards.",
      "Tipping isn't expected.",
      "Shops marked Tax Free can refund VAT on bigger purchases; bring your passport.",
    ],
    plugs: "Type C and F (two round pins), 220 V. Singapore plugs need an adapter.",
    emergency: [["Police", "112"], ["Fire and ambulance", "119"], ["Korea Travel Hotline (English)", "1330"]],
    transport: [
      "Get a T-money card for the subway, buses, taxis and convenience stores.",
      "KTX high-speed trains link Seoul, Busan and other cities; book ahead at weekends.",
      "Kakao T is the main taxi app.",
    ],
    links: [L("Visit Korea (Korea Tourism Organization)", "https://english.visitkorea.or.kr/")],
  },

  TW: {
    visa: {
      general: "Many nationalities can visit Taiwan visa-free, usually for 30 or 90 days depending on the passport.",
      byHome: { SG: "Singapore passport: visa-free for up to 30 days." },
      steps: [
        { text: "Fill in the online arrival card before you land. The paper card was dropped on 1 October 2025.", link: L("National Immigration Agency", "https://www.immigration.gov.tw/5475/") },
      ],
      links: [L("Visa-exempt entry (Bureau of Consular Affairs)", "https://www.boca.gov.tw/")],
    },
    dos: [
      "Get an EasyCard for the MRT, buses, YouBike and convenience stores.",
      "Bring cash for night markets and small eateries.",
      "Queue in the marked lines on MRT platforms.",
    ],
    donts: [
      "Don't eat, drink (even water) or chew gum in MRT stations or trains. You can be fined.",
      "Don't give a clock as a gift; it's linked with death.",
      "Don't write someone's name in red ink.",
    ],
    money: [
      "Currency: New Taiwan dollar (TWD).",
      "Tipping isn't expected. Many restaurants add a 10% service charge.",
    ],
    plugs: "Type A and B (two flat pins), 110 V.",
    emergency: [["Police", "110"], ["Fire and ambulance", "119"], ["Tourist hotline (24 hours)", "0800-011-765"]],
    transport: [
      "The MRT in Taipei and Kaohsiung is cheap and easy. High-speed rail runs down the west coast.",
      "Taxis are yellow and use meters; Uber also works in cities.",
    ],
    links: [L("Taiwan Tourism Administration", "https://eng.taiwan.net.tw/")],
  },

  HK: {
    visa: {
      general: "Many nationalities can visit Hong Kong visa-free, for 7 to 180 days depending on the passport.",
      byHome: { SG: "Singapore passport: visa-free for up to 90 days." },
      steps: [],
      links: [L("Immigration Department", "https://www.immd.gov.hk/eng/")],
    },
    dos: [
      "Get an Octopus card, or tap a contactless bank card or phone on the MTR.",
      "Stand on the right of escalators.",
      "Carry your passport; visitors are expected to have ID on them.",
    ],
    donts: [
      "Don't eat or drink on the MTR or in paid areas of stations. It's against the rules and fines apply.",
      "Don't smoke in indoor public places or most parks and beaches.",
    ],
    money: [
      "Currency: Hong Kong dollar (HKD).",
      "Restaurants usually add a 10% service charge, so extra tips aren't needed.",
    ],
    plugs: "Type G (three square pins, same as Singapore), 220 V.",
    emergency: [["Police, fire and ambulance", "999"]],
    transport: [
      "The Airport Express is the fastest way into the city; the MTR covers most places.",
      "Red taxis serve Hong Kong Island and Kowloon, green ones the New Territories, blue ones Lantau.",
    ],
    links: [L("Hong Kong Tourism Board", "https://www.discoverhongkong.com/")],
  },

  CN: {
    visa: {
      general: "China has added visa-free entry for many countries in recent years (often up to 30 days), plus visa-free transit of up to 240 hours for many nationalities. The rules change often.",
      byHome: { SG: "Singapore passport: visa-free for up to 30 days under the Singapore–China mutual visa exemption (in place since February 2024)." },
      steps: [
        { text: "Set up Alipay or WeChat Pay with your own card before you go. Many places don't take cash or foreign cards." },
        { text: "Google, WhatsApp, Instagram and many other foreign apps are blocked. Download offline maps and tell people how to reach you." },
      ],
      links: [L("National Immigration Administration", "https://en.nia.gov.cn/"), L("China Visa Application Service Center", "https://www.visaforchina.cn/")],
    },
    dos: [
      "Carry your passport. You need it for hotels, trains and many attractions.",
      "Book big attractions ahead; many need a real-name booking with your passport number.",
      "Use Amap or Apple Maps, which work well in China.",
    ],
    donts: [
      "Don't take photos of military or police sites.",
      "Avoid political topics in public.",
      "Don't tip; it isn't customary.",
    ],
    money: [
      "Currency: Chinese yuan renminbi (CNY).",
      "Mobile payment is the norm. Keep some cash as a backup.",
    ],
    plugs: "Type A, C and I, 220 V. Singapore plugs need an adapter.",
    emergency: [["Police", "110"], ["Ambulance", "120"], ["Fire", "119"]],
    transport: [
      "High-speed trains link most cities; book with your passport on the 12306 app or a travel site.",
      "Didi is the main ride-hailing app and takes foreign cards.",
    ],
    links: [],
  },

  TH: {
    visa: {
      general: "From 15 September 2026, Thailand cut visa-free stays from 60 days to 30 days (15 days for some countries).",
      byHome: { SG: "Singapore passport: visa-free for up to 30 days." },
      steps: [
        { text: "Fill in the Thailand Digital Arrival Card (TDAC) online within 3 days before you arrive. It's free on the official site.", link: L("TDAC (official)", "https://tdac.immigration.go.th/") },
      ],
      links: [L("Thai e-Visa", "https://www.thaievisa.go.th/"), L("Immigration Bureau", "https://www.immigration.go.th/")],
    },
    dos: [
      "Cover shoulders and knees at temples and the Grand Palace.",
      "Take your shoes off before entering temples and homes.",
      "Use metered taxis or Grab and Bolt, and agree the fare first for tuk-tuks.",
    ],
    donts: [
      "Never criticise or joke about the royal family. It's a serious crime.",
      "Don't bring vapes or e-cigarettes. They're illegal, and tourists have been fined and arrested.",
      "Don't touch people's heads, or point your feet at people or Buddha images.",
      "Women shouldn't touch monks or hand things to them directly.",
    ],
    money: [
      "Currency: Thai baht (THB).",
      "Tipping isn't required, but rounding up or leaving small change is appreciated.",
      "Thai ATMs charge foreign cards a fee on every withdrawal, so take out larger amounts less often.",
    ],
    plugs: "Mixed sockets (Type A, B, C and O), 220 V. Bring a universal adapter.",
    emergency: [["Tourist Police (English)", "1155"], ["Police", "191"], ["Ambulance and medical", "1669"]],
    transport: [
      "In Bangkok, the BTS Skytrain and MRT beat the traffic.",
      "Grab and Bolt work in most cities.",
    ],
    links: [L("Tourism Authority of Thailand", "https://www.tourismthailand.org/")],
  },

  MY: {
    visa: {
      general: "Many nationalities can visit Malaysia visa-free, usually for 30 or 90 days. Most foreign visitors must also submit the Malaysia Digital Arrival Card (MDAC).",
      byHome: { SG: "Singapore passport: no visa needed for visits, and Singapore citizens don't need to fill in the MDAC." },
      steps: [
        { text: "Unless you're exempt, submit the MDAC online within 3 days before you arrive.", link: L("MDAC (official)", "https://imigresen-online.imi.gov.my/mdac/main") },
        { text: "Driving a foreign-registered car into Malaysia? You need a Vehicle Entry Permit (VEP); check with JPJ before you go." },
      ],
      links: [L("Immigration Department of Malaysia", "https://www.imi.gov.my/")],
    },
    dos: [
      "Dress modestly at mosques. Many lend robes and headscarves at the door.",
      "Use your right hand to give, take or eat.",
      "Point with your thumb, not your index finger.",
    ],
    donts: [
      "Don't carry any drugs. Penalties are extremely severe.",
      "Avoid public displays of affection, especially in conservative areas.",
    ],
    money: [
      "Currency: Malaysian ringgit (MYR).",
      "Tipping isn't expected; many restaurants add a service charge.",
      "Touch 'n Go cards and e-wallets are used for transport, tolls and parking.",
    ],
    plugs: "Type G (three square pins, same as Singapore), 240 V.",
    emergency: [["Police, fire and ambulance", "999"], ["From a mobile", "112"]],
    transport: [
      "Grab is the easiest way around cities.",
      "In KL, the LRT, MRT and monorail cover most sights.",
    ],
    links: [L("Tourism Malaysia", "https://www.malaysia.travel/")],
  },

  ID: {
    visa: {
      general: "ASEAN passports are visa-free for short visits. Many other nationalities need an e-VOA (apply online) or a visa on arrival.",
      byHome: { SG: "Singapore passport: visa-free for tourist visits of up to 30 days." },
      steps: [
        { text: "Fill in the All Indonesia arrival card (immigration, customs and health in one) within 3 days before you arrive.", link: L("All Indonesia (official)", "https://allindonesia.imigrasi.go.id/") },
        { text: "Going to Bali? Foreign visitors pay a tourism levy of IDR 150,000; pay it on the official Love Bali site.", link: L("Love Bali", "https://lovebali.baliprov.go.id/") },
      ],
      links: [L("Indonesia e-Visa and e-VOA", "https://evisa.imigrasi.go.id/")],
    },
    dos: [
      "Wear a sarong and sash at Balinese temples (often lent at the entrance).",
      "Dress modestly away from beach areas.",
      "Use your right hand to give, take or eat.",
    ],
    donts: [
      "Don't carry any drugs. Penalties include long jail terms and the death penalty.",
      "Don't touch people's heads.",
      "Don't climb or pose on temple shrines in Bali.",
    ],
    money: [
      "Currency: Indonesian rupiah (IDR). Prices have lots of zeros, so count carefully.",
      "Tipping isn't required; small tips for good service are appreciated.",
      "Use bank ATMs inside banks or malls to avoid card skimmers.",
    ],
    plugs: "Type C and F (two round pins), 230 V. Singapore plugs need an adapter.",
    emergency: [["Emergency (any)", "112"], ["Police", "110"], ["Ambulance", "118 or 119"]],
    transport: [
      "Grab and Gojek work in most cities and in Bali.",
      "Bali traffic is slow; allow extra time to and from the airport.",
    ],
    links: [L("Wonderful Indonesia", "https://www.indonesia.travel/")],
  },

  VN: {
    visa: {
      general: "Vietnam offers e-visas of up to 90 days to all nationalities, and visa-free entry to some countries.",
      byHome: { SG: "Singapore passport: visa-free for up to 30 days." },
      steps: [
        { text: "If you need an e-visa, apply only on the official site. Many lookalike sites charge extra.", link: L("Vietnam e-visa (official)", "https://evisa.gov.vn/") },
      ],
      links: [L("Vietnam e-visa (official)", "https://evisa.gov.vn/")],
    },
    dos: [
      "Cross the road slowly and steadily so motorbikes can go around you.",
      "Cover shoulders and knees at pagodas and temples.",
      "Use Grab or Xanh SM rather than hailing unmarked taxis.",
    ],
    donts: [
      "Don't take photos of military sites.",
      "Don't touch people's heads.",
    ],
    money: [
      "Currency: Vietnamese dong (VND).",
      "Tipping isn't expected, but is welcome in tourist areas.",
    ],
    plugs: "Mostly Type A and C (flat or round pins), 220 V. Bring a universal adapter.",
    emergency: [["Police", "113"], ["Fire", "114"], ["Ambulance", "115"]],
    transport: [
      "Grab and Xanh SM work in big cities.",
      "Domestic flights and overnight trains link the north and south.",
    ],
    links: [L("Vietnam Tourism", "https://vietnam.travel/")],
  },

  AU: {
    visa: {
      general: "Everyone except New Zealand citizens needs a visa or an ETA (Electronic Travel Authority) before travelling to Australia.",
      byHome: { SG: "Singapore passport: apply for an ETA (subclass 601) in the official Australian ETA app before you fly." },
      steps: [
        { text: "Declare all food, plant and animal products on your incoming passenger card. Undeclared items mean big fines.", link: L("What you can bring in (Australian Border Force)", "https://www.abf.gov.au/entering-and-leaving-australia/can-you-bring-it-in") },
      ],
      links: [L("Department of Home Affairs: visas", "https://immi.homeaffairs.gov.au/")],
    },
    dos: [
      "Wear sunscreen and a hat; the sun is much stronger than it feels.",
      "Swim between the red and yellow flags on patrolled beaches.",
      "Drive on the left, and watch for wildlife on country roads at dusk.",
    ],
    donts: [
      "Don't skip the food declaration.",
      "Don't swim at unpatrolled beaches or in northern waters with crocodile warnings.",
    ],
    money: [
      "Currency: Australian dollar (AUD).",
      "Tipping isn't expected; 10% for good restaurant service is a nice extra.",
      "Some shops add a surcharge for card payments.",
    ],
    plugs: "Type I (two angled flat pins), 230 V. Singapore plugs need an adapter.",
    emergency: [["Police, fire and ambulance", "000"], ["From a mobile", "112"]],
    transport: [
      "Tap a contactless card or phone on public transport in Sydney, Melbourne and most big cities.",
      "Distances are huge; fly between cities.",
    ],
    links: [L("Tourism Australia", "https://www.australia.com/")],
  },

  GB: {
    visa: {
      general: "Visitors who don't need a visa now need an ETA (Electronic Travel Authorisation) before travelling to the UK. Other nationalities need a visa.",
      byHome: { SG: "Singapore passport: no visa needed for visits of up to 6 months, but you must get a UK ETA before you travel." },
      steps: [
        { text: "Apply for the ETA on the official GOV.UK app or website. Ignore sites that charge extra.", link: L("Apply for a UK ETA (GOV.UK)", "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta") },
      ],
      links: [L("Check if you need a UK visa (GOV.UK)", "https://www.gov.uk/check-uk-visa")],
    },
    dos: [
      "Queue patiently; pushing in is a real faux pas.",
      "Tap a contactless card or phone on London's buses and Tube; it's capped daily.",
      "Look right first when crossing; traffic drives on the left.",
    ],
    donts: [
      "Don't stand on the left of London Underground escalators; stand on the right.",
      "Don't call 999 for non-urgent medical help; call 111.",
    ],
    money: [
      "Currency: pound sterling (GBP).",
      "Restaurants: tip 10–12.5% if service isn't already on the bill.",
      "Cards and phones are accepted almost everywhere.",
    ],
    plugs: "Type G (three square pins, same as Singapore), 230 V.",
    emergency: [["Police, fire and ambulance", "999 or 112"], ["Urgent but not an emergency (medical)", "111"]],
    transport: [
      "Book long-distance trains ahead for much cheaper fares.",
      "A Railcard can cut fares by a third if you'll take several trips.",
    ],
    links: [L("VisitBritain", "https://www.visitbritain.com/")],
  },

  US: {
    visa: {
      general: "Citizens of Visa Waiver Program countries need an approved ESTA before travel. Everyone else needs a visa.",
      byHome: { SG: "Singapore passport: Visa Waiver Program. Apply for an ESTA before you travel (visits of up to 90 days)." },
      steps: [
        { text: "Apply for the ESTA only on the official site; lookalike sites charge more.", link: L("ESTA (official, CBP)", "https://esta.cbp.dhs.gov/") },
      ],
      links: [L("U.S. visas (Department of State)", "https://travel.state.gov/content/travel/en/us-visas.html")],
    },
    dos: [
      "Tip: about 18–20% at restaurants, and a little for taxis, bar staff and hotel housekeeping.",
      "Get travel insurance with medical cover; treatment is very expensive.",
    ],
    donts: [
      "Don't joke about security at the airport.",
      "Don't drink alcohol in public places like streets and parks (illegal in most areas).",
    ],
    money: [
      "Currency: US dollar (USD).",
      "Prices usually don't include sales tax, which is added at the till.",
    ],
    plugs: "Type A and B (two flat pins), 120 V. Check your devices handle 120 V.",
    emergency: [["Police, fire and ambulance", "911"]],
    transport: [
      "Outside big cities you'll usually need a car or ride-hailing (Uber, Lyft).",
      "Drive on the right.",
    ],
    links: [L("Brand USA (official tourism site)", "https://www.gousa.com/")],
  },
};

// Schengen countries share the same entry rules; each guide adds its own links.
const schengenVisa = (name, links, steps = []) => ({
  general: `${name} is in the Schengen Area. Many nationalities can visit visa-free for up to 90 days in any 180-day period, counted across all Schengen countries together; others need a Schengen visa.`,
  byHome: { SG: "Singapore passport: visa-free for up to 90 days in any 180-day period across the Schengen Area." },
  steps: [
    { text: "At the border, the EU's Entry/Exit System (EES) now takes your fingerprints and photo on your first visit. Allow extra time at passport control." },
    { text: "ETIAS, a new online travel authorisation for visa-free visitors, is planned but wasn't required yet when we checked. Only use the official EU site if it starts.", link: L("Travel to Europe (official EU site)", "https://travel-europe.europa.eu/") },
    ...steps,
  ],
  links,
  schengen: true,
});

Object.assign(GUIDES, {
  ES: {
    visa: schengenVisa("Spain", [L("Visas (Spanish Ministry of Foreign Affairs)", "https://www.exteriores.gob.es/en/")],
      [{ text: "Many places, including Barcelona and the Balearic Islands, charge a tourist tax per night. It's added to your hotel bill." }]),
    dos: [
      "Eat late like the locals: lunch is around 2 pm and dinner from 9 pm.",
      "Expect small shops in smaller towns to close for a few hours in the afternoon.",
      "Greet people with \"Hola\" or \"Buenos días\" when you walk into a shop or bar.",
      "Book big sights like the Sagrada Família and the Alhambra well ahead; they sell out.",
    ],
    donts: [
      "Watch for pickpockets in busy parts of Barcelona and Madrid, and on the metro.",
      "Don't walk around town in swimwear. Some beach towns fine people for it.",
      "Don't drink in the street; many cities fine for it.",
    ],
    money: [
      "Currency: euro (EUR).",
      "Tipping isn't expected. Rounding up, or 5–10% for good restaurant service, is appreciated.",
      "Cards are accepted almost everywhere, including contactless.",
    ],
    plugs: "Type C and F (two round pins), 230 V.",
    emergency: [["Emergency (any)", "112"], ["National Police", "091"]],
    transport: [
      "Fast AVE and low-cost trains (Ouigo, Iryo) link the big cities; book ahead for the best fares.",
      "City metros in Madrid and Barcelona are quick and cheap.",
      "Traffic drives on the right.",
    ],
    links: [L("Spain's official tourism site", "https://www.spain.info/en/")],
  },

  FR: {
    visa: schengenVisa("France", [L("France-Visas (official)", "https://france-visas.gouv.fr/en/")]),
    dos: [
      "Say \"Bonjour\" when you walk into a shop, café or lift, and \"Au revoir\" when you leave.",
      "Book the Louvre, the Eiffel Tower and other big sights online ahead with a time slot.",
      "Check opening days: many national museums close one day a week (often Monday or Tuesday).",
    ],
    donts: [
      "Watch for pickpockets on the Paris metro and around big sights.",
      "Don't expect quick service; waiters won't bring the bill until you ask for it.",
    ],
    money: [
      "Currency: euro (EUR).",
      "Service is included in the bill (service compris). Leaving small change or rounding up is a kind extra.",
      "Contactless cards work almost everywhere.",
    ],
    plugs: "Type C and E (two round pins), 230 V.",
    emergency: [["Emergency (any)", "112"], ["Medical (SAMU)", "15"], ["Police", "17"], ["Fire", "18"]],
    transport: [
      "TGV high-speed trains link Paris with most cities; book early on SNCF Connect for cheaper fares.",
      "In Paris, tap a Navigo Easy card, or buy tickets in the RATP app.",
      "Motorways have tolls; traffic drives on the right.",
    ],
    links: [L("France's official tourism site", "https://www.france.fr/en/")],
  },

  IT: {
    visa: schengenVisa("Italy", [L("Visa for Italy (Ministry of Foreign Affairs)", "https://vistoperitalia.esteri.it/")],
      [{ text: "Visiting Venice for the day? On peak days there's an access fee; check if your date needs one.", link: L("Venice access fee (City of Venice)", "https://cda.ve.it/en/") }]),
    dos: [
      "Cover shoulders and knees in churches, including St Peter's and the Vatican Museums.",
      "Validate paper bus and regional train tickets in the machine before you travel, or you can be fined.",
      "Book the Colosseum, the Last Supper and the Uffizi well ahead.",
    ],
    donts: [
      "Don't sit on the Spanish Steps in Rome or paddle in fountains; both can bring fines.",
      "Don't drive into a ZTL (limited traffic zone) in city centres. Cameras fine you automatically.",
      "Watch for pickpockets on busy buses and at big sights.",
    ],
    money: [
      "Currency: euro (EUR).",
      "Tipping isn't expected. Many restaurants add a small cover charge (coperto) per person.",
      "Carry some cash for small cafés and markets.",
    ],
    plugs: "Type C, F and L (round pins), 230 V.",
    emergency: [["Emergency (any)", "112"]],
    transport: [
      "Frecciarossa and Italo high-speed trains link the big cities; book early for cheaper fares.",
      "Coffee at the bar is cheaper than sitting down at a table.",
      "Traffic drives on the right.",
    ],
    links: [L("Italy's official tourism site", "https://www.italia.it/en")],
  },

  DE: {
    visa: schengenVisa("Germany", [L("Visa information (Federal Foreign Office)", "https://www.auswaertiges-amt.de/en")]),
    dos: [
      "Carry some cash; smaller cafés, bakeries and market stalls may not take cards.",
      "Return bottles marked Pfand to the machines in supermarkets to get your deposit back.",
      "Plan around Sundays: most shops are closed.",
    ],
    donts: [
      "Don't walk in bike lanes (usually red or marked on the pavement).",
      "Don't cross on a red pedestrian light, even when the road is empty.",
      "Keep noise down at night and on Sundays, which are quiet days.",
    ],
    money: [
      "Currency: euro (EUR).",
      "Round up or add 5–10% at restaurants, and say the total to the server when you pay instead of leaving it on the table.",
    ],
    plugs: "Type C and F (two round pins), 230 V.",
    emergency: [["Ambulance and fire", "112"], ["Police", "110"]],
    transport: [
      "Deutsche Bahn trains go everywhere; Sparpreis fares booked early are much cheaper.",
      "The Deutschlandticket covers local and regional transport nationwide for a monthly price.",
      "Traffic drives on the right.",
    ],
    links: [L("Germany's official tourism site", "https://www.germany.travel/en/")],
  },

  CH: {
    visa: schengenVisa("Switzerland", [L("Entry and visas (State Secretariat for Migration)", "https://www.sem.admin.ch/sem/en/home.html")]),
    dos: [
      "Look at the Swiss Travel Pass or a Half Fare Card if you'll take several trains, boats or mountain lifts.",
      "Check mountain weather before going up; it changes quickly.",
    ],
    donts: [
      "Don't expect shops to be open on Sundays.",
      "Don't pay in euros if you can avoid it; you'll get a poor rate and change in francs.",
    ],
    money: [
      "Currency: Swiss franc (CHF), not the euro.",
      "Service is included in prices; rounding up is a kind extra.",
      "Switzerland is expensive. Supermarkets (Coop, Migros) are good for cheaper meals.",
    ],
    plugs: "Type J (three round pins), 230 V. Type C two-pin plugs also fit.",
    emergency: [["Emergency (any)", "112"], ["Police", "117"], ["Ambulance", "144"], ["Fire", "118"]],
    transport: [
      "Trains are punctual and connect almost everywhere; the SBB app has all timetables and tickets.",
      "Driving on motorways needs a vignette sticker (or e-vignette).",
    ],
    links: [L("Switzerland Tourism", "https://www.myswitzerland.com/en/")],
  },

  NL: {
    visa: schengenVisa("The Netherlands", [L("Visas (Netherlands Worldwide)", "https://www.netherlandsworldwide.nl/")]),
    dos: [
      "Tap your contactless bank card in and out on trains, trams and buses.",
      "Look both ways for bikes before stepping off the pavement.",
    ],
    donts: [
      "Don't walk in bike lanes.",
      "Don't smoke cannabis in public in Amsterdam's red-light district; it's banned there.",
      "Don't take photos of people in the red-light district windows.",
    ],
    money: [
      "Currency: euro (EUR).",
      "Tipping isn't expected; round up or leave 5–10% for good service.",
      "Some places are card only and don't take cash.",
    ],
    plugs: "Type C and F (two round pins), 230 V.",
    emergency: [["Emergency (any)", "112"]],
    transport: [
      "Trains (NS) run often between all major cities.",
      "Hiring a bike is the local way to get around.",
    ],
    links: [L("Holland's official tourism site", "https://www.holland.com/global/tourism")],
  },

  TR: {
    visa: {
      general: "Many nationalities can visit Türkiye visa-free, usually for up to 90 days in 180; some need an e-Visa from the official site.",
      byHome: { SG: "Singapore passport: visa-free for up to 90 days in any 180-day period." },
      steps: [{ text: "If you need an e-Visa, apply only on the official site.", link: L("Türkiye e-Visa (official)", "https://www.evisa.gov.tr/en/") }],
      links: [L("Visa information (Ministry of Foreign Affairs)", "https://www.mfa.gov.tr/")],
    },
    dos: [
      "Cover shoulders and knees in mosques, and women should bring a headscarf. Take your shoes off at the door.",
      "Bargain in bazaars; it's expected.",
      "Accept tea when it's offered; it's part of the welcome.",
    ],
    donts: [
      "Don't insult Atatürk, the flag or the nation. It's a crime.",
      "Avoid visiting mosques during prayer times.",
    ],
    money: [
      "Currency: Turkish lira (TRY). Prices change often because of inflation.",
      "Tip about 10% in restaurants.",
    ],
    plugs: "Type C and F (two round pins), 230 V.",
    emergency: [["Emergency (any)", "112"]],
    transport: [
      "In Istanbul, get an Istanbulkart for the metro, trams, buses and ferries.",
      "Domestic flights and long-distance buses are cheap ways to cover big distances.",
    ],
    links: [L("Go Türkiye (official tourism site)", "https://goturkiye.com/")],
  },

  NZ: {
    visa: {
      general: "Visitors from visa-waiver countries need an NZeTA (with the tourist levy) before travelling to New Zealand. Others need a visa.",
      byHome: { SG: "Singapore passport: no visa needed for visits of up to 3 months, but you must get an NZeTA before you travel." },
      steps: [
        { text: "Apply for the NZeTA on the official app or website at least 72 hours before you fly.", link: L("NZeTA (Immigration New Zealand)", "https://www.immigration.govt.nz/") },
        { text: "Declare all food, and clean hiking boots and camping gear. Biosecurity is strict and fines are instant.", link: L("What you can bring (Biosecurity NZ)", "https://www.mpi.govt.nz/") },
      ],
      links: [L("New Zealand Customs: arriving in NZ", "https://www.customs.govt.nz/")],
    },
    dos: [
      "Check mountain and road conditions before hikes and long drives; weather changes fast.",
      "Use sunscreen; the UV is very strong.",
      "Drive on the left, and allow more time than the map says on winding roads.",
    ],
    donts: [
      "Don't leave valuables in your car at trailheads and car parks.",
      "Don't skip the food declaration at the airport.",
    ],
    money: [
      "Currency: New Zealand dollar (NZD).",
      "Tipping isn't expected.",
    ],
    plugs: "Type I (two angled flat pins), 230 V.",
    emergency: [["Police, ambulance and fire", "111"]],
    transport: [
      "Renting a car or campervan is the easiest way to see the country.",
      "Domestic flights link the North and South Islands; the Interislander ferry is the scenic option.",
    ],
    links: [L("New Zealand's official tourism site", "https://www.newzealand.com/")],
  },

  PH: {
    visa: {
      general: "Many nationalities can visit the Philippines visa-free, usually for 30 days or more depending on the passport.",
      byHome: { SG: "Singapore passport: visa-free for up to 30 days." },
      steps: [{ text: "Register on eTravel within 72 hours before you arrive. It's free on the official site.", link: L("eTravel (official)", "https://etravel.gov.ph/") }],
      links: [L("Bureau of Immigration", "https://immigration.gov.ph/")],
    },
    dos: [
      "Carry cash for islands and small towns, where cards often don't work.",
      "Check the weather for island hopping; typhoon season is roughly June to November.",
      "Use Grab in cities.",
    ],
    donts: [
      "Don't carry any drugs. Penalties are severe.",
      "Don't lose your temper in public; staying calm gets better results.",
    ],
    money: [
      "Currency: Philippine peso (PHP).",
      "Restaurants often add a 10% service charge; otherwise a small tip is appreciated.",
    ],
    plugs: "Type A, B and C, 220 V. Check your devices handle 220 V.",
    emergency: [["Police, ambulance and fire", "911"]],
    transport: [
      "Domestic flights are the quickest way between islands; ferries are cheaper but slower.",
      "Manila traffic is heavy, so leave plenty of time for the airport.",
    ],
    links: [L("Philippines' official tourism site", "https://philippines.travel/")],
  },

  IN: {
    visa: {
      general: "Most visitors need a visa for India. Many nationalities can apply online for an e-Visa.",
      byHome: { SG: "Singapore passport: you need a visa. Apply for an e-Visa (e-Tourist Visa) online before you travel." },
      steps: [{ text: "Apply for the e-Visa only on the official government site; many lookalike sites charge more.", link: L("Indian e-Visa (official)", "https://indianvisaonline.gov.in/evisa/") }],
      links: [L("Bureau of Immigration, India", "https://boi.mha.gov.in/boi/")],
    },
    dos: [
      "Dress modestly, and take your shoes off at temples and homes.",
      "Use your right hand to give, take or eat.",
      "Drink bottled or filtered water.",
      "Use Uber or Ola, or agree auto-rickshaw fares before you get in.",
    ],
    donts: [
      "Avoid public displays of affection.",
      "Don't touch people's heads or point your feet at people or shrines.",
    ],
    money: [
      "Currency: Indian rupee (INR).",
      "Tip about 10% in restaurants if there's no service charge.",
      "UPI phone payments are everywhere; carry cash for small purchases.",
    ],
    plugs: "Type C, D and M, 230 V.",
    emergency: [["Emergency (any)", "112"]],
    transport: [
      "Book trains early on IRCTC; popular routes sell out.",
      "Domestic flights are good value for long distances.",
    ],
    links: [L("Incredible India (official tourism site)", "https://www.incredibleindia.gov.in/")],
  },

  AE: {
    visa: {
      general: "Some nationalities get a free visa on arrival in the UAE; others must apply before travelling.",
      byHome: { SG: "Singapore passport: free visa on arrival for up to 30 days." },
      steps: [{ text: "Some prescription and over-the-counter medicines are controlled in the UAE. Check before you pack medicines.", link: L("UAE government portal", "https://u.ae/en") }],
      links: [L("Federal Authority for Identity and Citizenship (ICP)", "https://icp.gov.ae/en/")],
    },
    dos: [
      "Dress modestly in malls, souks and government buildings.",
      "During Ramadan, avoid eating, drinking or smoking in public in the daytime.",
      "Use the Dubai Metro with a Nol card; there are women-and-children carriages.",
    ],
    donts: [
      "Don't take photos of people without asking; privacy laws are strict.",
      "Don't drink alcohol outside licensed venues or be drunk in public.",
      "Avoid public displays of affection and rude gestures, including online.",
    ],
    money: [
      "Currency: UAE dirham (AED).",
      "Restaurants may add a service charge; otherwise about 10% is appreciated.",
    ],
    plugs: "Type G (three square pins, same as Singapore), 230 V.",
    emergency: [["Police", "999"], ["Ambulance", "998"], ["Fire", "997"]],
    transport: [
      "Taxis are metered; Careem and Uber also work.",
      "Summer (June to September) is extremely hot, so plan outdoor time for mornings and evenings.",
    ],
    links: [L("Visit Dubai (official)", "https://www.visitdubai.com/en"), L("Visit Abu Dhabi (official)", "https://visitabudhabi.ae/en")],
  },
});

// Schengen members get a short note on the shared rules (and fall back to
// Wikivoyage for the rest).
const SCHENGEN = new Set("AT BE BG CH CZ DE DK EE ES FI FR GR HR HU IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK".split(" "));

export const SCHENGEN_NOTE = {
  text: "This country is in the Schengen Area. Visa-free visitors can stay up to 90 days in any 180-day period across all Schengen countries combined. The EU's Entry/Exit System now records your fingerprints and photo at the border. ETIAS, a new travel authorisation, is planned but wasn't required yet when we checked.",
  link: L("Travel to Europe (official EU site)", "https://travel-europe.europa.eu/"),
};

export const isSchengen = (code) => SCHENGEN.has(String(code || "").toUpperCase());

export function getGuide(code) {
  return GUIDES[String(code || "").toUpperCase()] ?? null;
}

/**
 * The visa line for this traveller: null when they're going home, the checked
 * line for their passport if we have one, otherwise the general line plus a flag
 * telling the page to say "check the official list".
 */
export function visaFor(guide, destCode, homeCode) {
  if (homeCode && destCode && homeCode.toUpperCase() === destCode.toUpperCase()) return { home: true };
  const specific = guide?.visa?.byHome?.[String(homeCode || "").toUpperCase()] ?? null;
  return { specific, general: guide?.visa?.general ?? null, checkList: !specific };
}

/* ---------- links that work for any country ---------- */

// Wikipedia names its "Visa requirements for X citizens" pages by demonym.
const DEMONYM = {
  SG: "Singaporean", MY: "Malaysian", ID: "Indonesian", TH: "Thai", PH: "Filipino", VN: "Vietnamese", IN: "Indian",
  CN: "Chinese", JP: "Japanese", KR: "South Korean", TW: "Taiwanese", AU: "Australian", NZ: "New Zealand",
  GB: "British", US: "United States", CA: "Canadian", DE: "German", FR: "French", IT: "Italian", ES: "Spanish",
  NL: "Dutch", IE: "Irish", BN: "Bruneian", PK: "Pakistani", BD: "Bangladeshi", LK: "Sri Lankan", AE: "Emirati",
};

export function visaOverviewLink(homeCode) {
  const d = DEMONYM[String(homeCode || "").toUpperCase()];
  return d ? L(`Visa requirements for ${d} citizens (Wikipedia overview)`, `https://en.wikipedia.org/wiki/Visa_requirements_for_${encodeURIComponent(d.replace(/ /g, "_"))}_citizens`) : null;
}

/** Your own government's travel advice page, where we know it. */
const HOME_ADVICE = {
  SG: L("Travel page and eRegister (Singapore MFA)", "https://www.mfa.gov.sg/"),
  MY: L("Consular services (Malaysia Ministry of Foreign Affairs)", "https://www.kln.gov.my/"),
  AU: L("Smartraveller (Australian Government)", "https://www.smartraveller.gov.au/"),
  NZ: L("SafeTravel (New Zealand Government)", "https://www.safetravel.govt.nz/"),
  GB: L("Foreign travel advice (GOV.UK)", "https://www.gov.uk/foreign-travel-advice"),
  US: L("Travel advisories (U.S. Department of State)", "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html"),
  CA: L("Travel advice and advisories (Government of Canada)", "https://travel.gc.ca/travelling/advisories"),
  IE: L("Travel advice (Ireland Department of Foreign Affairs)", "https://www.ireland.ie/en/dfa/overseas-travel/advice/"),
};
export const homeAdviceLink = (homeCode) => HOME_ADVICE[String(homeCode || "").toUpperCase()] ?? null;

/** Wikivoyage page title for a country name, e.g. "Myanmar (Burma)" -> "Myanmar". */
export function wikivoyageTitle(name) {
  return String(name || "").replace(/\s*\(.*?\)\s*/g, " ").replace(/^Türkiye$/, "Turkey").replace(/^Czechia$/, "Czech Republic").trim();
}

export const wikivoyageUrl = (name) => `https://en.wikivoyage.org/wiki/${encodeURIComponent(wikivoyageTitle(name).replace(/ /g, "_"))}`;

// Wikivoyage section headings worth showing (level = deepest MediaWiki toclevel: 1 is a top heading) for a country without a curated guide.
const WANTED = [
  { key: "entry", title: "Getting in", match: /^(entry requirements|visas?|visa requirements|entry)$/i, level: 2 },
  { key: "respect", title: "Respect and etiquette", match: /^respect$/i, level: 1 },
  { key: "safe", title: "Stay safe", match: /^stay safe$/i, level: 1 },
  { key: "money", title: "Money", match: /^(money|tipping)$/i, level: 2 },
  { key: "around", title: "Getting around", match: /^get around$/i, level: 1 },
];

/** From a MediaWiki section list, the sections to fetch: [{ key, title, index }]. */
export function pickSections(sections) {
  const out = [];
  for (const w of WANTED) {
    const s = (sections || []).find((x) => w.match.test(String(x.line || "").replace(/<[^>]*>/g, "").trim()) && Number(x.toclevel) <= w.level);
    if (s && /^\d+$/.test(String(s.index))) out.push({ key: w.key, title: w.title, index: String(s.index) });
  }
  return out;
}
