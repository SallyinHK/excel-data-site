import { Router } from "express";
import { exportToSheets, importFromSheets, SHEET_URL } from "../lib/sheets";

const router = Router();

// POST /api/sheets/export
router.post("/sheets/export", async (req, res) => {
  try {
    const result = await exportToSheets();
    return res.json({ ...result, sheetUrl: SHEET_URL });
  } catch (err) {
    req.log.error({ err }, "Sheets export failed");
    return res.status(500).json({ error: "Sheets export failed" });
  }
});

// POST /api/sheets/import
router.post("/sheets/import", async (req, res) => {
  try {
    const result = await importFromSheets();
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Sheets import failed");
    return res.status(500).json({ error: "Sheets import failed" });
  }
});

export default router;
