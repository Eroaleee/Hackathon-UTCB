import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

/**
 * VeloCivic Seed — Real Sector 2 Bucharest cycling infrastructure data.
 * Reports placed at known problem intersections, proposals for real needs,
 * projects based on actual urban plans, infrastructure from real bike-lane map.
 */

async function main() {
  console.log("🌱 Seeding VeloCivic with real Sector 2 data...\n");

  // ==============================
  // 1. USERS
  // ==============================
  const adminPass = await bcrypt.hash("admin2026", 10);
  const citizenPass1 = await bcrypt.hash("andrei123", 10);
  const citizenPass2 = await bcrypt.hash("maria123", 10);
  const citizenPass3 = await bcrypt.hash("mihai123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@sector2.bucuresti.ro" },
    update: {},
    create: {
      nickname: "Admin Sector 2",
      email: "admin@sector2.bucuresti.ro",
      password: adminPass,
      role: "admin",
      neighborhood: "Sector 2",
      xp: 5000,
      level: 10,
      levelName: "Legendă Urbană",
    },
  });

  const andrei = await prisma.user.upsert({
    where: { email: "andrei.popescu@email.com" },
    update: {},
    create: {
      nickname: "Andrei Popescu",
      email: "andrei.popescu@email.com",
      password: citizenPass1,
      role: "cetatean",
      neighborhood: "Obor",
      xp: 1200,
      level: 3,
      levelName: "Activist Urban",
    },
  });

  const maria = await prisma.user.upsert({
    where: { email: "maria.ionescu@email.com" },
    update: {},
    create: {
      nickname: "Maria Ionescu",
      email: "maria.ionescu@email.com",
      password: citizenPass2,
      role: "cetatean",
      neighborhood: "Colentina",
      xp: 800,
      level: 2,
      levelName: "Biciclist Activ",
    },
  });

  const mihai = await prisma.user.upsert({
    where: { email: "mihai.dumitru@email.com" },
    update: {},
    create: {
      nickname: "Mihai Dumitru",
      email: "mihai.dumitru@email.com",
      password: citizenPass3,
      role: "cetatean",
      neighborhood: "Tei",
      xp: 600,
      level: 2,
      levelName: "Biciclist Activ",
    },
  });

  const users = [andrei, maria, mihai];

  // ==============================
  // 2. BADGES
  // ==============================
  const badgeData = [
    { name: "Primul Raport", description: "Ai trimis primul raport de incidente", icon: "📢" },
    { name: "Prima Propunere", description: "Ai creat prima propunere de infrastructură", icon: "💡" },
    { name: "Votant Activ", description: "Ai votat pentru 10 propuneri", icon: "🗳️" },
    { name: "Explorator Urban", description: "Ai raportat 5 incidente", icon: "🗺️" },
    { name: "Campion al Pistelor", description: "20 de rapoarte", icon: "🏆" },
    { name: "Comentator", description: "Ai scris 5 comentarii", icon: "💬" },
  ];
  const badges = [];
  for (const b of badgeData) {
    const badge = await prisma.badge.upsert({
      where: { name: b.name },
      update: { icon: b.icon },
      create: b,
    });
    badges.push(badge);
  }

  // Assign some badges
  for (const user of users) {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: user.id, badgeId: badges[0].id } },
      update: {},
      create: { userId: user.id, badgeId: badges[0].id },
    });
  }
  await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId: andrei.id, badgeId: badges[1].id } },
    update: {},
    create: { userId: andrei.id, badgeId: badges[1].id },
  });

  // ==============================
  // 3. REPORTS — Real problem locations in Sector 2
  // ==============================
  type RC = "masini_parcate" | "gropi" | "constructii" | "drum_blocat" | "interferenta_pietoni" | "obstacole" | "parcari_biciclete" | "iluminat" | "altele";
  type RS = "scazut" | "mediu" | "ridicat" | "critic";
  type RSt = "trimis" | "in_analiza" | "in_lucru" | "rezolvat" | "respins";

  const catLabel: Record<RC, string> = {
    masini_parcate: "Mașini parcate pe pistă",
    gropi: "Gropi / deteriorări",
    constructii: "Construcții blocante",
    drum_blocat: "Drum blocat",
    interferenta_pietoni: "Interferență cu pietonii",
    obstacole: "Obstacole pe drum",
    parcari_biciclete: "Parcări de biciclete",
    iluminat: "Iluminat insuficient",
    altele: "Altele",
  };

  const reportData: {
    category: RC;
    severity: RS;
    status: RSt;
    title: string;
    description: string;
    lat: number;
    lng: number;
    address: string;
    userId?: string;
  }[] = [
    // Obor area
    { category: "masini_parcate", severity: "critic", status: "trimis", title: "Mașini parcate pe pista de biciclete – Bd. Ferdinand", description: "Zilnic mașini ocupă pista de pe Bd. Ferdinand I, lângă Piața Obor, forțând bicicliștii pe carosabil.", lat: 44.4420, lng: 26.1210, address: "Bd. Ferdinand I / Piața Obor", userId: andrei.id },
    { category: "gropi", severity: "ridicat", status: "in_analiza", title: "Gropi pe Calea Moșilor", description: "Pavaj deteriorat grav pe Calea Moșilor între Bd. Carol I și Bd. Ferdinand. Pericol de cădere.", lat: 44.4340, lng: 26.1050, address: "Calea Moșilor 165", userId: maria.id },
    { category: "constructii", severity: "ridicat", status: "in_lucru", title: "Șantier nesemnalizat pe Șos. Colentina", description: "Șantier blocat pe 200m fără deviere semnalizată pentru bicicliști, lângă stația Doamna Ghica.", lat: 44.4560, lng: 26.1275, address: "Șos. Colentina / Doamna Ghica" },
    { category: "iluminat", severity: "mediu", status: "trimis", title: "Iluminat insuficient pe Bd. Lacul Tei", description: "Segmentul de pistă de pe Bd. Lacul Tei este complet neiluminat seara (între Circului și Tei).", lat: 44.4548, lng: 26.1120, address: "Bd. Lacul Tei 55", userId: mihai.id },
    { category: "masini_parcate", severity: "ridicat", status: "trimis", title: "Mașini pe pistă – Bd. Ștefan cel Mare", description: "Vehicule parcate regulat pe pista ciclabilă de pe Bd. Ștefan cel Mare, zona Cinema Scala.", lat: 44.4470, lng: 26.1000, address: "Bd. Ștefan cel Mare / Cinema Scala", userId: andrei.id },
    { category: "interferenta_pietoni", severity: "mediu", status: "in_analiza", title: "Pietoni pe pistă la Piața Obor", description: "Pista ciclabilă de la Piața Obor este folosită de pietoni datorită lipsei separatoarelor.", lat: 44.4430, lng: 26.1205, address: "Piața Obor – Intrare Bd. Ferdinand" },
    { category: "obstacole", severity: "mediu", status: "rezolvat", title: "Stâlpi metalici pe pistă – Str. Traian", description: "Stâlpi de protecție prost montați blochează partial pista pe Str. Traian.", lat: 44.4410, lng: 26.1050, address: "Str. Traian 120", userId: maria.id },
    { category: "gropi", severity: "critic", status: "trimis", title: "Cratere pe Șos. Pantelimon", description: "Gropi adânci pe Șos. Pantelimon, foarte periculos la pedalat noaptea. Lipsa totală de pistă.", lat: 44.4420, lng: 26.1400, address: "Șos. Pantelimon 250" },
    { category: "drum_blocat", severity: "ridicat", status: "in_lucru", title: "Drum blocat total – Str. Ziduri Moși", description: "Lucrări de canalizare au blocat complet strada, fără traseu alternativ pentru bicicliști.", lat: 44.4450, lng: 26.1185, address: "Str. Ziduri Moși 30", userId: andrei.id },
    { category: "parcari_biciclete", severity: "scazut", status: "trimis", title: "Lipsă rastel la Mega Image Colentina", description: "Niciun loc de parcare de biciclete la Mega Image de pe Șos. Colentina 120.", lat: 44.4520, lng: 26.1260, address: "Șos. Colentina 120", userId: mihai.id },
    // Tei / northern area
    { category: "masini_parcate", severity: "ridicat", status: "trimis", title: "Mașini pe pista Bd. Barbu Văcărescu", description: "Mașini parcate pe pista ciclabilă de lângă turnul de birouri Globalworth.", lat: 44.4600, lng: 26.0990, address: "Bd. Barbu Văcărescu 120" },
    { category: "iluminat", severity: "mediu", status: "in_analiza", title: "Lipsă iluminat Parc Plumbuita", description: "Aleile din Parcul Plumbuita sunt complet întunecate seara, deși sunt folosite de bicicliști.", lat: 44.4590, lng: 26.1300, address: "Parc Plumbuita – alee centrală", userId: maria.id },
    { category: "masini_parcate", severity: "mediu", status: "rezolvat", title: "Mașini parcate pe Str. Mihai Eminescu", description: "Vehiculele de livrare blochează regulat banda de biciclete pe Mihai Eminescu.", lat: 44.4430, lng: 26.1000, address: "Str. Mihai Eminescu 78", userId: andrei.id },
    { category: "constructii", severity: "mediu", status: "trimis", title: "Schele pe trotuar – Str. Vasile Lascăr", description: "Schele de construcție forțează bicicliștii pe carosabil pe porțiunea Vasile Lascăr.", lat: 44.4490, lng: 26.1070, address: "Str. Vasile Lascăr 28" },
    { category: "gropi", severity: "ridicat", status: "in_lucru", title: "Asfalt degradat pe Bd. Chișinău", description: "Multiple gropi pe Bd. Chișinău, zona Pantelimon – Delfinului. Pistă ciclabilă deteriorată.", lat: 44.4455, lng: 26.1360, address: "Bd. Chișinău / Pantelimon", userId: mihai.id },
    { category: "altele", severity: "scazut", status: "trimis", title: "Semnalizare lipsă la Piața Iancului", description: "Nicio semnalizare pentru bicicliști la intersecția Piața Iancului.", lat: 44.4420, lng: 26.1210, address: "Piața Iancului", userId: andrei.id },
    { category: "obstacole", severity: "ridicat", status: "trimis", title: "Gunoi pe pistă – Bd. Pierre de Coubertin", description: "Deșeuri de construcție aruncate pe pista de biciclete de pe Pierre de Coubertin.", lat: 44.4480, lng: 26.1250, address: "Bd. Pierre de Coubertin 12" },
    { category: "interferenta_pietoni", severity: "mediu", status: "trimis", title: "Pietoni pe aleea din Parcul Tei", description: "Aleea pentru bicicliști din Parcul Tei este constant blocată de pietoni și rulatori.", lat: 44.4555, lng: 26.1160, address: "Parcul Tei – alee centrală", userId: maria.id },
  ];

  const createdReports = [];
  for (let i = 0; i < reportData.length; i++) {
    const r = reportData[i];
    const daysAgo = Math.floor(Math.random() * 60) + 1;
    const report = await prisma.report.create({
      data: {
        userId: r.userId || null,
        category: r.category,
        categoryLabel: catLabel[r.category],
        severity: r.severity,
        status: r.status,
        title: r.title,
        description: r.description,
        latitude: r.lat,
        longitude: r.lng,
        address: r.address,
        seenCount: Math.floor(Math.random() * 30) + 1,
        createdAt: new Date(Date.now() - daysAgo * 86400000),
      },
    });
    createdReports.push(report);
  }
  console.log(`✅ Created ${createdReports.length} reports`);

  // ==============================
  // 4. PROPOSALS — Real citizen ideas for Sector 2
  // ==============================
  const proposalData: {
    category: "pista_noua" | "parcare_biciclete" | "siguranta" | "semaforizare" | "infrastructura_verde" | "altele";
    title: string;
    description: string;
    lat: number;
    lng: number;
    address: string;
    userId: string;
    geometry?: object;
  }[] = [
    {
      category: "pista_noua",
      title: "Pistă ciclabilă pe Șos. Pantelimon",
      description: "Propun o pistă ciclabilă dedicată pe Șos. Pantelimon, de la Piața Iancului până la intersecția cu Bd. Basarabia. Acest segment este extrem de periculos pentru bicicliști și este una din cele mai circulate artere din Sector 2.",
      lat: 44.4420, lng: 26.1400, address: "Șos. Pantelimon (Iancului - Basarabia)",
      userId: andrei.id,
    },
    {
      category: "pista_noua",
      title: "Pistă pe Calea Moșilor – completare rețea",
      description: "Legătură ciclabilă pe Calea Moșilor care ar conecta Piața Obor cu centrul orașului. Ar completa rețeaua existentă de pe Bd. Ferdinand și Bd. Ștefan cel Mare.",
      lat: 44.4340, lng: 26.1020, address: "Calea Moșilor (Obor - Universitate)",
      userId: maria.id,
    },
    {
      category: "parcare_biciclete",
      title: "Rastele la stația de metrou Piața Iancului",
      description: "10 rastele de biciclete securizate la intrarea stației de metrou Piața Iancului. Conectivitate intermodală critică.",
      lat: 44.4420, lng: 26.1210, address: "Metrou Piața Iancului", userId: mihai.id,
    },
    {
      category: "siguranta",
      title: "Separatoare pe pista Bd. Ferdinand",
      description: "Montarea separatoarelor fizice (stâlpișori flexibili) pe pista ciclabilă de pe Bd. Ferdinand I, pentru a preveni parcarea mașinilor pe pistă.",
      lat: 44.4380, lng: 26.1180, address: "Bd. Ferdinand I", userId: andrei.id,
    },
    {
      category: "semaforizare",
      title: "Semafor pentru bicicliști la Obor",
      description: "Semafor dedicat bicicliștilor la intersecția Bd. Ferdinand / Șos. Colentina / Piața Obor. Timpii actuali nu permit traversarea în siguranță.",
      lat: 44.4420, lng: 26.1210, address: "Intersecția Obor", userId: maria.id,
    },
    {
      category: "infrastructura_verde",
      title: "Coridor verde ciclabil Parcul Tei – Parcul Plumbuita",
      description: "Amenajarea unui coridor verde continuu care să lege Parcul Tei de Parcul Plumbuita, cu pistă ciclabilă, iluminat și spații verzi.",
      lat: 44.4570, lng: 26.1200, address: "Tei – Plumbuita",
      userId: mihai.id,
    },
    {
      category: "pista_noua",
      title: "Pistă ciclabilă pe Șos. Iancului",
      description: "Pistă dedicată pe Șos. Iancului de la intersecția cu Bd. Ferdinand până la Pantelimon. Ar conecta cartierul Iancului cu rețeaua existentă.",
      lat: 44.4470, lng: 26.1280, address: "Șos. Iancului",
      userId: andrei.id,
    },
    {
      category: "parcare_biciclete",
      title: "Bike parking securizat la Mega Image Colentina",
      description: "Rastele acoperite și securizate la supermarket-ul Mega Image de pe Șos. Colentina 120.",
      lat: 44.4520, lng: 26.1260, address: "Mega Image – Șos. Colentina 120", userId: maria.id,
    },
  ];

  const createdProposals = [];
  for (const p of proposalData) {
    const daysAgo = Math.floor(Math.random() * 90) + 5;
    const proposal = await prisma.proposal.create({
      data: {
        userId: p.userId,
        category: p.category,
        categoryLabel: {
          pista_noua: "Pistă nouă",
          parcare_biciclete: "Parcare biciclete",
          siguranta: "Siguranță rutieră",
          semaforizare: "Semaforizare",
          infrastructura_verde: "Infrastructură verde",
          altele: "Altele",
        }[p.category],
        title: p.title,
        description: p.description,
        latitude: p.lat,
        longitude: p.lng,
        address: p.address,
        geometry: p.geometry || Prisma.JsonNull,
        createdAt: new Date(Date.now() - daysAgo * 86400000),
      },
    });
    createdProposals.push(proposal);
  }

  // Add votes
  for (const proposal of createdProposals) {
    for (const user of users) {
      if (Math.random() > 0.3) {
        await prisma.proposalVote.create({
          data: { userId: user.id, proposalId: proposal.id, direction: 1 },
        }).catch(() => {});
      }
    }
  }
  console.log(`✅ Created ${createdProposals.length} proposals with votes`);

  // ==============================
  // 5. PROJECTS — Sector 2 cycling projects
  // ==============================
  const stageLabels: Record<string, string> = {
    planificat: "Planificat",
    proiectare: "Proiectare",
    simulare: "Simulare",
    testare: "Testare",
    consultare_publica: "Consultare publică",
    aprobare: "Aprobare",
    in_lucru: "În lucru",
    finalizat: "Finalizat",
  };

  const projectData = [
    {
      title: "Rețeaua Ciclabilă Sector 2 – Faza I",
      description: "Extinderea rețelei de piste ciclabile pe Bd. Ferdinand, Bd. Ștefan cel Mare și Bd. Lacul Tei. Include 12 km de pistă nouă cu separatoare, semnalizare dedicată și iluminat LED.",
      stage: "in_lucru" as const,
      projectType: "pista_biciclete" as const,
      budget: "4.200.000 RON",
      timeline: "Mar 2025 – Dec 2025",
      team: "Primăria Sector 2 / DT Infrastructură",
      startDate: new Date("2025-03-01"),
      endDate: new Date("2025-12-31"),
      workingHours: "Luni-Vineri 07:00-19:00",
      lat: 44.4470, lng: 26.1100,
      address: "Sector 2 – axe principale",
      geometry: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "LineString", coordinates: [[26.1180, 44.4310], [26.1180, 44.4380], [26.1210, 44.4420], [26.1200, 44.4500]] }, properties: { name: "Pistă Bd. Ferdinand", roadType: "bike_lane" } },
          { type: "Feature", geometry: { type: "LineString", coordinates: [[26.1000, 44.4470], [26.1050, 44.4500], [26.1100, 44.4520]] }, properties: { name: "Pistă Bd. Ștefan cel Mare", roadType: "bike_lane" } },
        ],
      },
    },
    {
      title: "Coridorul Verde Tei – Plumbuita",
      description: "Amenajarea unui coridor verde ciclabil care unește Parcul Tei cu Parcul Plumbuita: 3.5 km de alei reabilitate, 200 de arbori plantați, iluminat solar, 8 rastele securizate.",
      stage: "consultare_publica" as const,
      projectType: "coridor_verde" as const,
      budget: "2.800.000 RON",
      timeline: "Ian 2026 – Sep 2026",
      team: "Primăria Sector 2 / Direcția Spații Verzi",
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-09-30"),
      workingHours: "Luni-Sâmbătă 08:00-18:00",
      lat: 44.4570, lng: 26.1200,
      address: "Parc Tei – Parc Plumbuita",
      geometry: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "LineString", coordinates: [[26.1160, 44.4555], [26.1180, 44.4570], [26.1220, 44.4580], [26.1280, 44.4590], [26.1300, 44.4590]] }, properties: { name: "Coridor Tei-Plumbuita", roadType: "bike_lane" } },
        ],
      },
    },
    {
      title: "Pistă Ciclabilă Șos. Pantelimon",
      description: "4.2 km de pistă ciclabilă dedicată pe Șos. Pantelimon (Iancului – Bd. Basarabia). Include redesign-ul complet al profilului stradal cu separare fizică auto/biciclete/pietoni.",
      stage: "proiectare" as const,
      projectType: "pista_biciclete" as const,
      budget: "6.100.000 RON",
      timeline: "2026 – 2027",
      lat: 44.4425, lng: 26.1350,
      address: "Șos. Pantelimon",
      geometry: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "LineString", coordinates: [[26.1210, 44.4420], [26.1280, 44.4420], [26.1350, 44.4425], [26.1400, 44.4425], [26.1450, 44.4430]] }, properties: { name: "Pistă Șos. Pantelimon", roadType: "bike_lane" } },
        ],
      },
    },
    {
      title: "Semaforizare Inteligentă Intersecții Sector 2",
      description: "Instalarea de semafoare dedicate bicicliștilor la 15 intersecții cheie din Sector 2, cu detectori de prezență și timpi optimizați.",
      stage: "simulare" as const,
      projectType: "semaforizare" as const,
      budget: "1.500.000 RON",
      timeline: "Q3 2026 – Q1 2027",
      lat: 44.4420, lng: 26.1210,
      address: "Sector 2 – intersecții principale",
      geometry: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "Point", coordinates: [26.1210, 44.4420] }, properties: { name: "Semafor Obor", type: "semafor" } },
          { type: "Feature", geometry: { type: "Point", coordinates: [26.1050, 44.4500] }, properties: { name: "Semafor Ștefan cel Mare", type: "semafor" } },
          { type: "Feature", geometry: { type: "Point", coordinates: [26.1280, 44.4470] }, properties: { name: "Semafor Iancului", type: "semafor" } },
        ],
      },
    },
    {
      title: "Parcări Securizate la Stații de Metrou",
      description: "Amenajarea a 6 parcări securizate de biciclete la stațiile de metrou din Sector 2: Piața Iancului, Obor, Piața Muncii, Ștefan cel Mare, Costin Georgian, Pantelimon.",
      stage: "testare" as const,
      projectType: "parcare_biciclete" as const,
      budget: "980.000 RON",
      timeline: "Q2 2026 – Q4 2026",
      team: "Primăria Sector 2 / Metrorex",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-12-31"),
      workingHours: "Luni-Vineri 08:00-16:00",
      lat: 44.4420, lng: 26.1210,
      address: "Stații metrou Sector 2",
      simulationResults: { safetyScore: 72, coveragePercent: 45, conflictZones: 3, accessibilityScore: 68 },
      geometry: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "Point", coordinates: [26.1210, 44.4420] }, properties: { name: "Parcare Iancului", type: "parcare_biciclete", capacity: 20 } },
          { type: "Feature", geometry: { type: "Point", coordinates: [26.1215, 44.4415] }, properties: { name: "Parcare Obor", type: "parcare_biciclete", capacity: 15 } },
          { type: "Feature", geometry: { type: "Point", coordinates: [26.1050, 44.4500] }, properties: { name: "Parcare Ștefan cel Mare", type: "parcare_biciclete", capacity: 12 } },
        ],
      },
    },
    {
      title: "Zona 30 – Cartierul Tei",
      description: "Implementarea unei zone cu limita de 30 km/h în cartierul Tei, cu semnalizare completă, limitatoare de viteză și marcaje speciale pentru bicicliști.",
      stage: "planificat" as const,
      projectType: "zona_30" as const,
      timeline: "2027",
      lat: 44.4555, lng: 26.1160,
      address: "Cartierul Tei",
      geometry: {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: { type: "Polygon", coordinates: [[[26.1100, 44.4530], [26.1220, 44.4530], [26.1220, 44.4580], [26.1100, 44.4580], [26.1100, 44.4530]]] }, properties: { name: "Zona 30 Tei" } },
        ],
      },
    },
  ];

  for (const p of projectData) {
    await prisma.project.create({
      data: {
        title: p.title,
        description: p.description,
        stage: p.stage,
        stageLabel: stageLabels[p.stage],
        projectType: p.projectType || "infrastructura_mixta",
        budget: p.budget || null,
        timeline: p.timeline,
        team: p.team || null,
        startDate: p.startDate || null,
        endDate: p.endDate || null,
        workingHours: p.workingHours || null,
        latitude: p.lat,
        longitude: p.lng,
        address: p.address,
        geometry: p.geometry || Prisma.JsonNull,
        simulationResults: (p as any).simulationResults || Prisma.JsonNull,
      },
    });
  }
  console.log(`✅ Created ${projectData.length} projects`);

  // ==============================
  // 6. INFRASTRUCTURE LAYERS & ELEMENTS — from GeoJSON bike lane data
  // ==============================
  await prisma.infrastructureElement.deleteMany();
  await prisma.infrastructureLayer.deleteMany();

  const layerData = [
    { type: "pista_biciclete",    label: "Piste existente (principale)",   color: "#22c55e", icon: "🚲", isDefaultVisible: true },
    { type: "parcare_biciclete",  label: "Rute propuse (principale)",      color: "#3b82f6", icon: "🗺️", isDefaultVisible: true },
    { type: "semafor",            label: "Piste PNRR (secundare)",         color: "#f59e0b", icon: "🏗️", isDefaultVisible: true },
    { type: "zona_30",            label: "Piste planificate (secundare)",  color: "#a855f7", icon: "📋", isDefaultVisible: true },
    { type: "zona_pietonala",     label: "Zone pietonale",                 color: "#34d399", icon: "🚶", isDefaultVisible: false },
  ];

  const layerMap: Record<string, string> = {};
  for (const l of layerData) {
    const layer = await prisma.infrastructureLayer.create({ data: l });
    layerMap[l.type] = layer.id;
  }

  // Load GeoJSON files
  const principaleRaw = fs.readFileSync(path.resolve(__dirname, "../../frontend/public/data/principale.geojson"), "utf-8");
  const secundareRaw = fs.readFileSync(path.resolve(__dirname, "../../frontend/public/data/secundare.geojson"), "utf-8");
  const principale = JSON.parse(principaleRaw);
  const secundare = JSON.parse(secundareRaw);

  let infraCount = 0;

  // Principale — Existent=1 → green layer (pista_biciclete), Existent=0 → blue layer (parcare_biciclete)
  for (const feat of principale.features) {
    const isExisting = feat.properties.Existent === 1;
    const layerType = isExisting ? "pista_biciclete" : "parcare_biciclete";
    const typeLabel = isExisting ? "Pistă existentă" : "Rută propusă";
    await prisma.infrastructureElement.create({
      data: {
        layerId: layerMap[layerType],
        type: layerType as any,
        typeLabel,
        name: feat.properties.name,
        geometry: feat.geometry,
        properties: { length_km: feat.properties.Lungime, sector: feat.properties.SECTOR },
      },
    });
    infraCount++;
  }

  // Secundare — PNRR=1 → orange layer (semafor), PNRR=0 → purple layer (zona_30)
  for (const feat of secundare.features) {
    const isPNRR = feat.properties.PNRR === 1;
    const layerType = isPNRR ? "semafor" : "zona_30";
    const typeLabel = isPNRR ? "Pistă PNRR" : "Pistă planificată";
    await prisma.infrastructureElement.create({
      data: {
        layerId: layerMap[layerType],
        type: layerType as any,
        typeLabel,
        name: feat.properties.name,
        geometry: feat.geometry,
        properties: { length_km: feat.properties.Lungime, pnrr: feat.properties.PNRR },
      },
    });
    infraCount++;
  }

  console.log(`✅ Created ${infraCount} infrastructure elements from GeoJSON (4 layers)`);

  // ==============================
  // 7. NOTIFICATIONS & ACTIVITIES
  // ==============================
  for (const user of users) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Bine ai venit pe VeloCivic!",
        message: "Platforma ta pentru o infrastructură ciclabilă mai bună în Sector 2.",
        read: false,
      },
    });
    await prisma.activity.create({
      data: {
        userId: user.id,
        type: "report",
        description: `${user.nickname} s-a alăturat comunității VeloCivic`,
      },
    });
  }
  console.log(`✅ Created notifications & activities`);

  // ==============================
  // 8. ROAD NETWORK — Dense Sector 2 coverage for OSRM road-type matching
  // ==============================
  await prisma.roadSegment.deleteMany();
  await prisma.roadNode.deleteMany();

  // High-precision intersection nodes covering major Sector 2 streets
  const roadNodes = [
    // Core intersections
    { id: "n_obor",                lat: 44.44195, lng: 26.12155, name: "Piața Obor" },
    { id: "n_ferdinand_traian",    lat: 44.43098, lng: 26.11197, name: "Ferdinand / Traian" },
    { id: "n_stefan_liz",          lat: 44.44925, lng: 26.10498, name: "Ștefan cel Mare / Lizeanu" },
    { id: "n_stefan_dacia",        lat: 44.44550, lng: 26.09990, name: "Ștefan cel Mare / Dacia" },
    { id: "n_stefan_obor",         lat: 44.44300, lng: 26.11250, name: "Ștefan cel Mare / Obor" },
    { id: "n_lacul_tei_n",         lat: 44.46050, lng: 26.11735, name: "Lacul Tei Nord (Electronicii)" },
    { id: "n_lacul_tei_s",         lat: 44.44840, lng: 26.11800, name: "Bd. Lacul Tei / Obor" },
    { id: "n_lacul_tei_mid",       lat: 44.45400, lng: 26.11760, name: "Bd. Lacul Tei (Mijloc)" },
    { id: "n_colentina_obor",      lat: 44.44450, lng: 26.12600, name: "Colentina / Obor" },
    { id: "n_colentina_doamna",    lat: 44.45550, lng: 26.12850, name: "Colentina / Doamna Ghica" },
    { id: "n_colentina_fundeni",   lat: 44.46500, lng: 26.13200, name: "Colentina / Fundeni" },
    { id: "n_colentina_plumbuita", lat: 44.45050, lng: 26.12750, name: "Colentina / Plumbuita" },
    { id: "n_barbu_v_n",           lat: 44.46050, lng: 26.09920, name: "Barbu Văcărescu Nord" },
    { id: "n_barbu_v_s",           lat: 44.45200, lng: 26.10250, name: "Barbu Văcărescu Sud" },
    { id: "n_doamna_ghica",        lat: 44.45610, lng: 26.11020, name: "Doamna Ghica" },
    { id: "n_pantelimon_obor",     lat: 44.44000, lng: 26.12700, name: "Pantelimon / Obor" },
    { id: "n_pantelimon_delfinului",lat: 44.43500, lng: 26.13200, name: "Pantelimon / Delfinului" },
    { id: "n_pantelimon_n",        lat: 44.44500, lng: 26.14000, name: "Pantelimon Nord" },
    { id: "n_iancului",            lat: 44.43680, lng: 26.12020, name: "Piața Iancului" },
    { id: "n_mosilor_carol",       lat: 44.43300, lng: 26.10600, name: "Calea Moșilor / Carol" },
    { id: "n_tei_parc_n",          lat: 44.45650, lng: 26.11550, name: "Parc Plumbuita Nord" },
    { id: "n_tei_parc_s",          lat: 44.45150, lng: 26.11600, name: "Parc Plumbuita Sud" },
    { id: "n_fundeni",             lat: 44.47000, lng: 26.13500, name: "Fundeni" },
    { id: "n_eminescu_dacia",      lat: 44.44450, lng: 26.09600, name: "Eminescu / Dacia" },
    { id: "n_carol_mosilor",       lat: 44.43200, lng: 26.10100, name: "Carol I / Moșilor" },
    { id: "n_universitate",        lat: 44.43560, lng: 26.10250, name: "Universitate" },
    { id: "n_romana",              lat: 44.44680, lng: 26.09720, name: "Piața Romană" },
    { id: "n_dacia_eminescu",      lat: 44.44280, lng: 26.09420, name: "Bd. Dacia / Eminescu" },
    { id: "n_mihai_bravu_obor",    lat: 44.44100, lng: 26.12500, name: "Mihai Bravu / Obor" },
    { id: "n_mihai_bravu_iancului",lat: 44.43600, lng: 26.12500, name: "Mihai Bravu / Iancului" },
    { id: "n_mihai_bravu_dristor", lat: 44.42800, lng: 26.12300, name: "Mihai Bravu / Dristor" },
    { id: "n_tei_vergului",        lat: 44.45700, lng: 26.12200, name: "Tei / Vergului" },
    { id: "n_circului",            lat: 44.44700, lng: 26.11400, name: "Str. Circului" },
    { id: "n_maica_domnului",      lat: 44.45800, lng: 26.10500, name: "Maica Domnului" },
    { id: "n_petricani",           lat: 44.47200, lng: 26.11800, name: "Petricani" },
    { id: "n_pipera_barbu",        lat: 44.46700, lng: 26.10200, name: "Pipera / Barbu Văcărescu" },
  ];

  for (const node of roadNodes) {
    await prisma.roadNode.create({
      data: { id: node.id, latitude: node.lat, longitude: node.lng, name: node.name },
    });
  }
  console.log(`✅ Created ${roadNodes.length} road nodes`);

  // Dense road segments — categorized for OSRM route matching
  const roadSegments = [
    // ═══ BIKE LANES (Pistă ciclabilă) ═══
    { from: "n_lacul_tei_s", to: "n_lacul_tei_mid", name: "Pistă Bd. Lacul Tei (S)", type: "bike_lane", safety: 75, traffic: 0.2, speed: 30 },
    { from: "n_lacul_tei_mid", to: "n_lacul_tei_n", name: "Pistă Bd. Lacul Tei (N)", type: "bike_lane", safety: 75, traffic: 0.2, speed: 30 },
    { from: "n_stefan_liz", to: "n_doamna_ghica", name: "Pistă Ștefan cel Mare (N)", type: "bike_lane", safety: 65, traffic: 0.3, speed: 30 },
    { from: "n_stefan_obor", to: "n_stefan_liz", name: "Pistă Ștefan cel Mare (Obor-Liz)", type: "bike_lane", safety: 60, traffic: 0.4, speed: 30 },
    { from: "n_doamna_ghica", to: "n_tei_parc_n", name: "Aleea Tei - pistă", type: "bike_lane", safety: 80, traffic: 0.1, speed: 20 },
    { from: "n_tei_parc_n", to: "n_lacul_tei_n", name: "Aleea Lacul Tei - pistă", type: "bike_lane", safety: 85, traffic: 0.05, speed: 20 },
    { from: "n_tei_parc_s", to: "n_tei_parc_n", name: "Parc Plumbuita - pistă", type: "bike_lane", safety: 90, traffic: 0.05, speed: 15 },
    { from: "n_barbu_v_n", to: "n_pipera_barbu", name: "Pistă Barbu Văcărescu (N)", type: "bike_lane", safety: 70, traffic: 0.15, speed: 25 },
    { from: "n_maica_domnului", to: "n_barbu_v_n", name: "Pistă Maica Domnului", type: "bike_lane", safety: 72, traffic: 0.2, speed: 25 },

    // ═══ SHARED ROADS (Bandă partajată) ═══
    { from: "n_obor", to: "n_iancului", name: "Str. Zece Mese", type: "shared", safety: 50, traffic: 0.5, speed: 50 },
    { from: "n_iancului", to: "n_ferdinand_traian", name: "Calea Călărașilor", type: "shared", safety: 40, traffic: 0.7, speed: 50 },
    { from: "n_doamna_ghica", to: "n_barbu_v_n", name: "Bd. Barbu Văcărescu (S)", type: "shared", safety: 45, traffic: 0.5, speed: 50 },
    { from: "n_barbu_v_s", to: "n_doamna_ghica", name: "Bd. Barbu Văcărescu (mijloc)", type: "shared", safety: 45, traffic: 0.5, speed: 50 },
    { from: "n_lacul_tei_s", to: "n_obor", name: "Bd. Lacul Tei (S)", type: "shared", safety: 50, traffic: 0.6, speed: 50 },
    { from: "n_barbu_v_n", to: "n_lacul_tei_n", name: "Legătură Barbu V. → Lacul Tei", type: "shared", safety: 55, traffic: 0.4, speed: 40 },
    { from: "n_circului", to: "n_lacul_tei_s", name: "Str. Circului", type: "shared", safety: 48, traffic: 0.5, speed: 40 },
    { from: "n_stefan_obor", to: "n_circului", name: "Str. Vasile Lascăr", type: "shared", safety: 50, traffic: 0.4, speed: 40 },
    { from: "n_universitate", to: "n_carol_mosilor", name: "Bd. Carol I", type: "shared", safety: 42, traffic: 0.6, speed: 50 },
    { from: "n_eminescu_dacia", to: "n_romana", name: "Bd. Dacia", type: "shared", safety: 40, traffic: 0.6, speed: 50 },
    { from: "n_stefan_dacia", to: "n_eminescu_dacia", name: "Str. Eminescu (S)", type: "shared", safety: 45, traffic: 0.5, speed: 40 },
    { from: "n_romana", to: "n_stefan_dacia", name: "Str. Eminescu (N)", type: "shared", safety: 45, traffic: 0.5, speed: 40 },
    { from: "n_tei_vergului", to: "n_colentina_doamna", name: "Str. Vergului", type: "shared", safety: 50, traffic: 0.4, speed: 40 },
    { from: "n_lacul_tei_mid", to: "n_tei_vergului", name: "Str. Tei → Vergului", type: "shared", safety: 50, traffic: 0.4, speed: 40 },
    { from: "n_maica_domnului", to: "n_doamna_ghica", name: "Str. Maica Domnului → Ghica", type: "shared", safety: 48, traffic: 0.5, speed: 40 },
    { from: "n_lacul_tei_n", to: "n_petricani", name: "Bd. Lacul Tei → Petricani", type: "shared", safety: 45, traffic: 0.5, speed: 50 },

    // ═══ CAR ONLY (Drum auto — zona periculoasă) ═══
    { from: "n_ferdinand_traian", to: "n_mosilor_carol", name: "Bd. Ferdinand", type: "car_only", safety: 35, traffic: 0.8, speed: 50 },
    { from: "n_mosilor_carol", to: "n_stefan_liz", name: "Calea Moșilor → Ștefan cel Mare", type: "car_only", safety: 40, traffic: 0.7, speed: 50 },
    { from: "n_colentina_obor", to: "n_colentina_plumbuita", name: "Calea Colentina (S)", type: "car_only", safety: 25, traffic: 0.8, speed: 50 },
    { from: "n_colentina_plumbuita", to: "n_colentina_doamna", name: "Calea Colentina (mijloc)", type: "car_only", safety: 28, traffic: 0.7, speed: 50 },
    { from: "n_colentina_doamna", to: "n_colentina_fundeni", name: "Calea Colentina (N)", type: "car_only", safety: 30, traffic: 0.7, speed: 50 },
    { from: "n_colentina_fundeni", to: "n_fundeni", name: "Colentina → Fundeni", type: "car_only", safety: 25, traffic: 0.6, speed: 60 },
    { from: "n_obor", to: "n_pantelimon_obor", name: "Șos. Pantelimon (de la Obor)", type: "car_only", safety: 20, traffic: 0.9, speed: 50 },
    { from: "n_pantelimon_obor", to: "n_pantelimon_delfinului", name: "Șos. Pantelimon (S)", type: "car_only", safety: 20, traffic: 0.9, speed: 50 },
    { from: "n_pantelimon_delfinului", to: "n_pantelimon_n", name: "Șos. Pantelimon (N)", type: "car_only", safety: 22, traffic: 0.8, speed: 50 },
    { from: "n_obor", to: "n_mihai_bravu_obor", name: "Șos. Mihai Bravu (N)", type: "car_only", safety: 25, traffic: 0.8, speed: 50 },
    { from: "n_mihai_bravu_obor", to: "n_mihai_bravu_iancului", name: "Șos. Mihai Bravu (mijloc)", type: "car_only", safety: 25, traffic: 0.85, speed: 50 },
    { from: "n_mihai_bravu_iancului", to: "n_mihai_bravu_dristor", name: "Șos. Mihai Bravu (S)", type: "car_only", safety: 22, traffic: 0.9, speed: 50 },
    { from: "n_obor", to: "n_colentina_obor", name: "Piața Obor → Colentina", type: "car_only", safety: 28, traffic: 0.7, speed: 40 },
    { from: "n_colentina_plumbuita", to: "n_pantelimon_n", name: "Str. Transversală Col-Pant", type: "car_only", safety: 35, traffic: 0.5, speed: 40 },
    { from: "n_petricani", to: "n_fundeni", name: "Petricani → Fundeni", type: "car_only", safety: 30, traffic: 0.6, speed: 50 },
    { from: "n_carol_mosilor", to: "n_universitate", name: "Bd. Carol I (E)", type: "car_only", safety: 38, traffic: 0.7, speed: 50 },
    { from: "n_stefan_dacia", to: "n_stefan_obor", name: "Bd. Ștefan cel Mare (S)", type: "car_only", safety: 35, traffic: 0.8, speed: 50 },

    // ═══ PEDESTRIAN (Zonă pietonală) ═══
    { from: "n_tei_parc_s", to: "n_lacul_tei_s", name: "Parc Plumbuita (S)", type: "pedestrian", safety: 95, traffic: 0, speed: 15 },
    { from: "n_tei_parc_n", to: "n_tei_vergului", name: "Parc Plumbuita (E)", type: "pedestrian", safety: 92, traffic: 0, speed: 15 },
    { from: "n_lacul_tei_mid", to: "n_tei_parc_s", name: "Parc Lacul Tei", type: "pedestrian", safety: 90, traffic: 0, speed: 15 },
  ];

  for (const seg of roadSegments) {
    const fromNode = roadNodes.find((n) => n.id === seg.from)!;
    const toNode = roadNodes.find((n) => n.id === seg.to)!;
    const R = 6371000;
    const dLat = ((toNode.lat - fromNode.lat) * Math.PI) / 180;
    const dLng = ((toNode.lng - fromNode.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((fromNode.lat * Math.PI) / 180) * Math.cos((toNode.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const length = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    await prisma.roadSegment.create({
      data: {
        fromNodeId: seg.from,
        toNodeId: seg.to,
        name: seg.name,
        length,
        roadType: seg.type,
        speedLimit: seg.speed,
        trafficLoad: seg.traffic,
        safetyScore: seg.safety,
        geometry: {
          type: "LineString",
          coordinates: [[fromNode.lng, fromNode.lat], [toNode.lng, toNode.lat]],
        },
      },
    });
  }
  console.log(`✅ Created ${roadSegments.length} road segments (${roadNodes.length} nodes)`);

  // ==============================
  // 9. TRANSIT DATA — Import from INFO GTFS files
  // ==============================
  const infoDir = path.resolve(__dirname, "../../INFO");

  function parseCsv(filePath: string): Record<string, string>[] {
    if (!fs.existsSync(filePath)) { console.log(`  ⚠️ File not found: ${filePath}`); return []; }
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
        current += ch;
      }
      values.push(current.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ""; });
      return obj;
    });
  }

  // Sector 2 generous bounding box
  const BOUNDS = { minLat: 44.41, maxLat: 44.49, minLng: 26.08, maxLng: 26.20 };
  const inBounds = (lat: number, lng: number) =>
    lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

  // 9a. Transit Stops
  const stopRows = parseCsv(path.join(infoDir, "stops.txt"));
  const transitStops = stopRows
    .filter((r) => {
      const lat = parseFloat(r.stop_lat);
      const lng = parseFloat(r.stop_lon);
      return !isNaN(lat) && !isNaN(lng) && inBounds(lat, lng);
    })
    .map((r) => ({
      id: r.stop_id,
      name: r.stop_name,
      latitude: parseFloat(r.stop_lat),
      longitude: parseFloat(r.stop_lon),
      type: parseInt(r.location_type || "0") || 0,
      parentId: r.parent_station || null,
    }));

  for (const stop of transitStops) {
    await prisma.transitStop.upsert({
      where: { id: stop.id },
      update: { name: stop.name, latitude: stop.latitude, longitude: stop.longitude, type: stop.type, parentId: stop.parentId },
      create: stop,
    });
  }
  console.log(`✅ Imported ${transitStops.length} transit stops`);

  // 9b. Transit Routes
  const routeRows = parseCsv(path.join(infoDir, "routes.txt"));
  const transitRoutes = routeRows.map((r) => ({
    id: r.route_id,
    shortName: r.route_short_name || "",
    longName: r.route_long_name || "",
    type: parseInt(r.route_type || "3"),
    color: r.route_color ? `#${r.route_color}` : "",
    agencyId: r.agency_id || "",
  }));

  for (const route of transitRoutes) {
    await prisma.transitRoute.upsert({
      where: { id: route.id },
      update: route,
      create: route,
    });
  }
  console.log(`✅ Imported ${transitRoutes.length} transit routes`);

  // 9c. Transit Shapes (filter to Sector 2)
  const shapeRows = parseCsv(path.join(infoDir, "shapes.txt"));
  const shapeGroups = new Map<string, { lat: number; lng: number; seq: number }[]>();
  for (const r of shapeRows) {
    const lat = parseFloat(r.shape_pt_lat);
    const lng = parseFloat(r.shape_pt_lon);
    if (isNaN(lat) || isNaN(lng)) continue;
    const id = r.shape_id;
    if (!shapeGroups.has(id)) shapeGroups.set(id, []);
    shapeGroups.get(id)!.push({ lat, lng, seq: parseInt(r.shape_pt_sequence || "0") });
  }

  let shapeCount = 0;
  for (const [shapeId, points] of shapeGroups) {
    points.sort((a, b) => a.seq - b.seq);
    const hasPointInBounds = points.some((p) => inBounds(p.lat, p.lng));
    if (!hasPointInBounds) continue;

    const geometry = {
      type: "LineString",
      coordinates: points.map((p) => [p.lng, p.lat]),
    };

    const existing = await prisma.transitShape.findFirst({ where: { shapeId } });
    if (!existing) {
      await prisma.transitShape.create({ data: { shapeId, geometry } });
      shapeCount++;
    }
  }
  console.log(`✅ Imported ${shapeCount} transit shapes`);

  // 9d. Link shapes to routes via trips.txt
  const tripsRows = parseCsv(path.join(infoDir, "trips.txt"));
  const shapeRouteMap = new Map<string, string>();
  for (const r of tripsRows) {
    if (r.shape_id && r.route_id && !shapeRouteMap.has(r.shape_id)) {
      shapeRouteMap.set(r.shape_id, r.route_id);
    }
  }

  const allShapes = await prisma.transitShape.findMany();
  let linked = 0;
  for (const shape of allShapes) {
    const routeId = shapeRouteMap.get(shape.shapeId);
    if (routeId) {
      const routeExists = await prisma.transitRoute.findUnique({ where: { id: routeId } });
      if (routeExists) {
        await prisma.transitShape.update({ where: { id: shape.id }, data: { routeId } });
        linked++;
      }
    }
  }
  console.log(`✅ Linked ${linked} shapes to routes`);

  console.log("\n🎉 Seed complete!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
