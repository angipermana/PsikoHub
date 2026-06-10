const prisma = require("../config/db");
const ExcelJS = require('exceljs');

exports.dashboard = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id },
      include: { clientProfile: true }
    });

    if (!user.clientProfile) return res.status(403).send("Profil Klien Tidak Ditemukan");

    const projects = await prisma.project.findMany({
      where: { clientId: user.clientProfile.id },
      include: {
        package: true,
        _count: {
          select: { participants: true, sessions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.render("client/dashboard", {
      title: "Dashboard Klien",
      projects,
      institutionName: user.clientProfile.institutionName
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.reportDetail = async (req, res) => {
  const { projectId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id },
      include: { clientProfile: true }
    });

    const project = await prisma.project.findFirst({
      where: { 
        id: projectId,
        clientId: user.clientProfile.id // Pastikan project milik klien ini
      },
      include: { package: true }
    });

    if (!project) return res.status(404).send("Project Not Found");

    const sessions = await prisma.testSession.findMany({
      where: {
        projectId: project.id,
        status: 'COMPLETED'
      },
      include: {
        participant: { include: { user: true } },
        answers: { include: { question: { include: { options: true } } } },
        logs: true
      },
      orderBy: { submittedAt: 'desc' }
    });

    const results = sessions.map(session => {
      let totalScore = 0;
      let correctAnswers = 0;

      session.answers.forEach(ans => {
        const q = ans.question;
        if (!q) return;
        if (q.questionType !== 'SHORT_ANSWER') {
          const selectedOpt = q.options.find(o => o.id === ans.selectedOptionId);
          if (selectedOpt) {
            totalScore += selectedOpt.scoreValue;
            if (selectedOpt.scoreValue > 0) correctAnswers++;
          }
        } else {
          if (ans.textAnswer && q.options.length > 0) {
            const kunci = q.options[0].content.toLowerCase().trim();
            const jawab = ans.textAnswer.toLowerCase().trim();
            if (jawab === kunci) {
              totalScore += (q.options[0].scoreValue || 10);
              correctAnswers++;
            }
          }
        }
      });

      return {
        session,
        user: session.participant.user,
        totalScore,
        correctAnswers,
        totalQuestions: session.answers.length,
        proctoringIssues: session.logs.length
      };
    });

    res.render("client/report", {
      title: `Laporan: ${project.name}`,
      project,
      results
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

exports.exportExcel = async (req, res) => {
  const { projectId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.user.id },
      include: { clientProfile: true }
    });

    const project = await prisma.project.findFirst({
      where: { id: projectId, clientId: user.clientProfile.id }
    });

    if (!project) return res.status(404).send("Not Found");

    const sessions = await prisma.testSession.findMany({
      where: { projectId: project.id, status: 'COMPLETED' },
      include: {
        participant: { include: { user: true } },
        answers: { include: { question: { include: { options: true } } } },
        logs: true
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
        if (!q) return;
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
        end: session.submittedAt ? session.submittedAt.toLocaleString('id-ID') : '-',
        score: totalScore,
        issues: session.logs.length + ' catatan'
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
