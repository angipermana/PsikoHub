const express = require("express");
const router = express.Router();
const testController = require("../controllers/testController");

// C1: Halaman Pendaftaran via Token (Validate token & Register)
router.get("/:token", testController.validateToken);
router.post("/:token/register", testController.registerParticipant);

// C2: Halaman Persiapan / Setup (Terms, Rules, Permissions)
router.get("/:token/setup", testController.setupTest);
router.post("/:token/start", testController.startTest);

// C3: Halaman Pengerjaan Ujian
router.get("/:token/run", testController.runTest);

// Endpoint API untuk ujian
router.post("/:token/api/answer", testController.saveAnswer);
router.post("/:token/api/proctoring", testController.logProctoring);
router.post("/:token/submit", testController.submitTest);

// C4: Selesai
router.get("/:token/finish", testController.finishTest);

module.exports = router;
