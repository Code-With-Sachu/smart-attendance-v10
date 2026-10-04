const { chromium } = require("playwright");
const fs = require("fs");
/** V1.2: AI agent, files, percentages, students view, admin. Usage: BASE_URL=http://localhost:3000 CHROMIUM=/path/to/chrome node tests/e2e-v1.2.cjs */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const shots = require("path").join(__dirname, "../test-results/v12"); fs.mkdirSync(shots, { recursive: true });
const TMP = require("os").tmpdir();

function seed() {
  const now = new Date();
  const iso = (d) => d.toISOString();
  const dstr = (off) => { const d = new Date(now); d.setDate(d.getDate() - off); return d.toISOString().slice(0, 10); };
  const names = ["Anu Mathew","Bibin Joseph","Catherine Roy","Devika S","Elvin Thomas","Fathima N","Gokul Raj","Hari Krishnan","Irene Paul","Jithin M"];
  const students = names.map((n, i) => ({ roll: i + 1, name: n }));
  const rolls = students.map((s) => s.roll);
  const nm = Object.fromEntries(students.map((s) => [String(s.roll), s.name]));
  const records = [];
  for (let i = 0; i < 6; i++) {
    const absent = i % 2 ? [3, 7] : [3];
    records.push({ id: "att_" + i, mainModuleId: "mm1", subModuleId: i < 4 ? "sm1" : "sm2", mainModuleName: "CSE S3", subModuleName: i < 4 ? "Data Structures" : "OOP", date: dstr(i), session: 1, takenAt: iso(new Date(now.getTime() - i * 86400000)), rollNumbers: rolls, absent, present: rolls.filter((r) => !absent.includes(r)), names: nm, createdAt: iso(now), updatedAt: iso(now), editCount: 0 });
  }
  return {
    version: 1, activity: [],
    mainModules: [{ id: "mm1", name: "CSE S3", number: 1, color: "#6366F1", createdAt: iso(now), updatedAt: iso(now) }],
    subModules: [
      { id: "sm1", mainModuleId: "mm1", name: "Data Structures", number: 1, color: "#0EA5E9", rollNumbers: rolls, students, createdAt: iso(now), updatedAt: iso(now) },
      { id: "sm2", mainModuleId: "mm1", name: "OOP", number: 2, color: "#22C55E", rollNumbers: rolls, students, createdAt: iso(now), updatedAt: iso(now) },
    ],
    records, studentLists: [],
    profile: { name: "Sachin Kumar", subject: "Computer Science", teacherId: "KTU-1", photo: null },
    settings: { onboarded: true, whatsappNumber: "", whatsappContacts: [{ id: "wa1", label: "HOD", number: "+919876543210", send: "both" }, { id: "wa2", label: "Class group admin", number: "+919812345678", send: "absent" }], allowDuplicateSessions: false, sidebarCollapsed: false },
  };
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
  await page.goto(BASE + "/about");
  await page.evaluate((d) => localStorage.setItem("smart-attendance:data:v1", JSON.stringify(d)), seed());
  await page.goto(BASE + "/");
  await page.waitForSelector("text=Key numbers", { state: "attached" }).catch(() => {});
  await page.waitForTimeout(800);
  const theme = await page.evaluate(() => document.documentElement.classList.contains("dark") ? "dark" : "light");
  console.log("default theme:", theme);
  await page.screenshot({ path: shots + "/01-home.png", fullPage: true });

  // Agent bubble position
  const bubble = page.getByRole("button", { name: /Open Attendance Assistant/ });
  const box = await bubble.boundingBox();
  console.log("bubble default box", box);
  // drag it
  await page.mouse.move(box.x + 28, box.y + 28); await page.mouse.down();
  await page.mouse.move(300, 500, { steps: 8 }); await page.mouse.up();
  const box2 = await bubble.boundingBox();
  console.log("after drag", box2);
  // open via click
  await bubble.click();
  await page.waitForTimeout(400);
  await page.getByRole("dialog", { name: /chat/ }).getByRole("textbox").fill("Which students are below 75%?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shots + "/02-agent.png" });
  const reply = await page.locator('[role="dialog"]').innerText();
  console.log("AGENT REPLY:", reply.slice(0, 600).replace(/\n+/g, " | "));
  for (const q of ["attendance of roll 3", "who was absent today", "how do I take attendance", "give me a summary"]) {
    await page.getByRole("dialog", { name: /chat/ }).getByRole("textbox").fill(q);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
  }
  const reply2 = await page.locator('[role="dialog"]').innerText();
  console.log("AGENT REPLY2:", reply2.slice(-900).replace(/\n+/g, " | "));
  await page.screenshot({ path: shots + "/03-agent-more.png" });
  await page.keyboard.press("Escape");

  // Profile files upload
  fs.writeFileSync(TMP + "/syllabus.txt", "Data Structures syllabus\nModule 1: Arrays and linked lists\nModule 2: Trees and graphs\nExam on 20 November");
  fs.writeFileSync(TMP + "/marks.csv", "Roll,Name,Internal\n1,Anu Mathew,38\n3,Catherine Roy,22\n");
  await page.goto(BASE + "/profile");
  await page.waitForTimeout(800);
  await page.setInputFiles('input[aria-label="Upload files to My files"]', [TMP + "/syllabus.txt", TMP + "/marks.csv"]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: shots + "/04-profile-files.png", fullPage: true });
  // edit marks.csv
  await page.getByRole("button", { name: "Edit marks.csv" }).click();
  await page.waitForTimeout(500);
  await page.getByLabel("Row 3, column 3").fill("25");
  await page.screenshot({ path: shots + "/05-file-editor.png" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForTimeout(800);

  // agent reading files
  await page.getByRole("button", { name: "Ask the AI assistant" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("dialog", { name: /chat/ }).getByRole("textbox").fill("search files for trees");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  console.log("FILE ANSWER:", (await page.locator('[role="dialog"]').innerText()).slice(-400).replace(/\n+/g, " | "));
  await page.keyboard.press("Escape");

  // Sub module files
  await page.goto(BASE + "/sub-modules/sm1");
  await page.waitForTimeout(800);
  await page.setInputFiles('input[aria-label="Upload files to Data Structures files"]', [TMP + "/syllabus.txt"]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shots + "/06-sub-module.png", fullPage: true });

  // Take attendance -> review
  await page.goto(BASE + "/attendance/sm1");
  await page.waitForTimeout(1000);
  const discard = page.getByRole("button", { name: "Discard" });
  if (await discard.isVisible().catch(() => false)) await discard.click();
  await page.getByRole("button", { name: /Roll 05/ }).first().click();
  await page.getByRole("button", { name: /Apply Section/ }).click();
  await page.waitForURL(/review/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + "/07-review.png", fullPage: true });
  await page.getByRole("button", { name: /^Submit$/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Confirm & Submit" }).click();
  await page.waitForURL(/history\/att_/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + "/08-detail.png", fullPage: true });

  await page.goto(BASE + "/history?view=students");
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + "/09-students.png", fullPage: true });
  await page.goto(BASE + "/history/student?main=mm1&roll=3");
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + "/10-student.png", fullPage: true });
  await page.goto(BASE + "/admin#settings");
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + "/11-admin-settings.png", fullPage: true });
  await page.goto(BASE + "/admin");
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + "/12-admin.png", fullPage: true });
  await page.goto(BASE + "/assistant");
  await page.waitForTimeout(800);
  await page.screenshot({ path: shots + "/13-assistant.png" });

  // dark mode
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: shots + "/14-dark.png" });

  // mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  await mp.goto(BASE + "/about");
  await mp.evaluate((d) => localStorage.setItem("smart-attendance:data:v1", JSON.stringify(d)), seed());
  await mp.goto(BASE + "/history/att_0");
  await mp.waitForTimeout(1000);
  await mp.screenshot({ path: shots + "/15-mobile-detail.png" });
  await mp.getByRole("button", { name: /Open Attendance Assistant/ }).tap();
  await mp.waitForTimeout(500);
  await mp.screenshot({ path: shots + "/16-mobile-agent.png" });

  console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
