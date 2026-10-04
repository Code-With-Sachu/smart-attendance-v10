const { chromium } = require("playwright");
const OUT = require("path").join(__dirname, "../test-results"); require("fs").mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:3000";
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errors = [];
  async function run(name, viewport, full) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`[${name}] ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`[${name}] PAGEERROR ${e.message}`));
    const shot = async (n) => { await page.waitForTimeout(350); return page.screenshot({ path: `${OUT}/${name}-${n}.png`, fullPage: false }); };

    await page.goto(BASE + "/");
    await page.waitForURL("**/welcome");
    await shot("01-welcome");
    await page.fill("#teacher-name", "Sachu");
    await page.click("text=Get Started");
    await page.waitForURL(BASE + "/");
    await page.getByText("No Main Modules Yet").waitFor();
    await shot("02-home-empty");

    // create main module w/ validation
    await page.getByRole("button", { name: "Create Main Module" }).first().click();
    await page.fill("#module-number", "");
    await page.click("text=Create Module");
    await page.getByText("Name is required.").waitFor();
    await page.getByText("Enter a whole number of 1 or more.").waitFor();
    await shot("03-validation");
    await page.fill("#module-name", "CSE S3");
    await page.fill("#module-number", "1");
    await page.click("text=Create Module");
    await page.getByRole("link", { name: "CSE S3" }).waitFor();
    if (!full) { await ctx.close(); return; }

    // second main module & search
    await page.getByRole("button", { name: "Create Main Module" }).first().click();
    await page.fill("#module-name", "ECE S3");
    await page.click("text=Create Module");
    await page.getByRole("link", { name: "ECE S3" }).waitFor();

    await page.getByRole("link", { name: "CSE S3" }).click();
    await page.waitForURL("**/modules/**");
    await page.getByRole("button", { name: "Create Sub Module" }).first().click();
    await page.fill("#module-name", "Data Structures");
    await page.click("#module-form ~ * >> text=Create Sub Module", { strict: false }).catch(async () => {
      await page.getByRole("button", { name: "Create Sub Module" }).last().click();
    });
    await page.getByRole("link", { name: "Data Structures" }).waitFor();
    await page.getByRole("button", { name: "Create Sub Module" }).first().click();
    await page.fill("#module-name", "Operating Systems");
    await page.getByRole("button", { name: "Create Sub Module" }).last().click();
    await page.getByRole("link", { name: "Operating Systems" }).waitFor();

    // more menu on sub module
    await page.getByRole("button", { name: "More actions for Data Structures" }).click();
    await shot("04-submenu");
    await page.getByRole("menuitem", { name: "Manage Roll Numbers" }).click();
    await page.waitForURL("**/roll-numbers");
    await page.click("text=No file? Add roll numbers manually");
    await page.fill("#roll-from", "0");
    await page.fill("#roll-to", "37");
    await page.click("text=Generate Roll Numbers");
    await page.getByText("Enter a positive whole number (1, 2, 3…).").first().waitFor();
    await page.fill("#roll-from", "1.5");
    await page.click("text=Generate Roll Numbers");
    await page.fill("#roll-from", "1");
    await page.click("text=Generate Roll Numbers");
    await page.getByText("37 students").waitFor();
    await shot("05-rolls");

    // take attendance
    await page.getByRole("link", { name: "Take Attendance", exact: true }).last().click();
    await page.waitForURL("**/attendance/sm_*");
    for (const r of ["03", "08", "17", "25"]) await page.getByRole("button", { name: `Roll ${r} — Present` }).click();
    await page.getByRole("button", { name: "Roll 25 — Absent" }).waitFor();
    await shot("06-grid");
    await page.screenshot({ path: `${OUT}/${name}-06b-grid-full.png`, fullPage: true });

    // reload → restore prompt
    await page.reload();
    await page.getByText("Unsaved Attendance Found").waitFor();
    await shot("07-restore");
    await page.getByRole("button", { name: "Restore" }).click();
    await page.getByRole("button", { name: "Roll 17 — Absent" }).waitFor();

    // keyboard toggle
    await page.getByRole("button", { name: "Roll 17 — Absent" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Roll 18 — Absent" }).waitFor();
    await page.keyboard.press("Space");
    // quick entry
    await page.fill("#quick-entry", "30-31, 99");
    await page.keyboard.press("Enter");
    await page.getByText("Not in this class: 99").waitFor();
    await page.fill("#quick-entry", "");

    await page.getByRole("button", { name: "Apply Section" }).click();
    await page.waitForURL("**/review");
    await page.getByText("ABSENT STUDENTS — 4").waitFor();
    await shot("08-review");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByText("Once submitted, this attendance record will be saved.").waitFor();
    await shot("09-confirm");
    await page.getByRole("button", { name: "Confirm & Submit" }).click();
    await page.waitForURL("**/history/**");
    await page.getByText("Attendance submitted successfully").first().waitFor();
    await shot("10-submitted");
    const href = await page.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href");
    console.log("WA:", decodeURIComponent(href).slice(0, 200));

    // duplicate: go again, set session 1
    await page.goto(page.url().replace(/history.*/, "attendance"));
    await page.getByRole("link", { name: /Data Structures/ }).click();
    await page.waitForURL("**/attendance/sm_*");
    await page.getByRole("button", { name: "Roll 05 — Present" }).click();
    await page.getByRole("button", { name: /Change date or session|October|Session/ }).first().click();
    await page.fill("#session-number", "1");
    await page.getByText("already exists").waitFor();
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Apply Section" }).click();
    await page.getByText("Attendance already exists for this session.").waitFor();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByRole("heading", { name: "Attendance Already Exists" }).waitFor();
    await shot("11-duplicate");
    await page.getByRole("button", { name: /Save as Session 2/ }).click();
    await page.waitForURL("**/history/**");

    // history
    await page.goto(BASE + "/history");
    await page.getByText("Showing all 2").waitFor();
    await shot("12-history");
    // sub module stats
    await page.goto(BASE + "/sub-modules");
    await page.getByRole("link", { name: "Data Structures" }).click();
    await page.getByText("Total Classes").waitFor();
    await page.screenshot({ path: `${OUT}/${name}-13-subdetail.png`, fullPage: true });
    // home
    await page.goto(BASE + "/");
    await page.getByPlaceholder("Search sub modules…").fill("oper");
    await page.getByText("Sub modules matching").waitFor();
    await page.screenshot({ path: `${OUT}/${name}-14-home.png`, fullPage: true });
    // delete main module
    await page.getByPlaceholder("Search sub modules…").fill("");
    await page.getByRole("button", { name: "More actions for ECE S3" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByText('Delete “ECE S3”?').waitFor();
    await shot("15-delete");
    await page.getByRole("button", { name: "Delete" }).last().click();
    await page.getByText("“ECE S3” deleted").waitFor();
    await page.goto(BASE + "/profile");
    await shot("16-profile");
    if (viewport.width < 1000) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await shot("17-drawer");
    }
    await ctx.close();
  }
  try {
    await run("mobile", { width: 390, height: 844 }, true);
    await run("desktop", { width: 1440, height: 900 }, true);
  } catch (e) {
    console.error("FAIL", e.message);
  }
  console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
  await browser.close();
})();
