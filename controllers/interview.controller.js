import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openRouter.services.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

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

    const aiResponse = await askAi({ messages });
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
    return res
      .status(500)
      .json({ message: `Failed to analyze resume ${error}` });
  }
};

export const generateQuestions = async (req, res) => {
  try {
    const { role, experience, mode, resumeText, projects, skills } = req.body;
    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !mode || !experience) {
      return res
        .status(400)
        .json({ message: "role , experience and mode are required" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.credits < 50) {
      return res.status(400).json({ message: "Insufficient credits" });
    }

    const projectText =
      Array.isArray(projects) && skills.length ? projects.join(", ") : "None";
    const skillsText =
      Array.isArray(skills) && skills.length ? skills.join(", ") : "None";

    const safeResume = resumeText?.trim() || "None";

    const userPrompt = `
    Role:${role}
    Experience:${experience}
    InterviewMode:${mode}
    Projects:${projectText}
    Skills:${skillsText},
    Resume:${safeResume}
    `;

    if (!userPrompt.trim()) {
      return res.status(400).json({ message: "prompt content is empty" });
    }

    const messages = [
      {
        role: "system",
        content: `
You are a real human interviewer conducting a professional interview.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 5 interview questions.

Strict Rules:
- Each question must contain between 15 and 25 words.
- Each question must be a single complete sentence.
- Do NOT number them.
- Do NOT add explanations.
- Do NOT add extra text before or after.
- One question per line only.
- Keep language simple and conversational.
- Questions must feel practical and realistic.

Difficulty progression:
Question 1 → easy  
Question 2 → easy  
Question 3 → medium  
Question 4 → medium  
Question 5 → hard  

Make questions based on the candidate’s role, experience,interviewMode, projects, skills, and resume details.
`,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    const aiResponse = await askAi({ messages });
    console.log("aiResponse", aiResponse);

    if (aiResponse || aiResponse.trim()) {
      return res.status(500).json({ message: "AI returend empty response" });
    }

    const questionArray = aiResponse
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 5);

    if (questionArray.length === 0) {
      return res
        .status(500)
        .json({ message: "AI failed to generate questions" });
    }

    user.credits -= 50;
    await user.save();

    const interview = await Interview.create({
      userId: user._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      questions: questionArray.map((q, index) => ({
        question: q,
        difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
        timeLimit: [60, 60, 90, 90, 120][index],
      })),
    });

    return res.status(200).json({
      message: "Questions generated successfully",
      interviewId: interview._id,
      questions: interview.questions,
      creditLeft: user.credits,
      userName: user.name,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: `Failed to generate questions ${error}` });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionId, answer, questionIndex, timeTaken } =
      req.body;

    const interview = await Interview.findById(interviewId);

    const question = interview.questions[questionIndex];

    if (!answer) {
      question.score = 0;
      question.feedback = "No answer submitted, Answer not evaluated";
      question.answer = "";
      await interview.save();
      return res.json({
        feedback: question.feedback,
      });
    }

    // if Time exceed
    if (timeTaken > question.timeLimit) {
      question.score = 0;
      question.feedback = "Time limit exceeded";
      question.answer = answer;
      await interview.save();
      return res.json({
        feedback: question.feedback,
      });
    }

    const messages = [
      {
        role: "system",
        content: `
You are a professional human interviewer evaluating a candidate's answer in a real interview.

Evaluate naturally and fairly, like a real person would.

Score the answer in these areas (0 to 10):

1. Confidence – Does the answer sound clear, confident, and well-presented?
2. Communication – Is the language simple, clear, and easy to understand?
3. Correctness – Is the answer accurate, relevant, and complete?

Rules:
- Be realistic and unbiased.
- Do not give random high scores.
- If the answer is weak, score low.
- If the answer is strong and detailed, score high.
- Consider clarity, structure, and relevance.

Calculate:
finalScore = average of confidence, communication, and correctness (rounded to nearest whole number).

Feedback Rules:
- Write natural human feedback.
- 10 to 15 words only.
- Sound like real interview feedback.
- Can suggest improvement if needed.
- Do NOT repeat the question.
- Do NOT explain scoring.
- Keep tone professional and honest.

Return ONLY valid JSON in this format:

{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback"
}
`,
      },
      {
        role: "user",
        content: `
Question: ${question.question}
Answer: ${answer}
`,
      },
    ];

    const aiResponse = await askAi({ messages });
    const parsedResponse = JSON.parse(aiResponse);

    question.score = parsedResponse.finalScore;
    question.feedback = parsedResponse.feedback;
    question.confidence = parsedResponse.confidence;
    question.communication = parsedResponse.communication;
    question.correctness = parsedResponse.correctness;
    question.answer = answer;

    await interview.save();

    return res.json({
      feedback: question.feedback,
      score: question.score,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: `Failed to submit answer ${error}` });
  }
};

const generateOverallFeedback = async (interview) => {
  try {
    const questionData = interview.questions
      .map(
        (q, i) => `
    Question ${i + 1}: ${q.question}
    Candidate Answer: ${q.answer || "No answer provided"}
    Score: ${q.score}/10
    `,
      )
      .join("\n");

    const messages = [
      {
        role: "system",
        content: `
You are an expert technical interviewer reviewing a candidate's complete interview performance.

Based on the question and answer data, generate an overall feedback summary for the candidate.
Keep it strictly under 50 words.
Be professional, constructive, and encouraging. Focus on general strengths and areas for improvement.
Do not provide a score, just text feedback.
`,
      },
      {
        role: "user",
        content: `Interview Data:\n${questionData}`,
      },
    ];

    const aiResponse = await askAi({ messages });
    return aiResponse.trim();
  } catch (error) {
    console.log("Failed to generate overall feedback", error);
    return "Feedback generation failed due to an internal error.";
  }
};

export const finishInterview = async (req, res) => {
  try {
    const { interviewId } = req.body;
    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    if (totalQuestions > 0) {
      interview.questions.forEach((question) => {
        totalScore += question.score || 0;
        totalConfidence += question.confidence || 0;
        totalCommunication += question.communication || 0;
        totalCorrectness += question.correctness || 0;
      });

      interview.finalScore = totalScore / totalQuestions;
      interview.totalConfidence = totalConfidence / totalQuestions;
      interview.totalCommunication = totalCommunication / totalQuestions;
      interview.totalCorrectness = totalCorrectness / totalQuestions;
    } else {
      interview.finalScore = 0;
      interview.totalConfidence = 0;
      interview.totalCommunication = 0;
      interview.totalCorrectness = 0;
    }

    const overallFeedback = await generateOverallFeedback(interview);
    interview.overallFeedback = overallFeedback;
    interview.status = "completed";
    await interview.save();
    return res.json({ message: "Interview completed successfully", interview });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: `Failed to finish interview ${error}` });
  }
};

export const getInterviewHistory = async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.userId })
      .select("role experience mode status finalScore createdAt overallFeedback totalConfidence totalCommunication totalCorrectness")
      .sort({ createdAt: -1 });

    return res.status(200).json(interviews);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: `Failed to fetch interview history ${error}` });
  }
};
