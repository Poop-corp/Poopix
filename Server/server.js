// Sorry for my English🤞
// For more detailed comments, I will use a translator.

// importing libraries
import dotenv from "dotenv";
import express from "express";
import http from "http";
import url from "url";
import path from "path";
import cookieParser from "cookie-parser";

// importing all env variables
dotenv.config({ override: true });

// I divided the code into several services so as not to turn the code into a huge block,
// and even in the future, if we need to change, for example, MongoDB to, for example,
// PostgreSQL, we will only need to change the functions in DataStoreService
// importing services that was made by me >_<
import DataStoreService from "./Service/DataStoreService.ts";
// DataStoreService is created to save/get/delete data from mongoDB NoSQL DataBase
import AuthService from "./Service/AuthService.ts";
// AuthService is created to create/verify jwt tokens
import OrderService from "./Service/OrderService.ts";
// OrderService is created to control orders

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// current folder's path

const app = express();
const server = http.createServer(app); // creating server
app.use(express.json());
// allow the server to accept JSON data
app.use(cookieParser());
// allow the server to process cookies

const clientFolder = path.join(__dirname, "../Client");
// folder of Frontend (index.html, style.css, client.js)
app.use(express.static(clientFolder));

const httpMethods = { // declaring an array for httpMethods
    // this array will help us scale the project more easily
    // in the future and avoid a huge list of code from app.get, app.post, etc.
    GET: { // declaring routes for GET method
        // 
        "/": (req, res) => {
            // as soon as a user connects to the server, I send him the index.html file.
            res.sendFile(path.join(clientFolder, "index.html")) // sending index.html file to client
        },
        "/api/auth/discord/callback": async (req, res) => {
            const { code } = req.query;
            // We receive the code that Discord sent us.
            // If it is not there, then something went wrong, perhaps the user
            // canceled the login themselves.
            if (!code) return res.status(400).redirect("/");

            try {
                // We exchange the one-time code for real tokens.
                // We use URLSearchParams because the Discord API expects data
                // in the x-www-form-urlencoded format.
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

                // If Discord didn't return the tokens (for example, the code is expired),
                // there's no point in continuing. Return status 500, as this is most
                // likely a server error.
                const tokens = await tokenRes.json();
                if (!tokenRes.ok) return res.status(500).json({ msg: "Failed to authenticate via Discord" }); // send 500 (Server Error) if not found

                // Now, using the access_token, we request the user's data.
                const userRes = await fetch("https://discord.com/api/users/@me", {
                    headers: { authorization: `${tokens.token_type} ${tokens.access_token}` },
                });

                const user = await userRes.json(); // getting data from json
                if (!userRes.ok) return res.status(500).json({ msg: "Failed to get user data" }); // if status is not 2xx then throwing 500 (Server Error) >_<

                // We extract only the fields we need.
                // We'll use the email and ID for database identification.
                const discordId = user.id;
                const email = user.email;
                const avatar = user.avatar;
                const username = user.username

                // We register a user or update their data in our MongoDB using
                // a service. Encapsulating the logic in the DataStoreService
                // eliminates the need to write database queries directly here.
                const userDb = await DataStoreService.CreateUser(discordId, email);

                if (userDb.status) {
                    const jwt = AuthService.createJWT({
                        discordId: discordId,
                        email: email,
                        username: username,
                        avatar: avatar // putting avatar hash directly into jwt
                    });
                    // Creating jwt token thats will be saved to user's cookies

                    // We set a cookie with the httpOnly flag to protect against XSS attacks.
                    res.cookie("jwt", jwt, {
                        httpOnly: true,
                        secure: false,
                        sameSite: "Lax",
                        maxAge: 3600000
                    });

                    return res.redirect("/");
                } else {
                    // If something is wrong, we return status 500,
                    // as this is a server error.
                    return res.status(500).json({ msg: "Failed to save data to database" });
                };
            } catch (error) {
                if (!res.headersSent) {
                    // We exchange the code for a token. It's important to check the
                    // response status from Discord here; otherwise, if their API
                    // crashes, our app might also return an error to the user.
                    // I added a headersSent check to avoid attempting to send the
                    // response twice if an error occurs.
                    return res.status(500).send({ msg: error.message });
                }
            }
        },
        "/api/auth/discord/login": (req, res) => {
            // collecting url
            const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email`;
            res.redirect(url);
        },
        "/api/auth/logout": (req, res) => {
            res.clearCookie("jwt"); // removing jwt token from cookies
            res.redirect("/");
        },
        "/api/orders": async (req, res) => {
            const jwt = req.cookies.jwt;
            // We check whether the user is authorized at all
            if (!jwt) return res.status(404).json({ msg: "Login first." });
            let decoded
            try {
                // We're checking the token's authenticity.
                // It might be counterfeit or simply expired.
                decoded = AuthService.verifyJWT(jwt);
            } catch (error) {
                return res.status(401).json({ msg: "Invalid jwt token" });
            }

            // We extract orders for this specific user using their Discord ID.
            const orders = await DataStoreService.GetOrdersFor(decoded.discordId);
            if (!orders) return res.status(404).json({ msg: "Orders not found" });

            // We transform raw database data into ready-to-use
            // HTML chunks for the frontend.
            for (const index in orders) {
                const order = orders[index];
                orders[index] = OrderService.getHTMLFor(order);
            };
            res.status(200).json({ orders: orders, msg: "Success" });
        }
    },
    POST: {
        "/api/auth/me": async (req, res) => {
            // This endpoint is needed by the frontend when loading the page to
            // determine who is logged in and to render the username and avatar
            // in the header
            const jwt = req.cookies.jwt;
            if (!jwt) return res.status(404).json({ msg: "Login first." });
            // Same as above (line 143)
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

            // We create a new order in the database.
            // We link it to the discordId from the token to prevent the user
            // from creating an order on someone else's behalf.
            const status_order = await DataStoreService.CreateOrder(decoded.discordId, name, description, deadline);

            if (status_order.status.status) {
                // If the order is saved successfully, we send the embed to Discord
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

            // Incorrect data protection.
            // We only accept statuses 2 (Open) or 5 (Denied).
            // Other statuses can only be changed manually by the admin.
            if (status !== 2 && status !== 5) return res.status(400).json({ msg: "Bad request" }) // send status 400 (Bad request) if status is not 2 or 5

            // We check the order owner's ID in the database against the ID in the
            // user's token. Without this, any logged-in user could close someone
            // else's order via Postman.
            if (!DataStoreService.IsOwnerOf(orderId, id)) return res.status(403).json({ msg: "Not your order" }) // returning status 403 (Forbidden) if not user's order (have no premissions)
            const statusDB = await DataStoreService.PatchOrder(orderId, "status", status); // changing order's status to 2 (Open) or 4 (Denied)

            if (statusDB.status) {
                // Updating the embed in Discord
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

            // Checking ownership rights again
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

// I decided to implement route registration through a loop.
// I think the code looks cleaner and is easier to modify.
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

DiscordService.LoginBot();

// DISCORD BOT //