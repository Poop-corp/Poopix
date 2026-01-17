// Sorry for my English🤞
// For more detailed comments, I will use a translator.

// DIV //
const authDiv = document.getElementById("auth-container");
const profileDiv = document.getElementById("profile-container");
const createOrderDiv = document.getElementById("create-order-div");
const ordersListDiv = document.getElementById("orders-list");
// DIV //

// FORM //
const createOrderForm = document.getElementById("create-order-form");
// FORM //

// ELSE //
const loginDsButton = document.getElementById("discord-login");
const logoutButton = document.getElementById("logout");
const createOrderButton = document.getElementById("create-order");
const cancelOrderButton = document.getElementById("cancel-order");

const profileAvatar = document.getElementById("avatar");
const profileUsername = document.getElementById("username");
const profileOrderCount = document.getElementById("orders-count");
const profileOrderProgCount = document.getElementById("orders-progress-count");
// ELSE //

// SERVER SIDED ACTIONS //

loginDsButton.addEventListener("click", (event) => {
    // A simple redirect to the backend. We don't do a fetch here because OAuth2
    // should start with a direct click on the link to initiate the session.
    window.location.href = "/api/auth/discord/login";
});

logoutButton.addEventListener("click", (event) => {
    window.location.href = "/api/auth/logout";
});

createOrderForm.onsubmit = async () => {
    const name = document.getElementById("create-name").value;
    const description = document.getElementById("create-description").value;
    const deadline = document.getElementById("create-deadline").value;

    const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, deadline })
    });

    if (res.ok) {
        // If the server accepts the order, we clear the form and hide the div.
        // We update the order list so the user can see the result immediately.
        createOrderDiv.style.display = "none"
        createOrderForm.reset()
        await generateOrdersDiv()
    };
}

// An object mapper for order actions.
// I think using this pattern instead of a bunch of if/else
// statements makes the code cleaner and easier to extend.
const ordersButtonAttActions = {
    "Accept": async function (id) {
        // We send the patch to change the status.
        const res = await fetch("/api/order", {
            method: "PATCH",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId: id, status: 2 })
        });

        if (res.ok) {
            await generateOrdersDiv()
        };
    },
    "Deny": async function (id) {
        const res = await fetch("/api/order", {
            method: "PATCH",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId: id, status: 5 })
        });

        if (res.ok) {
            await generateOrdersDiv()
        };
    },
    "Report": async function (id) {
        window.location.href = "https://discord.gg/KfRykurRzb";
    },
    "Delete": async function (id) {
        const res = await fetch("/api/order", {
            method: "DELETE",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId: id })
        });

        if (res.ok) {
            await generateOrdersDiv();
        };
    }
}

// Event delegation.
// Instead of attaching a listener to every button in every order,
// which is bad for memory, we attach a single listener to the parent
// container and catch the event bubbling.
ordersListDiv.addEventListener("click", async (event) => {
    event.preventDefault();

    const button = event.target.closest("button");
    // We look for the nearest button if we clicked on the icon inside it
    if (!button) return;
    const type = button.dataset.type;
    // Get the action type (Accept/Delete, etc.)
    const id = button.dataset.id;
    if (!type || !id || !ordersButtonAttActions[type]) return;
    ordersButtonAttActions[type](id);
})

// SERVER SIDED ACTIONS //

// CLIENT SIDED ACTIONS //

createOrderButton.addEventListener("click", (event) => {
    createOrderDiv.style.display = "block";
});

cancelOrderButton.addEventListener("click", (event) => {
    createOrderDiv.style.display = "none";
    createOrderForm.reset();
});

// CLIENT SIDED ACTIONS //

async function generateOrdersDiv() {
    // getting ready-made HTML from the server
    const res = await fetch("/api/orders");

    if (res.ok) {
        const data = await res.json(); // getting data from responce
        ordersListDiv.innerHTML = "";

        data.orders.forEach((orderHTML) => { // inserting html
            ordersListDiv.insertAdjacentHTML("beforeend", orderHTML);
        })
    }
}

async function checkAuth() {
    // When loading the page, we check whether the session is still alive (JWT in cookies).
    const res = await fetch("/api/auth/me", { method: "POST" }); // fetching data from jwt saved in cookies
    if (res.ok) {
        const result = await res.json(); // getting decodeed data
        const user = result.data;

        if (user.avatar) {
            profileAvatar.src = `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=256`; // setting profile image to image from discord
        } else {
            profileAvatar.src = `https://cdn.discordapp.com/embed/avatars/${(BigInt(user.discordId) >> 22n) % 6n}.png`; // or on standart image if not found
        }
        profileUsername.innerText = user.username || "Guest";

        authDiv.style.display = "none";
        profileDiv.style.display = "block";

        await generateOrdersDiv();
    };
};

checkAuth();