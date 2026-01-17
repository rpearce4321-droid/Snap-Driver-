import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count().catch(() => -1);
  const seekerProfileCount = await prisma.seekerProfile
    .count()
    .catch(() => -1);
  const retainerProfileCount = await prisma.retainerProfile
    .count()
    .catch(() => -1);

  console.log("Users:", userCount);
  console.log("SeekerProfile:", seekerProfileCount);
  console.log("RetainerProfile:", retainerProfileCount);
}

main()
  .catch((e) => {
    console.error("Debug count failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  
