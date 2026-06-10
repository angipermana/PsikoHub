const { PrismaClient } = require('@prisma/client');
const url = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^['"]|['"]$/g, '').trim() : undefined;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: url
    }
  }
});
module.exports = prisma;
