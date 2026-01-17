// prisma/seeders/seed-full.mjs
// Seeds:
// - 1 Admin user
// - 75 SeekerProfile rows (all PENDING) with associated SEEKER users
// - 15 RetainerProfile rows with associated RETAINER users

import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Uniqueness helpers so names don't repeat within a single seed run
// ---------------------------------------------------------------------------

const usedSeekerFullNames = new Set<string>();
const usedRetainerCompanyNames = new Set<string>();
const usedRetainerCeoNames = new Set<string>();

function generateUniqueSeekerName() {
  let first: string;
  let lastPlain: string;
  let fullPlain: string;

  // Ensure we don't reuse the same first+last combo
  do {
    first = faker.person.firstName();
    lastPlain = faker.person.lastName();
    fullPlain = `${first} ${lastPlain}`;
  } while (usedSeekerFullNames.has(fullPlain));

  usedSeekerFullNames.add(fullPlain);

  // Keep the "*" suffix convention on last name for seed data
  const lastWithTag = `${lastPlain}*`;
  const fullTagged = `${first} ${lastWithTag}`;

  return { first, lastPlain, lastWithTag, fullPlain, fullTagged };
}

function generateUniqueRetainerCompanyName() {
  let name: string;

  do {
    name = faker.company.name();
  } while (usedRetainerCompanyNames.has(name));

  usedRetainerCompanyNames.add(name);
  return name;
}

function generateUniqueRetainerCeoName() {
  let first: string;
  let lastPlain: string;
  let fullPlain: string;

  do {
    first = faker.person.firstName();
    lastPlain = faker.person.lastName();
    fullPlain = `${first} ${lastPlain}`;
  } while (usedRetainerCeoNames.has(fullPlain));

  usedRetainerCeoNames.add(fullPlain);

  const lastWithTag = `${lastPlain}*`;
  const fullTagged = `${first} ${lastWithTag}`;

  return { first, lastPlain, lastWithTag, fullPlain, fullTagged };
}

// --- Generators -------------------------------------------------------------

/**
 * Make a fake Seeker + associated User data.
 * All Seekers start with status PENDING.
 * Seeker last name is suffixed with "*" so it's easy to find/delete later.
 * Names are guaranteed unique (first+last) within this seed run.
 */
function makeSeeker(index: number) {
  const {
    first,
    lastPlain,
    lastWithTag,
    fullPlain,
    fullTagged: fullName,
  } = generateUniqueSeekerName();

  const companyDba = faker.company.name();
  const city = faker.location.city();
  const state = faker.location.state({ abbreviated: true });
  const zip = faker.location.zipCode("#####");

  const yearsInBusiness = faker.number.int({ min: 0, max: 15 });

  const vehicleYear = faker.number.int({ min: 2015, max: 2024 });
  const vehicleMake = faker.vehicle.manufacturer();
  const vehicleModel = faker.vehicle.model();
  const vehicle = `${vehicleYear} ${vehicleMake} ${vehicleModel}`;

  const insuranceType = faker.helpers.arrayElement([
    "Commercial Auto",
    "Commercial Auto + Cargo",
    "General Liability + Auto",
    "Cargo Only",
  ]);

  const verticalOptions = [
    "Final mile parcel",
    "Same-day on-demand",
    "Medical / lab runs",
    "Retail distribution",
    "Grocery delivery",
    "Pharmacy",
    "B2B freight",
  ];

  const deliveryVerticals = faker.helpers.arrayElements(
    verticalOptions,
    faker.number.int({ min: 2, max: 4 })
  );

  const birthday = faker.date.birthdate({ min: 24, max: 60, mode: "age" });

  const ref1_name = `${faker.person.firstName()} ${faker.person.lastName()}`;
  const ref2_name = `${faker.person.firstName()} ${faker.person.lastName()}`;

  const userEmail = faker.internet.email({
    firstName: first,
    lastName: lastPlain,
  });

  const userPassword = "Password123!"; // dev-only; safe shared password

  return {
    user: {
      email: userEmail,
      password: userPassword,
      role: "SEEKER", // adjust if your Role enum uses a different name
    },
    profile: {
      name: fullName, // includes "*" on last name
      companyDba,
      birthday,
      city,
      state,
      zip,
      yearsInBusiness,
      deliveryVerticals,
      vehicle,
      insuranceType,
      ref1_name,
      ref1_phone: faker.phone.number("(###) ###-####"),
      ref1_email: faker.internet.email(),
      ref1_company: faker.company.name(),
      ref2_name,
      ref2_phone: faker.phone.number("(###) ###-####"),
      ref2_email: faker.internet.email(),
      ref2_company: faker.company.name(),
      status: "PENDING", // ALL Seeded Seekers start pending
    },
  };
}

/**
 * Make a fake Retainer + associated User data.
 * CEO last name is suffixed with "*".
 * Company names and CEO names are guaranteed unique per seed run.
 */
function makeRetainer(index: number) {
  const companyName = generateUniqueRetainerCompanyName();

  const {
    first: ceoFirst,
    lastPlain: ceoLastPlain,
    lastWithTag: ceoLastWithTag,
    fullTagged: ceoName,
  } = generateUniqueRetainerCeoName();

  const city = faker.location.city();
  const state = faker.location.state({ abbreviated: true });
  const zip = faker.location.zipCode("#####");

  const yearsInBusiness = faker.number.int({ min: 2, max: 20 });
  const employees = faker.number.int({ min: 10, max: 120 });

  const verticalOptions = [
    "Final mile parcel",
    "Same-day on-demand",
    "Medical / lab runs",
    "Retail distribution",
    "Heavy bulky",
    "Furniture & appliances",
    "B2B freight",
  ];

  const traitsOptions = [
    "On-time and reliable",
    "Customer-service focused",
    "Tech-savvy (apps, scanners)",
    "Comfortable with high stop counts",
    "Clean driving record",
    "Good communication",
    "Route optimization mindset",
  ];

  const deliveryVerticals = faker.helpers.arrayElements(
    verticalOptions,
    faker.number.int({ min: 2, max: 4 })
  );

  const desiredTraits = faker.helpers.arrayElements(
    traitsOptions,
    faker.number.int({ min: 3, max: 5 })
  );

  const mission =
    faker.company.catchPhrase() +
    " in " +
    faker.location.city() +
    " and surrounding markets.";

  // Some variety so Admin sees different buckets
  const statusRoll = index % 6;
  let status: "PENDING" | "APPROVED" | "SUSPENDED" = "PENDING";
  if (statusRoll === 0 || statusRoll === 1) status = "APPROVED";
  if (statusRoll === 5) status = "SUSPENDED";

  const userEmail = faker.internet.email({
    firstName: ceoFirst,
    lastName: ceoLastPlain,
  });
  const userPassword = "Password123!";

  return {
    user: {
      email: userEmail,
      password: userPassword,
      role: "RETAINER", // adjust if needed
    },
    profile: {
      companyName,
      ceoName, // includes "*" on last name
      city,
      state,
      zip,
      mission,
      deliveryVerticals,
      employees,
      yearsInBusiness,
      desiredTraits,
      status,
    },
  };
}

// --- Main seeding workflow --------------------------------------------------

async function main() {
  console.log(
    "🚨 Clearing existing data (Message, SeekerProfile, RetainerProfile, User)..."
  );

  // Delete in dependency-safe order:
  // Messages -> Profiles -> Users
  try {
    await prisma.message.deleteMany();
  } catch (err: any) {
    console.warn("Warning: prisma.message.deleteMany() failed:", err.message ?? err);
  }

  try {
    await prisma.seekerProfile.deleteMany();
  } catch (err: any) {
    console.warn(
      "Warning: prisma.seekerProfile.deleteMany() failed. Check model name or relations."
    );
    console.warn(err.message ?? err);
  }

  try {
    await prisma.retainerProfile.deleteMany();
  } catch (err: any) {
    console.warn(
      "Warning: prisma.retainerProfile.deleteMany() failed. Check model name or relations."
    );
    console.warn(err.message ?? err);
  }

  try {
    await prisma.user.deleteMany();
  } catch (err: any) {
    console.warn(
      "Warning: prisma.user.deleteMany() failed. Check relations or constraints."
    );
    console.warn(err.message ?? err);
  }

  console.log("🌱 Creating default Admin user...");
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@snapdriver.dev",
      password: "Admin123!", // dev-only
      role: "ADMIN", // adjust if your Role enum uses a different label
    },
  });
  console.log(`   → Admin created: ${adminUser.email}`);

  console.log("🌱 Generating 15 Retainer profiles...");
  const retainerSeed = Array.from({ length: 15 }).map((_, i) =>
    makeRetainer(i + 1)
  );

  console.log("💾 Inserting Retainers (+ their Users)...");
  for (const r of retainerSeed) {
    const user = await prisma.user.create({
      data: r.user,
    });

    await prisma.retainerProfile.create({
      data: {
        ...r.profile,
        userId: user.id,
      },
    });
  }

  console.log("🌱 Generating 75 Seeker profiles (all PENDING)...");
  const seekerSeed = Array.from({ length: 75 }).map((_, i) =>
    makeSeeker(i + 1)
  );

  console.log("💾 Inserting Seekers (+ their Users)...");
  for (const s of seekerSeed) {
    const user = await prisma.user.create({
      data: s.user,
    });

    await prisma.seekerProfile.create({
      data: {
        ...s.profile,
        userId: user.id,
      },
    });
  }

  console.log("✅ Seeding complete: 1 Admin, 75 Seekers (PENDING), 15 Retainers.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

