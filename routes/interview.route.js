import express from 'express'
import { analyzeResume, finishInterview, generateQuestions, submitAnswer, getInterviewHistory } from '../controllers/interview.controller.js'
import { upload } from '../middleware/multer.js'
import { isAuth } from '../middleware/isAuth.js'

const router = express.Router()

router.post("/resume", isAuth, upload.single("resume"), analyzeResume)
router.post("/generate-questions", isAuth, generateQuestions)
router.post("/submit-answer", isAuth, submitAnswer)
router.post("/finish", isAuth, finishInterview)
router.get("/history", isAuth, getInterviewHistory)

export default router