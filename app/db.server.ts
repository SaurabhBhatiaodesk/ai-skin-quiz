import { PrismaClient } from "@prisma/client";
import { postgresSql } from "./database-sql.js";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

const postgres = /^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || "");
// Preserve Prisma model delegates and parameter binding for session storage.
const database = postgres ? new Proxy(prisma, {
  get(target, key) {
    if (key === "$executeRawUnsafe" || key === "$queryRawUnsafe") {
      return (sql: string, ...values: unknown[]) => target[key](postgresSql(sql), ...values);
    }
    const value = Reflect.get(target, key);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) : prisma;

export default database;
