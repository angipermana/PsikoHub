const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/login", authController.showLogin);
router.post("/login", authController.login);
router.get("/logout", authController.logout);
router.get("/force-seed", authController.forceSeed);

module.exports = router;
