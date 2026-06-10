require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require('express-mysql-session')(session);
const methodOverride = require("method-override");
const flash = require('connect-flash');
const multer = require('multer');
const path = require("path");
const mysql = require("mysql2");

const app = express();
const PORT = process.env.PORT || 3000;

// Database pool for session store
const dbOptions = {
  host: process.env.DB_HOST ? process.env.DB_HOST.replace(/^['"]|['"]$/g, '').replace(/\\/g, '').trim() : '',
  user: process.env.DB_USER ? process.env.DB_USER.replace(/^['"]|['"]$/g, '').replace(/\\/g, '').trim() : '',
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/^['"]|['"]$/g, '').replace(/\\/g, '').trim() : '',
  database: process.env.DB_NAME ? process.env.DB_NAME.replace(/^['"]|['"]$/g, '').replace(/\\/g, '').trim() : '',
  connectionLimit: 2,
};
const sessionStore = new MySQLStore(dbOptions);

// Middleware
app.use(methodOverride("_method"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "src/public")));

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

// Session configuration
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "fallback_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// Flash messages
app.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Add user info to locals for views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.get("/", (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === "SUPER_ADMIN") return res.redirect("/admin");
    if (req.session.user.role === "CLIENT") return res.redirect("/client");
    return res.redirect("/test/dashboard");
  }
  res.redirect("/auth/login");
});

const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const clientRoutes = require("./src/routes/client");
const testRoutes = require("./src/routes/test");

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/client", clientRoutes);
app.use("/test", testRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render("partials/404");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
