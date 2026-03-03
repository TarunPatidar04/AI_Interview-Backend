
import axios from "axios"
import dotenv from "dotenv"
dotenv.config()

export const askAi = async ({ messages }) => {
    try {
        if (!messages || messages.length === 0 || !Array.isArray(messages)) {
            throw new Error("Messages are required")
        }

        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "anthropic/claude-sonnet-4.6",
            messages: messages,
        }, {
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
            },
        })
        const content = response?.data?.choices?.[0]?.message?.content;
        if (!content || !content.trim()) {
            throw new Error("No content received from AI")
        }
        return content;
    } catch (error) {
        console.log(error)
        throw new Error("Failed to get response from Open Router AI")
    }
}