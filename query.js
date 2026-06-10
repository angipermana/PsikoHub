const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const answers = await prisma.sessionAnswer.findMany({
    include: {
      question: { include: { options: true } }
    }
  });
  console.log(JSON.stringify(answers, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
