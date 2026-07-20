import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/db";
import { HierarchyModel } from "@/models/Hierarchy";
import { DocumentModel } from "@/models/Document";
import { GeminiResultModel } from "@/models/GeminiResult";
import { processWithGemini, generateExamWithGemini } from "@/lib/gemini";
import { auth } from "@/app/auth";
import  todo  from "@/app/todo";

function extractFolderId(url: string): string {
  const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return url;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Auto-seed demo nodes if the collection is empty
    const count = await HierarchyModel.countDocuments();
    if (count === 0) {
      const bue = await HierarchyModel.create({ Name: "BUE", tag_Name: "BUE", parents: [], children: [] });
      const guc = await HierarchyModel.create({ Name: "GUC", tag_Name: "GUC", parents: [], children: [] });
      const mast = await HierarchyModel.create({ Name: "MAST", tag_Name: "MAST", parents: [], children: [] });

      const cufe = new HierarchyModel({
        Name: "CUFE",
        tag_Name: "CUFE",
        parents: [],
        children: []
      });
      await cufe.save();

      const mec = await HierarchyModel.create({
        Name: "MEC",
        tag_Name: "MEC",
        parents: [{ "p-name": "CUFE", "p-id": cufe._id }],
        children: []
      });
      const eece = await HierarchyModel.create({
        Name: "EECE",
        tag_Name: "EECE",
        parents: [{ "p-name": "CUFE", "p-id": cufe._id }],
        children: []
      });
      const cmp = await HierarchyModel.create({
        Name: "CMP",
        tag_Name: "CMP",
        parents: [{ "p-name": "CUFE", "p-id": cufe._id }],
        children: []
      });
      const arc = await HierarchyModel.create({
        Name: "ARC",
        tag_Name: "ARCH",
        parents: [{ "p-name": "CUFE", "p-id": cufe._id }],
        children: []
      });

      cufe.children = [
        { "p-name": "MEC", "p-id": mec._id },
        { "p-name": "EECE", "p-id": eece._id },
        { "p-name": "CMP", "p-id": cmp._id },
        { "p-name": "ARC", "p-id": arc._id }
      ];
      await cufe.save();
    }

    const { command, currentNodeId, selectedDocId } = await request.json();

    if (typeof command !== "string") {
      return NextResponse.json({ error: "Invalid command input." }, { status: 400 });
    }

    const trimmed = command.trim();
    if (!trimmed) {
      return NextResponse.json({ success: true, output: "" });
    }

    const parts = trimmed.split(/\s+/);
    const cmdName = parts[0].toLowerCase();

    // 0. HELP command
    if (cmdName === "help") {
      const helpOutput = [
        "Available Commands:",
        "╠═ help                                  Display this help menu",
        "╠═ root                                  Reset navigation path to root",
        "╠═ navigate or n                         List child nodes or root nodes",
        "╠═ create <Name> <tag_Name>              Create a new hierarchy node",
        "╠═ back                                  Go back one node in path",
        "╠═ docs [?ID]                            List documents in current or specified node",
        "╠═ doc <name|number>                     Select a document",
        "╠═ rename [doc|hier] <name>              Rename selected doc or current node",
        "╠═ tags --tags <t1> <t2>... | tags --d   Set or delete tags for selected doc",
        "╠═ bulk <folder_id> [?ID]                Bulk upload PDFs from Google Drive",
        "╠═ id                                    Display current node ID",
        "╠═ files [?ID]                           Display files linked to current or specified node",
        "╠═ adopt <ID>                            Adopt target node as child",
        "╠═ custody <ID> [?name]                  Adopt children of target node",
        "╠═ disown <ID>                           Remove child node relationship",
        "╠═ guardian <ID>                         Add a parent to current node",
        "╠═ destroy <ID> [?name] [-all]           Destroy node, children, or specific child",
        "╠═ process <PdfID>                       Process PDF with Gemini",
        "╠═ verify <PdfID>                        Verify PDF document",
        "╠═ unverify <PdfID>                      Unverify PDF document",
        "╠═ delete <PdfID>                        Delete PDF document and Gemini results",
        "╠═ caste <PdfID> [?ID]                   Caste PDF to current/specified node",
        "╠═ liberate <PdfID> [--all]              Remove node from caste or clear all castes",
        "╠═ generate <prompt>                     Generate exam with Gemini using node PDFs",
        "╠═ scut #A#B#C                           Jump directly to a node by path segments",
        "╠═ path                                  Display the current path",
        "╠═ upload <link> [--tags t1 t2...]       Upload a PDF from a link into current node",
        "╠═ clone <drive_link>                    Clone a Google Drive folder tree into current node",
        "╠═ <node_name|tag_name>                  Navigate into node",
        "easter eggs:",
        "╠═ todo                                  displays future plans for the website"

      ].join("\n");

      return NextResponse.json({
        success: true,
        output: helpOutput
      });
    }

    // 1. ROOT command
    if (cmdName === "root") {
      return NextResponse.json({
        success: true,
        action: "root",
        output: "",
        currentNode: null
      });
    }

    // 2. NAVIGATE command
    if (cmdName === "navigate" || cmdName === "n") {
      if (!currentNodeId) {
        // Find parentless nodes
        const roots = await HierarchyModel.find({ parents: { $size: 0 } }).lean();
        if (roots.length === 0) {
          return NextResponse.json({
            success: true,
            output: "No parentless nodes found. Type 'create <Name> <tag_Name>' to create one."
          });
        }
        const output = roots.map((node: any) => `╠═ #${node.Name}`).join("\n");
        return NextResponse.json({ success: true, output });
      } else {
        const current = await HierarchyModel.findById(currentNodeId).lean();
        if (!current) {
          return NextResponse.json({
            success: false,
            output: `Error: Current node not found. Resetting to root.`,
            action: "root",
            currentNode: null
          });
        }
        if (!current.children || current.children.length === 0) {
          return NextResponse.json({
            success: true,
            output: "" // Return empty when no children
          });
        }
        const output = current.children.map((child: any) => `╠═ #${child["p-name"]}`).join("\n");
        return NextResponse.json({ success: true, output });
      }
    }

    // 3. CREATE command
    if (cmdName === "create") {
      const name = parts[1];
      const tagName = parts[2];

      if (!name) {
        return NextResponse.json({
          success: false,
          output: "Usage: create <Name>"
        });
      }

      // Check if tag_Name is unique
      // const existing = await HierarchyModel.findOne({ tag_Name: tagName });
      // if (existing) {
      //   return NextResponse.json({
      //     success: false,
      //     output: `Error: Node with tag name "${tagName}" already exists.`
      //   });
      // }

      let parents: any[] = [];
      if (currentNodeId) {
        const parentNode = await HierarchyModel.findById(currentNodeId);
        if (!parentNode) {
          return NextResponse.json({
            success: false,
            output: "Error: Parent node not found."
          });
        }
        parents = [{ "p-name": parentNode.Name, "p-id": parentNode._id }];
      }

      const newNode = new HierarchyModel({
        Name: name,
        parents,
        children: []
      });

      await newNode.save();

      // If there is a parent, update its children list
      if (currentNodeId) {
        await HierarchyModel.findByIdAndUpdate(currentNodeId, {
          $push: { children: { "p-name": name, "p-id": newNode._id } }
        });
      }

      return NextResponse.json({
        success: true,
        output: `node ${name} created sucessfully.` // using user's specific spelling 'sucessfully'
      });
    }

    // --- New Command: DOCS ---
    if (cmdName === "docs") {
      const targetNodeId = parts[1] || currentNodeId;
      if (!targetNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node specified or selected."
        });
      }
      if (!mongoose.Types.ObjectId.isValid(targetNodeId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${targetNodeId}".`
        });
      }
      const hierarchyNode = await HierarchyModel.findById(targetNodeId).lean();
      if (!hierarchyNode) {
        return NextResponse.json({
          success: false,
          output: `Error: Hierarchy node with ID ${targetNodeId} not found.`
        });
      }
      const fileIds = (hierarchyNode.files || []).map((id: any) => id.toString());
      if (fileIds.length === 0) {
        return NextResponse.json({
          success: true,
          output: "No documents found."
        });
      }
      const docs = await DocumentModel.find({ _id: { $in: fileIds } });
      const orderedDocs = fileIds
        .map((id: string) => docs.find((d: any) => d._id.toString() === id))
        .filter(Boolean);

      if (orderedDocs.length === 0) {
        return NextResponse.json({
          success: true,
          output: "No documents found."
        });
      }

      const output = orderedDocs
        .map((doc: any, index: number) => `${index + 1}. ${doc.name} ${doc._id}`)
        .join("\n");
      return NextResponse.json({
        success: true,
        output
      });
    }

    // --- New Command: DOC ---
    if (cmdName === "doc") {
      const docArg = parts.slice(1).join(" ").trim();
      if (!docArg) {
        return NextResponse.json({
          success: false,
          output: "Error: Please specify a document name or number."
        });
      }
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node selected."
        });
      }
      const hierarchyNode = await HierarchyModel.findById(currentNodeId).lean();
      if (!hierarchyNode) {
        return NextResponse.json({
          success: false,
          output: "Error: Current hierarchy node not found."
        });
      }
      const fileIds = (hierarchyNode.files || []).map((id: any) => id.toString());
      if (fileIds.length === 0) {
        return NextResponse.json({
          success: false,
          output: "Error: No documents found in this node."
        });
      }
      const docs = await DocumentModel.find({ _id: { $in: fileIds } });
      const orderedDocs = fileIds
        .map((id: string) => docs.find((d: any) => d._id.toString() === id))
        .filter(Boolean);

      let targetDoc: any = null;
      const num = parseInt(docArg, 10);
      if (!isNaN(num)) {
        if (num < 1 || num > orderedDocs.length) {
          return NextResponse.json({
            success: false,
            output: `Error: Invalid document number ${num}.`
          });
        }
        targetDoc = orderedDocs[num - 1];
      } else {
        // Find by name (case-insensitive)
        targetDoc = orderedDocs.find((d: any) => d.name.toLowerCase() === docArg.toLowerCase());
        if (!targetDoc) {
          return NextResponse.json({
            success: false,
            output: `Error: Document "${docArg}" not found in this node.`
          });
        }
      }

      return NextResponse.json({
        success: true,
        action: "select_doc",
        selectedDoc: {
          id: targetDoc._id.toString(),
          name: targetDoc.name
        },
        output: `Document "${targetDoc.name}" selected.`
      });
    }

    // --- New Command: RENAME ---
    if (cmdName === "rename") {
      const typeArg = parts[1]?.toLowerCase();
      const newName = parts.slice(2).join(" ").trim();

      if (typeArg === "doc") {
        if (!selectedDocId) {
          return NextResponse.json({
            success: false,
            output: "Error: No document selected."
          });
        }
        if (!newName) {
          return NextResponse.json({
            success: false,
            output: "Usage: rename doc $name"
          });
        }
        const doc = await DocumentModel.findByIdAndUpdate(
          selectedDocId,
          { $set: { name: newName } },
          { new: true }
        );
        if (!doc) {
          return NextResponse.json({
            success: false,
            output: "Error: Selected document not found."
          });
        }
        return NextResponse.json({
          success: true,
          action: "rename_doc",
          name: newName,
          output: `Document renamed to "${newName}" successfully.`
        });
      } else if (typeArg === "hier") {
        if (!currentNodeId) {
          return NextResponse.json({
            success: false,
            output: "Error: No hierarchy node selected."
          });
        }
        if (!newName) {
          return NextResponse.json({
            success: false,
            output: "Usage: rename hier $name"
          });
        }
        const node = await HierarchyModel.findById(currentNodeId);
        if (!node) {
          return NextResponse.json({
            success: false,
            output: "Error: Selected hierarchy node not found."
          });
        }
        const oldName = node.Name;
        node.Name = newName;
        await node.save();

        // Update all parents/children arrays referencing this node
        await HierarchyModel.updateMany(
          { "parents.p-id": node._id },
          { $set: { "parents.$[elem].p-name": newName } },
          { arrayFilters: [{ "elem.p-id": node._id }] }
        );

        await HierarchyModel.updateMany(
          { "children.p-id": node._id },
          { $set: { "children.$[elem].p-name": newName } },
          { arrayFilters: [{ "elem.p-id": node._id }] }
        );

        return NextResponse.json({
          success: true,
          action: "rename_hier",
          currentNode: {
            id: node._id.toString(),
            Name: node.Name,
            tag_Name: node.tag_Name
          },
          output: `node "${oldName}" renamed to "${newName}" successfully.`
        });
      } else {
        return NextResponse.json({
          success: false,
          output: "Usage: rename [doc|hier] $name"
        });
      }
    }

    // --- New Command: TAGS ---
    if (cmdName === "tags") {
      if (!selectedDocId) {
        return NextResponse.json({
          success: false,
          output: "Error: No document selected."
        });
      }

      const hasDelete = parts.includes("--d");
      if (hasDelete) {
        await DocumentModel.findByIdAndUpdate(selectedDocId, { $set: { tags: [] } });
        return NextResponse.json({
          success: true,
          output: "All tags deleted successfully."
        });
      }

      const tagsIdx = parts.indexOf("--tags");
      if (tagsIdx === -1) {
        return NextResponse.json({
          success: false,
          output: "Usage: tags --tags tag1 tag2 ... or tags --d"
        });
      }

      const newTags = parts.slice(tagsIdx + 1);
      if (newTags.length === 0) {
        return NextResponse.json({
          success: false,
          output: "Error: No tags specified after --tags."
        });
      }

      await DocumentModel.findByIdAndUpdate(selectedDocId, { $set: { tags: newTags } });
      return NextResponse.json({
        success: true,
        output: `Tags changed to: ${newTags.join(", ")}`
      });
    }

    // --- New Command: BULK ---
    if (cmdName === "bulk") {
      const folderInput = parts[1];
      if (!folderInput) {
        return NextResponse.json({
          success: false,
          output: "Usage: bulk $folder_id ?ID"
        });
      }

      const targetNodeId = parts[2] || currentNodeId;
      if (!targetNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node specified or selected."
        });
      }

      if (!mongoose.Types.ObjectId.isValid(targetNodeId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${targetNodeId}".`
        });
      }

      const hierarchyNode = await HierarchyModel.findById(targetNodeId);
      if (!hierarchyNode) {
        return NextResponse.json({
          success: false,
          output: `Error: Hierarchy node with ID ${targetNodeId} not found.`
        });
      }

      const folderId = extractFolderId(folderInput);
      const apiKey = process.env.DRIVE_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          success: false,
          output: "Error: DRIVE_API_KEY environment variable is not set."
        });
      }

      try {
        const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,size)&key=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json();
          return NextResponse.json({
            success: false,
            output: `Error fetching Google Drive folder: ${errorData.error?.message || response.statusText}`
          });
        }

        const data = await response.json();
        const files = data.files || [];

        if (files.length === 0) {
          return NextResponse.json({
            success: true,
            output: "No PDF files found in the Google Drive folder."
          });
        }

        const addedDocIds: mongoose.Types.ObjectId[] = [];
        const session = await auth();

        for (const file of files) {
          const canonicalUrl = `https://drive.google.com/file/d/${file.id}/view`;
          const newDoc = new DocumentModel({
            uid: session?.user?.id || "admin",
            name: file.name,
            password: "",
            tags: [],
            primaryTags: [],
            propertyTags: [],
            hidden: false,
            hiddenTags: [],
            fileLocation: canonicalUrl,
            fileName: file.name,
            fileSize: file.size ? parseInt(file.size, 10) : 0,
            mimeType: "application/pdf",
            storeMethod: "DRIVE",
            caste: [hierarchyNode._id]
          });

          await newDoc.save();
          addedDocIds.push(newDoc._id);
        }

        // Add their IDs to the hierarchy node
        await HierarchyModel.findByIdAndUpdate(targetNodeId, {
          $push: { files: { $each: addedDocIds } }
        });

        return NextResponse.json({
          success: true,
          output: `Bulk upload completed successfully. Uploaded ${files.length} PDFs to hierarchy node "${hierarchyNode.Name}".`
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          output: `Error performing bulk upload: ${err.message}`
        });
      }
    }

    // --- New Command: ID ---
    if (cmdName === "id") {
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No selected document."
        });
      }
      return NextResponse.json({
        success: true,
        output: currentNodeId
      });
    }

    // --- New Command: FILES ---
    if (cmdName === "files") {
      const hierarchyId = parts[1] || currentNodeId;

      if (!hierarchyId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node selected. Navigate to a node or specify an ID."
        });
      }
      if (!mongoose.Types.ObjectId.isValid(hierarchyId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${hierarchyId}".`
        });
      }

      const hierarchy = await HierarchyModel.findById(hierarchyId).lean();
      if (!hierarchy) {
        return NextResponse.json({
          success: false,
          output: `Error: Hierarchy node with ID ${hierarchyId} not found.`
        });
      }

      const fileIds = (hierarchy.files || []).map((id: any) => id.toString());
      if (fileIds.length === 0) {
        return NextResponse.json({
          success: true,
          output: "No files linked to this hierarchy node."
        });
      }

      const output = fileIds.map((id: string) => `╠═ ${id}`).join("\n");
      return NextResponse.json({
        success: true,
        output
      });
    }

    // --- New Command: ADOPT ---
    if (cmdName === "adopt") {
      const targetId = parts[1];
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No selected document to adopt into."
        });
      }
      if (!targetId) {
        return NextResponse.json({
          success: false,
          output: "Usage: adopt $ID"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${targetId}".`
        });
      }

      const targetDoc = await HierarchyModel.findById(targetId);
      if (!targetDoc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${targetId} not found.`
        });
      }

      const currentDoc = await HierarchyModel.findById(currentNodeId);
      if (!currentDoc) {
        return NextResponse.json({
          success: false,
          output: "Error: Selected document not found."
        });
      }

      // Check if targetDoc is already a child of currentDoc
      const alreadyChild = currentDoc.children.some((c: any) => c["p-id"].toString() === targetId);
      if (alreadyChild) {
        return NextResponse.json({
          success: true,
          output: `node ${targetDoc.Name} is already a child of ${currentDoc.Name}.`
        });
      }

      // Add parent link
      targetDoc.parents.push({ "p-name": currentDoc.Name, "p-id": currentDoc._id });
      await targetDoc.save();

      // Add child link
      currentDoc.children.push({ "p-name": targetDoc.Name, "p-id": targetDoc._id });
      await currentDoc.save();

      return NextResponse.json({
        success: true,
        output: `node ${targetDoc.Name} adopted by ${currentDoc.Name} successfully.`
      });
    }

    // --- New Command: CUSTODY ---
    if (cmdName === "custody") {
      const targetId = parts[1];
      const optName = parts[2]; // optional

      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No selected document to take custody into."
        });
      }
      if (!targetId) {
        return NextResponse.json({
          success: false,
          output: "Usage: custody $ID ?name"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${targetId}".`
        });
      }

      const targetDoc = await HierarchyModel.findById(targetId);
      if (!targetDoc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${targetId} not found.`
        });
      }

      const currentDoc = await HierarchyModel.findById(currentNodeId);
      if (!currentDoc) {
        return NextResponse.json({
          success: false,
          output: "Error: Selected document not found."
        });
      }

      if (!targetDoc.children || targetDoc.children.length === 0) {
        return NextResponse.json({
          success: true,
          output: `node ${targetDoc.Name} has no children to adopt.`
        });
      }

      let adoptedCount = 0;
      for (const childRef of targetDoc.children) {
        const childName = childRef["p-name"];
        const childId = childRef["p-id"];

        // If optional name is specified, skip non-matching child name
        if (optName && childName.toLowerCase() !== optName.toLowerCase()) {
          continue;
        }

        const childDoc = await HierarchyModel.findById(childId);
        if (!childDoc) continue;

        // Check if already a child of currentDoc
        const alreadyChild = currentDoc.children.some((c: any) => c["p-id"].toString() === childId.toString());
        if (!alreadyChild) {
          childDoc.parents.push({ "p-name": currentDoc.Name, "p-id": currentDoc._id });
          await childDoc.save();

          currentDoc.children.push({ "p-name": childDoc.Name, "p-id": childDoc._id });
          adoptedCount++;
        }
      }

      if (adoptedCount > 0) {
        await currentDoc.save();
      }

      return NextResponse.json({
        success: true,
        output: optName 
          ? `Custody of child "${optName}" taken successfully.` 
          : `Custody of ${adoptedCount} children taken successfully.`
      });
    }

    // --- New Command: DISOWN ---
    if (cmdName === "disown") {
      const targetId = parts[1];
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No selected document."
        });
      }
      if (!targetId) {
        return NextResponse.json({
          success: false,
          output: "Usage: disown $ID"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${targetId}".`
        });
      }

      const targetDoc = await HierarchyModel.findById(targetId);
      const currentDoc = await HierarchyModel.findById(currentNodeId);

      if (!targetDoc || !currentDoc) {
        return NextResponse.json({
          success: false,
          output: "Error: Target or selected document not found."
        });
      }

      // Remove targetDoc from currentDoc's children
      currentDoc.children = currentDoc.children.filter((c: any) => c["p-id"].toString() !== targetId);
      await currentDoc.save();

      // Remove currentDoc from targetDoc's parents
      targetDoc.parents = targetDoc.parents.filter((p: any) => p["p-id"].toString() !== currentNodeId);
      await targetDoc.save();

      return NextResponse.json({
        success: true,
        output: `node ${targetDoc.Name} disowned by ${currentDoc.Name} successfully.`
      });
    }

    // --- New Command: GUARDIAN ---
    if (cmdName === "guardian") {
      const targetId = parts[1];
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No selected document."
        });
      }
      if (!targetId) {
        return NextResponse.json({
          success: false,
          output: "Usage: guardian $ID"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${targetId}".`
        });
      }

      const parentDoc = await HierarchyModel.findById(targetId);
      if (!parentDoc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${targetId} not found.`
        });
      }

      const currentDoc = await HierarchyModel.findById(currentNodeId);
      if (!currentDoc) {
        return NextResponse.json({
          success: false,
          output: "Error: Selected document not found."
        });
      }

      // Check if parentDoc is already a parent of currentDoc
      const alreadyParent = currentDoc.parents.some((p: any) => p["p-id"].toString() === targetId);
      if (alreadyParent) {
        return NextResponse.json({
          success: true,
          output: `node ${parentDoc.Name} is already a guardian of ${currentDoc.Name}.`
        });
      }

      // Add parent to currentDoc
      currentDoc.parents.push({ "p-name": parentDoc.Name, "p-id": parentDoc._id });
      await currentDoc.save();

      // Add child to parentDoc
      parentDoc.children.push({ "p-name": currentDoc.Name, "p-id": currentDoc._id });
      await parentDoc.save();

      return NextResponse.json({
        success: true,
        output: `node ${parentDoc.Name} is now a guardian of ${currentDoc.Name}.`
      });
    }

    // --- New Command: DESTROY ---
    if (cmdName === "destroy") {
      const targetId = parts[1];
      if (!targetId) {
        return NextResponse.json({
          success: false,
          output: "Usage: destroy $ID ?name ?all"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${targetId}".`
        });
      }

      const targetDoc = await HierarchyModel.findById(targetId);
      if (!targetDoc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${targetId} not found.`
        });
      }

      const isAll = parts.includes("-all");
      let optName: string | undefined = parts[2];
      if (optName === "-all") {
        optName = undefined;
      }

      // Helper function to delete a document and clean up references
      const deleteDocAndCleanRefs = async (docToDelete: any) => {
        const idToDelete = docToDelete._id;
        // 1. Remove from all parents' children arrays
        await HierarchyModel.updateMany(
          { "children.p-id": idToDelete },
          { $pull: { children: { "p-id": idToDelete } } }
        );
        // 2. Remove from all children's parents arrays
        await HierarchyModel.updateMany(
          { "parents.p-id": idToDelete },
          { $pull: { parents: { "p-id": idToDelete } } }
        );
        // 3. Actually delete the document
        await HierarchyModel.findByIdAndDelete(idToDelete);
      };

      if (isAll) {
        // Destroy all children of doc with targetId
        if (!targetDoc.children || targetDoc.children.length === 0) {
          return NextResponse.json({
            success: true,
            output: `node ${targetDoc.Name} has no children to destroy.`
          });
        }

        const childrenRefs = [...targetDoc.children];
        for (const childRef of childrenRefs) {
          const childDoc = await HierarchyModel.findById(childRef["p-id"]);
          if (childDoc) {
            await deleteDocAndCleanRefs(childDoc);
          }
        }

        return NextResponse.json({
          success: true,
          output: `All children of document ${targetDoc.Name} destroyed successfully.`
        });
      } else if (optName) {
        // Destroy child called name of doc with targetId
        const matchRef = targetDoc.children.find((c: any) => c["p-name"].toLowerCase() === optName.toLowerCase());
        if (!matchRef) {
          return NextResponse.json({
            success: false,
            output: `Error: Child named "${optName}" not found under ${targetDoc.Name}.`
          });
        }

        const childDoc = await HierarchyModel.findById(matchRef["p-id"]);
        if (childDoc) {
          await deleteDocAndCleanRefs(childDoc);
        }

        return NextResponse.json({
          success: true,
          output: `Child "${optName}" of document ${targetDoc.Name} destroyed successfully.`
        });
      } else {
        // Destroy the doc with targetId itself
        await deleteDocAndCleanRefs(targetDoc);
        return NextResponse.json({
          success: true,
          output: `node ${targetDoc.Name} destroyed successfully.`
        });
      }
    }

    // --- New Command: CD ---
    if (cmdName === "back") {
      return NextResponse.json({
        success: true,
        action: "cd",
        output: ""
      });
    }

    // command: to do
    if (cmdName === "todo") {
      return NextResponse.json({
        success: true,
        action: "cd",
        output: todo
      });
    }

    // --- Command: PATH (handled client-side, stub for API) ---
    if (cmdName === "path") {
      return NextResponse.json({
        success: true,
        action: "path"
      });
    }

    // --- Command: SCUT_RESOLVE (used internally by client-side scut) ---
    // Resolves a single named segment relative to a given parent node.
    // Usage: scut_resolve <segmentName> [parentNodeId]
    if (cmdName === "scut_resolve") {
      const segmentName = parts[1];
      const parentId = parts[2] || null;

      if (!segmentName) {
        return NextResponse.json({
          success: false,
          output: "Usage: scut_resolve <segmentName> [parentNodeId]"
        });
      }

      let matchingNode: any = null;

      if (!parentId) {
        // Root-level search
        matchingNode = await HierarchyModel.findOne({
          parents: { $size: 0 },
          $or: [
            { Name: { $regex: new RegExp(`^${segmentName}$`, "i") } },
            { tag_Name: { $regex: new RegExp(`^${segmentName}$`, "i") } }
          ]
        });
      } else {
        if (!mongoose.Types.ObjectId.isValid(parentId)) {
          return NextResponse.json({
            success: false,
            output: `Error: Invalid parent ID format "${parentId}".`
          });
        }
        const parentNode = await HierarchyModel.findById(parentId);
        if (!parentNode) {
          return NextResponse.json({
            success: false,
            output: `Error: Parent node with ID ${parentId} not found.`
          });
        }
        const childIds = parentNode.children.map((c: any) => c["p-id"]);
        matchingNode = await HierarchyModel.findOne({
          _id: { $in: childIds },
          $or: [
            { Name: { $regex: new RegExp(`^${segmentName}$`, "i") } },
            { tag_Name: { $regex: new RegExp(`^${segmentName}$`, "i") } }
          ]
        });
      }

      if (!matchingNode) {
        return NextResponse.json({
          success: false,
          output: `node "${segmentName}" not found`
        });
      }

      return NextResponse.json({
        success: true,
        action: "navigate",
        output: "",
        currentNode: {
          id: matchingNode._id.toString(),
          Name: matchingNode.Name,
          tag_Name: matchingNode.tag_Name
        }
      });
    }

    // --- Command: UPLOAD ---
    // Usage: upload <link> [--tags tag1 tag2 ...]
    if (cmdName === "upload") {
      const rawLink = parts[1];
      if (!rawLink) {
        return NextResponse.json({
          success: false,
          output: "Usage: upload <link> [--tags tag1 tag2 ...]"
        });
      }
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node selected. Navigate to a node first."
        });
      }

      const hierarchyNode = await HierarchyModel.findById(currentNodeId);
      if (!hierarchyNode) {
        return NextResponse.json({
          success: false,
          output: "Error: Current hierarchy node not found."
        });
      }

      // Parse --tags
      const tagsIdx = parts.indexOf("--tags");
      const uploadTags: string[] = tagsIdx !== -1 ? parts.slice(tagsIdx + 1) : [];

      // Derive a file name from the URL
      let fileName: string;
      try {
        const urlObj = new URL(rawLink);
        const lastSegment = urlObj.pathname.split("/").filter(Boolean).pop() || "document";
        fileName = decodeURIComponent(lastSegment);
        if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";
      } catch {
        fileName = "document.pdf";
      }

      // Normalise Google Drive share links to a canonical view URL
      let fileLocation = rawLink;
      const driveIdMatch = rawLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (driveIdMatch) {
        fileLocation = `https://drive.google.com/file/d/${driveIdMatch[1]}/view`;
        fileName = fileName.replace(/^file$/, "document");
      }

      const session = await auth();
      const newDoc = new DocumentModel({
        uid: session?.user?.id || "admin",
        name: fileName,
        password: "",
        tags: uploadTags,
        primaryTags: [],
        propertyTags: [],
        hidden: false,
        hiddenTags: [],
        fileLocation,
        fileName,
        fileSize: 0,
        mimeType: "application/pdf",
        storeMethod: "DRIVE",
        caste: [hierarchyNode._id]
      });

      await newDoc.save();

      await HierarchyModel.findByIdAndUpdate(currentNodeId, {
        $push: { files: newDoc._id }
      });

      return NextResponse.json({
        success: true,
        output: `Uploaded "${fileName}" to ${hierarchyNode.Name}${
          uploadTags.length ? ` with tags: ${uploadTags.join(", ")}` : ""
        }. ID: ${newDoc._id}`
      });
    }

    // --- Command: CLONE ---
    // Usage: clone <drive_link>
    // Recursively mirrors a Google Drive folder tree into the current node.
    if (cmdName === "clone") {
      const driveInput = parts[1];
      if (!driveInput) {
        return NextResponse.json({
          success: false,
          output: "Usage: clone <drive_link>"
        });
      }
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node selected. Navigate to a node first."
        });
      }

      const apiKey = process.env.DRIVE_API_KEY;
      if (!apiKey) {
        return NextResponse.json({
          success: false,
          output: "Error: DRIVE_API_KEY environment variable is not set."
        });
      }

      const rootFolderId = extractFolderId(driveInput);
      const cloneSession = await auth();

      // Recursive helper: clone a Drive folder into a given hierarchy parent
      const cloneDriveFolder = async (
        driveFolderId: string,
        folderName: string,
        parentHierarchyId: string
      ): Promise<{ filesAdded: number; foldersAdded: number }> => {
        // 1. Create a new hierarchy node for this folder under parentHierarchyId
        const parentNode = await HierarchyModel.findById(parentHierarchyId);
        if (!parentNode) throw new Error(`Parent node ${parentHierarchyId} not found`);

        const newNode = new HierarchyModel({
          Name: folderName,
          tag_Name: folderName,
          parents: [{ "p-name": parentNode.Name, "p-id": parentNode._id }],
          children: [],
          files: []
        });
        await newNode.save();

        await HierarchyModel.findByIdAndUpdate(parentHierarchyId, {
          $push: { children: { "p-name": folderName, "p-id": newNode._id } }
        });

        let totalFiles = 0;
        let totalFolders = 1; // count this folder itself

        // 2. Fetch PDF files directly in this folder
        const pdfUrl = `https://www.googleapis.com/drive/v3/files?q='${driveFolderId}'+in+parents+and+mimeType='application/pdf'+and+trashed=false&fields=files(id,name,size)&key=${apiKey}`;
        const pdfRes = await fetch(pdfUrl);
        if (!pdfRes.ok) {
          const errData = await pdfRes.json();
          throw new Error(`Drive API error: ${errData.error?.message || pdfRes.statusText}`);
        }
        const pdfData = await pdfRes.json();
        const pdfFiles: any[] = pdfData.files || [];

        const addedDocIds: mongoose.Types.ObjectId[] = [];
        for (const file of pdfFiles) {
          const canonicalUrl = `https://drive.google.com/file/d/${file.id}/view`;
          const doc = new DocumentModel({
            uid: cloneSession?.user?.id || "admin",
            name: file.name,
            password: "",
            tags: [],
            primaryTags: [],
            propertyTags: [],
            hidden: false,
            hiddenTags: [],
            fileLocation: canonicalUrl,
            fileName: file.name,
            fileSize: file.size ? parseInt(file.size, 10) : 0,
            mimeType: "application/pdf",
            storeMethod: "DRIVE",
            caste: [newNode._id]
          });
          await doc.save();
          addedDocIds.push(doc._id);
        }

        if (addedDocIds.length > 0) {
          await HierarchyModel.findByIdAndUpdate(newNode._id, {
            $push: { files: { $each: addedDocIds } }
          });
          totalFiles += addedDocIds.length;
        }

        // 3. Fetch sub-folders and recurse
        const folderUrl = `https://www.googleapis.com/drive/v3/files?q='${driveFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)&key=${apiKey}`;
        const folderRes = await fetch(folderUrl);
        if (!folderRes.ok) {
          const errData = await folderRes.json();
          throw new Error(`Drive API error: ${errData.error?.message || folderRes.statusText}`);
        }
        const folderData = await folderRes.json();
        const subFolders: any[] = folderData.files || [];

        for (const subFolder of subFolders) {
          const result = await cloneDriveFolder(
            subFolder.id,
            subFolder.name,
            newNode._id.toString()
          );
          totalFiles += result.filesAdded;
          totalFolders += result.foldersAdded;
        }

        return { filesAdded: totalFiles, foldersAdded: totalFolders };
      };

      try {
        // Resolve the root folder name
        const metaUrl = `https://www.googleapis.com/drive/v3/files/${rootFolderId}?fields=name&key=${apiKey}`;
        const metaRes = await fetch(metaUrl);
        let rootFolderName = "Cloned Folder";
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          rootFolderName = metaData.name || rootFolderName;
        }

        const { filesAdded, foldersAdded } = await cloneDriveFolder(
          rootFolderId,
          rootFolderName,
          currentNodeId
        );

        const currentHierarchyNode = await HierarchyModel.findById(currentNodeId);
        return NextResponse.json({
          success: true,
          output: `Clone complete! Created ${foldersAdded} folder node(s) and uploaded ${filesAdded} PDF(s) under "${currentHierarchyNode?.Name || currentNodeId}".`
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          output: `Error during clone: ${err.message}`
        });
      }
    }

    // --- Command: PROCESS ---
    if (cmdName === "process") {
      const pdfId = parts[1];
      if (!pdfId) {
        return NextResponse.json({
          success: false,
          output: "Usage: process $PdfID"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(pdfId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${pdfId}".`
        });
      }

      try {
        await processWithGemini(pdfId);
        return NextResponse.json({
          success: true,
          output: "Result saved successfully."
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          output: `Error: ${err?.message || "Failed to process PDF."}`
        });
      }
    }

    // --- Command: VERIFY ---
    if (cmdName === "verify") {
      const pdfId = parts[1];
      if (!pdfId) {
        return NextResponse.json({
          success: false,
          output: "Usage: verify $PdfID"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(pdfId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${pdfId}".`
        });
      }

      const doc = await DocumentModel.findByIdAndUpdate(
        pdfId,
        { $set: { verified: true } },
        { new: true }
      );
      if (!doc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${pdfId} not found.`
        });
      }

      return NextResponse.json({
        success: true,
        output: `Document ${pdfId} verified successfully.`
      });
    }

    // --- Command: UNVERIFY ---
    if (cmdName === "unverify") {
      const pdfId = parts[1];
      if (!pdfId) {
        return NextResponse.json({
          success: false,
          output: "Usage: unverify $PdfID"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(pdfId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${pdfId}".`
        });
      }

      const doc = await DocumentModel.findByIdAndUpdate(
        pdfId,
        { $set: { verified: false } },
        { new: true }
      );
      if (!doc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${pdfId} not found.`
        });
      }

      return NextResponse.json({
        success: true,
        output: `Document ${pdfId} unverified successfully.`
      });
    }

    // --- Command: DELETE ---
    if (cmdName === "delete") {
      const pdfId = parts[1];
      if (!pdfId) {
        return NextResponse.json({
          success: false,
          output: "Usage: delete $PdfID"
        });
      }
      if (!mongoose.Types.ObjectId.isValid(pdfId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${pdfId}".`
        });
      }

      const doc = await DocumentModel.findById(pdfId);
      if (!doc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${pdfId} not found.`
        });
      }

      if (doc.storeMethod === "PDF") {
        const absolutePath = path.join(process.cwd(), doc.fileLocation);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }

      await DocumentModel.findByIdAndDelete(pdfId);
      await GeminiResultModel.findByIdAndDelete(pdfId);

      return NextResponse.json({
        success: true,
        output: `Document ${pdfId} and its Gemini result deleted successfully.`
      });
    }

    // --- Command: CASTE ---
    if (cmdName === "caste") {
      const pdfId = parts[1];
      const hierarchyId = parts[2] || currentNodeId;

      if (!pdfId) {
        return NextResponse.json({
          success: false,
          output: "Usage: caste $PdfID ?ID"
        });
      }
      if (!hierarchyId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node selected. Navigate to a node or specify an ID."
        });
      }
      if (!mongoose.Types.ObjectId.isValid(pdfId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid PDF ID format "${pdfId}".`
        });
      }
      if (!mongoose.Types.ObjectId.isValid(hierarchyId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid hierarchy ID format "${hierarchyId}".`
        });
      }

      const doc = await DocumentModel.findById(pdfId);
      if (!doc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${pdfId} not found.`
        });
      }

      const hierarchy = await HierarchyModel.findById(hierarchyId);
      if (!hierarchy) {
        return NextResponse.json({
          success: false,
          output: `Error: Hierarchy node with ID ${hierarchyId} not found.`
        });
      }

      await HierarchyModel.findByIdAndUpdate(hierarchyId, {
        $addToSet: { files: pdfId }
      });
      await DocumentModel.findByIdAndUpdate(pdfId, {
        $addToSet: { caste: hierarchyId }
      });

      return NextResponse.json({
        success: true,
        output: `Document ${pdfId} casted to ${hierarchy.Name} successfully.`
      });
    }

    // --- Command: LIBERATE ---
    if (cmdName === "liberate") {
      const pdfId = parts[1];
      const isAll = parts.includes("--all");

      if (!pdfId) {
        return NextResponse.json({
          success: false,
          output: "Usage: liberate $PdfID --all"
        });
      }
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node selected."
        });
      }
      if (!mongoose.Types.ObjectId.isValid(pdfId)) {
        return NextResponse.json({
          success: false,
          output: `Error: Invalid ID format "${pdfId}".`
        });
      }

      const doc = await DocumentModel.findById(pdfId);
      if (!doc) {
        return NextResponse.json({
          success: false,
          output: `Error: Document with ID ${pdfId} not found.`
        });
      }

      if (isAll) {
        await DocumentModel.findByIdAndUpdate(pdfId, { $set: { caste: [] } });
        return NextResponse.json({
          success: true,
          output: `All caste links removed from document ${pdfId}.`
        });
      }

      await DocumentModel.findByIdAndUpdate(pdfId, {
        $pull: { caste: currentNodeId }
      });

      return NextResponse.json({
        success: true,
        output: `Hierarchy node removed from caste of document ${pdfId}.`
      });
    }

    // --- Command: GENERATE ---
    if (cmdName === "generate") {
      const userPrompt = trimmed.slice(parts[0].length).trim();

      if (!userPrompt) {
        return NextResponse.json({
          success: false,
          output: "Usage: generate $prompt"
        });
      }
      if (!currentNodeId) {
        return NextResponse.json({
          success: false,
          output: "Error: No hierarchy node selected."
        });
      }

      const hierarchy = await HierarchyModel.findById(currentNodeId).lean();
      if (!hierarchy) {
        return NextResponse.json({
          success: false,
          output: "Error: Selected hierarchy node not found."
        });
      }

      const fileIds = (hierarchy.files || []).map((id: any) => id.toString());

      try {
        const result = await generateExamWithGemini(fileIds, userPrompt);
        return NextResponse.json({
          success: true,
          output: result || "(empty response from Gemini)"
        });
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          output: `Error: ${err?.message || "Failed to generate exam."}`
        });
      }
    }

    // 4. NODE SELECTION / NAVIGATION by typing Name or tag_Name
    if (!currentNodeId) {
      // Find parentless node with this Name or tag_Name (case-insensitive)
      const matchingNode = await HierarchyModel.findOne({
        parents: { $size: 0 },
        $or: [
          { Name: { $regex: new RegExp(`^${trimmed}$`, "i") } },
          { tag_Name: { $regex: new RegExp(`^${trimmed}$`, "i") } }
        ]
      });

      if (matchingNode) {
        return NextResponse.json({
          success: true,
          action: "navigate",
          output: "",
          currentNode: {
            id: matchingNode._id.toString(),
            Name: matchingNode.Name,
            tag_Name: matchingNode.tag_Name
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          output: `node ${trimmed} not found`
        });
      }
    } else {
      // Find a child of the current node with this Name or tag_Name (case-insensitive)
      const parentNode = await HierarchyModel.findById(currentNodeId);
      if (!parentNode) {
        return NextResponse.json({
          success: false,
          output: `Error: Current node not found. Resetting to root.`,
          action: "root",
          currentNode: null
        });
      }

      // Check among children of parent node
      const childIds = parentNode.children.map((c: any) => c["p-id"]);
      const matchingChild = await HierarchyModel.findOne({
        _id: { $in: childIds },
        $or: [
          { Name: { $regex: new RegExp(`^${trimmed}$`, "i") } },
          { tag_Name: { $regex: new RegExp(`^${trimmed}$`, "i") } }
        ]
      });

      if (matchingChild) {
        return NextResponse.json({
          success: true,
          action: "navigate",
          output: "",
          currentNode: {
            id: matchingChild._id.toString(),
            Name: matchingChild.Name,
            tag_Name: matchingChild.tag_Name
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          output: `node ${trimmed} not found`
        });
      }
    }
  } catch (error: any) {
    console.error("Hierarchy API Error:", error);
    return NextResponse.json({ error: error?.message || "An error occurred." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("nodeId");

    if (!nodeId) {
      const roots = await HierarchyModel.find({ parents: { $size: 0 } })
        .lean()
        .sort({ Name: 1 });

      return NextResponse.json({
        node: null,
        children: roots.map((node: any) => ({
          id: node._id.toString(),
          Name: node.Name,
        })),
        fileIds: [],
      });
    }

    if (!mongoose.Types.ObjectId.isValid(nodeId)) {
      return NextResponse.json({ error: "Invalid node ID." }, { status: 400 });
    }

    const node = await HierarchyModel.findById(nodeId).lean();
    if (!node) {
      return NextResponse.json({ error: "Hierarchy node not found." }, { status: 404 });
    }

    return NextResponse.json({
      node: {
        id: node._id.toString(),
        Name: node.Name,
      },
      children: (node.children || []).map((child: any) => ({
        id: child["p-id"].toString(),
        Name: child["p-name"],
      })),
      fileIds: (node.files || []).map((id: any) => id.toString()),
    });
  } catch (error: any) {
    console.error("Hierarchy browse error:", error);
    return NextResponse.json(
      { error: error?.message || "An error occurred." },
      { status: 500 }
    );
  }
}
