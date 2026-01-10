import dotenv from "dotenv";

dotenv.config({ override: true });

import DataStoreService from "./DataStoreService";
import { Order } from "../Interface/Interface";

export function getHTMLFor(order: Order) { // get HTML for order card
    if (!order) return "";

    const status = order.status; // order's status
    const orderId = order._id.toString().slice(-5).toUpperCase(); // order's Id. I got the last 5 symbols otherwise its going to look like #asfrnqyuh12yegdgyvd32tdvtd
    const orderName = order.name || "Unknown"; // order's name
    
    let config = {
        bg: "rgba(67, 181, 129, 0.1)",
        border: "rgba(67, 181, 129, 0.3)",
        badgeBg: "rgba(67, 181, 129, 0.8)",
        label: "OPEN",
        subtext: "Just opened",
        buttons: ``
    }; // creating standart config if no one of statuses doesnt match (or status is 2) this one will be used

    switch (status) {
        case 0:
            config = {
                bg: "rgba(230, 126, 34, 0.1)",
                border: "rgba(230, 126, 34, 0.3)",
                badgeBg: "rgba(230, 126, 34, 0.8)",
                label: "ON REVIEW",
                subtext: "On review",
                buttons: ``
            }; // config for status 0 (On review) this status means the order is sent on my discord server and waiting to be accepted
            break;
        case 1:
            config = {
                bg: "rgba(155, 89, 182, 0.1)",
                border: "rgba(155, 89, 182, 0.3)",
                badgeBg: "rgba(155, 89, 182, 0.8)",
                label: "CONSIDERATION",
                subtext: "Action required",
                buttons: `
                    <div style="display:flex; gap:8px;">
                        <button class="discord-btn" style="background:#43b581; flex:1; font-size:13px; padding:8px;" data-id=${order._id.toString()} data-type="Accept">Accept for $${order.cost}</button>
                        <button class="delete-btn" style="background:#f04747; flex:1; font-size:13px; padding:8px;" data-id=${order._id.toString()} data-type="Deny">Deny</button>
                    </div>`
            }; // config for status 1 (consideration) this status means I saw the order and set my price, you can accept it or decline
            break;
        // I doesnt created config for 2 because the standart one is the same
        case 3:
            config = {
                bg: "rgba(240, 144, 76, 0.1)",
                border: "rgba(240, 144, 76, 0.3)",
                badgeBg: "rgba(240, 144, 76, 0.8)",
                label: "IN PROGRESS",
                subtext: "In progress",
                buttons: ``
            }; // config for status 3 (in progress) this status means I started doing your order
            break;
        case 4:
            config = {
                bg: "rgba(67, 181, 129, 0.05)",
                border: "rgba(67, 181, 129, 0.2)",
                badgeBg: "#43b581",
                label: "DONE",
                subtext: "Check your discord dm with bot",
                buttons: `
                    <div style="display:flex; gap:8px;">
                        <button class="discord-btn" style="background:#4f545c; flex:1; font-size:14px; padding:8px;" data-id=${order._id.toString()} data-type="Delete">Archive</button>
                        <button class="discord-btn" style="background:#5865f2; flex:1; font-size:14px; padding:8px;" data-id=${order._id.toString()} data-type="Report">Report</button>
                    </div>`
            }; // status 4 (done) this status means your order is done
            break;
        case 5:
            config = {
                bg: "rgba(244, 67, 54, 0.1)",
                border: "rgba(244, 67, 54, 0.3)",
                badgeBg: "rgba(244, 67, 54, 0.8)",
                label: "DENIED",
                subtext: "Denied",
                buttons: `
                    <div style="display:flex; gap:8px;">
                        <button class="delete-btn" style="background:#f04747; flex:1; font-size:14px; padding:8px;" data-id=${order._id.toString()} data-type="Delete">Delete</button>
                    </div>`
            }; // status 5 (denied) this status means I denied your order >_<
            break;
    }

    return `
        <div class="order-card" style="background:${config.bg}; border:1px solid ${config.border}; border-radius:8px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                <div>
                    <h4 style="color:#fff; font-weight:600; margin-bottom:4px;">Order #${orderId}</h4>
                    <p style="color:#b9bbbe; font-size:12px;">${config.subtext}</p>
                </div>
                <span style="background:${config.badgeBg}; color:#fff; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600;">${config.label}</span>
            </div>
            <p style="color:#b9bbbe; font-size:13px; margin-bottom:12px;">Name: ${orderName}</p>
            ${config.buttons}
        </div>
    `; // collecting full HTML Code
}

export default {
    getHTMLFor
}