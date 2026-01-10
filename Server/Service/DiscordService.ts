import dotenv from "dotenv";
import {
    Client, GatewayIntentBits, EmbedBuilder, TextChannel,
    User, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    MessageFlags,
} from "discord.js";
import DataStoreService from "./DataStoreService.ts";
import OrderData from "../Data/OrderData";
import { Order, Status } from "../Interface/Interface.ts";

dotenv.config({ override: true });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

export async function GetUserById(id: string): Promise<User | null> { // function to get user by it's id
    try {
        return await client.users.fetch(id); // the main line
    } catch (error) {
        return null;
    }
}

export async function SendOrderEmbed(order: Order): Promise<Status> {
    try {
        if (!DISCORD_CHANNEL_ID) {
            return { status: false, msg: "No DISCORD_CHANNEL_ID in .env" };
        }

        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID); // getting channel

        if (!channel || !channel.isTextBased()) {
            return { status: false, msg: "Invalid channel" }; // returning if channel not found or its not textchannel (maybe voice or else)
        }

        const textChannel = channel as TextChannel; // Casting channel to TextChannel class
        const user = await GetUserById(order.by); // getting user by its id
        const hex = parseInt(OrderData.StatusColors[order.status as keyof typeof OrderData.StatusColors], 16); // getting hex for current status
        const buttons = OrderData.StatusButtons[order.status as keyof typeof OrderData.StatusButtons](order._id.toString());

        const embed = new EmbedBuilder()
            .setColor(hex)
            .setTitle(`Order: ${order.name}`) // title to order.name
            .setAuthor({ // author's name is user's username or "Unknown" and avatar is undefined or user's one
                name: user ? user.username : "Unknown",
                iconURL: user ? user.displayAvatarURL() : undefined
            })
            .setDescription(order.description || "No description provided") // description order.description
            .addFields( // filling fields like Deadline and Order's ID (just for beauty no practic usage)
                { name: "Deadline", value: order.deadline ? order.deadline.toLocaleString("hy-AM", { timeZone: "Asia/Yerevan" }) : "No deadline provided", inline: true },
                { name: "Order ID", value: order._id.toString().slice(-5).toUpperCase(), inline: true }
            )
            .setTimestamp();

        const actionRow = new ActionRowBuilder<ButtonBuilder>() // creating buttons
            .addComponents(...buttons)

        await textChannel.send({ embeds: [embed], components: [actionRow] }); // sending embed to textChannel
        return { status: true, msg: "Success" };

    } catch (error: any) {
        return { status: false, msg: error.message };
    }
}

export async function PatchOrderEmbed(orderId: string): Promise<Status> {
    try {
        if (!DISCORD_CHANNEL_ID) return { status: false, msg: "No DISCORD_CHANNEL_ID" };

        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID); // getting channel by it's id
        if (!channel || !channel.isTextBased()) return { status: false, msg: "Invalid channel" };

        const textChannel = channel as TextChannel; // cast channel to TextChannel class
        const order = await DataStoreService.GetOrderById(orderId); // getting order by it's id
        if (!order) return { status: false, msg: "Order not found" }; // order not found

        const messages = await textChannel.messages.fetch({ limit: 100 }); // fetching last 100 messages to get our order embed
        const targetMessage = messages.find(msg =>
            msg.author.id === client.user?.id &&
            msg.embeds[0]?.fields.some(f => f.name === "Order ID" && f.value === order._id.toString().slice(-5).toUpperCase())
        ); // finding the needed one

        if (!targetMessage) return { status: false, msg: "Message not found" }; // not found

        const user = await GetUserById(order.by.toString()); // getting user by it's id
        const hex = parseInt(OrderData.StatusColors[order.status as keyof typeof OrderData.StatusColors], 16); // getting color for embed
        const buttons = OrderData.StatusButtons[order.status as keyof typeof OrderData.StatusButtons](order._id.toString()); // getting buttons for embed

        const updatedEmbed = EmbedBuilder.from(targetMessage.embeds[0]) // updating embed
            .setColor(hex)
            .setFields(
                { name: "Deadline", value: order.deadline ? new Date(order.deadline).toLocaleString("hy-AM", { timeZone: "Asia/Yerevan" }) : "No deadline", inline: true },
                { name: "Order ID", value: order._id.toString().slice(-5).toUpperCase(), inline: true }
            ); // setting fields

        if (order.cost > 0) { // adding "Cost" field if cost is more then 0
            updatedEmbed.addFields({ name: "Cost", value: `$${order.cost}`, inline: true });
        }

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons); // creating actionRow for buttons

        await targetMessage.edit({ embeds: [updatedEmbed], components: [actionRow] }); // editing the target

        return { status: true, msg: "Success" };
    } catch (error: any) {
        return { status: false, msg: error.message };
    }
}

export async function DeleteOrderEmbed(orderId: string): Promise<Status> {
    try {
        if (!DISCORD_CHANNEL_ID) return { status: false, msg: "No DISCORD_CHANNEL_ID" };

        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID); // getting channel by it's id
        if (!channel || !channel.isTextBased()) return { status: false, msg: "Invalid channel" };

        const textChannel = channel as TextChannel; // cast channel to TextChannel class
        const order = await DataStoreService.GetOrderById(orderId); // getting order by it's id
        if (!order) return { status: false, msg: "Order not found" }; // order not found

        const messages = await textChannel.messages.fetch({ limit: 100 }); // fetching last 100 messages to get our order embed
        const targetMessage = messages.find(msg =>
            msg.author.id === client.user?.id &&
            msg.embeds[0]?.fields.some(f => f.name === "Order ID" && f.value === order._id.toString().slice(-5).toUpperCase())
        ); // finding the needed one

        if (!targetMessage) return { status: false, msg: "Message not found" }; // not found
        await targetMessage.delete() // deleting embed

        return { status: true, msg: "Success" };
    } catch (error: any) {
        return { status: false, msg: error.message };
    }
}

const modals = {
    "modal_setcost_": async function (interaction: any) {
        if (!interaction.isFromMessage()) return;
        const orderId = interaction.customId.split("_")[2]; // getting order id
        const costValue = interaction.fields.getTextInputValue('cost_value');
        const costNum = parseInt(costValue, 10); // getting cost value

        if (!costNum) {
            return interaction.reply({ content: "Not valid number entered.", flags: [MessageFlags.Ephemeral] });
        }

        await DataStoreService.PatchOrder(orderId, "cost", costNum);
        await DataStoreService.PatchOrder(orderId, "status", 1);

        const updatedEmbed = EmbedBuilder.from(interaction.message!.embeds[0]) // creating new embed
            .addFields({ name: "Cost", value: `$${costNum}`, inline: true })
            .setColor(parseInt(OrderData.StatusColors[1], 16));

        await interaction.update({ embeds: [updatedEmbed], components: [] });
    }
}

export function LoginBot(): void { // LoginBot function that's turning bot on with provided token
    if (DISCORD_BOT_TOKEN) {
        client.on("interactionCreate", async (interaction) => { // connect to interactionCreate's event
            if (interaction.isButton()) {
                try {
                    const [strStatus, action, orderId] = interaction.customId.split("_");
                    const status = Number(strStatus); // making status number from string
                    const statusActions = OrderData.StatusButtonsActions[status as keyof typeof OrderData.StatusButtonsActions]; // getting status button's actions for current status
                    if (!statusActions) return;
                    const actionFunc = (statusActions as any)?.[action]; // getting action function for current action

                    if (actionFunc) await actionFunc(interaction, orderId);
                } catch (err) {
                    // to avoid errors😾
                }
            }

            if (interaction.isModalSubmit()) {
                for (const index in modals) {
                    if (interaction.customId.startsWith(index)) {
                        modals[index as keyof typeof modals](interaction);
                    };
                };
            };
        });

        client.login(DISCORD_BOT_TOKEN);
    }
}

export default {
    LoginBot,
    SendOrderEmbed,
    PatchOrderEmbed,
    GetUserById
};