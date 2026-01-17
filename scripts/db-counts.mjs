import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const sa = await p.seekerProfile.count({ where: { status: "APPROVED" } });
  const sp = await p.seekerProfile.count({ where: { status: "PENDING" } });
  const sr = await p.seekerProfile.count({ where: { status: "REJECTED" } });
  const ss = await p.seekerProfile.count({ where: { status: "SUSPENDED" } });

  const ra = await p.retainerProfile.count({ where: { status: "APPROVED" } });
  const rp = await p.retainerProfile.count({ where: { status: "PENDING" } });
  const rr = await p.retainerProfile.count({ where: { status: "REJECTED" } });
  const rs = await p.retainerProfile.count({ where: { status: "SUSPENDED" } });

  console.log(JSON.stringify({
    seekers: { approved: sa, pending: sp, rejected: sr, suspended: ss },
    retainers: { approved: ra, pending: rp, rejected: rr, suspended: rs }
  }, null, 2));
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });

