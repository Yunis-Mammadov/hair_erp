const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const areas = [
  // =========================
  // SAHE_1
  // =========================

  // I — 1-ci gün
  { name: "Xəzər", routeZone: "SAHE_1", routeDay: 1, sortOrder: 1 },
  { name: "Zığ", routeZone: "SAHE_1", routeDay: 1, sortOrder: 2 },
  { name: "Hövsan", routeZone: "SAHE_1", routeDay: 1, sortOrder: 3 },
  { name: "Xətai", routeZone: "SAHE_1", routeDay: 1, sortOrder: 4 },
  { name: "Keşlə", routeZone: "SAHE_1", routeDay: 1, sortOrder: 5 },
  { name: "NZS", routeZone: "SAHE_1", routeDay: 1, sortOrder: 6 },
  { name: "Bakıxanov", routeZone: "SAHE_1", routeDay: 1, sortOrder: 7 },
  { name: "Qaraçuxur", routeZone: "SAHE_1", routeDay: 1, sortOrder: 8 },
  { name: "Günəşli", routeZone: "SAHE_1", routeDay: 1, sortOrder: 9 },

  // III — 3-cü gün
  { name: "Sabunçu", routeZone: "SAHE_1", routeDay: 3, sortOrder: 1 },
  { name: "Balaxanı", routeZone: "SAHE_1", routeDay: 3, sortOrder: 2 },
  { name: "Zabrat", routeZone: "SAHE_1", routeDay: 3, sortOrder: 3 },
  { name: "Kürdəxanı", routeZone: "SAHE_1", routeDay: 3, sortOrder: 4 },
  { name: "Maştağa", routeZone: "SAHE_1", routeDay: 3, sortOrder: 5 },
  { name: "Buzovna", routeZone: "SAHE_1", routeDay: 3, sortOrder: 6 },
  { name: "Mərdəkan", routeZone: "SAHE_1", routeDay: 3, sortOrder: 7 },
  { name: "Şüvəlan", routeZone: "SAHE_1", routeDay: 3, sortOrder: 8 },
  { name: "Qala", routeZone: "SAHE_1", routeDay: 3, sortOrder: 9 },
  { name: "Binə", routeZone: "SAHE_1", routeDay: 3, sortOrder: 10 },

  // V — 5-ci gün
  { name: "Əmircan", routeZone: "SAHE_1", routeDay: 5, sortOrder: 1 },
  { name: "Ramana 1", routeZone: "SAHE_1", routeDay: 5, sortOrder: 2 },
  { name: "Ramana 2", routeZone: "SAHE_1", routeDay: 5, sortOrder: 3 },
  { name: "Zirə", routeZone: "SAHE_1", routeDay: 5, sortOrder: 4 },
  { name: "Suraxanı 1", routeZone: "SAHE_1", routeDay: 5, sortOrder: 5 },
  { name: "Suraxanı 2", routeZone: "SAHE_1", routeDay: 5, sortOrder: 6 },
  { name: "Qarayev", routeZone: "SAHE_1", routeDay: 5, sortOrder: 7 },
  { name: "Neftçilər", routeZone: "SAHE_1", routeDay: 5, sortOrder: 8 },
  { name: "Xalqlar", routeZone: "SAHE_1", routeDay: 5, sortOrder: 9 },
  { name: "Əhmədli", routeZone: "SAHE_1", routeDay: 5, sortOrder: 10 },
  { name: "Həzi Aslanov", routeZone: "SAHE_1", routeDay: 5, sortOrder: 11 },
  { name: "Neapol", routeZone: "SAHE_1", routeDay: 5, sortOrder: 12 },

  // =========================
  // SAHE_2
  // =========================

  // II — 2-ci gün
  { name: "Azadlıq pr", routeZone: "SAHE_2", routeDay: 2, sortOrder: 1 },
  { name: "Təbriz(Çapayev)", routeZone: "SAHE_2", routeDay: 2, sortOrder: 2 },
  { name: "Nəsimi", routeZone: "SAHE_2", routeDay: 2, sortOrder: 3 },
  { name: "Ayna Sultanova", routeZone: "SAHE_2", routeDay: 2, sortOrder: 4 },
  { name: "Gənclik", routeZone: "SAHE_2", routeDay: 2, sortOrder: 5 },
  { name: "Nərimanov", routeZone: "SAHE_2", routeDay: 2, sortOrder: 6 },
  { name: "Montin", routeZone: "SAHE_2", routeDay: 2, sortOrder: 7 },

  // IV — 4-cü gün
  { name: "Yasamal", routeZone: "SAHE_2", routeDay: 4, sortOrder: 1 },
  { name: "Elmlər", routeZone: "SAHE_2", routeDay: 4, sortOrder: 2 },
  { name: "Mkr-lar", routeZone: "SAHE_2", routeDay: 4, sortOrder: 3 },

  // VI — 6-cı gün
  { name: "20-ci sahə", routeZone: "SAHE_2", routeDay: 6, sortOrder: 1 },
  { name: "Bayıl", routeZone: "SAHE_2", routeDay: 6, sortOrder: 2 },
  { name: "Badamdar", routeZone: "SAHE_2", routeDay: 6, sortOrder: 3 },
  { name: "28-may", routeZone: "SAHE_2", routeDay: 6, sortOrder: 4 },
  { name: "Sahil", routeZone: "SAHE_2", routeDay: 6, sortOrder: 5 },
  { name: "Nizami", routeZone: "SAHE_2", routeDay: 6, sortOrder: 6 },
  { name: "İçərişəhər", routeZone: "SAHE_2", routeDay: 6, sortOrder: 7 },
  { name: "Tarqovi", routeZone: "SAHE_2", routeDay: 6, sortOrder: 8 },
];

async function main() {
  for (const area of areas) {
    await prisma.area.upsert({
      where: { name: area.name },
      update: {
        routeZone: area.routeZone,
        routeDay: area.routeDay,
        sortOrder: area.sortOrder,
        isActive: true,
      },
      create: {
        name: area.name,
        routeZone: area.routeZone,
        routeDay: area.routeDay,
        sortOrder: area.sortOrder,
        isActive: true,
      },
    });
  }

  console.log("Bütün area-lar əlavə olundu ✅");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
