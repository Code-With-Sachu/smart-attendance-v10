# Smart Attendance — Version 1.2

A fast, mobile-first attendance workspace for teachers.
**Next.js 15 · React 19 · TypeScript · Tailwind CSS · Radix UI (shadcn-style components) · Lucide icons**

```
Welcome → Home → Main Modules → Sub Modules → Roll Numbers → Attendance grid → Apply → Review → Submit → History → WhatsApp
```

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run typecheck
npm run test:e2e     # full workflow in headless Chromium (needs `npm i -D playwright` and a running server)
FIXTURES=./fixtures npm run test:e2e:v11   # V1.1 features (student files, names, WhatsApp numbers, theme)
BASE_URL=http://localhost:3000 npm run test:e2e:v12   # V1.2 features (AI agent, files, %, students, admin)
```

Deploys to Vercel as-is. **No login** — anyone can use it. `postinstall` copies the PDF reader worker into `public/`.

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Needed for | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Full AI assistant | Without it the assistant still works as a built-in **offline helper** |
| `GEMINI_MODEL` | optional | Default `gemini-flash-latest` |
| `AGENT_RATE_LIMIT` | optional | Requests per IP per 10 min (default 40) — protects your key on a public site |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | optional | WhatsApp Business Cloud API → reports reach **all saved numbers at once** automatically. Without them, one tap opens every chat via wa.me |

See `.env.example`. Never commit real keys.

## What's in V1

| Area | Details |
|---|---|
| Welcome | First-run onboarding with optional name; flag stored locally; "Show welcome screen again" in Profile |
| Layout | Collapsible sidebar (icon + tooltip when collapsed, remembered), mobile drawer, sticky header |
| Home | Greeting + date, **main module search** and **sub module search** (debounced, case-insensitive, partial, clear button, empty states), module cards, recent attendance |
| Main modules | Create / edit / duplicate (copies sub modules + rolls) / delete (confirmation). Name, number (ordering), colour (presets + custom). ⋮ menu: Open, Take Attendance, Create Sub Module, Edit, Duplicate, Delete |
| Sub modules | Same form; ⋮ menu: Take Attendance, Edit, Manage Roll Numbers, Attendance History, Create Sub Module, Delete. Cards show students, average %, last taken |
| Roll numbers | Range generator (rejects 0, negatives, decimals, text), replace-or-merge prompt, add single roll, remove with undo, clear all (confirm). Max 500 |
| **Attendance grid** | Everyone starts **present** (white). Tap → **absent** (light violet + icon + "ABSENT" text + `aria-pressed` + label "Roll 03 — Absent"). Live totals, sticky header (Present/Absent) and sticky Apply bar. Mark All Present, Clear Selection (back to starting state), Undo, Invert, Mark All Absent (confirm). Arrow-key navigation, quick entry (`3, 8, 20-24`), date / session picker |
| Drafts | Selection auto-saved on every tap. After a reload: "Unsaved Attendance Found — Restore / Discard" |
| Review | Separate Absent / Present lists + totals, Back to Attendance, Submit → "Confirm Attendance" dialog |
| Duplicate protection | Key = sub module + date + session. "Attendance Already Exists" → View Existing / Edit Existing / Save as next session. Toggle in Profile to allow duplicates |
| History | Filters: main module, sub module, date range, roll number was absent/present. "Load more" pagination. Records of deleted modules are kept |
| Detail | All fields, absent + present lists, edit (keeps original roll snapshot), delete (confirm), WhatsApp share + copy |
| Stats | Per sub module: total classes, average, highest, lowest, trend chart, per-student table with < 75% highlight |
| WhatsApp | `wa.me` deep link with a formatted report; default contact configurable in Profile. No credentials anywhere |
| Profile | Photo upload (JPG/PNG/WebP, ≤ 2 MB, preview, auto-cropped to 256 px), name, subject, teacher ID, JSON backup download |

## New in 1.1

| Feature | Details |
|---|---|
| **Dark / light mode** | Sun/moon button in the top bar (and on the welcome screen), plus Profile → Appearance. Follows the device setting until you choose; remembered per browser; no flash on load |
| **Student file upload** | Manage Roll Numbers → **Upload File** (or drag & drop). Reads Excel `.xlsx/.xls/.xlsm`, `.ods`, `.csv/.tsv`, Google Sheets (paste the link, or upload a downloaded copy), Word `.docx` (tables or one name per line), text-based PDF, `.txt`, `.json`. Finds the header row and the name / roll columns automatically; a preview lets you change columns and choose **Number 1 to N** (file order) or **use the file’s roll numbers**. Other columns are kept as student details |
| **Names everywhere** | Attendance buttons show roll + name; Review, History and the per-student stats table list names; WhatsApp reports list one student per line (`03 - Anu Mathew`). Each record stores a snapshot of names, so later edits never change history. Names can be edited inline |
| **Multiple WhatsApp numbers** | Profile → WhatsApp sharing → **Add WhatsApp Number**. Each number has a label and what it receives (absent + present, absent only, present only). After submitting, **Send to all** opens each chat in turn with its own message (WhatsApp only allows one chat per tap) |
| **Student details in Profile** | Upload student detail files once, keep them as saved lists (view, download CSV, delete) and **Use in class** for any sub module — or pick them from Manage Roll Numbers. Kept for future features |

Google Sheets links are fetched through `/api/sheet` (a small server route, Google hosts only). The sheet must be shared as **Anyone with the link → Viewer**; otherwise download it as `.xlsx` and upload the file. Scanned/photo PDFs and old binary `.doc` files can’t be read — the app says so and suggests a format that works.

## New in 1.2

| Feature | Details |
|---|---|
| **Floating AI agent** | On every page for everyone (default top-right). Drag it anywhere — position is remembered; double-click to reset. Chat by text or **voice** (mic), optional spoken replies, 7 voice languages. Knows how to use every section, reads **all data** (classes, students, every session, student %), **all uploaded files** (Profile + sub modules) and can analyse a file attached in the chat. Streams answers from Google Gemini; falls back to an exact offline helper |
| **AI Assistant page** | Navbar item + “Ask AI” button in the top bar. Full-screen chat, sources overview, voice settings, status |
| **Files everywhere** | Profile → *My files* and every sub module → *Files*: upload **many files at once** (PDF, Word, Excel, CSV, text, images · 15 MB each). Open any file to **edit** it: text editor, spreadsheet grid editor (add rows/columns, download .xlsx/.csv), rename, notes, move between Profile and sub modules, replace with a new version, download original. Stored in IndexedDB |
| **Attendance History** | Two views. *Sessions*: every attendance with filters; detail shows date, day, year, time, period, totals, absent & present lists with each student’s **overall %**. *Students*: every student’s overall and subject-wise %, below-threshold filter, CSV; student page with subject cards and a **date-wise absent/present list with time & period**, WhatsApp/Share |
| **% in Apply & Submit** | Review (apply) screen and record details show each student’s overall % in that subject (including this session); below threshold in red |
| **Share & WhatsApp on Apply** | Review screen: *Back · Share · WhatsApp · Submit*. WhatsApp submits and sends to **all saved numbers at once** (Cloud API) or opens every chat in one tap; Share uses the phone’s share sheet (any app) with a fallback sheet (WhatsApp, Telegram, Email, SMS, copy, CSV, print) |
| **Professional report** | Institution header, class, subject, full date, time & period, totals, numbered absentees/present with names and %, signature. “Plain text” style available |
| **Admin** | Overview & storage, settings (institution, threshold, message style, % in messages, assistant), backup with files / restore, Excel export (sessions, absences, per-class student %), bulk-delete records, manage all files, activity log, integration status. Open to all — no login |
| **Back / Next** | Every section ends with Back (previous page) and Next (next section in menu order) |
| **Theme** | Professional light & dark themes — **light by default**, remembered per browser |
| **Dashboard** | KPI tiles, students below threshold, quick AI entry |

## Architecture

```
src/
├── app/                         # routes (App Router)
│   ├── welcome/                 # onboarding
│   ├── page.tsx                 # home dashboard
│   ├── modules/[id]/            # main module → its sub modules
│   ├── sub-modules/[id]/        # stats + recent sessions
│   │   └── roll-numbers/
│   ├── attendance/              # class picker
│   │   └── [subId]/review/      # grid → review (?edit=<recordId> for edits)
│   ├── history/[id]/            # list + detail (?submitted=1 shows success + share)
│   ├── profile/  about/
│   ├── assistant/  admin/  history/student/
│   └── api/agent  api/whatsapp  api/sheet
├── components/
│   ├── ai/          FloatingAgent (draggable), ChatPanel (text + voice), Markdown
│   ├── files/       FileManager (multi-upload), FileEditor (text / table editor)
│   ├── history/     StudentsOverview
│   ├── layout/      Sidebar, Header, MobileNavigation, AppShell, PageHeader, Avatar, Logo
│   ├── modules/     MainModuleCard, SubModuleCard, ModuleFormModal, ModuleActionsProvider, RollNumberManager
│   ├── attendance/  RollNumberGrid, RollNumberButton, AttendanceSummary, AttendanceTaker, AttendanceReview, RollList, WhatsAppShare, stats
│   ├── profile/     ProfileForm, SettingsPanel
│   └── ui/          Button, Input/Field, Modal, ConfirmationDialog, MoreMenu, Tooltip, SearchInput, EmptyState, ColorPicker, Card/Skeleton
└── lib/
    ├── types.ts              # domain model (mirrors the planned Mongo collections)
    ├── validation.ts         # pure validators — reusable on the server in V2
    ├── store/store.ts        # actions: validate → persist → notify; never shows unsaved state
    ├── store/persistence.ts  # V1 adapter: localStorage (swap for API in V2)
    ├── store/selectors.ts    # stats and derived data
    ├── use-attendance-draft.ts
    ├── whatsapp.ts           # professional report builder + wa.me links
    ├── files/                # IndexedDB store, content extraction
    ├── ai/                   # context builder, offline helper, chat store, speech
    └── export.ts             # Excel export, backups
```

**History is immutable by design:** each record stores `mainModuleName`, `subModuleName` and the full `rollNumbers` list at the time it was taken, so renaming a module, changing rolls or deleting a module never rewrites past attendance.

## Data storage in V1

Attendance data is kept in the browser (localStorage) and uploaded files in IndexedDB on the device you use. When the AI assistant answers, the relevant data and file text are sent to Google Gemini. That makes V1 instant and offline-capable, but data doesn't sync across devices and is lost if browser data is cleared — use **Admin → Data & backup**.

## Next: Version 2 (auth + MongoDB)

The store's action methods are the seam. Planned steps:

1. `lib/db.ts` (Mongoose connection) and models `User`, `MainModule`, `SubModule` (embedded `rollNumbers`), `AttendanceRecord` with a unique index on `{ userId, subModuleId, date, session }`.
2. Route handlers / server actions per store action, each calling the same `lib/validation.ts` functions and scoping every query by the session's `userId`.
3. Auth (e.g. Auth.js or email + password with httpOnly session cookies); middleware protecting all app routes.
4. Replace `persistence.ts` with fetch calls; keep drafts in localStorage so the grid stays instant and offline-tolerant.
5. One-time import of the V1 JSON backup into the new account.
