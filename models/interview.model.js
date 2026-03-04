import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
    question: {
        type: String,
    },
    difficulty: {
        type: String,
    },
    timeLimit: {
        type: String,
    },
    answer: {
        type: String,
    },
    feedback: {
        type: String,
    },
    score: {
        type: Number,
    },
    confidence: {
        type: Number,
        default: 0
    },
    communication: {
        type: Number,
        default: 0
    },
    correctness: {
        type: Number,
        default: 0
    },

});

const interviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    role: {
        type: String,
        required: true
    },
    experience: {
        type: String,
        required: true
    },
    mode: {
        type: String,
        enum: ["HR", "Technical"],
        required: true
    },
    resumeText: {
        type: String,
        required: true
    },
    questions: [questionSchema],
    totalConfidence: {
        type: Number,
        default: 0
    },
    totalCommunication: {
        type: Number,
        default: 0
    },
    totalCorrectness: {
        type: Number,
        default: 0
    },
    overallFeedback: {
        type: String
    },
    finalScore: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ["incompleted", "completed"],
        default: "incompleted"
    }

}, { timestamps: true });

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;
