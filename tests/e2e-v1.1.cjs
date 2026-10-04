/**
 * V1.1 features: theme toggle, student-file upload (xlsx/csv/docx/pdf/txt), names on the
 * attendance grid + review + history, multiple WhatsApp numbers, Profile student lists.
 * Usage: BASE_URL=http://localhost:3000 FIXTURES=/path/to/fixtures node tests/e2e-v1.1.cjs
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const OUT = path.join(__dirname, "../test-results");
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:3000";
const FX = process.env.FIXTURES;

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT: " + msg);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  const shot = async (n, full = false) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/v11-${n}.png`, fullPage: full });
  };

  // Welcome + theme toggle
  await page.goto(BASE + "/");
  await page.waitForURL("**/welcome");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  assert(await page.evaluate(() => document.documentElement.classList.contains("dark")), "dark class set");
  await shot("01-welcome-dark");
  await page.fill("#teacher-name", "Sachu");
  await page.click("text=Get Started");
  await page.waitForURL(BASE + "/");

  // reload keeps dark (no flash script)
  await page.reload();
  assert(await page.evaluate(() => document.documentElement.classList.contains("dark")), "dark persists after reload");

  // module + sub module
  await page.getByRole("button", { name: "Create Main Module" }).first().click();
  await page.fill("#module-name", "CSE S3");
  await page.click("text=Create Module");
  await page.getByRole("link", { name: "CSE S3" }).click();
  await page.waitForURL("**/modules/**");
  await page.getByRole("button", { name: "Create Sub Module" }).first().click();
  await page.fill("#module-name", "Data Structures");
  await page.getByRole("button", { name: "Create Sub Module" }).last().click();
  await page.getByRole("link", { name: "Data Structures" }).waitFor();
  await page.getByRole("button", { name: "More actions for Data Structures" }).click();
  await page.getByRole("menuitem", { name: "Manage Roll Numbers" }).click();
  await page.waitForURL("**/roll-numbers");
  await shot("02-roll-page-empty-dark");

  // Each format parses
  for (const [file, expect] of [["class.csv", 12], ["class.docx", 12], ["class.pdf", 12], ["class.txt", 12]]) {
    await page.setInputFiles('input[type=file][aria-label="Upload student file"]', path.join(FX, file));
    await page.getByRole("dialog", { name: "Check the student list" }).waitFor();
    const txt = await page.getByRole("dialog").innerText();
    assert(txt.includes(`${expect} students found`), `${file}: ${expect} students found — got:\n${txt.slice(0, 400)}`);
    assert(txt.includes("Aarav Nair") && txt.includes("Keerthana R"), `${file}: names present`);
    if (file === "class.pdf") await shot("03-preview-pdf");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }

  // xlsx: header on row 3, "Sl No" → numbered 1..N, extra sheet ignored
  await page.setInputFiles('input[type=file][aria-label="Upload student file"]', path.join(FX, "class.xlsx"));
  await page.getByRole("dialog", { name: "Check the student list" }).waitFor();
  assert((await page.locator("#imp-name option:checked").innerText()) === "Student Name", "name column detected");
  await shot("04-preview-xlsx");
  await page.getByRole("button", { name: /Import 12 students/ }).click();
  await page.getByText("12 students").first().waitFor();
  await page.getByText("Arjun Pillai").waitFor();
  await shot("05-students-dark");

  // edit a name inline
  await page.getByRole("button", { name: "Edit name for roll 12" }).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Keerthana Rajan");
  await page.keyboard.press("Enter");
  await page.getByText("Keerthana Rajan").waitFor();

  // Take attendance: name buttons
  await page.getByRole("link", { name: "Take Attendance", exact: true }).last().click();
  await page.waitForURL("**/attendance/sm_*");
  await page.getByRole("button", { name: "Roll 03 Ameya Krishnan — Present" }).click();
  await page.getByRole("button", { name: "Roll 07 Fathima Rahman — Present" }).click();
  await page.getByRole("button", { name: "Roll 07 Fathima Rahman — Absent" }).waitFor();
  await shot("06-grid-names-dark");

  // light mode screenshot of grid
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await shot("07-grid-names-light");

  await page.getByRole("button", { name: /Apply Section/ }).click();
  await page.waitForURL("**/review");
  const review = await page.locator("main").innerText();
  assert(review.includes("ABSENT STUDENTS — 2") && review.includes("Fathima Rahman") && review.includes("PRESENT STUDENTS — 10"), "review lists with names");
  await shot("08-review-light", true);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & Submit" }).click();
  await page.waitForURL("**/history/**");
  await page.getByText("Send the absent & present lists").waitFor();
  const shareHref = await page.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href");
  const msg = decodeURIComponent(shareHref.split("text=")[1]);
  assert(msg.includes("*ABSENT STUDENTS (2):*\n03 - Ameya Krishnan\n07 - Fathima Rahman"), "WhatsApp message has names:\n" + msg);
  assert(msg.includes("12 - Keerthana Rajan"), "edited name in message");
  await shot("09-submitted-light");

  // Profile: multiple numbers + saved list
  await page.goto(BASE + "/profile");
  await page.getByRole("button", { name: "Add WhatsApp Number" }).click();
  await page.locator('input[id^="wa-num-"]').nth(0).fill("+91 98765 43210");
  await page.locator('input[id^="wa-label-"]').nth(0).fill("HOD");
  await page.getByRole("button", { name: "Add WhatsApp Number" }).click();
  await page.locator('input[id^="wa-num-"]').nth(1).fill("12");
  await page.getByRole("button", { name: "Save numbers" }).click();
  await page.getByText("Enter a number with country code").waitFor();
  await page.locator('input[id^="wa-num-"]').nth(1).fill("+91 90000 11111");
  await page.locator('select[id^="wa-send-"]').nth(1).selectOption("absent");
  await page.getByRole("button", { name: "Save numbers" }).click();
  await page.getByText("Saved 2 WhatsApp numbers").waitFor();

  await page.setInputFiles('#students input[type=file]', path.join(FX, "class.csv"));
  await page.getByRole("dialog", { name: "Check the student list" }).waitFor();
  // CSV has "Roll No" 2,4,6… → defaults to file roll numbers
  const csvTxt = await page.getByRole("dialog").innerText();
  assert(csvTxt.includes("Roll numbers 02–24"), "csv uses file roll numbers: " + csvTxt.slice(0, 300));
  await page.getByRole("button", { name: /Save 12 students/ }).click();
  await page.getByText("class", { exact: true }).waitFor();
  await shot("10-profile-light", true);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await shot("11-profile-dark", true);

  // history detail: per-contact sends
  await page.goto(BASE + "/history");
  await page.locator('a[href^="/history/att_"]').first().click();
  await page.getByRole("button", { name: "WhatsApp all 2 numbers" }).waitFor();
  const hodHref = await page.getByRole("link", { name: "Send to HOD" }).getAttribute("href");
  assert(hodHref.startsWith("https://wa.me/919876543210?text="), "HOD link number");
  const absOnly = decodeURIComponent((await page.getByRole("link", { name: "Send to +919000011111" }).getAttribute("href")).split("text=")[1]);
  assert(absOnly.includes("ABSENT STUDENTS") && !absOnly.includes("PRESENT STUDENTS"), "absent-only contact message");
  const [popup] = await Promise.all([ctx.waitForEvent("page"), page.getByRole("button", { name: "WhatsApp all 2 numbers" }).click()]);
  await popup.close().catch(() => {});
  await page.getByRole("button", { name: "Send to next (2 of 2)" }).waitFor();
  await shot("12-history-share-dark");

  // Apply saved list to the class from Profile
  await page.goto(BASE + "/profile");
  await page.getByRole("button", { name: "Use in class" }).click();
  await page.selectOption("#apply-sub", { label: "Data Structures (12 students)" });
  await page.getByRole("button", { name: "Apply list" }).click();
  await page.getByText("Data Structures now has 12 students").waitFor();

  // mobile screenshots
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  await mp.goto(page.url().replace("/profile", "") + "/attendance");
  await mp.getByRole("link", { name: /Data Structures/ }).first().click();
  await mp.waitForURL("**/attendance/sm_*");
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: `${OUT}/v11-13-mobile-grid.png` });
  await m.close();

  await browser.close();
  if (errors.length) {
    console.log("Console errors:\n" + errors.join("\n"));
    process.exitCode = 1;
  } else console.log("V1.1 E2E PASSED");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
