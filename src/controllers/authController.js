const bcrypt = require("bcrypt");
const prisma = require("../config/db");

exports.showLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }
  res.render("auth/login", { error: null });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (!user) {
      return res.render("auth/login", { error: "Debug: User not found in database for email: " + email });
    }
    if (!user.isActive) {
      return res.render("auth/login", { error: "Debug: Account is inactive." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.render("auth/login", { error: "Debug: Password mismatch." });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      role: user.role,
    };

    req.session.save((err) => {
      if (err) {
        return res.render("auth/login", { error: "Debug: Session save error: " + err.message });
      }
      if (user.role === "SUPER_ADMIN") return res.redirect("/admin");
      if (user.role === "CLIENT") return res.redirect("/client");
      return res.redirect("/test/dashboard");
    });
  } catch (error) {
    console.error(error);
    res.render("auth/login", { error: "Debug Server Error: " + error.message });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    res.redirect("/auth/login");
  });
};

exports.forceSeed = async (req, res) => {
  try {
    const email = 'admin@psikotes.com';
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Check if table exists (Prisma schema push status)
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
      res.send("Push & Seed successful! You can now login. <a href='/auth/login'>Go to login</a>");
    } else {
      res.send("Admin already exists! <a href='/auth/login'>Go to login</a>");
    }
  } catch (error) {
    console.error(error);
    res.send("Error during seed: " + error.message);
  }
};

exports.demoSeed = async (req, res) => {
  try {
    const { nanoid } = require('nanoid');
    
    // 1. Ambil Super Admin (sebagai creator)
    const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!superAdmin) return res.send('Super Admin tidak ditemukan. Harap login atau force-seed dulu.');

    let log = [];

    // 2. Buat Client Demo
    const clientEmail = 'hrd@teknus.co.id';
    let clientUser = await prisma.user.findUnique({ where: { email: clientEmail }, include: { clientProfile: true } });
    
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
      log.push('✅ Client demo berhasil dibuat.');
    } else {
      log.push('ℹ️ Client demo sudah ada.');
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
          { label: 'Kunci', content: 'Express', score: 10 }
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
      log.push(`✅ ${createdQuestions.length} Soal demo berhasil dimasukkan.`);
    } else {
      createdQuestions = await prisma.question.findMany({ take: 5 });
      log.push('ℹ️ Soal demo sudah ada di database.');
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
      log.push('✅ Paket Tes demo berhasil dibuat.');
    } else {
      log.push('ℹ️ Paket Tes demo sudah ada.');
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
      log.push('✅ Project demo berhasil dibuat.');
      log.push(`LINK TES PESERTA: /test/${token}`);
    } else {
      log.push('ℹ️ Project demo sudah ada.');
      log.push(`LINK TES PESERTA: /test/${project.accessToken}`);
    }

    res.send(`<h2>Seeding Demo Data Selesai!</h2><pre>${log.join('\\n')}</pre><br><a href='/admin'>Ke Dashboard Admin</a>`);
  } catch (error) {
    console.error(error);
    res.send("Error during demo seed: " + error.message);
  }
};
