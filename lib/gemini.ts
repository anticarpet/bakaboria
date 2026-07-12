import { GoogleGenAI, Type } from "@google/genai";
import { readFile } from "fs/promises";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/db";
import { DocumentModel } from "@/models/Document";
import { GeminiResultModel } from "@/models/GeminiResult";

// ─── Placeholder: Paste your prompt text here ───────────────────────────────
const PROMPT = `You are an expert academic text parser and curriculum analyst. Analyze the provided attached exam PDF file thoroughly and extract its structural properties and content into the requested structured JSON schema format.

Follow these strict extraction guidelines:
1. EXAM METADATA: Isolate the total duration, document classification type, and the absolute sum of all available points/marks.
2. SECTION TYPES: Map out the paper's organization. Break down the structural layout by sections, counting the questions and accumulating their allocated point values.
3. COGNITIVE DISTRIBUTION: Calculate the estimated percentage breakdown of marks based on cognitive complexity. 
   - 'recall_percent' evaluates straightforward memory recall or standard plug-and-play definitions.
   - 'analytical_calculation_percent' covers algorithmic multi-step math calculations or structural parsing.
   - 'design_and_troubleshoot_percent' maps to items requiring students to plan a configuration under system constraints or spot engineering system faults.
   Ensure the combined sum of these three fields equals exactly 100.
4. TOPIC WEIGHTING: Identify the explicit syllabus units tested. Sum up the marks assigned to questions belonging to each topic.
5. BLACKLIST: Extract a list of the unique real-world systems, scenario contexts, or application settings used as problem frameworks in the questions (e.g., if a question uses a 'strain gauge connected to an op-amp', add that phrase here). This prevents repetitive cloning in future generated papers.
6. EXAM CONTENT: Extract every single question from the PDF exactly as written. Preserve original question labeling, option strings for multiple-choice items, and specific numerical constraints. Do not omit mathematical symbols or equations.

Output ONLY valid JSON matching the specified responseSchema. Do not include markdown formatting code blocks ("json ... ") in the final payload string.

CRITICAL COMPLETENESS REQUIREMENT: 
You are strictly forbidden from summarizing, abbreviating, or truncating the 'exam_content' array. You must loop through the entire PDF from the first page to the last page and capture every single question item. High fidelity extraction of all questions is your highest priority.`;

// ─── Placeholder: Paste your response schema here ───────────────────────────
// This should follow the Gemini API schema format.
// See: https://ai.google.dev/gemini-api/docs/structured-output
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    "exam length": { type: Type.STRING, description: "Total duration allowed for the exam, e.g., '3 hours'." },
    "type": { type: Type.STRING, enum: ["exam", "sheet", "summary"] },
    "total marks": { type: Type.INTEGER },
    "section types": {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          "section": { type: Type.STRING, description: "Section letter, e.g., 'A'" },
          "type": { type: Type.STRING, description: "Type of questions, e.g., 'MCQ', 'Structured', 'Long Form'" },
          "count": { type: Type.INTEGER, description: "Number of questions in this section" },
          "total_marks": { type: Type.INTEGER }
        },
        required: ["section", "type", "count", "total_marks"]
      }
    },
    "cognitive_distribution": {
      type: Type.OBJECT,
      properties: {
        "recall_percent": { type: Type.INTEGER, description: "Percentage of total marks testing pure memory or definition recall" },
        "analytical_calculation_percent": { type: Type.INTEGER, description: "Percentage of total marks testing multi-step mathematical calculations or analysis" },
        "design_and_troubleshoot_percent": { type: Type.INTEGER, description: "Percentage of total marks testing design constraints, open-ended creation, or troubleshooting faults" }
      },
      required: ["recall_percent", "analytical_calculation_percent", "design_and_troubleshoot_percent"]
    },
    "core_topic_weighting": {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          "topic": { type: Type.STRING, description: "The distinct syllabus module or topic name" },
          "avg_marks": { type: Type.INTEGER, description: "Total marks allocated specifically to this topic across the entire paper" }
        },
        required: ["topic", "avg_marks"]
      }
    },
    "tags": {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Descriptive classification tags including Subject, Difficulty, and Year."
    },
    "description": { type: Type.STRING, description: "A high-level synthesis describing who this exam is for and what core subjects it evaluates." },
    "past_scenarios_blacklist": {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of distinct engineering/real-world case scenarios, contexts, applications, or word problems used inside the questions."
    },
    "exam_content": {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A COMPLETE, comprehensive array of every single question found in the exam. You MUST extract all questions. Do not truncate, do not summarize, and do not stop after one question. If there are 50 questions, this array must contain exactly 50 items."
    }
  },
  required: [
    "exam length", "type", "total marks", "section types",
    "cognitive_distribution", "core_topic_weighting", "tags",
    "description", "past_scenarios_blacklist", "exam_content"
  ]
};



// ─── Google Drive helpers (reused from existing download route) ──────────────
function extractDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/open\?id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchDriveBytes(fileLocation: string): Promise<Buffer> {
  const fileId = extractDriveId(fileLocation);
  if (!fileId) {
    throw new Error("Could not extract Google Drive file ID from URL.");
  }

  const driveDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;

  const res = await fetch(driveDownloadUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch file from Google Drive (HTTP ${res.status}).`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Main exported function ─────────────────────────────────────────────────
/**
 * Processes a PDF document through Gemini Flash 2.5.
 *
 * 1. Looks up the document by `_id` in MongoDB.
 * 2. Retrieves the PDF bytes (local docus/ folder or Google Drive).
 * 3. Sends the PDF + tags + prompt + response schema to Gemini.
 * 4. Stores the structured JSON result in the `GeminiResult` collection
 *    with the same `_id`.
 * 5. Returns the JSON response as a string.
 *
 * @param documentId - The MongoDB `_id` of the document to process.
 * @returns The Gemini JSON response as a string.
 */
export async function processWithGemini(documentId: string): Promise<string> {
  // 1. Connect & fetch the document record
  await connectDB();

  const doc = await DocumentModel.findById(documentId);
  if (!doc) {
    throw new Error(`Document with _id "${documentId}" not found.`);
  }

  // 2. Retrieve PDF bytes
  let pdfBytes: Buffer;

  if (doc.storeMethod === "DRIVE") {
    pdfBytes = await fetchDriveBytes(doc.fileLocation);
  } else {
    // Local file in docus/ folder
    const absolutePath = path.join(process.cwd(), doc.fileLocation);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`PDF file not found on disk at: ${absolutePath}`);
    }
    pdfBytes = await readFile(absolutePath);
  }

  // 3. Build the prompt with tags interpolated
  const tagsString = doc.tags.length > 0 ? doc.tags.join(", ") : "none";
  const finalPrompt = PROMPT.replace("{{TAGS}}", tagsString);

  // 4. Call Gemini Flash 2.5
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBytes.toString("base64"),
            },
          },
          {
            text: finalPrompt,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 8192
    },
  });

  const resultText = response.text ?? "";

  // 5. Parse and store in MongoDB
  let parsedResult: Record<string, any>;
  try {
    parsedResult = JSON.parse(resultText);
  } catch {
    // If Gemini returns non-JSON despite the schema, store raw text
    parsedResult = { rawResponse: resultText };
  }

  // Upsert: create or replace the result with the same _id
  await GeminiResultModel.findOneAndUpdate(
    { _id: documentId },
    { _id: documentId, result: parsedResult, createdAt: new Date() },
    { upsert: true, new: true }
  );

  // 6. Return the response stringssssssss
  return resultText;
}

/**
 * Generates an exam using Gemini Flash 2.5 based on stored GeminiResult data
 * and a user-provided prompt.
 */
export async function generateExamWithGemini(
  fileIds: string[],
  userPrompt: string
): Promise<string> {
  await connectDB();

  if (fileIds.length === 0) {
    throw new Error("No files are linked to the selected hierarchy node.");
  }

  const results = await GeminiResultModel.find({ _id: { $in: fileIds } }).lean();
  if (results.length === 0) {
    throw new Error("No Gemini results found for the linked files.");
  }

  const contextData = results.map((r) => ({
    id: r._id,
    result: r.result,
  }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const professionalPrompt = `You are an expert academic exam designer and curriculum specialist. Your task is to create a high-quality, professionally structured exam based on the reference material provided below.

USER INSTRUCTIONS:
${userPrompt}

REFERENCE DATA (analyzed exam content from source PDFs):
${JSON.stringify(contextData, null, 2)}

Using the reference data above, generate a complete exam that aligns with the user's instructions. Include clear section headings, question numbering, mark allocations, and any necessary instructions for students. Ensure the exam is academically rigorous, well-organized, and appropriate for the subject matter reflected in the reference data.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: professionalPrompt }],
      },
    ],
  });

  return response.text ?? "";
}
