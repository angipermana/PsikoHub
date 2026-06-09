const prisma = require("../config/db");
const ExcelJS = require('exceljs');

// Menampilkan daftar project untuk dilihat laporannya
exports.listReports = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        clientProfile: true,
        package: true,
        _count: {
          select: { participants: true, testSessions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.render("admin/reports/index", {
      title: "Laporan Hasil Ujian",
      projects
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Menampilkan detail laporan per project (daftar peserta dan nilainya)
exports.reportDetail = async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(projectId) },
      include: {
        clientProfile: true,
        package: true
      }
    });

    if (!project) return res.status(404).send("Not Found");

    // Ambil semua TestSession dari project ini yang sudah COMPLETED
    const sessions = await prisma.testSession.findMany({
      where: {
        projectId: project.id,
        status: 'COMPLETED'
      },
      include: {
        participant: {
          include: { user: true }
        },
        answers: {
          include: {
            question: {
              include: { options: true }
            }
          }
        },
        proctoringLogs: true
      },
      orderBy: { finishedAt: 'desc' }
    });

    // Proses kalkulasi skor
    const results = sessions.map(session => {
      let totalScore = 0;
      let correctAnswers = 0;
      let dimensionScores = {};

      session.answers.forEach(ans => {
        const q = ans.question;
        const dim = q.dimensionGroup || 'General';
        if (!dimensionScores[dim]) dimensionScores[dim] = 0;

        // Scoring untuk pilihan ganda, TF, Likert
        if (q.questionType !== 'SHORT_ANSWER') {
          const selectedOpt = q.options.find(o => o.id === ans.selectedOptionId);
          if (selectedOpt) {
            totalScore += selectedOpt.scoreValue;
            dimensionScores[dim] += selectedOpt.scoreValue;
            
            // Asumsi: jika scoreValue > 0, dianggap 'benar' untuk menghitung akurasi simpel
            if (selectedOpt.scoreValue > 0) correctAnswers++;
          }
        } else {
          // Scoring sederhana untuk Short Answer (cocokkan text dengan kunci jawaban di opsi pertama)
          if (ans.textAnswer && q.options.length > 0) {
            const kunci = q.options[0].content.toLowerCase().trim();
            const jawab = ans.textAnswer.toLowerCase().trim();
            if (jawab === kunci) {
              const point = q.options[0].scoreValue || 10;
              totalScore += point;
              dimensionScores[dim] += point;
              correctAnswers++;
            }
          }
        }
      });

      return {
        session,
        participant: session.participant,
        user: session.participant.user,
        totalScore,
        correctAnswers,
        totalQuestions: session.answers.length,
        dimensionScores,
        proctoringIssues: session.proctoringLogs.length
      };
    });

    res.render("admin/reports/detail", {
      title: `Hasil Tes: ${project.name}`,
      project,
      results
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// Export ke Excel
exports.exportExcel = async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(projectId) },
      include: { clientProfile: true }
    });

    if (!project) return res.status(404).send("Not Found");

    const sessions = await prisma.testSession.findMany({
      where: { projectId: project.id, status: 'COMPLETED' },
      include: {
        participant: { include: { user: true } },
        answers: { include: { question: { include: { options: true } } } },
        proctoringLogs: true
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Hasil Tes');

    sheet.columns = [
      { header: 'Nama Peserta', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Waktu Mulai', key: 'start', width: 20 },
      { header: 'Waktu Selesai', key: 'end', width: 20 },
      { header: 'Skor Total', key: 'score', width: 15 },
      { header: 'Pelanggaran Proctoring', key: 'issues', width: 25 },
    ];

    sessions.forEach(session => {
      let totalScore = 0;
      session.answers.forEach(ans => {
        const q = ans.question;
        if (q.questionType !== 'SHORT_ANSWER') {
          const selectedOpt = q.options.find(o => o.id === ans.selectedOptionId);
          if (selectedOpt) totalScore += selectedOpt.scoreValue;
        } else {
          if (ans.textAnswer && q.options.length > 0) {
            const kunci = q.options[0].content.toLowerCase().trim();
            const jawab = ans.textAnswer.toLowerCase().trim();
            if (jawab === kunci) totalScore += (q.options[0].scoreValue || 10);
          }
        }
      });

      sheet.addRow({
        name: session.participant.user.name,
        email: session.participant.user.email,
        start: session.startedAt.toLocaleString('id-ID'),
        end: session.finishedAt ? session.finishedAt.toLocaleString('id-ID') : '-',
        score: totalScore,
        issues: session.proctoringLogs.length + ' catatan'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Hasil_Tes_${project.name.replace(/\s+/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
