import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
    const { token } = req.cookies;
    if(!token) {
        // For notes, it's better to respond with 401 if unauthorized, not 200 success:false
        return res.status(401).json({ success: false, message: "Not Authorized: Please log in to access this resource." });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
        if(tokenDecode.id) {
            req.userId = tokenDecode.id; // Sets userId for subsequent controllers
            next();
        }else{
            return res.status(401).json({ success: false, message: "Not Authorized: Invalid token." });
        }
    } catch (error) {
        console.error("Error in userAuth middleware:", error);
        return res.status(401).json({ success: false, message: error.message || "Not Authorized: Invalid or expired token." });
    }
}

export default userAuth;