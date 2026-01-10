import mongodb, { ObjectId } from "mongodb";
import { JwtPayload } from "jsonwebtoken";

export interface User {
    _id: mongodb.ObjectId;
    discordId: number,
    email: string
};

export interface Status {
    status: boolean;
    msg: string;
};

export interface UserPayload extends JwtPayload {
    discordId: string;
    email: string;
};

export interface Order {
    _id: ObjectId,
    name: string,
    description: string,
    by: string,
    cost: number,
    status: number,
    deadline: Date
};