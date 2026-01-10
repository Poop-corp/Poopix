import dotenv from "dotenv";
import express from "express";
import http from "http";
import url from "url";
import path from "path";
import cookieParser from "cookie-parser";

dotenv.config({ override: true });

// importing services that was made by me >_<
import DataStoreService from "./Service/DataStoreService.ts";
import AuthService from "./Service/AuthService.ts";
import OrderService from "./Service/OrderService.ts";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app); // creating server
app.use(express.json());
app.use(cookieParser());

const clientFolder = path.join(__dirname, "../Client");
app.use(express.static(clientFolder));

const httpMethods = { // declaring an array for httpMethods
    GET: { // declaring routes for GET method
        "/": (req, res) => {
            res.sendFile(path.join(clientFolder, "index.html")) // sending index.html file to client
        },
        "/api/auth/discord/callback": async (req, res) => {
            const { code } = req.query; // getting code from discord redirect
            if (!code) return res.status(400).redirect("/");

            try {
                const tokenRes = await fetch("https://discord.com/api/oauth2/token", { // getting real data from auth code
                    method: "POST",
                    body: new URLSearchParams({
                        client_id: process.env.DISCORD_CLIENT_ID,
                        client_secret: process.env.DISCORD_CLIENT_SECRET,
                        grant_type: "authorization_code",
                        code: code,
                        redirect_uri: process.env.DISCORD_REDIRECT_URI,
                    }),
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                });

                const tokens = await tokenRes.json();
                if (!tokenRes.ok) return res.status(500).json({ msg: "Failed to authenticate via Discord" }); // send 500 (Server Error) if not found

                const userRes = await fetch("https://discord.com/api/users/@me", { // getting user data like {id: number, email: string and etc}
                    headers: { authorization: `${tokens.token_type} ${tokens.access_token}` },
                });

                const user = await userRes.json(); // getting data from json
                if (!userRes.ok) return res.status(500).json({ msg: "Failed to get user data" }); // if status is not 2xx then throwing 500 (Server Error) >_<

                const discordId = user.id;
                const email = user.email;
                const avatar = user.avatar;
                const username = user.username

                const userDb = await DataStoreService.CreateUser(discordId, email);

                if (userDb.status) {
                    const jwt = AuthService.createJWT({
                        discordId: discordId,
                        email: email,
                        username: username,
                        avatar: avatar // putting avatar hash directly into jwt
                    });

                    res.cookie("jwt", jwt, {
                        httpOnly: true,
                        secure: false,
                        sameSite: "Lax",
                        maxAge: 3600000
                    });

                    return res.redirect("/");
                } else {
                    return res.status(500).json({ msg: "Failed to save data to database" });
                };
            } catch (error) {
                if (!res.headersSent) {
                    return res.status(500).send({ msg: error.message });
                }
            }
        },
        "/api/auth/discord/login": (req, res) => {
            const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email`;
            res.redirect(url);
        },
        "/api/auth/logout": (req, res) => {
            res.clearCookie("jwt"); // removing jwt token from cookies
            res.redirect("/");
        },
        "/api/orders": async (req, res) => {
            const jwt = req.cookies.jwt;
            if (!jwt) return res.status(404).json({ msg: "Login first." });
            let decoded
            try {
                decoded = AuthService.verifyJWT(jwt);
            } catch (error) {
                return res.status(401).json({ msg: "Invalid jwt token" });
            }

            const orders = await DataStoreService.GetOrdersFor(decoded.discordId);
            if (!orders) return res.status(404).json({ msg: "Orders not found" });
            for (const index in orders) {
                const order = orders[index];
                orders[index] = OrderService.getHTMLFor(order);
            };
            res.status(200).json({ orders: orders, msg: "Success" });
        }
    },
    POST: {
        "/api/auth/me": async (req, res) => {
            const jwt = req.cookies.jwt;
            if (!jwt) return res.status(404).json({ msg: "Login first." });
            try {
                const decoded = AuthService.verifyJWT(jwt);
                res.status(200).json({ data: decoded });
            } catch (error) {
                res.status(401).json({ msg: "Invalid jwt token" });
            }
        },
        "/api/order": async (req, res) => {
            const jwt = req.cookies.jwt;
            if (!jwt) return res.status(404).json({ msg: "Login first." });
            let decoded
            try {
                decoded = AuthService.verifyJWT(jwt);
            } catch (error) {
                return res.status(401).json({ msg: "Invalid jwt token" });
            }

            const { name, description, deadline } = req.body;

            const status_order = await DataStoreService.CreateOrder(decoded.discordId, name, description, deadline);

            if (status_order.status.status) {
                const status = await DiscordService.SendOrderEmbed(status_order.order);
                console.log(status.msg);
            }

            return res.status(status_order.status.status ? 200 : 500).json({ msg: status_order.status.msg });
        }
    },
    PATCH: {
        "/api/order": async (req, res) => {
            const jwt = req.cookies.jwt;
            if (!jwt) return res.status(404).json({ msg: "Login first." });
            let decoded
            try {
                decoded = AuthService.verifyJWT(jwt);
            } catch (error) {
                return res.status(401).json({ msg: "Invalid jwt token" });
            }
            const id = decoded.discordId;
            const { orderId, status } = req.body;
            if (status !== 2 && status !== 5) return res.status(400).json({ msg: "Bad request" }) // send status 400 (Bad request) if status is not 2 or 5

            if (!DataStoreService.IsOwnerOf(orderId, id)) return res.status(403).json({ msg: "Not your order" }) // returning status 403 (Forbidden) if not user's order (have no premissions)
            const statusDB = await DataStoreService.PatchOrder(orderId, "status", status); // changing order's status to 2 (Open) or 4 (Denied)

            if (statusDB.status) {
                await DiscordService.PatchOrderEmbed(orderId);
            }

            return res.status(statusDB.status ? 200 : 500).json({ msg: statusDB.msg });
        }
    },
    DELETE: {
        "/api/order": async (req, res) => { // delete order
            const jwt = req.cookies.jwt;
            if (!jwt) return res.status(404).json({ msg: "Login first." });
            let decoded
            try {
                decoded = AuthService.verifyJWT(jwt);
            } catch (error) {
                return res.status(401).json({ msg: "Invalid jwt token" });
            }
            const id = decoded.discordId;
            const { orderId } = req.body;
            if (!DataStoreService.IsOwnerOf(orderId, id)) return res.status(403).json({ msg: "Not your order" }) // returning status 403 (Forbidden) if not user's order (have no premissions)
            const status = await DataStoreService.DeleteOrder(orderId);

            if (status.status) {
                await DiscordService.PatchOrderEmbed(orderId);
            }
            
            return res.status(status.status ? 200 : 500).json({ msg: status.msg }) // return 200 (ok) if deleted and 500 (server iternal error) if not
        }
    }
};

// HTTP METHODS USAGE //

for (const method in httpMethods) { // Here we are getting methods from my array (GET, POST, PATCh etc)
    const routes = httpMethods[method]; // Getting routes from method arrays (for GET - "/" etc)

    for (const route in routes) {
        const routeFunction = routes[route]; // for every route we are getting function

        app[method.toLowerCase()](route, routeFunction); // connectiong app
        // for example, for "/" in GET method thats the same like app.get("/", (req, res) => {});
    };
};

// HTTP METHODS USAGE //

// RUN SERVER //

const PORT = process.env.PORT || 3000; // we are getting port from .env file or 3000 by standart
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});

// RUN SERVER //

// DISCORD BOT //

// Discord Bot's Service (Written by me)
import DiscordService from "./Service/DiscordService.ts";
import req from "express/lib/request.js";

DiscordService.LoginBot();

// DISCORD BOT //