export const INITIAL_MAP_BOUNDS = [[25.4, 23.6], [50.9, 38.9]];
export const HARD_MAP_BOUNDS = [[22.5, 19.0], [56.0, 41.6]];
export const anchorLabelIds = new Set([
  "egypt", "sinai", "jerusalem", "galilee", "damascus", "babylon", "susa", "harran", "ur", "antioch",
  "samaria", "caesarea", "nebo", "bethel", "tyre", "cyprus", "ephesus"
]);

export const eraMeta = {
  patriarker: { label: "Patriarker", color: "#b07b3d", soft: "rgba(176, 123, 61, 0.45)" },
  exodus: { label: "Exodus & ökenvandring", color: "#9a5a41", soft: "rgba(154, 90, 65, 0.45)" },
  kungar_profeter: { label: "Kungar & profeter", color: "#69734c", soft: "rgba(105, 115, 76, 0.45)" },
  jesu_liv: { label: "Jesu liv", color: "#2e7b89", soft: "rgba(46, 123, 137, 0.45)" },
  urkyrkan: { label: "Urkyrkan", color: "#4b688e", soft: "rgba(75, 104, 142, 0.45)" }
};

export const bookOrder = [
  "1 Mos", "2 Mos", "3 Mos", "4 Mos", "5 Mos", "Jos", "Dom", "Rut", "1 Sam", "2 Sam", "1 Kung", "2 Kung", "2 Krön", "Ps",
  "Jes", "Jer", "Hes", "Jona", "Nah", "Dan", "Est", "Neh", "Matt", "Mark", "Luk", "Joh", "Apg", "2 Kor", "Gal"
];

export const featuredCharacters = [
  { name: "Abraham", note: "förbundet och kallelsen" },
  { name: "Mose", note: "uttåget och Sinai" },
  { name: "David", note: "kungadömet i Juda" },
  { name: "Elia", note: "profetröst i nordriket" },
  { name: "Josua", note: "intåget och förnyat förbund" },
  { name: "Ester", note: "judar i exilen" },
  { name: "Jona", note: "kallelsen till Nineve" },
  { name: "Jesus", note: "evangeliernas geografi" },
  { name: "Petrus", note: "församlingen i Jerusalem" },
  { name: "Filippos", note: "evangeliet längs kust och vägar" },
  { name: "Barnabas", note: "brobyggare från Antiochia och Cypern" },
  { name: "Paulus", note: "mission och resor" }
];

export const storyRoutes = [
  {
    id: "abraham_route",
    palette: "patriarker",
    title: "Abrahams väg",
    subtitle: "Ur, Harran, Sikem, Betel och Hebron",
    description: "Följer hur Abraham lämnar Mesopotamien, bygger altaren i landet och rör sig genom de platser där löftet om land och släkt konkretiseras.",
    locations: ["ur", "harran", "shechem", "bethel", "hebron", "beersheba", "egypt"]
  },
  {
    id: "jacob_route",
    palette: "patriarker",
    title: "Jakob & Josef",
    subtitle: "Beer Sheva, Betel, Harran och Egypten",
    description: "Samlar patriarkberättelsernas senare båge: Jakobs flykt och återkomst, försoningen med familjen och rörelsen ned mot Egypten i Josefs dagar.",
    locations: ["beersheba", "bethel", "harran", "shechem", "hebron", "egypt"]
  },
  {
    id: "exodus_route",
    palette: "exodus",
    title: "Exodus & förbundet",
    subtitle: "Egypten, Sinai, Berget Nebo och Jeriko",
    description: "Lyfter fram slaveriet i Egypten, lagen vid Sinai, utsikten från Nebo och gränsen till landet vid Jeriko.",
    locations: ["egypt", "sinai", "nebo", "jericho"]
  },
  {
    id: "kingdom_route",
    palette: "kungar_profeter",
    title: "Riket delas",
    subtitle: "Betlehem, Jerusalem, Betel, Samaria och Karmel",
    description: "Visar hur Davids stad, nordrikets helgedomar och profeternas konfrontationer formar landskapet från den förenade monarkin till den delade.",
    locations: ["bethlehem", "hebron", "jerusalem", "bethel", "samaria", "carmel", "damascus"]
  },
  {
    id: "exile_route",
    palette: "kungar_profeter",
    title: "Exil & hov",
    subtitle: "Jerusalem, Babylon och Susa",
    description: "Samlar den judiska erfarenheten av nederlag, förvisning och hovtjänst i stormaktsstäderna som präglar Daniel, Ester och Nehemja.",
    locations: ["jerusalem", "babylon", "susa"]
  },
  {
    id: "jesus_early_route",
    palette: "jesu_liv",
    title: "Jesu tidiga år",
    subtitle: "Betlehem, Egypten, Nazaret och Galileen",
    description: "Binder ihop födelsen i Juda, flykten till Egypten, uppväxten i Nazaret och den tidiga tjänsten i Galileen.",
    locations: ["bethlehem", "egypt", "nazareth", "galilee", "capernaum"]
  },
  {
    id: "jesus_final_route",
    palette: "jesu_liv",
    title: "Jesu sista väg",
    subtitle: "Kafarnaum, Jeriko, Betania och Jerusalem",
    description: "Följer rörelsen från Galileens undervisning till uppvägen genom Jeriko och den sista veckan kring Betania och Jerusalem.",
    locations: ["capernaum", "galilee", "jericho", "bethany", "jerusalem"]
  },
  {
    id: "jesus_signs_route",
    palette: "jesu_liv",
    title: "Tecken i Galileen",
    subtitle: "Nazaret, Kana, Kafarnaum och Jerusalem",
    description: "Binder ihop hemtrakten kring Nazaret och Kana med Kafarnaum och den väg som leder fram mot Jerusalems högtider.",
    locations: ["nazareth", "cana", "capernaum", "bethany", "jerusalem"]
  },
  {
    id: "peter_coast_route",
    palette: "urkyrkan",
    title: "Petrus vid kusten",
    subtitle: "Jerusalem, Joppe och Caesarea",
    description: "Markerar hur evangeliet rör sig från Jerusalem till kuststäderna när Petrus möter Tabita, får sin syn och går in i Cornelius hus.",
    locations: ["jerusalem", "joppa", "caesarea"]
  },
  {
    id: "coast_route",
    palette: "urkyrkan",
    title: "Evangeliet längs kusten",
    subtitle: "Gaza, Joppe, Caesarea, Tyros och Antiochia",
    description: "Visar hur vägarna längs kusten och hamnstäderna blir bärare av nya möten när evangeliet rör sig mot Fenikien och Syrien.",
    locations: ["gaza", "joppa", "caesarea", "tyre", "antioch"]
  },
  {
    id: "paul_route",
    palette: "urkyrkan",
    title: "Paulus i Levanten",
    subtitle: "Damaskus, Jerusalem, Tarsos, Antiochia och Caesarea",
    description: "Skildrar Saulus kallelse, åren mellan Jerusalem och Tarsos samt hur Antiochia och Caesarea blir viktiga nav i hans tjänst.",
    locations: ["damascus", "jerusalem", "tarsus", "antioch", "caesarea"]
  },
  {
    id: "mediterranean_route",
    palette: "urkyrkan",
    title: "Mot övärld och Mindre Asien",
    subtitle: "Antiochia, Cypern, Perge och Efesos",
    description: "Öppnar kartan västerut med de tidiga missionsvägarna från Antiochia över Cypern till Pamfylien och vidare mot Efesos.",
    locations: ["antioch", "cyprus", "perge", "ephesus"]
  }
];

export const locations = [
  {
    id: "ur",
    name: "Ur",
    region: "Södra Mesopotamien",
    lat: 30.962,
    lng: 46.103,
    labelDirection: "left",
    labelOffset: [-8, -2],
    focusZoom: 7,
    palette: "patriarker",
    testaments: ["GT"],
    eras: ["patriarker"],
    primaryBooks: ["1 Mos"],
    references: [
      { book: "1 Mos", passages: "11:31; 15:7" }
    ],
    characters: ["Abraham", "Terach"],
    summary: "Ur framstår som patriarkernas tidiga utgångspunkt när Abrams familj lämnar Mesopotamien mot Kanaan.",
    geography: "Markören följer Tell el-Muqayyar i södra Mesopotamien; identifieringen av Abrahams Ur är vanlig men inte helt utan alternativa förslag."
  },
  {
    id: "harran",
    name: "Harran",
    region: "Övre Mesopotamien",
    lat: 36.867,
    lng: 39.031,
    labelDirection: "bottom",
    labelOffset: [0, 6],
    focusZoom: 7,
    palette: "patriarker",
    testaments: ["GT"],
    eras: ["patriarker"],
    primaryBooks: ["1 Mos"],
    references: [
      { book: "1 Mos", passages: "11:31-32; 12:4-5; 27:42-43; 28:10; 29:4-5" }
    ],
    characters: ["Abraham", "Jakob", "Rebecka", "Laban"],
    summary: "Harran är mellanstationen där Abrams kallelse tar form och där Jakob möter Labans familj.",
    geography: "Platsen låg vid viktiga handelsleder mellan Anatolien och Syrien."
  },
  {
    id: "hebron",
    name: "Hebron",
    region: "Judeens högland",
    lat: 31.525087,
    lng: 35.10222,
    labelDirection: "bottom",
    labelOffset: [0, 5],
    focusZoom: 8,
    palette: "patriarker",
    testaments: ["GT"],
    eras: ["patriarker", "kungar_profeter"],
    primaryBooks: ["1 Mos", "2 Sam"],
    references: [
      { book: "1 Mos", passages: "13:18; 23:2, 19" },
      { book: "2 Sam", passages: "2:1-4" }
    ],
    characters: ["Abraham", "Sara", "David"],
    summary: "Hebron är kopplad till patriarkernas gravar och blir också Davids första kungliga säte.",
    geography: "Markören följer Tel Rumeida, den gamla stadshöjden; Machpelagrottan och patriarkgravarna ligger i dagens Hebron i närheten."
  },
  {
    id: "beersheba",
    name: "Beer Sheva",
    region: "Negev",
    lat: 31.244722,
    lng: 34.840833,
    labelDirection: "left",
    labelOffset: [-2, 2],
    focusZoom: 7,
    palette: "patriarker",
    testaments: ["GT"],
    eras: ["patriarker"],
    primaryBooks: ["1 Mos"],
    references: [
      { book: "1 Mos", passages: "21:31-33; 26:23-33; 46:1-5" }
    ],
    characters: ["Abraham", "Isak", "Jakob"],
    summary: "Beer Sheva markerar patriarkernas södra gräns och återkommer i förbunden kring brunnar och offer.",
    geography: "Markören följer Tel Beer Sheva, den starkaste arkeologiska kandidaten; patriarkberättelserna knyts också till brunnstraditioner vid Bir es Seba i dagens Beer Sheva."
  },
  {
    id: "bethel",
    name: "Betel",
    region: "Benjamins och Efraims högland",
    lat: 31.922778,
    lng: 35.241389,
    labelDirection: "left",
    labelOffset: [-10, -2],
    focusZoom: 8,
    palette: "patriarker",
    testaments: ["GT"],
    eras: ["patriarker", "kungar_profeter"],
    primaryBooks: ["1 Mos", "1 Kung"],
    references: [
      { book: "1 Mos", passages: "12:8; 13:3-4; 28:10-22; 35:1-15" },
      { book: "1 Kung", passages: "12:28-33" }
    ],
    characters: ["Abraham", "Jakob", "Jerobeam"],
    summary: "Betel återkommer både i patriarkernas altaren och i det delade rikets kult, vilket gör platsen till en spegel för både löfte och avfall.",
    geography: "Markören följer Beitin, den vanligaste identifieringen av Betel, norr om Jerusalem på höglandsleden genom Efraim."
  },
  {
    id: "shechem",
    name: "Sikem",
    region: "Samarien",
    lat: 32.213611,
    lng: 35.281944,
    labelDirection: "right",
    labelOffset: [8, -2],
    focusZoom: 8,
    palette: "patriarker",
    testaments: ["GT", "NT"],
    eras: ["patriarker", "exodus", "jesu_liv"],
    primaryBooks: ["1 Mos", "Jos", "Joh"],
    references: [
      { book: "1 Mos", passages: "12:6-7; 33:18-20" },
      { book: "Jos", passages: "24:1-25" },
      { book: "Joh", passages: "4:5-6" }
    ],
    characters: ["Abraham", "Jakob", "Josua", "Jesus"],
    summary: "Sikem binder ihop Abrahams första ankomst, Jakobs bosättning, Josuas förbundsförnyelse och Jesu möte nära Sykar.",
    geography: "Markören följer Tell Balata, mellan bergen Gerissim och Ebal; Joh 4 gäller Sykar/Jakobs brunn i Sikemområdet, där identifieringen ofta knyts till Askar eller Sikemtraditionen."
  },
  {
    id: "egypt",
    name: "Egypten",
    region: "Nildeltat",
    lat: 30.83,
    lng: 31.46,
    labelDirection: "right",
    labelOffset: [6, 0],
    focusZoom: 7,
    palette: "exodus",
    testaments: ["GT", "NT"],
    eras: ["patriarker", "exodus", "jesu_liv"],
    primaryBooks: ["1 Mos", "2 Mos", "Matt"],
    references: [
      { book: "1 Mos", passages: "37-50" },
      { book: "2 Mos", passages: "1-14" },
      { book: "Matt", passages: "2:13-15" }
    ],
    characters: ["Josef", "Mose", "Maria", "Jesus"],
    summary: "Egypten är både platsen för Josefs räddning och slaveriet som leder till uttåget; senare flyr Jesu familj hit.",
    geography: "Markören är en representativ punkt i nordöstra Nildeltat; bibeltexterna avser främst Egypten som rike och Goshen/Ramsesområdet, inte en enskild stad."
  },
  {
    id: "sinai",
    name: "Sinai",
    region: "Sinaihalvön",
    lat: 28.539,
    lng: 33.975,
    labelDirection: "right",
    labelOffset: [6, 8],
    focusZoom: 7,
    palette: "exodus",
    testaments: ["GT"],
    eras: ["exodus"],
    primaryBooks: ["2 Mos", "3 Mos", "4 Mos"],
    references: [
      { book: "2 Mos", passages: "19-34" },
      { book: "3 Mos", passages: "7:38; 25:1; 26:46; 27:34" },
      { book: "4 Mos", passages: "1:1; 10:11-12" }
    ],
    characters: ["Mose", "Aron"],
    summary: "Vid Sinai sluts förbundet, lagen ges och Israels ökenvandring får sin liturgiska form.",
    geography: "Markören ligger vid den traditionella Jebel Musa/Horeb i södra Sinai; den exakta platsen för bibliska Sinai är omdiskuterad."
  },
  {
    id: "nebo",
    name: "Berget Nebo",
    region: "Moab / Pisga",
    lat: 31.7651,
    lng: 35.725,
    labelDirection: "right",
    labelOffset: [10, -4],
    focusZoom: 8,
    palette: "exodus",
    testaments: ["GT"],
    eras: ["exodus"],
    primaryBooks: ["5 Mos"],
    references: [
      { book: "5 Mos", passages: "32:48-52; 34:1-4" }
    ],
    characters: ["Mose"],
    summary: "Från Nebo/Pisgas topp ser Mose landet innan sin död, vilket gör berget till gränsen mellan löftet och intåget.",
    geography: "Markören följer den traditionella Rujm Siyaghah/Jabal Nebo-platsen i Abarimbergen öster om Jordan; Pisgas exakta utsträckning är osäker."
  },
  {
    id: "jericho",
    name: "Jeriko",
    region: "Jordandalen",
    lat: 31.871719,
    lng: 35.444564,
    labelDirection: "right",
    labelOffset: [8, -2],
    focusZoom: 8,
    palette: "exodus",
    testaments: ["GT", "NT"],
    eras: ["exodus", "jesu_liv"],
    primaryBooks: ["Jos", "Luk"],
    references: [
      { book: "Jos", passages: "2; 6" },
      { book: "Luk", passages: "18:35-43; 19:1-10" }
    ],
    characters: ["Josua", "Rahab", "Jesus", "Sackaios"],
    summary: "Jeriko är porten in i landet i Josuas tid och en mötesplats i Jesu sista resa mot Jerusalem.",
    geography: "Markören följer Tell es Sultan nordväst om dagens Jeriko, GT:s Jeriko; Lukas 18-19 hör till NT:s Jeriko vid Tell el Alayiq i samma oasområde."
  },
  {
    id: "jerusalem",
    name: "Jerusalem",
    region: "Judeen",
    lat: 31.776667,
    lng: 35.234167,
    labelDirection: "top",
    labelOffset: [0, -6],
    focusZoom: 8,
    palette: "kungar_profeter",
    testaments: ["GT", "NT"],
    eras: ["kungar_profeter", "jesu_liv", "urkyrkan"],
    primaryBooks: ["2 Sam", "1 Kung", "Luk", "Apg"],
    references: [
      { book: "2 Sam", passages: "5:6-10" },
      { book: "1 Kung", passages: "6-8" },
      { book: "Luk", passages: "22-24" },
      { book: "Apg", passages: "1-8; 15" }
    ],
    characters: ["David", "Salomo", "Jesus", "Petrus", "Paulus"],
    summary: "Jerusalem är Davids stad, tempelstad, platsen för Jesu lidande och uppståndelse samt centrum för den första församlingen.",
    geography: "Markören ligger i dagens Jerusalem; berättelserna rör särskilt Davids stad, tempelområdet och den första församlingens centrum."
  },
  {
    id: "bethany",
    name: "Betania",
    region: "Öster om Jerusalem",
    lat: 31.771661,
    lng: 35.255903,
    labelDirection: "right",
    labelOffset: [10, 0],
    focusZoom: 9,
    palette: "jesu_liv",
    testaments: ["NT"],
    eras: ["jesu_liv"],
    primaryBooks: ["Luk", "Joh", "Mark"],
    references: [
      { book: "Luk", passages: "19:29; 24:50" },
      { book: "Joh", passages: "11:1-44; 12:1-8" },
      { book: "Mark", passages: "11:1-12; 14:3-9" }
    ],
    characters: ["Maria", "Marta", "Lasarus", "Jesus"],
    summary: "Betania ligger på sluttningen öster om Jerusalem och förknippas med Lasarus, Maria, Marta och Jesu sista dagar före lidandet.",
    geography: "Byn låg på Olivbergets östra sida längs vägen från Jeriko till Jerusalem."
  },
  {
    id: "bethlehem",
    name: "Betlehem",
    region: "Judeen",
    lat: 31.704306,
    lng: 35.207639,
    labelDirection: "left",
    labelOffset: [-8, -2],
    focusZoom: 8,
    palette: "jesu_liv",
    testaments: ["GT", "NT"],
    eras: ["kungar_profeter", "jesu_liv"],
    primaryBooks: ["Rut", "1 Sam", "Matt", "Luk"],
    references: [
      { book: "Rut", passages: "1:19-22; 4:11-17" },
      { book: "1 Sam", passages: "16:1-13" },
      { book: "Matt", passages: "2:1-6" },
      { book: "Luk", passages: "2:4-15" }
    ],
    characters: ["Rut", "David", "Maria", "Josef", "Jesus"],
    summary: "Betlehem knyter samman Davids kungalinje med Jesu födelse i samma stad.",
    geography: "Ligger strax söder om Jerusalem på Juda högland."
  },
  {
    id: "nazareth",
    name: "Nazaret",
    region: "Galileen",
    lat: 32.70214,
    lng: 35.29769,
    labelDirection: "left",
    labelOffset: [-8, -4],
    focusZoom: 8,
    palette: "jesu_liv",
    testaments: ["NT"],
    eras: ["jesu_liv"],
    primaryBooks: ["Matt", "Luk"],
    references: [
      { book: "Matt", passages: "2:23" },
      { book: "Luk", passages: "1:26-27; 2:39-52; 4:16-30" }
    ],
    characters: ["Maria", "Josef", "Jesus"],
    summary: "Nazaret är platsen för bebådelsen och Jesu uppväxt innan hans offentliga tjänst tar fart.",
    geography: "Staden låg i Galileens kulliga inland."
  },
  {
    id: "cana",
    name: "Kana",
    region: "Nedre Galileen",
    lat: 32.8222,
    lng: 35.30269,
    labelDirection: "left",
    labelOffset: [-10, 0],
    focusZoom: 9,
    palette: "jesu_liv",
    testaments: ["NT"],
    eras: ["jesu_liv"],
    primaryBooks: ["Joh"],
    references: [
      { book: "Joh", passages: "2:1-11" },
      { book: "Joh", passages: "4:46-54; 21:2" }
    ],
    characters: ["Jesus", "Maria", "Natanael", "kunglig ämbetsman"],
    summary: "Kana i Galileen knyts till Jesu första tecken, helandet av ämbetsmannens son och Natanaels hemstad.",
    geography: "Markören följer Horbat Qana/Khirbet Qana, en stark kandidat i modern bibelgeografi; den senare pilgrimstraditionen placerar ofta Kana vid Kafr Kanna."
  },
  {
    id: "galilee",
    name: "Galileen",
    region: "Norra Israel / Galileiska sjön",
    lat: 32.785,
    lng: 35.545,
    labelDirection: "right",
    labelOffset: [12, -2],
    focusZoom: 8,
    palette: "jesu_liv",
    testaments: ["GT", "NT"],
    eras: ["exodus", "kungar_profeter", "jesu_liv"],
    primaryBooks: ["Jos", "Jes", "Matt", "Mark", "Joh"],
    references: [
      { book: "Jos", passages: "20:7; 21:32" },
      { book: "Jes", passages: "9:1" },
      { book: "Matt", passages: "4:13-25" },
      { book: "Mark", passages: "1:16-39" },
      { book: "Joh", passages: "6:1-21" }
    ],
    characters: ["Jesus", "Petrus", "Andreas", "Jakob", "Johannes"],
    summary: "Galileen nämns redan som nordlig region i GT och blir i evangelierna centrum för många kallelser, undervisningar och undergärningar.",
    geography: "Markören representerar Galileen kring sjön och de galileiska höjderna i norra Israel, inte en enskild stad."
  },
  {
    id: "capernaum",
    name: "Kafarnaum",
    region: "Galileiska sjöns nordkust",
    lat: 32.881111,
    lng: 35.575,
    labelDirection: "top",
    labelOffset: [0, -10],
    focusZoom: 9,
    palette: "jesu_liv",
    testaments: ["NT"],
    eras: ["jesu_liv"],
    primaryBooks: ["Matt", "Mark", "Joh"],
    references: [
      { book: "Matt", passages: "4:13; 8:5-17" },
      { book: "Mark", passages: "1:21-34; 2:1-12" },
      { book: "Joh", passages: "6:24-59" }
    ],
    characters: ["Jesus", "Petrus"],
    summary: "Kafarnaum blir nav för Jesu undervisning, helanden och konfrontationer vid Galileiska sjön.",
    geography: "Markören följer Tell Hum på sjöns nordvästra strand, den starkaste identifieringen; Khirbet Minyeh är en svagare alternativ kandidat."
  },
  {
    id: "samaria",
    name: "Samaria",
    region: "Nordrikets huvudstad och samariska regionen",
    lat: 32.276,
    lng: 35.197,
    labelDirection: "left",
    labelOffset: [-8, -2],
    focusZoom: 8,
    palette: "kungar_profeter",
    testaments: ["GT", "NT"],
    eras: ["kungar_profeter", "jesu_liv", "urkyrkan"],
    primaryBooks: ["1 Kung", "2 Kung", "Joh", "Apg"],
    references: [
      { book: "1 Kung", passages: "16:24-33" },
      { book: "2 Kung", passages: "17:1-6" },
      { book: "Joh", passages: "4:4-26" },
      { book: "Apg", passages: "8:4-8, 14-17" }
    ],
    characters: ["Omri", "Ahab", "Jesus", "Filippos", "Petrus", "Johannes"],
    summary: "Staden Samaria blev Nordrikets huvudstad; i NT kan Samaria också syfta på regionen där Jesus och den första missionen bryter gamla murar.",
    geography: "Markören ligger vid Sebaste, den forna huvudstaden; NT-referenserna kan avse den bredare regionen mellan Judeen och Galileen."
  },
  {
    id: "carmel",
    name: "Karmel",
    region: "Kustlandet",
    lat: 32.727,
    lng: 35.041,
    labelDirection: "left",
    labelOffset: [-8, 0],
    focusZoom: 7,
    palette: "kungar_profeter",
    testaments: ["GT"],
    eras: ["kungar_profeter"],
    primaryBooks: ["1 Kung"],
    references: [
      { book: "1 Kung", passages: "18:19-39" }
    ],
    characters: ["Elia", "Ahab"],
    summary: "På Karmelberget ställs Herren mot Baalsprofeterna i en av GT:s mest dramatiska uppgörelser.",
    geography: "Markören representerar Karmelbergets rygg, som skjuter ut mot Medelhavet söder om dagens Haifa; texten anger berget, inte en exakt punkt på ryggen."
  },
  {
    id: "joppa",
    name: "Joppe",
    region: "Medelhavskusten",
    lat: 32.05,
    lng: 34.75,
    labelDirection: "left",
    labelOffset: [-10, 0],
    focusZoom: 8,
    palette: "urkyrkan",
    testaments: ["GT", "NT"],
    eras: ["exodus", "kungar_profeter", "urkyrkan"],
    primaryBooks: ["Jos", "2 Krön", "Jona", "Apg"],
    references: [
      { book: "Jos", passages: "19:46" },
      { book: "2 Krön", passages: "2:16" },
      { book: "Jona", passages: "1:3" },
      { book: "Apg", passages: "9:36-43; 10:5-23" }
    ],
    characters: ["Jona", "Petrus", "Tabita"],
    summary: "Joppe är hamnstaden vid Jaffa: en gränspunkt för Dan, en hamn för tempelvirke, Jonas flyktväg och platsen där Petrus får synen som öppnar vägen mot hedningarna.",
    geography: "Den gamla hamnstaden låg vid Medelhavskusten söder om Caesarea, i dagens Jaffa/Tel Aviv."
  },
  {
    id: "gaza",
    name: "Gaza",
    region: "Sydvästra kustslätten",
    lat: 31.504,
    lng: 34.4644,
    labelDirection: "left",
    labelOffset: [-10, 0],
    focusZoom: 8,
    palette: "urkyrkan",
    testaments: ["GT", "NT"],
    eras: ["kungar_profeter", "urkyrkan"],
    primaryBooks: ["Dom", "Apg"],
    references: [
      { book: "Dom", passages: "16:1-3, 21" },
      { book: "Apg", passages: "8:26-40" }
    ],
    characters: ["Simson", "Filippos", "etiopiske hovmannen"],
    summary: "Gaza är en filisteisk stad i GT och vägen dit markerar i Apg platsen där Filippos möter den etiopiske hovmannen.",
    geography: "Markören följer Tell Harube/Tell Azza vid den gamla stadsplatsen; Apg 8 syftar på vägen från Jerusalem mot Gaza genom ödemarken."
  },
  {
    id: "caesarea",
    name: "Caesarea",
    region: "Medelhavskusten",
    lat: 32.500,
    lng: 34.892,
    labelDirection: "right",
    labelOffset: [8, -2],
    focusZoom: 8,
    palette: "urkyrkan",
    testaments: ["NT"],
    eras: ["urkyrkan"],
    primaryBooks: ["Apg"],
    references: [
      { book: "Apg", passages: "8:40" },
      { book: "Apg", passages: "10:1-48" },
      { book: "Apg", passages: "21:8-16; 23:23-35; 24-26" }
    ],
    characters: ["Filippos", "Petrus", "Cornelius", "Paulus"],
    summary: "Caesarea är den romerska kuststaden där Cornelius döps och där Paulus försvarar sig inför ståthållare och kungar.",
    geography: "Markören avser Caesarea Maritima på Medelhavskusten, den romerska administrationsstaden i Judeen."
  },
  {
    id: "tyre",
    name: "Tyros",
    region: "Fenikiska kusten",
    lat: 33.270833,
    lng: 35.196111,
    labelDirection: "right",
    labelOffset: [8, -2],
    focusZoom: 8,
    palette: "urkyrkan",
    testaments: ["GT", "NT"],
    eras: ["kungar_profeter", "jesu_liv", "urkyrkan"],
    primaryBooks: ["1 Kung", "Mark", "Apg"],
    references: [
      { book: "1 Kung", passages: "5:1-12" },
      { book: "Mark", passages: "7:24-31" },
      { book: "Apg", passages: "21:3-6" }
    ],
    characters: ["Hiram", "Jesus", "Paulus"],
    summary: "Tyros förenar tempelbyggets fenikiska kontakter med Jesu gränsöverskridande tjänst och Paulus senare kustresa.",
    geography: "Markören följer den tidigare östaden Tyros, som efter Alexanderstidens vall blev en udde på den fenikiska kusten norr om Galileen."
  },
  {
    id: "damascus",
    name: "Damaskus",
    region: "Syrien",
    lat: 33.511112,
    lng: 36.30639,
    labelDirection: "right",
    labelOffset: [8, -2],
    focusZoom: 7,
    palette: "urkyrkan",
    testaments: ["GT", "NT"],
    eras: ["kungar_profeter", "urkyrkan"],
    primaryBooks: ["2 Kung", "Jes", "Apg"],
    references: [
      { book: "2 Kung", passages: "5:1-19; 8:7-15" },
      { book: "Jes", passages: "7:8" },
      { book: "Apg", passages: "9:1-22" }
    ],
    characters: ["Naaman", "Paulus", "Hananias"],
    summary: "Damaskus är både arameisk maktstad i GT och platsen där Saulus möter den uppståndne Kristus.",
    geography: "Markören följer den historiska stadskärnan i oasstaden öster om Anti-Libanon, en gammal knutpunkt mellan öken och kust."
  },
  {
    id: "antioch",
    name: "Antiochia",
    region: "Romerska Syrien / dagens Antakya",
    lat: 36.226691,
    lng: 36.171743,
    labelDirection: "top",
    labelOffset: [0, -6],
    focusZoom: 7,
    palette: "urkyrkan",
    testaments: ["NT"],
    eras: ["urkyrkan"],
    primaryBooks: ["Apg", "Gal"],
    references: [
      { book: "Apg", passages: "11:19-26; 13:1-3" },
      { book: "Gal", passages: "2:11-14" }
    ],
    characters: ["Barnabas", "Paulus", "Petrus"],
    summary: "I Antiochia får Jesu lärjungar namnet kristna och därifrån sänds missionen ut.",
    geography: "Markören följer Antiochia vid Orontes nära dagens Antakya, mellan Medelhavet och de syriska inlandsvägarna."
  },
  {
    id: "cyprus",
    name: "Cypern",
    region: "Östra Medelhavet",
    lat: 35.126,
    lng: 33.429,
    labelDirection: "left",
    labelOffset: [-10, 0],
    focusZoom: 7,
    palette: "urkyrkan",
    testaments: ["GT", "NT"],
    eras: ["kungar_profeter", "urkyrkan"],
    primaryBooks: ["Jes", "Jer", "Hes", "Apg"],
    references: [
      { book: "Jes", passages: "23:1, 12" },
      { book: "Jer", passages: "2:10" },
      { book: "Hes", passages: "27:6" },
      { book: "Apg", passages: "4:36" },
      { book: "Apg", passages: "13:4-12" },
      { book: "Apg", passages: "15:39" }
    ],
    characters: ["Barnabas", "Paulus", "Johannes Markus"],
    summary: "Cypern, Kittim i flera profettexter, förknippas med Barnabas och blir ett av de första tydliga missionella stegen ut i den östra medelhavsvärlden.",
    geography: "Markören är representativ för ön väster om Syrien och söder om Anatolien, en naturlig bro mellan kustregionerna."
  },
  {
    id: "tarsus",
    name: "Tarsos",
    region: "Kilikien",
    lat: 36.913028,
    lng: 34.892056,
    labelDirection: "left",
    labelOffset: [-8, -8],
    focusZoom: 7,
    palette: "urkyrkan",
    testaments: ["NT"],
    eras: ["urkyrkan"],
    primaryBooks: ["Apg"],
    references: [
      { book: "Apg", passages: "9:11, 30; 11:25; 21:39; 22:3" }
    ],
    characters: ["Paulus"],
    summary: "Tarsos är Paulus hemstad och markerar den grekisk-romerska horisont som formar hans uppdrag.",
    geography: "Markören följer den arkeologiska platsen i dagens Tarsos i Kilikien på Anatoliens sydöstra kustslätt."
  },
  {
    id: "perge",
    name: "Perge",
    region: "Pamfylien",
    lat: 36.959,
    lng: 30.853,
    labelDirection: "left",
    labelOffset: [-10, -2],
    focusZoom: 8,
    palette: "urkyrkan",
    testaments: ["NT"],
    eras: ["urkyrkan"],
    primaryBooks: ["Apg"],
    references: [
      { book: "Apg", passages: "13:13-14" },
      { book: "Apg", passages: "14:24-25" }
    ],
    characters: ["Paulus", "Johannes Markus"],
    summary: "Perge är en av de första anatoliska platserna på Paulus väg in från kusten mot inlandet, och här lämnar Johannes Markus följet.",
    geography: "Markören följer ruinerna av Perge/Perga i Pamfyliens slättland en bit in från Anatoliens sydkust."
  },
  {
    id: "ephesus",
    name: "Efesos",
    region: "Asien / västra Mindre Asien",
    lat: 37.939,
    lng: 27.341,
    labelDirection: "left",
    labelOffset: [-10, -4],
    focusZoom: 8,
    palette: "urkyrkan",
    testaments: ["NT"],
    eras: ["urkyrkan"],
    primaryBooks: ["Apg"],
    references: [
      { book: "Apg", passages: "18:18-28" },
      { book: "Apg", passages: "19:1-41" },
      { book: "Apg", passages: "20:17-38" }
    ],
    characters: ["Paulus", "Apollos", "Priscilla", "Aquila"],
    summary: "Efesos blir ett av den tidiga kyrkans starkaste urbana centra där undervisning, konflikt och församlingstillväxt möts.",
    geography: "Efesos låg vid Kaystros gamla flodmynning och var en romersk hamnstad; ruinerna ligger idag längre inåt land efter sedimentering."
  },
  {
    id: "nineveh",
    name: "Nineve",
    region: "Assyrien",
    lat: 36.3594,
    lng: 43.1528,
    labelDirection: "right",
    labelOffset: [8, -8],
    focusZoom: 7,
    palette: "kungar_profeter",
    testaments: ["GT"],
    eras: ["kungar_profeter"],
    primaryBooks: ["Jona", "Nah"],
    references: [
      { book: "Jona", passages: "1-4" },
      { book: "Nah", passages: "1-3" }
    ],
    characters: ["Jona"],
    summary: "Nineve är Assyriens storstad där Jona kallas att predika omvändelse och Nahum senare uttalar dom.",
    geography: "Markören följer Nineves synliga ruiner vid Tigris i norra Mesopotamien."
  },
  {
    id: "babylon",
    name: "Babylon",
    region: "Mesopotamien",
    lat: 32.536,
    lng: 44.42,
    labelDirection: "right",
    labelOffset: [8, -6],
    focusZoom: 7,
    palette: "kungar_profeter",
    testaments: ["GT"],
    eras: ["kungar_profeter"],
    primaryBooks: ["2 Kung", "Ps", "Dan", "Hes"],
    references: [
      { book: "2 Kung", passages: "24-25" },
      { book: "Ps", passages: "137" },
      { book: "Dan", passages: "1-6" },
      { book: "Hes", passages: "1:1-3" }
    ],
    characters: ["Daniel", "Nebukadnessar", "Hesekiel"],
    summary: "Babylon står för exilen, maktens hov och de visioner som formar hoppet om återkomst.",
    geography: "Markören följer Babylon stadsruin vid Eufrat, söder om dagens Bagdad; flera exiltexter, särskilt hos Hesekiel, syftar bredare på Babylonien/Kaldéernas land."
  },
  {
    id: "susa",
    name: "Susa",
    region: "Elam / Persien",
    lat: 32.1896,
    lng: 48.257,
    labelDirection: "left",
    labelOffset: [-8, -2],
    focusZoom: 7,
    palette: "kungar_profeter",
    testaments: ["GT"],
    eras: ["kungar_profeter"],
    primaryBooks: ["Est", "Neh", "Dan"],
    references: [
      { book: "Est", passages: "1-10" },
      { book: "Neh", passages: "1:1-2:9" },
      { book: "Dan", passages: "8:1-2" }
    ],
    characters: ["Ester", "Nehemja", "Daniel"],
    summary: "Susa är hovstad i Perserriket där Ester och Nehemja verkar nära rikets centrum.",
    geography: "Markören följer Shush/Susa i sydvästra Iran, på Susianas slätter mellan Karkheh och Dez där Mesopotamien möter Irans högland."
  }
];
