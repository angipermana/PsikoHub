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
