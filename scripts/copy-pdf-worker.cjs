// Copies the pdf.js worker into /public so PDF rosters can be read in the browser.
const fs = require("fs");
const path = require("path");
try {
  const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
  const dest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");
  fs.copyFileSync(src, dest);
  console.log("[postinstall] pdf.js worker copied to public/");
} catch (err) {
  console.warn("[postinstall] Could not copy pdf.js worker:", err.message);
}
