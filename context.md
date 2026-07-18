# Project Context: Bakaboria

Bakaboria is a Next.js web application designed to manage, analyze, and generate academic exam papers. It integrates MongoDB (via Mongoose) and Gemini 2.5 Flash (`@google/genai` API) to upload, categorize, search, analyze, and download document PDFs (either stored locally or proxy-downloaded from Google Drive). It also includes a node-based hierarchy management system (via a retro-style terminal emulator interface).

---

## 🛠️ Technology Stack

*   **Framework**: Next.js 16 (App Router)
*   **Language**: TypeScript
*   **Database**: MongoDB via Mongoose
*   **Authentication**: NextAuth.js v5 (Google OAuth + Credentials Provider with registration flow)
*   **Styling**: TailwindCSS v4
*   **AI Integration**: Google GenAI SDK (`@google/genai`), utilizing `gemini-2.5-flash`

---

## 📂 File Directory Map

```text
bakaboria/
├── app/
│   ├── api/
│   │   ├── auth/                      # NextAuth configuration and API endpoints
│   │   ├── documents/                 # Document retrieval and tag-based filtering API
│   │   ├── download/                  # Local/Drive PDF download and streaming API
│   │   ├── gemini/                    # Runs PDF document analysis through Gemini
│   │   ├── hierarchy/                 # Node/parent/child tree navigation commands execution
│   │   ├── migrate-documents/         # Utility migration API for backfilling fields
│   │   └── upload/                    # File registration API (local or Google Drive links)
│   ├── components/
│   │   └── GoogleSignInBtn.tsx        # UI button component for Google OAuth
│   ├── gemini_test/
│   │   └── page.tsx                   # Diagnostic page to run Gemini document processing
│   ├── get_doc/
│   │   └── page.tsx                   # UI page to browse, search, and download documents
│   ├── page/
│   │   └── page.tsx                   # Redirect or landing wrapper
│   ├── signIn/
│   │   └── page.tsx                   # Custom Sign In page (Google & Credentials)
│   ├── terminal/
│   │   └── page.tsx                   # Interactive retro command-line directory/node manager
│   ├── test_pages/
│   │   └── page.tsx                   # Sandbox/diagnostic file testing page
│   ├── upload_doc/
│   │   └── page.tsx                   # UI form to add documents (PDF or Drive links)
│   ├── layout.tsx                     # Main layout
│   ├── page.tsx                       # Home landing page
│   ├── providers.tsx                  # NextAuth and context providers
│   ├── auth.config.ts                 # NextAuth settings & edge callbacks
│   ├── auth.ts                        # NextAuth core setup & credentials registration logic
│   └── globals.css                    # Base Tailwind style rules
├── docus/                             # Target local directory for uploaded PDFs
├── for_IDE/
│   └── VibeSummary                    # Brief summary of the project
├── lib/
│   ├── db.ts                          # Mongoose connection utility
│   └── gemini.ts                      # Core Gemini processing & exam generator function logic
├── models/
│   ├── Document.ts                    # Document metadata Mongoose Schema
│   ├── GeminiResult.ts                # Extracted Gemini structural JSON output mapping
│   ├── Hierarchy.ts                   # Nodes hierarchy (parent/children relationships) Schema
│   └── users.ts                       # Users credentials and profile Schema
├── next.config.ts                     # Next.js configuration
├── package.json                       # Project dependencies and script details
└── tsconfig.json                      # TypeScript Configuration
```

---

## 💾 Database Schemas (`models/`)

### 1. User Schema ([users.ts](file:///c:/Users/AIO12TH-RTX30WHITE/bakaboria/models/users.ts))
Stores credentials and OAuth user profiles:
- `uid`: Unique User ID string.
- `username`: Plaintext username.
- `email`: Unique email address.
- `password`: Plaintext password (optional, not stored for Google OAuth).
- `image`: URL string for OAuth avatar.
- `role`: Authorization role (`"user"` or `"admin"`, defaults to `"user"`).

### 2. Document Schema ([Document.ts](file:///c:/Users/AIO12TH-RTX30WHITE/bakaboria/models/Document.ts))
Handles uploaded file metadata:
- `uid`: Owner user ID.
- `name`: Document display name.
- `password`: Optional password to unlock/download the file.
- `tags` / `primaryTags` / `propertyTags`: Categorization tags.
- `hidden`: Boolean visibility flag (filters files in `/get_doc`).
- `hiddenTags`: Secret tags that unlock access to hidden files when searched.
- `processed` / `reviewed`: Boolean status of Gemini parsing.
- `fileLocation`: Local file path (in `docus/`) or Google Drive share link.
- `fileName` / `fileSize` / `mimeType`: Technical file metadata.
- `storeMethod`: Enum `"PDF"` or `"DRIVE"`.
- `caste`: Array of Hierarchy ObjectID references that this file belongs to.

### 3. Hierarchy Schema ([Hierarchy.ts](file:///c:/Users/AIO12TH-RTX30WHITE/bakaboria/models/Hierarchy.ts))
Manages custom tree structures:
- `Name`: Node label (e.g. `"Cairo University"`).
- `tag_Name`: Unique tag/abbreviation (e.g. `"CUFE"`).
- `parents`: Array of parent objects containing `{ "p-name": string, "p-id": ObjectId }`.
- `children`: Array of child objects containing `{ "p-name": string, "p-id": ObjectId }`.
- `files`: Array of Document ObjectId references.

### 4. Gemini Result Schema ([GeminiResult.ts](file:///c:/Users/AIO12TH-RTX30WHITE/bakaboria/models/GeminiResult.ts))
Saves the structural JSON result returned by Gemini analysis:
- `_id`: 1-to-1 matching `_id` of the parsed `Document`.
- `result`: Mixed schema containing structured JSON data.

---

## 🧠 Gemini Analysis & Generation Pipeline ([gemini.ts](file:///c:/Users/AIO12TH-RTX30WHITE/bakaboria/lib/gemini.ts))

The application uses the `@google/genai` SDK on `gemini-2.5-flash` to process exams.

### Analysis (`processWithGemini`)
1. Fetches document metadata.
2. Loads PDF bytes (either locally or proxied/downloaded from Google Drive).
3. Base64-encodes the file and sends it to Gemini with a custom prompt instructing it to extract:
   - **Exam Metadata**: Duration (`exam length`), type (`exam` | `sheet` | `summary`), total marks.
   - **Section Types**: Array of objects (`section`, `type`, `count`, `total_marks`).
   - **Cognitive Distribution**: Percentages for memory definition recall (`recall_percent`), calculation/analysis (`analytical_calculation_percent`), and design/troubleshooting constraints (`design_and_troubleshoot_percent`). Sum must be 100%.
   - **Topic Weightings**: Average marks per core syllabus topic.
   - **Blacklist**: Past scenario settings, application contexts, or engineering word-problems to avoid cloning.
   - **Exam Content**: Direct high-fidelity array of all questions.
4. Enforces the structure using `responseSchema` and `responseMimeType: "application/json"`.
5. Stores the JSON response in the `GeminiResult` collection.

### Generation (`generateExamWithGemini`)
Takes a list of file IDs and a user-provided prompt, builds context based on the corresponding `GeminiResult` records, and asks Gemini to design a new exam matching the reference curriculum and structure without duplicating blacklisted scenarios.

---

## 🌐 API Endpoint Specifications (`app/api/`)

### 1. Document Management
- **`GET /api/documents`**: Retrieves matching document metadata list. Filters hidden files unless queried with matching `hiddenTags`.
- **`POST /api/upload`**: Accepts `storeMethod` (`"PDF"` or `"DRIVE"`), tags, name, and optional password. Saves locally or processes a Google Drive URL.
- **`GET /api/download`**: Streams the binary PDF payload. Proxies Google Drive's download endpoint or reads local storage, verifying password access.

### 2. Hierarchy Command Center
- **`POST /api/hierarchy`**: Handles command executions for tree navigation. Commands:
  - `root`: Returns roots.
  - `navigate`: Explores children/parents.
  - `create <Name> <tag_Name>`: Generates a new node.
  - `adopt <ID>` / `disown <ID>`: Link / unlink nodes.
  - `custody <ID>` / `guardian <ID>`: Attach/detach files to/from nodes.
  - `destroy <ID>`: Deletes nodes.

---

## 🛡️ Authentication Flow
NextAuth handles sessions using JWT. On login:
- **Credentials Provider**: Supports signing in using plaintext passwords and auto-registers new accounts.
- **Google Provider**: Links users using Google OAuth.
- Both flows upsert user details into the MongoDB database and inject the Mongo `_id` into the JWT for session lookup.
