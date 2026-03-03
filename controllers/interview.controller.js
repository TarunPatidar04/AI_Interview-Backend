import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openRouter.services.js";

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume File is required" });
    }

    const file = req.file.path;
    const Filebuffer = await fs.promises.readFile(file);
    const uint8Array = new Uint8Array(Filebuffer);
    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
    // console.log(pdf)

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ");
      fullText += text + "\n";
    }
    console.log("fullText", fullText);

    fullText = fullText.replace(/\s+/g, " ").trim();
    console.log("clean fullText", fullText);

    const messages = [
      {
        role: "system",
        content: `
Extract structured data from resume.

Return strictly JSON:

{
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}
`,
      },
      {
        role: "user",
        content: fullText,
      },
    ];

    const aiResponse = await askAi(messages);
    const parsedResponse = JSON.parse(aiResponse);
    console.log("parsedResponse", parsedResponse);

    fs.unlinkSync(file);
    return res.status(200).json({
      message: "Resume analyzed successfully",
      role: parsedResponse.role,
      experience: parsedResponse.experience,
      projects: parsedResponse.projects,
      skills: parsedResponse.skills,
      fullText,
    });
  } catch (error) {
    console.log(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ message: "Failed to analyze resume" });
  }
};
