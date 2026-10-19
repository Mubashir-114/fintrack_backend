import jwt from "jsonwebtoken";
import { sessionBinding } from "./sessionBinding.js";

const generateToken = (userId, passwordHash)=> {
    return jwt.sign(
        {id: userId, session: sessionBinding(userId, passwordHash)},
        process.env.JWT_SECRET,
        {expiresIn: "7d", algorithm: "HS256"}
    );
};

export default generateToken;
