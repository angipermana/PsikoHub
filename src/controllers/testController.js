const prisma = require("../config/db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require('uuid');

// Validasi Token & Tampilkan Form Registrasi
exports.validateToken = async (req, res) => {
  const { token } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { accessToken: token },
      include: { clientProfile: true }
    });

    if (!project) {
      return res.render("participant/invalid", { title: "Token Tidak Valid", message: "Link yang Anda gunakan tidak valid atau sudah kadaluarsa." });
    }

    if (!project.isActive) {
      return res.render("participant/invalid", { title: "Project Dinonaktifkan", message: "Sesi tes untuk project ini sedang dinonaktifkan oleh administrator." });
    }

    const now = new Date();
    if (project.activeFrom && now < project.activeFrom) {
      return res.render("participant/invalid", { title: "Belum Dimulai", message: `Sesi tes ini baru akan dimulai pada ${project.activeFrom.toLocaleString('id-ID')}` });
    }
    if (project.activeUntil && now > project.activeUntil) {
      return res.render("participant/invalid", { title: "Sudah Berakhir", message: "Sesi tes ini sudah berakhir." });
    }

    res.render("participant/register", { title: "Registrasi Peserta Tes", project, error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Proses Registrasi Peserta (Bikin akun dummy / daftarkan ke project)
exports.registerParticipant = async (req, res) => {
  const { token } = req.params;
  const { fullName, email, customData } = req.body;

  try {
    const project = await prisma.project.findUnique({ where: { accessToken: token } });
    if (!project) return res.status(404).send("Not Found");

    // Cari atau buat User untuk participant
    let user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      const dummyPassword = await bcrypt.hash(uuidv4(), 10);
      user = await prisma.user.create({
        data: {
          name: fullName,
          email: email,
          passwordHash: dummyPassword,
          role: "PARTICIPANT"
        }
      });
    }

    // Daftarkan Participant ke Project (Upsert jika sudah pernah daftar tapi belum tes)
    const participant = await prisma.participant.upsert({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: project.id
        }
      },
      update: {
        customFieldValues: customData || {}
      },
      create: {
        userId: user.id,
        projectId: project.id,
        customFieldValues: customData || {}
      }
    });

    // Simpan data participant di session (peserta otomatis 'login' ke sesi tes)
    req.session.participantId = participant.id;
    req.session.projectId = project.id;
    req.session.userId = user.id;

    // Arahkan ke halaman setup (C2)
    res.redirect(`/test/${token}/setup`);
  } catch (err) {
    console.error(err);
    res.redirect(`/test/${token}?error=1`);
  }
};

// Halaman Persiapan / Setup
exports.setupTest = async (req, res) => {
  const { token } = req.params;
  
  if (!req.session.participantId) {
    return res.redirect(`/test/${token}`);
  }

  const project = await prisma.project.findUnique({
    where: { accessToken: token },
    include: { package: true }
  });

  if (!project) return res.status(404).send("Not Found");

  // Cek apakah peserta sudah punya TestSession yang sedang berjalan
  const existingSession = await prisma.testSession.findFirst({
    where: {
      participantId: req.session.participantId,
      projectId: project.id
    }
  });

  // Jika sudah COMPLETED, tidak boleh tes lagi
  if (existingSession && existingSession.status === 'COMPLETED') {
    return res.render("participant/invalid", { title: "Tes Selesai", message: "Anda sudah menyelesaikan tes ini sebelumnya." });
  }

  res.render("participant/setup", { title: "Persiapan Ujian", project });
};

// Mulai Tes
exports.startTest = async (req, res) => {
  const { token } = req.params;
  
  if (!req.session.participantId) {
    return res.redirect(`/test/${token}`);
  }

  const project = await prisma.project.findUnique({
    where: { accessToken: token }
  });

  if (!project) return res.status(404).send("Not Found");

  let testSession = await prisma.testSession.findFirst({
    where: {
      participantId: req.session.participantId,
      projectId: project.id
    }
  });

  if (!testSession) {
    testSession = await prisma.testSession.create({
      data: {
        participantId: req.session.participantId,
        projectId: project.id,
        status: 'IN_PROGRESS',
        startedAt: new Date()
      }
    });
  }

  req.session.testSessionId = testSession.id;

  res.redirect(`/test/${token}/run`);
};

exports.runTest = async (req, res) => {
  const { token } = req.params;
  
  if (!req.session.testSessionId) {
    return res.redirect(`/test/${token}/setup`);
  }

  try {
    const project = await prisma.project.findUnique({
      where: { accessToken: token },
      include: {
        package: {
          include: {
            questions: {
              include: {
                question: {
                  include: { options: true }
                }
              },
              orderBy: { orderIndex: 'asc' }
            }
          }
        }
      }
    });

    if (!project) return res.status(404).send("Not Found");

    const testSession = await prisma.testSession.findUnique({
      where: { id: req.session.testSessionId },
      include: { answers: true }
    });

    if (testSession.status === 'COMPLETED') {
      return res.redirect(`/test/${token}/finish`);
    }

    // Jika randomize dihidupkan, acak questions
    let displayQuestions = project.package.questions;
    if (project.package.randomizeQuestions) {
      // Sederhana: gunakan sort random (tidak disarankan untuk skala besar, tapi cukup untuk MVP)
      displayQuestions = [...displayQuestions].sort(() => Math.random() - 0.5);
    }

    // Ambil jawaban yang sudah tersimpan
    const savedAnswers = testSession.answers.reduce((acc, curr) => {
      acc[curr.questionId] = {
        optionId: curr.selectedOptionId,
        textAnswer: curr.textAnswer
      };
      return acc;
    }, {});

    // Hitung sisa waktu (endTime = startedAt + totalTimeMinutes)
    const startedAt = new Date(testSession.startedAt);
    const endTime = new Date(startedAt.getTime() + project.package.totalTimeMinutes * 60000);
    const now = new Date();
    let remainingSeconds = Math.floor((endTime - now) / 1000);
    if (remainingSeconds < 0) remainingSeconds = 0;

    res.render("participant/run", {
      title: "Pengerjaan Ujian",
      project,
      questions: displayQuestions.map(q => q.question),
      savedAnswers,
      remainingSeconds
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.saveAnswer = async (req, res) => {
  if (!req.session.testSessionId) return res.status(401).json({ error: "Unauthorized" });

  const { questionId, optionId, textAnswer } = req.body;

  try {
    await prisma.sessionAnswer.upsert({
      where: {
        testSessionId_questionId: {
          testSessionId: req.session.testSessionId,
          questionId: parseInt(questionId)
        }
      },
      update: {
        selectedOptionId: optionId ? parseInt(optionId) : null,
        textAnswer: textAnswer || null
      },
      create: {
        testSessionId: req.session.testSessionId,
        questionId: parseInt(questionId),
        selectedOptionId: optionId ? parseInt(optionId) : null,
        textAnswer: textAnswer || null
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save answer" });
  }
};

exports.logProctoring = async (req, res) => {
  if (!req.session.testSessionId) return res.status(401).json({ error: "Unauthorized" });

  const { eventType, details } = req.body;
  try {
    await prisma.proctoringLog.create({
      data: {
        testSessionId: req.session.testSessionId,
        eventType,
        details
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log" });
  }
};

exports.submitTest = async (req, res) => {
  const { token } = req.params;
  if (!req.session.testSessionId) return res.redirect(`/test/${token}`);

  try {
    await prisma.testSession.update({
      where: { id: req.session.testSessionId },
      data: {
        status: 'COMPLETED',
        submittedAt: new Date()
      }
    });
    res.redirect(`/test/${token}/finish`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.finishTest = async (req, res) => {
  const { token } = req.params;
  if (!req.session.testSessionId) return res.redirect(`/test/${token}`);

  try {
    const project = await prisma.project.findUnique({
      where: { accessToken: token }
    });
    
    // Clear session for the test
    req.session.testSessionId = null;

    res.render("participant/finish", { title: "Ujian Selesai", project });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
