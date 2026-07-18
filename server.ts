import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import AdmZip from "adm-zip";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to handle JSON
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API endpoint to export code. Disabled by default because it exposes source files.
  app.get("/api/export-code", (req, res) => {
    const exportEnabled = process.env.ENABLE_CODE_EXPORT === "true";
    const exportToken = process.env.EXPORT_CODE_TOKEN;
    const providedToken = req.get("x-export-code-token");

    if (!exportEnabled || !exportToken || providedToken !== exportToken) {
      return res.status(403).json({ error: "Code export is disabled or unauthorized" });
    }

    try {
      const zip = new AdmZip();
      const rootDir = process.cwd();
      
      // Add files and folders excluding node_modules and dist
      const entries = fs.readdirSync(rootDir);
      entries.forEach(entry => {
        if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry.startsWith('.')) {
          return;
        }
        
        const fullPath = path.join(rootDir, entry);
        if (fs.lstatSync(fullPath).isDirectory()) {
          zip.addLocalFolder(fullPath, entry);
        } else {
          zip.addLocalFile(fullPath);
        }
      });

      const zipBuffer = zip.toBuffer();
      
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', 'attachment; filename=gold-app-source.zip');
      res.send(zipBuffer);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Failed to export code" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

