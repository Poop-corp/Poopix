import jwt from 'jsonwebtoken';
import dotenv from "dotenv";

import { UserPayload } from "../Interface/Interface.ts";

dotenv.config({ override: true });

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET_XYZ";

export function createJWT(payload: UserPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "3d" }); // creating jwt sign
}

export function verifyJWT(token: string): UserPayload | null { // verifying JWT
    try {
        return jwt.verify(token, JWT_SECRET) as UserPayload;
    } catch (error) {
        console.log(error);
        return null;
    }
}

export default {
    createJWT,
    verifyJWT
};