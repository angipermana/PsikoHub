const prisma = require('./src/config/db');
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

async function main() {
  console.log('Memulai proses seeding demo data...');

  // 1. Ambil Super Admin (sebagai creator)
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) throw new Error('Super Admin tidak ditemukan. Harap jalankan seed.js terlebih dahulu.');

  // 2. Buat Client Demo
  const clientEmail = 'hrd@teknus.co.id';
  let clientUser = await prisma.user.findUnique({ where: { email: clientEmail } });
  
  if (!clientUser) {
    const passwordHash = await bcrypt.hash('client123', 12);
    clientUser = await prisma.user.create({
      data: {
        name: 'Budi Santoso',
        email: clientEmail,
        passwordHash,
        role: 'CLIENT',
        clientProfile: {
          create: {
            institutionName: 'PT Teknologi Nusantara',
            contactPhone: '081234567890',
            notes: 'Klien demo untuk testing platform.'
          }
        }
      },
      include: { clientProfile: true }
    });
    console.log('✅ Client demo berhasil dibuat.');
  } else {
    clientUser = await prisma.user.findUnique({ where: { email: clientEmail }, include: { clientProfile: true }});
  }

  const clientId = clientUser.clientProfile.id;

  // 3. Buat Bank Soal Demo
  const demoQuestions = [
    {
      content: 'Apa kepanjangan dari HTML?',
      type: 'MULTIPLE_CHOICE',
      dimension: 'Technical',
      timeLimit: 30,
      options: [
        { label: 'A', content: 'Hyper Text Markup Language', score: 10 },
        { label: 'B', content: 'High Tech Modern Language', score: 0 },
        { label: 'C', content: 'Hyper Transfer Markup Logic', score: 0 },
        { label: 'D', content: 'Home Tool Markup Language', score: 0 },
      ]
    },
    {
      content: 'JavaScript adalah bahasa pemrograman yang berjalan di sisi server saja.',
      type: 'TRUE_FALSE',
      dimension: 'Technical',
      timeLimit: 20,
      options: [
        { label: 'A', content: 'Benar', score: 0 },
        { label: 'B', content: 'Salah', score: 10 }
      ]
    },
    {
      content: 'Seberapa nyaman Anda bekerja di bawah tekanan ketat (tight deadline)?',
      type: 'LIKERT',
      dimension: 'Kepribadian',
      timeLimit: 30,
      options: [
        { label: '1', content: 'Sangat Tidak Nyaman', score: 1 },
        { label: '2', content: 'Tidak Nyaman', score: 2 },
        { label: '3', content: 'Netral', score: 3 },
        { label: '4', content: 'Nyaman', score: 4 },
        { label: '5', content: 'Sangat Nyaman', score: 5 }
      ]
    },
    {
      content: 'Sebutkan framework Node.js yang paling populer untuk membuat REST API!',
      type: 'SHORT_ANSWER',
      dimension: 'Technical',
      timeLimit: 60,
      options: [
        { label: 'Kunci', content: 'Express', score: 10 } // Untuk isian singkat, kita simpan kunci jawabannya di opsi pertama
      ]
    },
    {
      content: 'Manakah dari berikut ini yang merupakan tipe data primitif di JavaScript?',
      type: 'MULTIPLE_CHOICE',
      dimension: 'Technical',
      timeLimit: 30,
      options: [
        { label: 'A', content: 'Array', score: 0 },
        { label: 'B', content: 'Object', score: 0 },
        { label: 'C', content: 'String', score: 10 },
        { label: 'D', content: 'Function', score: 0 },
      ]
    }
  ];

  let createdQuestions = [];
  
  // Bersihkan soal lama jika mau (opsional, tapi agar tidak duplikat kita lewati jika sudah ada)
  const existingQ = await prisma.question.findFirst({ where: { content: demoQuestions[0].content }});
  
  if (!existingQ) {
    for (const q of demoQuestions) {
      const inserted = await prisma.question.create({
        data: {
          createdBy: superAdmin.id,
          content: q.content,
          questionType: q.type,
          dimensionGroup: q.dimension,
          timeLimitSeconds: q.timeLimit,
          options: {
            create: q.options.map((opt, i) => ({
              label: opt.label,
              content: opt.content,
              scoreValue: opt.score,
              orderIndex: i + 1
            }))
          }
        }
      });
      createdQuestions.push(inserted);
    }
    console.log(`✅ ${createdQuestions.length} Soal demo berhasil dimasukkan.`);
  } else {
    createdQuestions = await prisma.question.findMany({ take: 5 });
    console.log('ℹ️ Soal demo sudah ada di database.');
  }

  // 4. Buat Paket Tes Demo
  const packageName = 'Paket Seleksi Fullstack Developer 2026';
  let pkg = await prisma.package.findFirst({ where: { name: packageName } });

  if (!pkg) {
    pkg = await prisma.package.create({
      data: {
        createdBy: superAdmin.id,
        name: packageName,
        instructions: 'Kerjakan soal dengan teliti. Dilarang berpindah tab browser atau mematikan kamera.',
        totalTimeMinutes: 60,
        randomizeQuestions: true,
        isActive: true,
        questions: {
          create: createdQuestions.map((q, index) => ({
            questionId: q.id,
            orderIndex: index + 1
          }))
        }
      }
    });
    console.log('✅ Paket Tes demo berhasil dibuat.');
  }

  // 5. Buat Project Demo
  const projectName = 'Rekrutmen Batch 1 - PT Teknologi Nusantara';
  let project = await prisma.project.findFirst({ where: { name: projectName } });

  if (!project) {
    const token = nanoid(10);
    project = await prisma.project.create({
      data: {
        clientId: clientId,
        packageId: pkg.id,
        name: projectName,
        accessToken: token,
        proctoringFullscreen: true,
        proctoringTab: true,
        proctoringCamera: true,
        isActive: true
      }
    });
    console.log('✅ Project demo berhasil dibuat.');
    console.log(`\n======================================`);
    console.log(`LINK TES PESERTA: http://localhost:3000/test/${token}`);
    console.log(`======================================\n`);
  } else {
    console.log('ℹ️ Project demo sudah ada.');
    console.log(`\n======================================`);
    console.log(`LINK TES PESERTA: http://localhost:3000/test/${project.accessToken}`);
    console.log(`======================================\n`);
  }

  console.log('🎉 Seeding demo data selesai!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
