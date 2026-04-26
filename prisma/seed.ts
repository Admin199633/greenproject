import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "משה ישראלי",
      passwordHash,
    },
  });

  await prisma.business.upsert({
    where: { ownerUserId: user.id },
    update: {},
    create: {
      ownerUserId: user.id,
      name: 'עסק לדוגמה בע"מ',
      taxId: "514000000",
      address: "רחוב הרצל 1, תל אביב",
      phone: "03-1234567",
      email: "info@example.co.il",
    },
  });

  console.log("✓ Seed complete");
  console.log("  Login: admin@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
