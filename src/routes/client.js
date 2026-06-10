const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

// Hanya user dengan role CLIENT yang bisa masuk
router.use(requireAuth);
router.use(requireRole("CLIENT"));

router.get("/", clientController.dashboard);
router.get("/reports/:projectId", clientController.reportDetail);
router.get("/reports/:projectId/export", clientController.exportExcel);

module.exports = router;
