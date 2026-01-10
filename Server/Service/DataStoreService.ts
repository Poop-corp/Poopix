import mongodb, { ObjectId } from "mongodb";
import dotenv from "dotenv";

import { Order, Status } from "../Interface/Interface";
import { url } from "inspector";

dotenv.config({ override: true });

const URL = process.env.MONGO_URL; // we are getting URL to mongodb cluster from .env
if (!URL) {
  throw new Error("No MongoDB URL in env variables");
};

const MongoClient = new mongodb.MongoClient(URL, {
  serverApi: {
    version: mongodb.ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
}); // Creating mongo client
await MongoClient.connect();
const PoopMarketDB = await MongoClient.db("Poopix"); // getting DataBase "Poopix"
const UsersColl = await PoopMarketDB.collection("users"); // getting Collection for users
const OrdersColl = await PoopMarketDB.collection("orders"); // getting Collection for orders

export async function CreateUser(discordId: number, email: string): Promise<Status> { // creating user
  const user = await UsersColl.findOne({ discordId: discordId }); // finding user with the same discordId
  if (user) return { status: true, msg: "User allready exists. But login" }; // if found then just let him to login
  const status = await UsersColl.insertOne({
    discordId: discordId,
    email: email
  }); // if not creating him
  return { status: status.acknowledged, msg: status.acknowledged ? "Success" : "Something went wrong..." };
};

export async function CreateOrder(by: number, name: string, description: string, deadline: Date): Promise<{ status: Status, order: Order }> {
  const orderForm = {
    by: by, name: name, description: description,
    cost: 0, // by default | status - On Review. Cost doesnt set
    status: 0, // 0 status - On Review (Check OrderService.ts >_<)
    deadline: deadline
  }
  const status = await OrdersColl.insertOne(orderForm);
  return { order: { ...orderForm, _id: status.insertedId } as unknown as Order, status: { status: status.acknowledged, msg: status.acknowledged ? "Success" : "Something went wrong..." } };
}

export async function DeleteOrder(id: string): Promise<Status> { // delete order
  const status = await OrdersColl.deleteOne({ _id: new ObjectId(id) });
  return { status: status.acknowledged, msg: status.acknowledged ? "Success" : "Something went wrong..." };
}

export async function PatchOrder(id: string, key: any, value: any): Promise<Status> {
  const status = await OrdersColl.updateOne( // patch order
    { _id: new ObjectId(id) },
    { $set: { [key]: value } },
    { upsert: false }
  );
  return { status: status.acknowledged, msg: status.acknowledged ? "Success" : "Something went wrong..." };
}

export async function GetOrders(by: number): Promise<Order[]> {
  const orders = await OrdersColl.find({}).toArray();
  return orders as Order[];
}

export async function IsOwnerOf(orderId: string, by: string): Promise<boolean> {
  const order = await OrdersColl.find({ _id: new ObjectId(orderId) }) as unknown as Order; // "unknown" to avoid typization errors >_<
  return order.by == by
}

export async function GetOrdersFor(by: number): Promise<Order[]> {
  const orders = await OrdersColl.find({ by: by }).toArray();
  return orders as Order[];
}

export async function GetOrderById(id: string): Promise<Order> {
  const order = await OrdersColl.findOne({ _id: new ObjectId(id) });
  return order as Order;
}

export default {
  CreateUser,
  CreateOrder,
  DeleteOrder,
  PatchOrder,
  GetOrders,
  IsOwnerOf,
  GetOrdersFor,
  GetOrderById
};