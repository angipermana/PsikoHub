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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.render("auth/login", { error: "Invalid credentials or inactive account." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.render("auth/login", { error: "Invalid credentials." });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      role: user.role,
    };

    if (user.role === "SUPER_ADMIN") return res.redirect("/admin");
    if (user.role === "CLIENT") return res.redirect("/client");
    return res.redirect("/test/dashboard");
  } catch (error) {
    console.error(error);
    res.render("auth/login", { error: "Server error occurred." });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    res.redirect("/auth/login");
  });
};

exports.forceSeed = async (req, res) => {
  try {
    const { execSync } = require('child_process');
    try {
      execSync('/opt/alt/alt-nodejs22/root/usr/bin/node node_modules/prisma/build/index.js db push --accept-data-loss', {
        env: { ...process.env },
        cwd: process.cwd(),
        stdio: 'pipe'
      });
    } catch (e) {
      console.log('Push warning/error:', e.message);
      if (e.stdout) console.log(e.stdout.toString());
      if (e.stderr) console.log(e.stderr.toString());
    }

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
