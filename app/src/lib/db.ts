import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// A relative `file:` URL in DATABASE_URL resolves against process.cwd(), which
// differs between `next dev` (app/) and the standalone listener script (repo
// root). Resolve it against this file's location instead so both agree.
function resolveDatabaseUrl(raw: string): string {
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (isAbsolute(filePath)) return raw;
  const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  return `file:${join(appDir, filePath)}`;
}

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl(process.env.DATABASE_URL!) });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
