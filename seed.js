const prisma = require('./src/config/db');
const bcrypt = require('bcrypt');

async function main() {
  const email = 'admin@psikotes.com';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 12);

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: email,
        passwordHash: passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log('Super Admin berhasil dibuat!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } else {
    console.log('Super Admin sudah ada.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
