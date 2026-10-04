/**
 * How-to knowledge for the assistant. Each topic is used both as context for the AI model
 * and by the offline helper (keyword match), so keep the text practical and accurate.
 */
export interface GuideTopic {
  id: string;
  title: string;
  href: string;
  keywords: string[];
  body: string;
}

export const GUIDE: GuideTopic[] = [
  {
    id: "overview",
    title: "What Smart Attendance does",
    href: "/",
    keywords: ["what", "overview", "start", "begin", "website", "app", "use", "how", "help", "workflow", "steps"],
    body:
      "Smart Attendance is a free attendance workspace — no login needed, anyone can use it. Workflow: 1) create a Main Module (a class, e.g. CSE S3), 2) add Sub Modules (subjects), 3) upload the student list or generate roll numbers, 4) Take Attendance — everyone starts present, tap only absentees, 5) Apply → review absent/present lists with each student’s %, 6) Submit (or Submit & WhatsApp / Share), 7) see everything in Attendance History. Data is saved in this browser; download a backup from Admin.",
  },
  {
    id: "profile",
    title: "Profile",
    href: "/profile",
    keywords: ["profile", "photo", "name", "teacher", "subject", "my files", "upload file", "whatsapp number", "theme", "dark", "light"],
    body:
      "Profile: set your name, subject, teacher ID and photo (shown in shared reports). ‘My files’ lets you upload many files at once (PDF, Word, Excel, CSV, text, images) and open any file to edit its content, rename it, add notes, move it to a sub module or replace it. ‘Student details’ keeps uploaded student lists to reuse in any class. ‘WhatsApp sharing’ holds all WhatsApp numbers that receive reports (each can get absent+present, absent only or present only). Appearance switches light/dark mode (light is the default).",
  },
  {
    id: "home",
    title: "Home dashboard",
    href: "/",
    keywords: ["home", "dashboard", "search", "recent", "kpi", "overview"],
    body: "Home shows today’s summary, key numbers (classes, students, sessions, average attendance), students below the threshold, search for main and sub modules, your module cards and recent attendance.",
  },
  {
    id: "main-modules",
    title: "Main Modules",
    href: "/modules",
    keywords: ["main module", "class", "create class", "duplicate", "delete module", "edit module", "colour", "color"],
    body: "Main Modules are classes or groups. Create with a name, number (for ordering) and colour. The ⋮ menu offers Open, Take Attendance, Create Sub Module, Edit, Duplicate (copies sub modules and students) and Delete. Deleting a module keeps its attendance history.",
  },
  {
    id: "sub-modules",
    title: "Sub Modules",
    href: "/sub-modules",
    keywords: ["sub module", "subject", "create subject", "files", "stats", "trend", "sub-module"],
    body: "Sub Modules are subjects inside a main module. Open one to see stats (total classes, average, highest, lowest), the attendance trend, each student’s %, recent sessions and the sub module’s Files — upload several files at once and edit them later. The ⋮ menu has Take Attendance, Edit, Manage Roll Numbers, Attendance History and Delete.",
  },
  {
    id: "roll-numbers",
    title: "Students & roll numbers",
    href: "/sub-modules",
    keywords: ["roll", "roll number", "student list", "import", "excel", "google sheet", "csv", "add student", "names", "upload students"],
    body: "Sub module → Manage Roll Numbers: upload a student file (Excel, Google Sheets link shared as ‘Anyone with the link’, CSV, PDF, Word, text). A preview lets you pick the name and roll columns and number students 1 to N or keep the file’s roll numbers. You can also use a saved list from Profile, generate a range (e.g. 1–60), add one student, rename inline or remove with undo. Changing the list never changes past attendance.",
  },
  {
    id: "take-attendance",
    title: "Taking attendance",
    href: "/attendance",
    keywords: ["take attendance", "mark", "absent", "present", "tap", "grid", "quick entry", "session", "period", "date", "undo", "draft"],
    body: "Take Attendance → pick a subject. Everyone starts present; tap a roll to mark absent (tap again to undo). Tools: Mark All Present, Clear Selection, Undo, Invert, Mark All Absent, Quick entry (type ‘3, 8, 20-24’). Tap the date line to change date or period/session. Selections auto-save as a draft. Press ‘Apply Section’ to review.",
  },
  {
    id: "apply-submit",
    title: "Apply, review & submit",
    href: "/attendance",
    keywords: ["apply", "review", "submit", "confirm", "percentage", "duplicate", "share", "whatsapp", "send"],
    body: "The Apply/Review screen shows the absent and present lists side by side with each student’s overall % in that subject (including this session; below the threshold is red). Buttons: Back, Share (submit then open any app), WhatsApp (submit then send to every saved number at once), Submit. If attendance already exists for that date and period you can view it, edit it or save as the next session.",
  },
  {
    id: "whatsapp",
    title: "WhatsApp sharing",
    href: "/profile#whatsapp",
    keywords: ["whatsapp", "share", "message", "send", "numbers", "multiple", "group", "broadcast", "report"],
    body: "Add WhatsApp numbers in Profile → WhatsApp sharing. After submitting, ‘WhatsApp all numbers’ sends the professional report to every saved number in one tap: with the WhatsApp Business Cloud API configured on the server it is delivered to all numbers at once; otherwise one tap opens every chat (allow pop-ups) and you press send in each. The Share button uses your phone’s share sheet (any app) or offers WhatsApp, Telegram, Email, SMS, copy, CSV and print. Message style and including % are set in Admin → Settings.",
  },
  {
    id: "history",
    title: "Attendance History",
    href: "/history",
    keywords: ["history", "previous", "records", "filter", "students", "report", "percentage", "absent dates", "present dates", "details", "edit record", "delete record"],
    body: "Attendance History has two views. ‘Attendance Sessions’ lists every submitted attendance with filters (main module, sub module, date range, roll was absent/present); open one for its details: date, day, year, time, period, totals, absent and present lists with each student’s %, edit/delete and share. ‘Students’ shows every student’s overall and subject-wise % (filter below threshold, export CSV); open a student for subject cards and a date-wise list of absent and present classes with time and period, plus WhatsApp/Share of the student report.",
  },
  {
    id: "assistant",
    title: "AI Assistant",
    href: "/assistant",
    keywords: ["assistant", "ai", "agent", "chat", "voice", "mic", "speak", "move", "drag", "files", "analyse", "analyze"],
    body: "The AI Assistant floats on every page (default top-right). Drag it anywhere; double-click the bubble to reset its position. Type or tap the mic to speak; turn on ‘Read replies aloud’ for voice answers. It knows how to use every section, reads all attendance data, student reports and every file in Profile and sub modules, and can analyse them. Attach a file in the chat to analyse it without saving. The AI Assistant page in the menu gives a full-screen chat and settings.",
  },
  {
    id: "admin",
    title: "Admin",
    href: "/admin",
    keywords: ["admin", "backup", "restore", "export", "excel", "clear", "delete all", "settings", "threshold", "institution", "activity", "log", "storage"],
    body: "Admin (open to everyone, no login): overview of all data and storage, backup download (optionally with files) and restore, export everything to Excel, bulk delete records by date range, manage every uploaded file, settings (institution name, low-attendance threshold, WhatsApp message style, include % in messages, assistant name/voice/language), integration status (AI model, WhatsApp API) and the activity log.",
  },
  {
    id: "data",
    title: "Where data is stored",
    href: "/admin",
    keywords: ["data", "storage", "lost", "device", "sync", "browser", "privacy", "offline"],
    body: "All data stays in this browser (localStorage for attendance, IndexedDB for files). It doesn’t sync between devices and is removed if browser data is cleared — download a backup in Admin regularly. When you chat with the AI assistant, the relevant data and file contents are sent to the AI model to answer.",
  },
];

export const guideAsText = () => GUIDE.map((g) => `## ${g.title} (${g.href})\n${g.body}`).join("\n\n");
