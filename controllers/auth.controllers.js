import genToken from "../config/token.js";
import User from "../models/user.model.js";

export const googleAuth = async (req, res) => {

    try {
        const { email, name } = req.body;

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ name, email });

        }
        const token = await genToken(user._id);

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ message: "User logged in successfully", user });


    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Google Auth failed Internal server error" });

    }
}


export const logout = async (req, res) => {
    try {
        await res.clearCookie("token");
        res.status(200).json({ message: "User logged out successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Logout failed Internal server error" });
    }
}