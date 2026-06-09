const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

router.use(requireAuth);
router.use(requireRole("SUPER_ADMIN"));

router.get("/", adminController.dashboard);
router.get("/clients", adminController.clients);
router.get("/clients/create", adminController.createClient);
router.post("/clients", adminController.storeClient);
router.get("/clients/:id/edit", adminController.editClient);
router.post("/clients/:id", adminController.updateClient);
router.post("/clients/:id/delete", adminController.deleteClient);

const multer = require("multer");
const upload = multer({ dest: "uploads/" });

router.get("/questions", adminController.questions);
router.get("/questions/create", adminController.createQuestion);
router.post("/questions", adminController.storeQuestion);
router.get("/questions/import", adminController.importQuestionView);
router.post("/questions/import", upload.single("csvFile"), adminController.importQuestionProcess);
router.get("/questions/:id/edit", adminController.editQuestion);
router.post("/questions/:id", adminController.updateQuestion);
router.post("/questions/:id/delete", adminController.deleteQuestion);

router.get("/packages", adminController.packages);
router.get("/packages/create", adminController.createPackage);
router.post("/packages", adminController.storePackage);
router.get("/packages/:id/edit", adminController.editPackage);
router.post("/packages/:id", adminController.updatePackage);
router.post("/packages/:id/delete", adminController.deletePackage);

router.get("/projects", adminController.projects);
router.get("/projects/create", adminController.createProject);
router.post("/projects", adminController.storeProject);
router.get("/projects/:id/edit", adminController.editProject);
router.post("/projects/:id", adminController.updateProject);
router.post("/projects/:id/delete", adminController.deleteProject);

const reportController = require("../controllers/reportController");

router.get("/reports", reportController.listReports);
router.get("/reports/:projectId", reportController.reportDetail);
router.get("/reports/:projectId/export", reportController.exportExcel);

module.exports = router;
