import { PrismaClient } from "@prisma/client";

type ReportCategory = "masini_parcate" | "gropi" | "constructii" | "drum_blocat" | "interferenta_pietoni" | "obstacole" | "parcari_biciclete" | "iluminat" | "altele";
type ReportSeverity = "scazut" | "mediu" | "ridicat" | "critic";
type ReportStatus = "trimis" | "in_analiza" | "in_lucru" | "rezolvat" | "respins";
type ProposalCategory = "pista_noua" | "parcare_biciclete" | "siguranta" | "semaforizare" | "infrastructura_verde" | "altele";
type ProposalStatus = "in_analiza" | "aprobat" | "respins" | "in_implementare";

const prisma = new PrismaClient();

// ============================
// Helpers
// ============================
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return parseFloat((min + Math.random() * (max - min)).toFixed(4));
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Cluj-Napoca bounding box for random locations
const CLUJ_LAT = { min: 46.745, max: 46.795 };
const CLUJ_LNG = { min: 23.555, max: 23.625 };

const categories: ReportCategory[] = [
  "masini_parcate", "gropi", "constructii", "drum_blocat",
  "interferenta_pietoni", "obstacole", "parcari_biciclete", "iluminat", "altele",
];

const categoryLabels: Record<string, string> = {
  masini_parcate: "Mașini parcate pe piste",
  gropi: "Gropi / deteriorări",
  constructii: "Construcții blocante",
  drum_blocat: "Drum blocat",
  interferenta_pietoni: "Interferență cu pietonii",
  obstacole: "Obstacole pe drumuri",
  parcari_biciclete: "Parcări de biciclete proaste",
  iluminat: "Iluminat insuficient",
  altele: "Altele",
};

const severities: ReportSeverity[] = ["scazut", "mediu", "ridicat", "critic"];
const statuses: ReportStatus[] = ["trimis", "in_analiza", "in_lucru", "rezolvat", "respins"];

const proposalCategories: ProposalCategory[] = [
  "pista_noua", "parcare_biciclete", "siguranta", "semaforizare", "infrastructura_verde", "altele",
];

const proposalCategoryLabels: Record<string, string> = {
  pista_noua: "Pistă nouă",
  parcare_biciclete: "Parcare biciclete",
  siguranta: "Siguranță",
  semaforizare: "Semaforizare",
  infrastructura_verde: "Infrastructură verde",
  altele: "Altele",
};

const proposalStatuses: ProposalStatus[] = ["in_analiza", "aprobat", "respins", "in_implementare"];

const streets = [
  "Calea Moților", "Strada Memorandumului", "Bulevardul Eroilor", "Strada Napoca",
  "Strada Republicii", "Strada Dorobanților", "Calea Turzii", "Strada Observatorului",
  "Aleea Carpați", "Strada Fabricii", "Piața Gării", "Strada Clinicilor",
  "Malul Someșului", "Parcul Central", "Parcul Cetățuie", "Strada Horea",
  "Strada Avram Iancu", "Bulevardul 21 Decembrie", "Strada Traian", "Piața Unirii",
  "Strada Regele Ferdinand", "Calea Florești", "Strada Mehedinți", "Strada Plopilor",
  "Strada Brâncuși", "Strada Pasteur", "Bulevardul Nicolae Titulescu", "Strada Teodor Mihali",
  "Strada Emil Isac", "Calea Mănăștur",
];

const neighborhoods = ["Mănăștur", "Centru", "Gheorgheni", "Grigorescu", "Zorilor", "Mărăști", "Bună Ziua", "Andrei Mureșanu", "Iris", "Dâmbul Rotund"];

const reportTitles: Record<string, string[]> = {
  masini_parcate: [
    "SUV parcat pe pista de biciclete", "Mașină pe pistă lângă semafor", "Parcare neautorizată pe pistă",
    "Taxi staționar pe pista ciclabilă", "Autoutilitară parcată pe pistă", "Duba de livrare pe pistă",
    "Mașină parcată permanent pe pistă", "Vehicul abandonat pe pista de biciclete",
  ],
  gropi: [
    "Groapă mare pe pistă", "Asfalt crăpat pe pista ciclabilă", "Denivelări pe pistă",
    "Groapă adâncă după ploaie", "Fisuri extinse pe suprafață", "Asfalt rupt la marginea pistei",
  ],
  constructii: [
    "Schele pe toată lățimea pistei", "Excavator parcat pe pistă", "Lucrări blocante nesemnalizate",
    "Material de construcții pe pistă", "Container pe pista ciclabilă", "Macara cu brațul peste pistă",
  ],
  drum_blocat: [
    "Livrare blochează pista", "Drum blocat complet", "Barieră pusă pe pistă",
    "Obstacol mare pe pistă", "Stâlp căzut pe pistă", "Container de gunoi pe pistă",
  ],
  interferenta_pietoni: [
    "Pietoni pe pista ciclabilă", "Grupuri de pietoni pe pistă", "Copii care se joacă pe pistă",
    "Pietoni cu cărucioare pe pistă", "Joggeri pe pista de biciclete",
  ],
  obstacole: [
    "Tomberon lăsat pe pistă", "Ramuri căzute pe pistă", "Sticlă spartă pe pistă",
    "Bordură ridicată pe pistă", "Capac de canal ridicat", "Ghivece pe pista ciclabilă",
  ],
  parcari_biciclete: [
    "Suporturi biciclete ruginite", "Parcare biciclete lipsă", "Stâlp de parcare îndoit",
    "Parcare biciclete supraîncărcată", "Loc parcare biciclete vandalizat",
  ],
  iluminat: [
    "Lipsă iluminat pe pistă", "Bec ars pe pistă", "Stâlpi de iluminat nefuncționali",
    "Zonă întunecată pe pista ciclabilă", "Iluminat intermitent pe pistă",
  ],
  altele: [
    "Marcaje pistă șterse", "Indicatoare lipsă", "Pistă cu sens ambiguu",
    "Semnalizare confuză la intersecție", "Lipsa semnelor de pistă ciclabilă",
  ],
};

const proposalTitles = [
  "Pistă de biciclete pe {street}", "Parcare securizată de biciclete lângă {street}",
  "Semafoare dedicate bicicliștilor pe {street}", "Bariere de protecție pe {street}",
  "Coridor verde pe {street}", "Oglinzi de trafic la intersecțiile din {neighborhood}",
  "Stații bike-sharing în {neighborhood}", "Iluminat suplimentar pe {street}",
  "Extindere pistă ciclabilă {street}", "Rută alternativă ciclabilă prin {neighborhood}",
  "Zone de odihnă pentru bicicliști pe {street}", "Semnalizare îmbunătățită pe {street}",
];

const proposalDescriptions = [
  "Propun construirea unei piste dedicate de biciclete care ar îmbunătăți siguranța și mobilitatea în zonă.",
  "Instalarea de parcări securizate pentru biciclete ar facilita transportul intermodal și ar reduce furturile.",
  "Montarea de semafoare specifice pentru bicicliști ar reduce semnificativ riscul de accidente.",
  "Crearea unui coridor verde cu pistă de biciclete, vegetație și zone de odihnă ar transforma complet zona.",
  "Propun instalarea de bariere fizice pentru separarea pistei de carosabil, crescând siguranța bicicliștilor.",
  "Iluminatul suplimentar pe traseele ciclabile ar permite deplasarea în siguranță și pe timp de noapte.",
  "Extinderea rețelei ciclabile ar conecta mai bine cartierele și ar încuraja transportul pe două roți.",
  "Semnalizarea îmbunătățită ar clarifica prioritățile la intersecții și ar reduce conflictele cu autovehicule.",
];

const commentTexts = [
  "Excelentă idee! Această zonă are nevoie urgentă de asta.",
  "De acord! Eu circul zilnic pe acest traseu și este foarte periculos.",
  "Ar fi grozav dacă s-ar conecta cu pistele existente din zonă.",
  "Sper să fie implementat cât mai curând. E o nevoie reală.",
  "Am pățit un accident în zona asta tocmai din cauza lipsei acestei infrastructuri.",
  "Foarte necesară această propunere. Susțin 100%!",
  "Ar trebui prioritizată, mai ales că sunt mulți studenți care circulă pe aici.",
  "O soluție bună ar fi și barierele pe lângă pistă.",
  "Ar reduce semnificativ traficul auto dacă ar exista un traseu ciclabil decent.",
  "Bravo pentru inițiativă! Cluj-Napoca are nevoie de mai multe astfel de proiecte.",
  "Am vorbit și cu vecinii, toți vor acest lucru.",
  "Se poate adăuga și un punct de service biciclete?",
  "Cred că bugetul propus este realist. Ar trebui aprobat.",
  "Zona asta este un coșmar pentru bicicliști, e nevoie urgentă de intervenție.",
  "Poate primăria ar putea face un parteneriat cu o companie de bike-sharing.",
];

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.activity.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.projectLike.deleteMany();
  await prisma.projectFollow.deleteMany();
  await prisma.proposalVote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.reportPhoto.deleteMany();
  await prisma.report.deleteMany();
  await prisma.proposalImage.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.project.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.simulationScenario.deleteMany();
  await prisma.infrastructureElement.deleteMany();
  await prisma.infrastructureLayer.deleteMany();
  await prisma.user.deleteMany();

  // ============================
  // Badges
  // ============================
  const badges = await Promise.all([
    prisma.badge.create({ data: { name: "Primul Raport", description: "Ai trimis primul tău raport", icon: "🏅" } }),
    prisma.badge.create({ data: { name: "Activist Urban", description: "10 rapoarte trimise", icon: "🌟" } }),
    prisma.badge.create({ data: { name: "Voce Civică", description: "5 propuneri trimise", icon: "📢" } }),
    prisma.badge.create({ data: { name: "Campion Civic", description: "50 rapoarte trimise", icon: "🏆" } }),
    prisma.badge.create({ data: { name: "Explorator", description: "Rapoarte din 5 cartiere diferite", icon: "🗺️" } }),
    prisma.badge.create({ data: { name: "Comentator Activ", description: "20 comentarii la propuneri", icon: "💬" } }),
  ]);

  console.log(`  ✓ ${badges.length} badges created`);

  // ============================
  // Users — 3 main + 20 generated citizens + 1 admin
  // ============================
  const firstNames = ["Alexandru", "Elena", "Vlad", "Ana", "Bogdan", "Ioana", "Cristian", "Diana", "Florin", "Gabriela", "Horia", "Laura", "Marius", "Raluca", "Sergiu", "Teodora", "Adrian", "Bianca", "Dan", "Monica"];
  const lastNames = ["Popa", "Rusu", "Mureșan", "Toma", "Moldovan", "Crișan", "Petrescu", "Nistor", "Ciobanu", "Dragomir", "Lungu", "Stanciu", "Olariu", "Suciu", "Bîrsan", "Varga", "Kiss", "Kovács", "Bogdan", "Radu"];

  const andrei = await prisma.user.create({
    data: {
      nickname: "Andrei Popescu",
      email: "andrei.popescu@email.com",
      role: "cetatean",
      neighborhood: "Mănăștur",
      xp: 1250,
      level: 3,
      levelName: "Activist Urban",
      sessionToken: "session-andrei-popescu",
    },
  });

  const maria = await prisma.user.create({
    data: {
      nickname: "Maria Ionescu",
      email: "maria.ionescu@email.com",
      role: "cetatean",
      neighborhood: "Centru",
      xp: 830,
      level: 2,
      levelName: "Biciclist Activ",
      sessionToken: "session-maria-ionescu",
    },
  });

  const mihai = await prisma.user.create({
    data: {
      nickname: "Mihai Dumitru",
      email: "mihai.dumitru@email.com",
      role: "cetatean",
      neighborhood: "Gheorgheni",
      xp: 420,
      level: 1,
      levelName: "Începător",
      sessionToken: "session-mihai-dumitru",
    },
  });

  const admin = await prisma.user.create({
    data: {
      nickname: "Admin Cluj-Napoca",
      email: "admin@clujnapoca.ro",
      role: "admin",
      neighborhood: "Centru",
      xp: 0,
      level: 0,
      levelName: "Administrator",
      sessionToken: "session-admin-cluj",
    },
  });

  // Generate 20 more citizens
  const extraUsers = [];
  for (let i = 0; i < 20; i++) {
    const fn = firstNames[i];
    const ln = lastNames[i];
    const u = await prisma.user.create({
      data: {
        nickname: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@email.com`,
        role: "cetatean",
        neighborhood: randomItem(neighborhoods),
        xp: randomInt(50, 2000),
        level: randomInt(1, 5),
        levelName: randomItem(["Începător", "Biciclist Activ", "Activist Urban", "Expert Civic", "Campion"]),
      },
    });
    extraUsers.push(u);
  }

  const allCitizens = [andrei, maria, mihai, ...extraUsers];
  console.log(`  ✓ ${allCitizens.length + 1} users created (${allCitizens.length} citizens + 1 admin)`);

  // ============================
  // User Badges
  // ============================
  await prisma.userBadge.createMany({
    data: [
      { userId: andrei.id, badgeId: badges[0].id, earnedAt: new Date("2025-11-10") },
      { userId: andrei.id, badgeId: badges[1].id, earnedAt: new Date("2025-12-15") },
      { userId: andrei.id, badgeId: badges[4].id, earnedAt: new Date("2026-01-20") },
      { userId: maria.id, badgeId: badges[0].id, earnedAt: new Date("2025-10-25") },
      { userId: mihai.id, badgeId: badges[0].id, earnedAt: new Date("2026-01-10") },
      ...extraUsers.slice(0, 10).map((u) => ({
        userId: u.id,
        badgeId: badges[0].id,
        earnedAt: randomDate(new Date("2025-06-01"), new Date("2026-03-01")),
      })),
    ],
  });

  console.log("  ✓ User badges assigned");

  // ============================
  // Reports — ~200 reports spread across 12 months
  // ============================
  const reportData = [];
  const yearStart = new Date("2025-04-01");
  const now = new Date("2026-03-10");

  // 15 hand-crafted core reports
  const coreReports = [
    { userId: andrei.id, category: "masini_parcate" as ReportCategory, severity: "ridicat" as ReportSeverity, status: "in_analiza" as ReportStatus, title: "SUV parcat pe pista de pe Calea Moților", description: "Un SUV negru este parcat permanent pe pista de biciclete de pe Calea Moților, în dreptul numărului 42. Forțează bicicliștii să circule pe carosabil.", lat: 46.7712, lng: 23.5897, address: "Calea Moților 42, Cluj-Napoca", seenCount: 3, createdAt: new Date("2026-03-08T10:30:00Z") },
    { userId: andrei.id, category: "gropi" as ReportCategory, severity: "mediu" as ReportSeverity, status: "trimis" as ReportStatus, title: "Groapă mare pe strada Memorandumului", description: "Groapă adâncă de aproximativ 15cm pe pista de biciclete, aproame de intersecția cu strada Eroilor.", lat: 46.7695, lng: 23.5880, address: "Strada Memorandumului, Cluj-Napoca", seenCount: 5, createdAt: new Date("2026-03-07T14:20:00Z") },
    { userId: maria.id, category: "iluminat" as ReportCategory, severity: "ridicat" as ReportSeverity, status: "in_lucru" as ReportStatus, title: "Lipsă iluminat pe tronsonul Parcul Central", description: "Segmentul de pistă de biciclete din Parcul Central nu are iluminat funcțional pe o distanță de aproximativ 200m.", lat: 46.7710, lng: 23.5960, address: "Parcul Central, Cluj-Napoca", seenCount: 8, createdAt: new Date("2026-03-05T18:45:00Z") },
    { userId: mihai.id, category: "constructii" as ReportCategory, severity: "critic" as ReportSeverity, status: "in_analiza" as ReportStatus, title: "Schele pe toată lățimea trotuarului pe Bulevardul Eroilor", description: "Lucrări de renovare a fațadei au blocat complet trotuarul și pista de biciclete.", lat: 46.7705, lng: 23.5870, address: "Bulevardul Eroilor 15, Cluj-Napoca", seenCount: 12, createdAt: new Date("2026-03-06T08:00:00Z") },
    { userId: andrei.id, category: "obstacole" as ReportCategory, severity: "mediu" as ReportSeverity, status: "rezolvat" as ReportStatus, title: "Tomberon lăsat pe pistă pe strada Napoca", description: "Un tomberon de gunoi a fost lăsat pe pista de biciclete de personalul de salubrizare.", lat: 46.7725, lng: 23.5915, address: "Strada Napoca, Cluj-Napoca", seenCount: 2, createdAt: new Date("2026-03-01T07:30:00Z") },
    { userId: maria.id, category: "drum_blocat" as ReportCategory, severity: "ridicat" as ReportSeverity, status: "trimis" as ReportStatus, title: "Livrare blochează pista pe Eroilor", description: "Camion de livrare parcat zilnic între orele 8-10 pe pista de biciclete.", lat: 46.7700, lng: 23.5855, address: "Bulevardul Eroilor 30, Cluj-Napoca", seenCount: 6, createdAt: new Date("2026-03-09T09:00:00Z") },
    { userId: mihai.id, category: "interferenta_pietoni" as ReportCategory, severity: "scazut" as ReportSeverity, status: "trimis" as ReportStatus, title: "Pietoni pe pista de pe Republicii", description: "Mulți pietoni merg pe pista de biciclete de pe strada Republicii.", lat: 46.7715, lng: 23.5930, address: "Strada Republicii, Cluj-Napoca", seenCount: 4, createdAt: new Date("2026-03-08T16:00:00Z") },
    { userId: andrei.id, category: "parcari_biciclete" as ReportCategory, severity: "mediu" as ReportSeverity, status: "in_analiza" as ReportStatus, title: "Suporturi biciclete ruginite la Universitate", description: "Suporturile de biciclete din fața UBB sunt puternic ruginite și instabile.", lat: 46.7670, lng: 23.5910, address: "Universitatea Babeș-Bolyai, Cluj-Napoca", seenCount: 3, createdAt: new Date("2026-03-04T12:15:00Z") },
    { userId: maria.id, category: "masini_parcate" as ReportCategory, severity: "ridicat" as ReportSeverity, status: "in_lucru" as ReportStatus, title: "Parcare neautorizată pe pista de pe Dorobanților", description: "Mai multe mașini parcate permanent pe pista de biciclete de pe strada Dorobanților.", lat: 46.7650, lng: 23.5850, address: "Strada Dorobanților, Cluj-Napoca", seenCount: 10, createdAt: new Date("2026-02-28T11:00:00Z") },
    { userId: mihai.id, category: "gropi" as ReportCategory, severity: "ridicat" as ReportSeverity, status: "trimis" as ReportStatus, title: "Asfalt crăpat pe pista din Gheorgheni", description: "Asfaltul pistei de biciclete din zona Gheorgheni prezintă multiple crăpături.", lat: 46.7680, lng: 23.6050, address: "Aleea Carpați, Gheorgheni, Cluj-Napoca", seenCount: 7, createdAt: new Date("2026-03-10T08:45:00Z") },
    { userId: andrei.id, category: "iluminat" as ReportCategory, severity: "mediu" as ReportSeverity, status: "trimis" as ReportStatus, title: "Bec ars pe pista de pe malul Someșului", description: "Trei stâlpi de iluminat consecutivi nu funcționează pe pista de pe malul Someșului.", lat: 46.7730, lng: 23.5780, address: "Malul Someșului, Grigorescu, Cluj-Napoca", seenCount: 2, createdAt: new Date("2026-03-09T19:30:00Z") },
    { userId: maria.id, category: "obstacole" as ReportCategory, severity: "scazut" as ReportSeverity, status: "rezolvat" as ReportStatus, title: "Ramuri căzute pe pistă în Parcul Cetățuie", description: "Mai multe ramuri de copac au căzut pe pista de biciclete din Parcul Cetățuie.", lat: 46.7740, lng: 23.5860, address: "Parcul Cetățuie, Cluj-Napoca", seenCount: 1, createdAt: new Date("2026-02-25T10:00:00Z") },
    { userId: andrei.id, category: "constructii" as ReportCategory, severity: "mediu" as ReportSeverity, status: "in_analiza" as ReportStatus, title: "Excavator parcat pe pistă pe Fabricii", description: "Utilaj de construcții parcat pe pista de biciclete în zona lucrărilor de pe strada Fabricii.", lat: 46.7760, lng: 23.5820, address: "Strada Fabricii, Cluj-Napoca", seenCount: 4, createdAt: new Date("2026-03-07T07:45:00Z") },
    { userId: mihai.id, category: "masini_parcate" as ReportCategory, severity: "mediu" as ReportSeverity, status: "trimis" as ReportStatus, title: "Taxi-uri parcate pe pista la gară", description: "Taxiurile staționează regulat pe pista de biciclete din fața Gării Cluj-Napoca.", lat: 46.7810, lng: 23.5940, address: "Piața Gării, Cluj-Napoca", seenCount: 9, createdAt: new Date("2026-03-10T06:30:00Z") },
    { userId: maria.id, category: "altele" as ReportCategory, severity: "scazut" as ReportSeverity, status: "trimis" as ReportStatus, title: "Marcaje pistă șterse pe Observatorului", description: "Marcajele pistei de biciclete de pe strada Observatorului sunt aproape complet șterse.", lat: 46.7635, lng: 23.5985, address: "Strada Observatorului, Cluj-Napoca", seenCount: 3, createdAt: new Date("2026-03-06T15:20:00Z") },
  ];

  for (const r of coreReports) {
    reportData.push({
      userId: r.userId,
      category: r.category,
      categoryLabel: categoryLabels[r.category],
      severity: r.severity,
      status: r.status,
      title: r.title,
      description: r.description,
      latitude: r.lat,
      longitude: r.lng,
      address: r.address,
      seenCount: r.seenCount,
      createdAt: r.createdAt,
    });
  }

  // Generate ~185 more reports spread across months with weighted distribution
  // More reports in recent months to simulate growth
  const monthWeights = [5, 6, 8, 10, 12, 14, 12, 10, 14, 18, 22, 18]; // Apr 2025 -> Mar 2026
  let totalGenerated = 0;

  for (let m = 0; m < 12; m++) {
    const count = monthWeights[m];
    const monthStart = new Date(2025, 3 + m, 1); // April 2025 start
    const monthEnd = new Date(2025, 4 + m, 1);

    for (let i = 0; i < count; i++) {
      const cat = randomItem(categories);
      const titles = reportTitles[cat];
      const street = randomItem(streets);
      const status = randomItem(statuses);
      const severity = randomItem(severities);
      const createdAt = randomDate(monthStart, monthEnd);
      const isAnonymous = Math.random() < 0.15; // 15% anonymous

      reportData.push({
        userId: isAnonymous ? null : randomItem(allCitizens).id,
        category: cat,
        categoryLabel: categoryLabels[cat],
        severity,
        status,
        title: `${randomItem(titles)} — ${street}`,
        description: `Problemă de tip "${categoryLabels[cat]}" raportată pe ${street}, Cluj-Napoca. ${severity === "critic" ? "Situație urgentă!" : ""}`,
        latitude: randomFloat(CLUJ_LAT.min, CLUJ_LAT.max),
        longitude: randomFloat(CLUJ_LNG.min, CLUJ_LNG.max),
        address: `${street}, Cluj-Napoca`,
        seenCount: randomInt(1, 20),
        createdAt,
      });
      totalGenerated++;
    }
  }

  // Batch create all reports
  for (const r of reportData) {
    await prisma.report.create({ data: r });
  }

  console.log(`  ✓ ${reportData.length} reports created (15 core + ${totalGenerated} generated, ~15% anonymous)`);

  // ============================
  // Proposals — 8 core + 25 generated
  // ============================
  const coreProposals = [
    { userId: andrei.id, category: "pista_noua" as ProposalCategory, categoryLabel: "Pistă nouă", title: "Pistă de biciclete pe Calea Turzii", description: "Propun construirea unei piste dedicate de biciclete pe Calea Turzii, de la intersecția cu strada Observatorului până la ieșirea din oraș. Aceasta ar conecta cartierul Mănăștur cu zona de sud a orașului.", lat: 46.7580, lng: 23.5870, address: "Calea Turzii, Cluj-Napoca", status: "in_analiza" as ProposalStatus, createdAt: new Date("2026-03-01T10:00:00Z") },
    { userId: maria.id, category: "parcare_biciclete" as ProposalCategory, categoryLabel: "Parcare biciclete", title: "Stații de biciclete securizate la stațiile de autobuz", description: "Instalarea de parcări securizate pentru biciclete la toate stațiile importante de transport public din Cluj-Napoca.", lat: 46.7712, lng: 23.5897, address: "Centrul Civic, Cluj-Napoca", status: "aprobat" as ProposalStatus, createdAt: new Date("2026-02-15T14:00:00Z") },
    { userId: mihai.id, category: "siguranta" as ProposalCategory, categoryLabel: "Siguranță", title: "Oglinzi de trafic la intersecțiile din Gheorgheni", description: "Montarea de oglinzi de trafic la intersecțiile periculoase din cartierul Gheorgheni.", lat: 46.7680, lng: 23.6050, address: "Gheorgheni, Cluj-Napoca", status: "in_analiza" as ProposalStatus, createdAt: new Date("2026-03-05T11:30:00Z") },
    { userId: andrei.id, category: "semaforizare" as ProposalCategory, categoryLabel: "Semaforizare", title: "Semafoare dedicate bicicliștilor pe Eroilor", description: "Instalarea de semafoare specifice pentru bicicliști pe Bulevardul Eroilor, cu fază separată.", lat: 46.7700, lng: 23.5870, address: "Bulevardul Eroilor, Cluj-Napoca", status: "in_implementare" as ProposalStatus, createdAt: new Date("2026-01-20T09:00:00Z") },
    { userId: maria.id, category: "infrastructura_verde" as ProposalCategory, categoryLabel: "Infrastructură verde", title: "Coridor verde pe malul Someșului", description: "Crearea unui coridor verde continuu pe malul Someșului, cu pistă de biciclete, vegetație și zone de odihnă.", lat: 46.7730, lng: 23.5780, address: "Malul Someșului, Cluj-Napoca", status: "in_analiza" as ProposalStatus, createdAt: new Date("2026-02-10T16:00:00Z") },
    { userId: mihai.id, category: "siguranta" as ProposalCategory, categoryLabel: "Siguranță", title: "Bariere fizice între pistă și carosabil pe Dorobanților", description: "Propun instalarea de bariere fizice (stâlpi flexibili sau jardiniere) între pista de biciclete și circulația auto.", lat: 46.7650, lng: 23.5850, address: "Strada Dorobanților, Cluj-Napoca", status: "respins" as ProposalStatus, createdAt: new Date("2026-02-25T08:00:00Z") },
    { userId: andrei.id, category: "pista_noua" as ProposalCategory, categoryLabel: "Pistă nouă", title: "Rută ciclabilă campus universitar", description: "Conectarea campusurilor universitare (UBB, UTCN, UMF) printr-o rută ciclabilă dedicată.", lat: 46.7670, lng: 23.5910, address: "Campus Universitar, Cluj-Napoca", status: "aprobat" as ProposalStatus, createdAt: new Date("2026-01-10T10:00:00Z") },
    { userId: maria.id, category: "altele" as ProposalCategory, categoryLabel: "Altele", title: "Aplicație mobilă pentru raportare rapidă", description: "Dezvoltarea unei aplicații mobile companion pentru VeloCivic.", lat: 46.7712, lng: 23.5897, address: "Cluj-Napoca", status: "in_analiza" as ProposalStatus, createdAt: new Date("2026-03-02T12:00:00Z") },
  ];

  const proposals = [];
  for (const p of coreProposals) {
    const created = await prisma.proposal.create({
      data: {
        userId: p.userId,
        category: p.category,
        categoryLabel: p.categoryLabel,
        title: p.title,
        description: p.description,
        latitude: p.lat,
        longitude: p.lng,
        address: p.address,
        status: p.status,
        createdAt: p.createdAt,
      },
    });
    proposals.push(created);
  }

  // Generate 25 more proposals
  for (let i = 0; i < 25; i++) {
    const cat = randomItem(proposalCategories);
    const street = randomItem(streets);
    const hood = randomItem(neighborhoods);
    const titleTemplate = randomItem(proposalTitles);
    const title = titleTemplate.replace("{street}", street).replace("{neighborhood}", hood);

    const created = await prisma.proposal.create({
      data: {
        userId: randomItem(allCitizens).id,
        category: cat,
        categoryLabel: proposalCategoryLabels[cat],
        title,
        description: randomItem(proposalDescriptions),
        latitude: randomFloat(CLUJ_LAT.min, CLUJ_LAT.max),
        longitude: randomFloat(CLUJ_LNG.min, CLUJ_LNG.max),
        address: `${street}, Cluj-Napoca`,
        status: randomItem(proposalStatuses),
        createdAt: randomDate(new Date("2025-06-01"), new Date("2026-03-10")),
      },
    });
    proposals.push(created);
  }

  console.log(`  ✓ ${proposals.length} proposals created`);

  // ============================
  // Proposal Votes — lots of votes to make numbers realistic
  // ============================
  const voteData: { userId: string; proposalId: string; direction: number }[] = [];
  const voteSet = new Set<string>();

  for (const p of proposals) {
    const voteCount = randomInt(5, 40);
    for (let v = 0; v < voteCount; v++) {
      const voter = randomItem(allCitizens);
      const key = `${voter.id}-${p.id}`;
      if (voteSet.has(key)) continue;
      voteSet.add(key);
      voteData.push({
        userId: voter.id,
        proposalId: p.id,
        direction: Math.random() > 0.15 ? 1 : -1, // 85% upvotes
      });
    }
  }

  // Batch in chunks of 50
  for (let i = 0; i < voteData.length; i += 50) {
    await prisma.proposalVote.createMany({ data: voteData.slice(i, i + 50) });
  }

  console.log(`  ✓ ${voteData.length} proposal votes created`);

  // ============================
  // Projects
  // ============================
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        title: "Rețea ciclabilă centru Cluj-Napoca",
        description: "Proiect amplu de creare a unei rețele integrate de piste de biciclete în centrul istoric al Cluj-Napocii. Va include 12km de piste noi, 200 de locuri de parcare pentru biciclete și 15 intersecții cu semaforizare dedicată.",
        stage: "in_lucru",
        stageLabel: "În lucru",
        budget: "4.500.000 RON",
        timeline: "Iunie 2026 - Decembrie 2027",
        team: "Direcția Tehnică, Departamentul Transport",
        latitude: 46.7712,
        longitude: 23.5897,
        address: "Centrul Istoric, Cluj-Napoca",
        citizenEngagementScore: 87,
        createdAt: new Date("2025-06-01T10:00:00Z"),
      },
    }),
    prisma.project.create({
      data: {
        title: "Parcări inteligente pentru biciclete",
        description: "Instalarea a 50 de stații inteligente de parcare pentru biciclete în punctele cheie ale orașului. Fiecare stație va avea sistem de închidere electronic și monitorizare video.",
        stage: "aprobare",
        stageLabel: "Aprobare",
        budget: "1.200.000 RON",
        timeline: "Septembrie 2026 - Martie 2027",
        team: "Smart City Department",
        latitude: 46.7700,
        longitude: 23.5870,
        address: "Diverse locații, Cluj-Napoca",
        citizenEngagementScore: 72,
        createdAt: new Date("2025-12-15T10:00:00Z"),
      },
    }),
    prisma.project.create({
      data: {
        title: "Coridor verde Someș - de la Grigorescu la Expo",
        description: "Crearea unui coridor verde continuu pe ambele maluri ale Someșului, de la cartierul Grigorescu până la zona Expo Transilvania.",
        stage: "consultare_publica",
        stageLabel: "Consultare publică",
        budget: "8.900.000 RON",
        timeline: "2027 - 2029",
        team: "Arhitectul Șef, Direcția Mediu",
        latitude: 46.7730,
        longitude: 23.5780,
        address: "Malul Someșului, Cluj-Napoca",
        citizenEngagementScore: 94,
        createdAt: new Date("2025-09-01T10:00:00Z"),
      },
    }),
    prisma.project.create({
      data: {
        title: "Bike-sharing electric Cluj",
        description: "Lansarea unui sistem de bike-sharing cu biciclete electrice. 500 de biciclete în 80 de stații acoperind toate cartierele principale.",
        stage: "planificat",
        stageLabel: "Planificat",
        budget: "6.200.000 RON",
        timeline: "2027 - 2028",
        team: "Direcția Transport Public",
        latitude: 46.7712,
        longitude: 23.5897,
        address: "Cluj-Napoca",
        citizenEngagementScore: 96,
        createdAt: new Date("2026-01-15T10:00:00Z"),
      },
    }),
  ]);

  console.log(`  ✓ ${projects.length} projects created`);

  // ============================
  // Comments — on proposals and projects
  // ============================
  let commentCount = 0;

  // Comments on first 8 core proposals (2-5 each)
  for (let pi = 0; pi < Math.min(8, proposals.length); pi++) {
    const numComments = randomInt(2, 5);
    let parentId: string | null = null;

    for (let ci = 0; ci < numComments; ci++) {
      const commenter = randomItem(allCitizens);
      const c: { id: string } = await prisma.comment.create({
        data: {
          userId: commenter.id,
          proposalId: proposals[pi].id,
          parentId: ci > 0 && Math.random() > 0.5 ? parentId : null,
          content: randomItem(commentTexts),
          createdAt: randomDate(proposals[pi].createdAt, new Date("2026-03-10")),
        },
      });
      if (ci === 0) parentId = c.id;
      commentCount++;
    }
  }

  // Comments on generated proposals (1-3 each)
  for (let pi = 8; pi < proposals.length; pi++) {
    const numComments = randomInt(1, 3);
    for (let ci = 0; ci < numComments; ci++) {
      await prisma.comment.create({
        data: {
          userId: randomItem(allCitizens).id,
          proposalId: proposals[pi].id,
          content: randomItem(commentTexts),
          createdAt: randomDate(proposals[pi].createdAt, new Date("2026-03-10")),
        },
      });
      commentCount++;
    }
  }

  // Comments on projects (3-8 each)
  for (const proj of projects) {
    const numComments = randomInt(3, 8);
    let parentId: string | null = null;

    for (let ci = 0; ci < numComments; ci++) {
      const commenter = randomItem(allCitizens);
      const c: { id: string } = await prisma.comment.create({
        data: {
          userId: commenter.id,
          projectId: proj.id,
          parentId: ci > 0 && Math.random() > 0.6 ? parentId : null,
          content: randomItem(commentTexts),
          createdAt: randomDate(proj.createdAt, new Date("2026-03-10")),
        },
      });
      if (ci === 0) parentId = c.id;
      commentCount++;
    }
  }

  console.log(`  ✓ ${commentCount} comments created on proposals and projects`);

  // ============================
  // Project Follows & Likes — lots of them
  // ============================
  const followData: { userId: string; projectId: string }[] = [];
  const likeData: { userId: string; projectId: string }[] = [];
  const followSet = new Set<string>();
  const likeSet = new Set<string>();

  for (const proj of projects) {
    const followCount = randomInt(5, 18);
    const likeCount = randomInt(3, 15);

    for (let fi = 0; fi < followCount; fi++) {
      const u = randomItem(allCitizens);
      const key = `${u.id}-${proj.id}`;
      if (followSet.has(key)) continue;
      followSet.add(key);
      followData.push({ userId: u.id, projectId: proj.id });
    }

    for (let li = 0; li < likeCount; li++) {
      const u = randomItem(allCitizens);
      const key = `${u.id}-${proj.id}`;
      if (likeSet.has(key)) continue;
      likeSet.add(key);
      likeData.push({ userId: u.id, projectId: proj.id });
    }
  }

  // Ensure andrei follows/likes the first 2 projects
  for (let i = 0; i < 2; i++) {
    const fKey = `${andrei.id}-${projects[i].id}`;
    if (!followSet.has(fKey)) { followSet.add(fKey); followData.push({ userId: andrei.id, projectId: projects[i].id }); }
    const lKey = `${andrei.id}-${projects[i].id}`;
    if (!likeSet.has(lKey)) { likeSet.add(lKey); likeData.push({ userId: andrei.id, projectId: projects[i].id }); }
  }

  await prisma.projectFollow.createMany({ data: followData });
  await prisma.projectLike.createMany({ data: likeData });

  console.log(`  ✓ ${followData.length} project follows + ${likeData.length} project likes created`);

  // ============================
  // Notifications (for Andrei and Maria)
  // ============================
  await prisma.notification.createMany({
    data: [
      { userId: andrei.id, type: "report_update", title: "Raport actualizat", message: 'Raportul tău "SUV parcat pe pista de pe Calea Moților" este acum în analiză.', read: false, link: "/cetatean/feedback", createdAt: new Date("2026-03-10T09:00:00Z") },
      { userId: andrei.id, type: "proposal_vote", title: "Propunere votată", message: 'Propunerea ta "Pistă de biciclete pe Calea Turzii" a primit 5 voturi noi!', read: false, link: "/cetatean/propuneri", createdAt: new Date("2026-03-09T18:00:00Z") },
      { userId: andrei.id, type: "project_update", title: "Proiect actualizat", message: 'Proiectul "Rețea ciclabilă centru" a trecut în faza de execuție.', read: true, link: "/cetatean/proiecte", createdAt: new Date("2026-03-08T14:00:00Z") },
      { userId: andrei.id, type: "badge_earned", title: "Insignă nouă!", message: 'Felicitări! Ai obținut insigna "Explorator" — rapoarte din 5 cartiere diferite! 🗺️', read: true, createdAt: new Date("2026-01-20T10:00:00Z") },
      { userId: andrei.id, type: "system", title: "Bun venit la VeloCivic!", message: "Bine ai venit pe platforma VeloCivic. Începe prin a trimite primul tău raport!", read: true, createdAt: new Date("2025-09-15T10:00:00Z") },
      { userId: maria.id, type: "report_update", title: "Raport actualizat", message: 'Raportul tău "Lipsă iluminat pe tronsonul Parcul Central" este acum în lucru.', read: false, link: "/cetatean/feedback", createdAt: new Date("2026-03-09T10:00:00Z") },
      { userId: maria.id, type: "proposal_vote", title: "Propunere votată", message: 'Propunerea ta "Stații de biciclete securizate" a fost aprobată!', read: false, link: "/cetatean/propuneri", createdAt: new Date("2026-03-08T12:00:00Z") },
      { userId: maria.id, type: "system", title: "Bun venit la VeloCivic!", message: "Bine ai venit pe platforma VeloCivic!", read: true, createdAt: new Date("2025-10-20T10:00:00Z") },
    ],
  });

  console.log("  ✓ Notifications created");

  // ============================
  // Activities (for Andrei)
  // ============================
  await prisma.activity.createMany({
    data: [
      { userId: andrei.id, type: "report", description: 'Ai raportat "SUV parcat pe pista de pe Calea Moților"', link: "/cetatean/feedback", createdAt: new Date("2026-03-08T10:30:00Z") },
      { userId: andrei.id, type: "vote", description: 'Ai votat propunerea "Semafoare dedicate bicicliștilor pe Eroilor"', link: "/cetatean/propuneri", createdAt: new Date("2026-03-07T16:00:00Z") },
      { userId: andrei.id, type: "comment", description: 'Ai comentat la propunerea "Stații de biciclete securizate"', link: "/cetatean/propuneri", createdAt: new Date("2026-03-06T13:30:00Z") },
      { userId: andrei.id, type: "report", description: 'Raportul "Groapă mare pe strada Memorandumului" a fost trimis', link: "/cetatean/feedback", createdAt: new Date("2026-03-07T14:20:00Z") },
      { userId: andrei.id, type: "badge", description: 'Ai obținut insigna "Explorator" 🗺️', createdAt: new Date("2026-01-20T10:00:00Z") },
      { userId: andrei.id, type: "proposal", description: 'Ai trimis propunerea "Pistă de biciclete pe Calea Turzii"', link: "/cetatean/propuneri", createdAt: new Date("2026-03-01T10:00:00Z") },
      { userId: andrei.id, type: "report", description: 'Ai raportat "Suporturi biciclete ruginite la Universitate"', link: "/cetatean/feedback", createdAt: new Date("2026-03-04T12:15:00Z") },
      { userId: andrei.id, type: "vote", description: 'Ai votat propunerea "Coridor verde pe malul Someșului"', link: "/cetatean/propuneri", createdAt: new Date("2026-02-12T11:00:00Z") },
    ],
  });

  console.log("  ✓ Activities created");

  // ============================
  // Infrastructure Layers & Elements
  // ============================
  const layers = await Promise.all([
    prisma.infrastructureLayer.create({ data: { type: "heatmap_pericole", label: "Heatmap pericole", color: "#ef4444", icon: "🔴", isDefaultVisible: true } }),
    prisma.infrastructureLayer.create({ data: { type: "trafic_biciclete", label: "Trafic biciclete", color: "#f59e0b", icon: "🟡", isDefaultVisible: false } }),
    prisma.infrastructureLayer.create({ data: { type: "infrastructura", label: "Infrastructură existentă", color: "#a3e635", icon: "🟢", isDefaultVisible: true } }),
    prisma.infrastructureLayer.create({ data: { type: "proiecte", label: "Proiecte în desfășurare", color: "#00d4ff", icon: "🔵", isDefaultVisible: false } }),
    prisma.infrastructureLayer.create({ data: { type: "propuneri", label: "Propuneri cetățeni", color: "#a855f7", icon: "⭐", isDefaultVisible: false } }),
  ]);

  const infraLayerId = layers[2].id; // "infrastructura" layer for all elements

  await prisma.infrastructureElement.createMany({
    data: [
      { layerId: infraLayerId, type: "pista_biciclete", typeLabel: "Pistă biciclete", name: "Pista Eroilor - Memorandumului", geometry: { type: "LineString", coordinates: [[23.5870, 46.7700], [23.5880, 46.7695], [23.5897, 46.7712]] }, properties: { length_km: 1.2, surface: "asfalt", condition: "bun" } },
      { layerId: infraLayerId, type: "pista_biciclete", typeLabel: "Pistă biciclete", name: "Pista malul Someșului", geometry: { type: "LineString", coordinates: [[23.5750, 46.7735], [23.5780, 46.7730], [23.5850, 46.7720], [23.5900, 46.7715]] }, properties: { length_km: 3.5, surface: "asfalt", condition: "mediu" } },
      { layerId: infraLayerId, type: "pista_biciclete", typeLabel: "Pistă biciclete", name: "Pista Mănăștur - Centru", geometry: { type: "LineString", coordinates: [[23.5550, 46.7650], [23.5650, 46.7670], [23.5750, 46.7690], [23.5870, 46.7700]] }, properties: { length_km: 4.2, surface: "asfalt", condition: "bun" } },
      { layerId: infraLayerId, type: "pista_biciclete", typeLabel: "Pistă biciclete", name: "Pista Gheorgheni", geometry: { type: "LineString", coordinates: [[23.5960, 46.7712], [23.6000, 46.7700], [23.6050, 46.7680]] }, properties: { length_km: 2.1, surface: "beton", condition: "mediu" } },
      { layerId: infraLayerId, type: "parcare_biciclete", typeLabel: "Parcare biciclete", name: "Parcare UBB", geometry: { type: "Point", coordinates: [23.5910, 46.7670] }, properties: { capacity: 20, covered: false, locked: false } },
      { layerId: infraLayerId, type: "parcare_biciclete", typeLabel: "Parcare biciclete", name: "Parcare Piața Unirii", geometry: { type: "Point", coordinates: [23.5897, 46.7712] }, properties: { capacity: 30, covered: true, locked: true } },
      { layerId: infraLayerId, type: "parcare_biciclete", typeLabel: "Parcare biciclete", name: "Parcare Gara Cluj", geometry: { type: "Point", coordinates: [23.5940, 46.7810] }, properties: { capacity: 40, covered: true, locked: true } },
      { layerId: infraLayerId, type: "parcare_biciclete", typeLabel: "Parcare biciclete", name: "Parcare UTCN", geometry: { type: "Point", coordinates: [23.5880, 46.7695] }, properties: { capacity: 15, covered: false, locked: false } },
      { layerId: infraLayerId, type: "parcare_biciclete", typeLabel: "Parcare biciclete", name: "Parcare Iulius Mall", geometry: { type: "Point", coordinates: [23.5850, 46.7650] }, properties: { capacity: 50, covered: true, locked: true } },
      { layerId: infraLayerId, type: "semafor", typeLabel: "Semafor bicicliști", name: "Semafor Eroilor / Napoca", geometry: { type: "Point", coordinates: [23.5870, 46.7700] }, properties: { dedicated_cyclist: true, signal_time: 30 } },
      { layerId: infraLayerId, type: "semafor", typeLabel: "Semafor bicicliști", name: "Semafor Memorandumului / Eroilor", geometry: { type: "Point", coordinates: [23.5880, 46.7695] }, properties: { dedicated_cyclist: true, signal_time: 25 } },
      { layerId: infraLayerId, type: "semafor", typeLabel: "Semafor bicicliști", name: "Semafor 21 Decembrie / Horea", geometry: { type: "Point", coordinates: [23.5850, 46.7720] }, properties: { dedicated_cyclist: false, signal_time: 35 } },
      { layerId: infraLayerId, type: "zona_30", typeLabel: "Zonă 30 km/h", name: "Zona 30 - Centru Vechi", geometry: { type: "Polygon", coordinates: [[[23.5860, 46.7700], [23.5910, 46.7700], [23.5910, 46.7720], [23.5860, 46.7720], [23.5860, 46.7700]]] }, properties: { area_sqm: 50000 } },
      { layerId: infraLayerId, type: "zona_30", typeLabel: "Zonă 30 km/h", name: "Zona 30 - Universitate", geometry: { type: "Polygon", coordinates: [[[23.5890, 46.7660], [23.5930, 46.7660], [23.5930, 46.7680], [23.5890, 46.7680], [23.5890, 46.7660]]] }, properties: { area_sqm: 35000 } },
      { layerId: infraLayerId, type: "zona_pietonala", typeLabel: "Zonă pietonală", name: "Strada Republicii", geometry: { type: "LineString", coordinates: [[23.5920, 46.7710], [23.5935, 46.7715], [23.5950, 46.7718]] }, properties: { length_km: 0.4, bikes_allowed: true } },
      { layerId: infraLayerId, type: "zona_pietonala", typeLabel: "Zonă pietonală", name: "Piața Unirii", geometry: { type: "Polygon", coordinates: [[[23.5885, 46.7708], [23.5910, 46.7708], [23.5910, 46.7720], [23.5885, 46.7720], [23.5885, 46.7708]]] }, properties: { area_sqm: 12000, bikes_allowed: false } },
    ],
  });

  console.log("  ✓ 5 infrastructure layers + 16 elements created");

  // ============================
  // Simulation Scenarios
  // ============================
  await prisma.simulationScenario.createMany({
    data: [
      { name: "Piste complete centru", description: "Rețea completă de piste de biciclete în centrul Clujului", safetyScore: 92, coveragePercent: 78, conflictZones: 3, accessibilityScore: 88 },
      { name: "Parcare maximizată", description: "Maximizarea parcărilor de biciclete la nodurile de transport", safetyScore: 75, coveragePercent: 45, conflictZones: 12, accessibilityScore: 95 },
      { name: "Siguranță totală", description: "Toate intersecțiile cu semaforizare și bariere dedicate", safetyScore: 98, coveragePercent: 60, conflictZones: 1, accessibilityScore: 82 },
    ],
  });

  console.log("  ✓ 3 simulation scenarios created");

  console.log("\n✅ Seed complete!");
  console.log("\n📊 Summary:");
  console.log(`   ${allCitizens.length} citizens + 1 admin`);
  console.log(`   ${reportData.length} reports (~15% anonymous)`);
  console.log(`   ${proposals.length} proposals`);
  console.log(`   ${voteData.length} votes`);
  console.log(`   ${commentCount} comments`);
  console.log(`   ${projects.length} projects`);
  console.log(`   ${followData.length} follows + ${likeData.length} likes`);
  console.log("\n📋 Session tokens for testing:");
  console.log(`   Andrei (citizen): session-andrei-popescu`);
  console.log(`   Maria  (citizen): session-maria-ionescu`);
  console.log(`   Mihai  (citizen): session-mihai-dumitru`);
  console.log(`   Admin:            session-admin-cluj`);
  console.log(`\n   Use header: x-session-token: <token>`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
