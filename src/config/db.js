const { PrismaClient } = require('@prisma/client');
let url = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^['"]|['"]$/g, '').replace(/\\/g, '').trim() : undefined;

if (url) {
  if (url.includes('?')) {
    url += '&connection_limit=2&pool_timeout=15';
  } else {
    url += '?connection_limit=2&pool_timeout=15';
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: url
    }
  }
});
module.exports = prisma;
