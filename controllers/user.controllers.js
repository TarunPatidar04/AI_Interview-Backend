import User from "../models/user.model.js";


export const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Get user failed Internal server error" });
    }
}