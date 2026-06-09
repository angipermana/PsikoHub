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
