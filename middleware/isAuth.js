import jwt from "jsonwebtoken";


export const isAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "User does not have token" });
        }
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        if (!decodedToken) {
            return res.status(401).json({ message: "Invalid token" });
        }

        req.userId = decodedToken.userId;
        next();
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}