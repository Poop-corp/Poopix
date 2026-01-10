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
        createOrderDiv.style.display = "none"
        createOrderForm.reset()
        await generateOrdersDiv()
    };
}

const ordersButtonAttActions = {
    "Accept": async function (id) {
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

ordersListDiv.addEventListener("click", async (event) => {
    event.preventDefault();

    const button = event.target.closest("button");
    if (!button) return;
    const type = button.dataset.type;
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
    const res = await fetch("/api/orders"); // getting all orders htmls

    if (res.ok) {
        const data = await res.json(); // getting data from responce
        ordersListDiv.innerHTML = "";

        data.orders.forEach((orderHTML) => { // inserting html
            ordersListDiv.insertAdjacentHTML("beforeend", orderHTML);
        })
    }
}

async function checkAuth() {
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