const prisma = require("../config/db");
const bcrypt = require("bcrypt");
const { nanoid } = require("nanoid");

exports.dashboard = async (req, res) => {
  const stats = {
    totalClients: await prisma.user.count({ where: { role: "CLIENT" } }),
    totalQuestions: await prisma.question.count(),
    totalPackages: await prisma.package.count(),
    totalProjects: await prisma.project.count(),
  };
  res.render("admin/dashboard", { stats, title: "Super Admin Dashboard" });
};

exports.clients = async (req, res) => {
  const clients = await prisma.user.findMany({
    where: { role: "CLIENT" },
    include: { clientProfile: true },
    orderBy: { createdAt: 'desc' }
  });
  res.render("admin/clients/index", { clients, title: "Manage Clients", error: null, success: null });
};

exports.createClient = (req, res) => {
  res.render("admin/clients/create", { title: "Tambah Klien Baru", error: null });
};

exports.storeClient = async (req, res) => {
  const { name, email, password, institutionName, contactPhone, notes } = req.body;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.render("admin/clients/create", { title: "Tambah Klien Baru", error: "Email sudah digunakan." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CLIENT",
        clientProfile: {
          create: {
            institutionName,
            contactPhone,
            notes
          }
        }
      }
    });

    res.redirect("/admin/clients");
  } catch (error) {
    console.error(error);
    res.render("admin/clients/create", { title: "Tambah Klien Baru", error: "Terjadi kesalahan server." });
  }
};

exports.editClient = async (req, res) => {
  const { id } = req.params;
  const client = await prisma.user.findUnique({
    where: { id },
    include: { clientProfile: true }
  });

  if (!client || client.role !== "CLIENT") return res.redirect("/admin/clients");

  res.render("admin/clients/edit", { title: "Edit Klien", client, error: null });
};

exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, institutionName, contactPhone, notes, isActive } = req.body;
  
  try {
    const dataToUpdate = {
      name,
      email,
      isActive: isActive === 'on' || isActive === 'true',
      clientProfile: {
        update: {
          institutionName,
          contactPhone,
          notes
        }
      }
    };

    if (password) {
      dataToUpdate.passwordHash = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id },
      data: dataToUpdate
    });

    res.redirect("/admin/clients");
  } catch (error) {
    console.error(error);
    res.redirect(`/admin/clients/${id}/edit?error=1`);
  }
};

exports.deleteClient = async (req, res) => {
  const { id } = req.params;
  try {
    // Delete profile first then user, or rely on cascade if we set it up (we didn't set cascade for clientProfile on user, but we can delete profile manually)
    await prisma.clientProfile.delete({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    res.redirect("/admin/clients");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/clients");
  }
};

const fs = require('fs');
const csv = require('csv-parser');

exports.questions = async (req, res) => {
  const { type, category } = req.query;

  const where = {};
  if (type) where.questionType = type;
  if (category) where.dimensionGroup = category;

  const questions = await prisma.question.findMany({
    where,
    orderBy: { categoryLabel: 'asc' },
    include: { options: true }
  });

  // Get distinct dimension groups for the filter dropdown
  const distinctCategories = await prisma.question.findMany({
    distinct: ['dimensionGroup'],
    select: { dimensionGroup: true },
    where: { dimensionGroup: { not: null, not: '' } }
  });

  const categories = distinctCategories.map(c => c.dimensionGroup).filter(Boolean);

  res.render("admin/questions/index", { 
    questions, 
    categories,
    filters: { type, category },
    title: "Manage Questions" 
  });
};

exports.createQuestion = (req, res) => {
  res.render("admin/questions/create", { title: "Tambah Soal Manual", error: null });
};

exports.storeQuestion = async (req, res) => {
  const { content, questionType, dimensionGroup, categoryLabel, timeLimitSeconds, isRandomizable, options } = req.body;
  
  try {
    let questionImageUrl = null;
    if (req.files && req.files.length > 0) {
      const qImage = req.files.find(f => f.fieldname === 'questionImage');
      if (qImage) questionImageUrl = `/uploads/questions/${qImage.filename}`;
    }

    const parsedOptions = options ? options.map((opt, index) => {
      let optImageUrl = null;
      if (req.files && req.files.length > 0) {
        const oImage = req.files.find(f => f.fieldname === `optionImage_${index}`);
        if (oImage) optImageUrl = `/uploads/questions/${oImage.filename}`;
      }
      return {
        label: opt.label || String.fromCharCode(65 + index), // A, B, C...
        content: opt.content || '',
        scoreValue: parseInt(opt.scoreValue) || 0,
        isReverseScored: opt.isReverseScored === 'true',
        orderIndex: index + 1,
        imageUrl: optImageUrl || opt.existingImageUrl || null
      };
    }).filter(opt => opt.content.trim() !== '' || opt.imageUrl !== null) : [];

    await prisma.question.create({
      data: {
        createdBy: req.session.user.id,
        content,
        questionType,
        dimensionGroup,
        categoryLabel,
        timeLimitSeconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null,
        isRandomizable: isRandomizable === 'true',
        imageUrl: questionImageUrl,
        options: {
          create: parsedOptions
        }
      }
    });

    res.redirect("/admin/questions");
  } catch (error) {
    console.error(error);
    res.render("admin/questions/create", { title: "Tambah Soal Manual", error: "Gagal menyimpan soal." });
  }
};

exports.importQuestionView = (req, res) => {
  res.render("admin/questions/import", { title: "Import Soal via CSV", error: null, success: null });
};

exports.importQuestionProcess = (req, res) => {
  if (!req.file) {
    return res.render("admin/questions/import", { title: "Import Soal via CSV", error: "File CSV tidak ditemukan.", success: null });
  }

  const results = [];
  let errorMsg = null;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        for (const row of results) {
          if (!row.question_content || !row.question_type) continue;
          
          const options = [];
          if (row.option_a) options.push({ label: 'A', content: row.option_a, scoreValue: parseInt(row.score_a) || 0, orderIndex: 1 });
          if (row.option_b) options.push({ label: 'B', content: row.option_b, scoreValue: parseInt(row.score_b) || 0, orderIndex: 2 });
          if (row.option_c) options.push({ label: 'C', content: row.option_c, scoreValue: parseInt(row.score_c) || 0, orderIndex: 3 });
          if (row.option_d) options.push({ label: 'D', content: row.option_d, scoreValue: parseInt(row.score_d) || 0, orderIndex: 4 });

          await prisma.question.create({
            data: {
              createdBy: req.session.user.id,
              content: row.question_content,
              questionType: row.question_type.toUpperCase(),
              dimensionGroup: row.dimension_group || null,
              categoryLabel: row.dimension_group || null,
              timeLimitSeconds: row.time_limit_seconds ? parseInt(row.time_limit_seconds) : null,
              isRandomizable: true,
              options: {
                create: options
              }
            }
          });
        }
        fs.unlinkSync(req.file.path);
        res.render("admin/questions/import", { title: "Import Soal via CSV", error: null, success: `Berhasil import ${results.length} soal.` });
      } catch (err) {
        console.error(err);
        res.render("admin/questions/import", { title: "Import Soal via CSV", error: "Terjadi kesalahan saat memproses data CSV.", success: null });
      }
    });
};

exports.editQuestion = async (req, res) => {
  const { id } = req.params;
  const question = await prisma.question.findUnique({
    where: { id },
    include: { options: { orderBy: { orderIndex: 'asc' } } }
  });

  if (!question) return res.redirect("/admin/questions");

  res.render("admin/questions/edit", { title: "Edit Soal", question, error: null });
};

exports.updateQuestion = async (req, res) => {
  const { id } = req.params;
  const { content, questionType, dimensionGroup, categoryLabel, timeLimitSeconds, isRandomizable, options } = req.body;
  
  try {
    let questionImageUrl = req.body.existingQuestionImage || null;
    if (req.files && req.files.length > 0) {
      const qImage = req.files.find(f => f.fieldname === 'questionImage');
      if (qImage) questionImageUrl = `/uploads/questions/${qImage.filename}`;
    }

    // Delete existing options
    await prisma.questionOption.deleteMany({ where: { questionId: id } });

    const parsedOptions = options ? options.map((opt, index) => {
      let optImageUrl = opt.existingImageUrl || null;
      if (req.files && req.files.length > 0) {
        const oImage = req.files.find(f => f.fieldname === `optionImage_${index}`);
        if (oImage) optImageUrl = `/uploads/questions/${oImage.filename}`;
      }
      return {
        label: opt.label || String.fromCharCode(65 + index),
        content: opt.content || '',
        scoreValue: parseInt(opt.scoreValue) || 0,
        isReverseScored: opt.isReverseScored === 'true',
        orderIndex: index + 1,
        imageUrl: optImageUrl
      };
    }).filter(opt => opt.content.trim() !== '' || opt.imageUrl !== null) : [];

    await prisma.question.update({
      where: { id },
      data: {
        content,
        questionType,
        dimensionGroup,
        categoryLabel,
        timeLimitSeconds: timeLimitSeconds ? parseInt(timeLimitSeconds) : null,
        isRandomizable: isRandomizable === 'true',
        imageUrl: questionImageUrl,
        options: {
          create: parsedOptions
        }
      }
    });

    res.redirect("/admin/questions");
  } catch (error) {
    console.error(error);
    res.redirect(`/admin/questions/${id}/edit?error=1`);
  }
};

exports.deleteQuestion = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.question.delete({ where: { id } });
    res.redirect("/admin/questions");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/questions");
  }
};

exports.packages = async (req, res) => {
  const packages = await prisma.package.findMany({
    include: { questions: true }
  });
  res.render("admin/packages/index", { packages, title: "Manage Packages", error: null });
};

exports.createPackage = async (req, res) => {
  const questions = await prisma.question.findMany({
    orderBy: { categoryLabel: 'asc' }
  });
  res.render("admin/packages/create", { title: "Buat Paket Tes Baru", questions, error: null });
};

exports.storePackage = async (req, res) => {
  const { name, instructions, totalTimeMinutes, randomizeQuestions, questionIds } = req.body;
  
  try {
    const parsedQuestionIds = Array.isArray(questionIds) ? questionIds : (questionIds ? [questionIds] : []);
    
    await prisma.package.create({
      data: {
        createdBy: req.session.user.id,
        name,
        instructions,
        totalTimeMinutes: totalTimeMinutes ? parseInt(totalTimeMinutes) : null,
        randomizeQuestions: randomizeQuestions === 'on' || randomizeQuestions === 'true',
        questions: {
          create: parsedQuestionIds.map((qId, index) => ({
            questionId: qId,
            orderIndex: index + 1
          }))
        }
      }
    });

    res.redirect("/admin/packages");
  } catch (error) {
    console.error(error);
    const questions = await prisma.question.findMany({ orderBy: { categoryLabel: 'asc' } });
    res.render("admin/packages/create", { title: "Buat Paket Tes Baru", questions, error: "Gagal menyimpan paket tes." });
  }
};

exports.editPackage = async (req, res) => {
  const { id } = req.params;
  const pkg = await prisma.package.findUnique({
    where: { id },
    include: { questions: { orderBy: { orderIndex: 'asc' }, include: { question: true } } }
  });

  if (!pkg) return res.redirect("/admin/packages");

  const questions = await prisma.question.findMany({
    orderBy: { categoryLabel: 'asc' }
  });

  const selectedQuestionIds = pkg.questions.map(pq => pq.questionId);

  res.render("admin/packages/edit", { title: "Edit Paket Tes", pkg, questions, selectedQuestionIds, error: null });
};

exports.updatePackage = async (req, res) => {
  const { id } = req.params;
  const { name, instructions, totalTimeMinutes, randomizeQuestions, isActive, questionIds } = req.body;
  
  try {
    const parsedQuestionIds = Array.isArray(questionIds) ? questionIds : (questionIds ? [questionIds] : []);

    await prisma.packageQuestion.deleteMany({ where: { packageId: id } });

    await prisma.package.update({
      where: { id },
      data: {
        name,
        instructions,
        totalTimeMinutes: totalTimeMinutes ? parseInt(totalTimeMinutes) : null,
        randomizeQuestions: randomizeQuestions === 'on' || randomizeQuestions === 'true',
        isActive: isActive === 'on' || isActive === 'true',
        questions: {
          create: parsedQuestionIds.map((qId, index) => ({
            questionId: qId,
            orderIndex: index + 1
          }))
        }
      }
    });

    res.redirect("/admin/packages");
  } catch (error) {
    console.error(error);
    res.redirect(`/admin/packages/${id}/edit?error=1`);
  }
};

exports.deletePackage = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.package.delete({ where: { id } });
    res.redirect("/admin/packages");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/packages");
  }
};

exports.projects = async (req, res) => {
  const projects = await prisma.project.findMany({
    include: { clientProfile: { include: { user: true } }, package: true },
    orderBy: { activeFrom: 'desc' }
  });
  res.render("admin/projects/index", { projects, title: "Manage Projects", error: null });
};

exports.createProject = async (req, res) => {
  const clients = await prisma.clientProfile.findMany({
    include: { user: true },
    orderBy: { institutionName: 'asc' }
  });
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });
  res.render("admin/projects/create", { title: "Buat Project Tes", clients, packages, error: null });
};

exports.storeProject = async (req, res) => {
  const { clientId, packageId, name, proctoringFullscreen, proctoringTab, proctoringCamera, activeFrom, activeUntil } = req.body;
  
  try {
    const accessToken = nanoid(10); // Generate 10-char unique string
    
    await prisma.project.create({
      data: {
        clientId,
        packageId,
        name,
        accessToken,
        proctoringFullscreen: proctoringFullscreen === 'on',
        proctoringTab: proctoringTab === 'on',
        proctoringCamera: proctoringCamera === 'on',
        activeFrom: activeFrom ? new Date(activeFrom) : null,
        activeUntil: activeUntil ? new Date(activeUntil) : null,
      }
    });

    res.redirect("/admin/projects");
  } catch (error) {
    console.error(error);
    const clients = await prisma.clientProfile.findMany({ include: { user: true } });
    const packages = await prisma.package.findMany({ where: { isActive: true } });
    res.render("admin/projects/create", { title: "Buat Project Tes", clients, packages, error: "Gagal menyimpan project tes." });
  }
};

exports.editProject = async (req, res) => {
  const { id } = req.params;
  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) return res.redirect("/admin/projects");

  const clients = await prisma.clientProfile.findMany({
    include: { user: true },
    orderBy: { institutionName: 'asc' }
  });
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });

  res.render("admin/projects/edit", { title: "Edit Project", project, clients, packages, error: null });
};

exports.updateProject = async (req, res) => {
  const { id } = req.params;
  const { clientId, packageId, name, proctoringFullscreen, proctoringTab, proctoringCamera, activeFrom, activeUntil, isActive } = req.body;
  
  try {
    await prisma.project.update({
      where: { id },
      data: {
        clientId,
        packageId,
        name,
        proctoringFullscreen: proctoringFullscreen === 'on',
        proctoringTab: proctoringTab === 'on',
        proctoringCamera: proctoringCamera === 'on',
        activeFrom: activeFrom ? new Date(activeFrom) : null,
        activeUntil: activeUntil ? new Date(activeUntil) : null,
        isActive: isActive === 'on',
      }
    });

    res.redirect("/admin/projects");
  } catch (error) {
    console.error(error);
    res.redirect(`/admin/projects/${id}/edit?error=1`);
  }
};

exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.project.delete({ where: { id } });
    res.redirect("/admin/projects");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/projects");
  }
};

exports.users = async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: "PARTICIPANT" },
    include: { participants: true },
  });
  res.render("admin/users", { users, title: "Manage Global Users" });
};
