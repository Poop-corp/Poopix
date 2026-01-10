import DataStoreService from "../Service/DataStoreService.ts";
import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    EmbedBuilder, MessageFlags, ModalBuilder,
    TextInputBuilder, TextInputStyle
} from "discord.js";

export const StatusColors = { // embed colors for every status
    0: "ffa500",
    1: "9b59b6",
    2: "43b581",
    3: "ffa500",
    4: "43b581",
    5: "f44336"
}; // hex colors copied from internet

export const StatusButtons = { // buttons for every status
    0: function buttons(orderId) { // buttons for 1 status
        return [ // return them via function
            new ButtonBuilder() // button to set cost
                .setCustomId(`0_cost_${orderId}`)
                .setLabel("Set cost")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder() // button to deny order
                .setCustomId(`0_deny_${orderId}`)
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger)
        ]
    },
    2: function buttons(orderId) { // buttons list for 2 status
        return [
            new ButtonBuilder()
                .setCustomId(`2_accept_${orderId}`)
                .setLabel("Accept")
                .setStyle(ButtonStyle.Success)
        ]
    },
    3: function buttons(orderId) { // buttons list for 3 status
        return [
            new ButtonBuilder()
                .setCustomId(`3_done_${orderId}`)
                .setLabel("Done")
                .setStyle(ButtonStyle.Success)
        ]
    }
};

export const StatusButtonsActions = {
    0: {
        cost: async function (interaction, orderId) {
            const modal = new ModalBuilder()
                .setCustomId(`modal_setcost_${orderId}`)
                .setTitle("Set Order's Cost");

            const costInput = new TextInputBuilder()
                .setCustomId("cost_value")
                .setLabel("Cost ($USD)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("0")
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(costInput));
            await interaction.showModal(modal);
        },
        deny: async function (interaction, orderId) {
            await DataStoreService.PatchOrder(orderId, "status", 5); // changing status to 5 (Denied)

            const deniedEmbed = EmbedBuilder.from(interaction.message.embeds[0]) // changing embed
                .setColor(parseInt(StatusColors[5], 16))
                .setTitle("Order: DENIED");

            await interaction.update({ embeds: [deniedEmbed], components: [] }); // updating embed and deleting buttons
        }
    },
    2: {
        accept: async function (interaction, orderId) {
            await DataStoreService.PatchOrder(orderId, "status", 3) // changing status to 3 (In progress)

            const inProgressEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(parseInt(StatusColors[3], 16)) // changing embed

            const buttons = StatusButtons[3](orderId);
            const actionRow = new ActionRowBuilder().addComponents(...buttons); // creating action row

            await interaction.update({ embeds: [inProgressEmbed], components: [actionRow] }) // updating embeds and buttons
        }
    },
    3: {
        done: async function (interaction, orderId) {
            await interaction.reply({ content: "Browse work's file with reply on order.", flags: [MessageFlags.Ephemeral]});

            const filter = (msg) => msg.author.id === interaction.user.id && msg.attachments.size > 0;

            const collected = await interaction.channel.awaitMessages({
                filter,
                max: 1,
                time: 300000,
                errors: ["time"]
            }); // waiting for file to be sent in the same channel

            const msg = collected.first(); // getting message
            const att = msg.attachments.first(); // attachment from there
            if (!att) return;
            const OrderData = await DataStoreService.GetOrderById(orderId); // getting orderdata
            const client = await interaction.client.users.fetch(OrderData.by); // getting client
            const dmEmbed = new EmbedBuilder() // creating embed
                .setTitle("Here is your order!")
                .setDescription(`Order: ${OrderData.name}. Cost: ${OrderData.cost}`)
                .addFields({ name: "File", value: `[Download](${att.url})` })
                .setColor(parseInt(StatusColors[4], 16));
            await client.send({embeds: [dmEmbed]}); // sending embed
            if (msg.deletable) { // deleting message with file
                await msg.delete().catch(err => console.log(err));
            }

            await DataStoreService.PatchOrder(orderId, "status", 4); // changing status to 4 (Done)

            const doneEmbed = EmbedBuilder.from(interaction.message.embeds[0]) // changing embed
                .setColor(parseInt(OrderData.StatusColors[4], 16))
                .setTitle("Order: DONE")

            await interaction.update({ embeds: [doneEmbed], components: [] }); // updating embed and deleting buttons
        }
    }
};

export default {
    StatusColors,
    StatusButtons,
    StatusButtonsActions
};