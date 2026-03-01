const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const fullName = "Admin";
  const pin = "1234";
  const pinHash = await bcrypt.hash(pin, 10);

  const existing = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  if (!existing) {
    await prisma.user.create({
      data: { fullName, pinHash, role: "ADMIN" },
    });
    console.log("✅ Admin created. PIN: 1234");
  } else {
    console.log("ℹ️ Admin already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
