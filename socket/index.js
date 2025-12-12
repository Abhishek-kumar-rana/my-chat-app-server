const express = require('express')
const { Server } = require('socket.io')
const http = require('http')
const getUserDetailsFromToken = require('../helper/GetUserDetailFromUser')
const UserModel = require('../models/UserModel')
const { ConversationModel, MessageModel } = require('../models/ConversationModel')
const GetConversation = require('../helper/GetConversation')

const app = express()

/*** socket connection */
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*",
        credentials: true,
    }
})

/*** Room helper for private chats */
function getRoomId(user1, user2) {
    return [user1.toString(), user2.toString()].sort().join("_")
}

//online users
const onlineUser = new Set()

io.on("connection", async (socket) => {

    const token = socket.handshake.auth.token
    let user = null

    try {
        user = await getUserDetailsFromToken(token)

        if (!user || user.logout) {
            socket.emit("auth-error", { message: user?.message || "Authentication failed" })
            socket.disconnect()
            return
        }

        socket.user = user

        socket.join(user._id.toString())
        onlineUser.add(user._id.toString())

        io.emit("onlineUser", Array.from(onlineUser))

    } catch (error) {
        socket.emit("auth-error", { message: "Authentication error" })
        socket.disconnect()
        return
    }

    // -----------------------------
    // LOAD CHAT PAGE
    // -----------------------------
    socket.on("message-page", async (userId) => {
        if (!socket.user) return

        try {
            const userDetails = await UserModel.findById(userId).select("-password")

            socket.emit("message-user", {
                _id: userDetails?._id,
                name: userDetails?.name,
                email: userDetails?.email,
                profile_pic: userDetails?.profile_pic,
                online: onlineUser.has(userId)
            })

            // JOIN CHAT ROOM
            const roomId = getRoomId(socket.user._id, userId)
            socket.join(roomId)
            socket.currentChatRoom = roomId

            // Load messages
            const conv = await ConversationModel.findOne({
                "$or": [
                    { sender: socket.user._id, receiver: userId },
                    { sender: userId, receiver: socket.user._id }
                ]
            })
                .populate("messages")
                .sort({ updatedAt: -1 })

            socket.emit("message", conv?.messages || [])

        } catch (err) {
            socket.emit("error", { message: "Failed to load messages" })
        }
    })

    // -----------------------------
    // SEND NEW MESSAGE
    // -----------------------------
    socket.on("new message", async (data) => {

        let conversation = await ConversationModel.findOne({
            "$or": [
                { sender: data.sender, receiver: data.receiver },
                { sender: data.receiver, receiver: data.sender }
            ]
        })

        if (!conversation) {
            const createConversation = new ConversationModel({
                sender: data.sender,
                receiver: data.receiver
            })
            conversation = await createConversation.save()
        }

        const message = new MessageModel({
            text: data.text,
            imageUrl: data.imageUrl,
            videoUrl: data.videoUrl,
            msgByUserId: data.msgByUserId,
        })

        await message.save()

        await ConversationModel.updateOne(
            { _id: conversation._id },
            { "$push": { messages: message._id } }
        )

        const updatedConv = await ConversationModel.findOne({
            "$or": [
                { sender: data.sender, receiver: data.receiver },
                { sender: data.receiver, receiver: data.sender }
            ]
        }).populate("messages")

        const roomId = getRoomId(data.sender, data.receiver)
        io.to(roomId).emit("message", updatedConv?.messages || [])

        // Update conversation list
        const conversationSender = await GetConversation(data.sender)
        const conversationReceiver = await GetConversation(data.receiver)

        io.to(data.sender).emit("conversation", conversationSender)
        io.to(data.receiver).emit("conversation", conversationReceiver)
    })

    // -----------------------------
    // DELETE MESSAGE
    // -----------------------------
    socket.on("delete-message", async ({ messageId }) => {
        try {
            if (!socket.user) return

            const msg = await MessageModel.findById(messageId)
            if (!msg) return

            if (msg.msgByUserId.toString() !== socket.user._id.toString()) {
                return
            }

            const conversations = await ConversationModel.find({ messages: messageId })

            await ConversationModel.updateMany(
                { messages: messageId },
                { $pull: { messages: messageId } }
            )

            await MessageModel.findByIdAndDelete(messageId)

            conversations.forEach(conv => {
                io.to(conv.sender.toString()).emit("message-deleted", messageId)
                io.to(conv.receiver.toString()).emit("message-deleted", messageId)
            })

        } catch (err) {
            console.log("Delete error:", err)
        }
    })

    // -----------------------------
    // SIDEBAR UPDATE
    // -----------------------------
    socket.on("sidebar", async (currentUserId) => {
        const conv = await GetConversation(currentUserId)
        socket.emit("conversation", conv)
    })

    // -----------------------------
    // SEEN MESSAGE
    // -----------------------------
    socket.on("seen", async (msgByUserId) => {
        if (!socket.user) return

        try {
            const conv = await ConversationModel.findOne({
                "$or": [
                    { sender: socket.user._id, receiver: msgByUserId },
                    { sender: msgByUserId, receiver: socket.user._id }
                ]
            })

            const messageIds = conv?.messages || []

            await MessageModel.updateMany(
                { _id: { "$in": messageIds }, msgByUserId },
                { "$set": { seen: true } }
            )

            const conversationSender = await GetConversation(socket.user._id)
            const conversationReceiver = await GetConversation(msgByUserId)

            io.to(socket.user._id.toString()).emit("conversation", conversationSender)
            io.to(msgByUserId).emit("conversation", conversationReceiver)

        } catch (err) { }
    })

    // -----------------------------
    // MESSAGE REACTIONS
    // -----------------------------
    socket.on("add-reaction", async (data) => {
        try {
            const { messageId, userId, emoji } = data

            const message = await MessageModel.findById(messageId)
            if (!message) return

            if (!message.reactions) message.reactions = {}

            if (!Array.isArray(message.reactions[userId])) {
                message.reactions[userId] = []
            }

            const list = message.reactions[userId]
            const index = list.indexOf(emoji)

            if (index > -1) list.splice(index, 1)
            else list.push(emoji)

            if (message.reactions[userId].length === 0) {
                delete message.reactions[userId]
            }

            message.markModified("reactions")
            await message.save()

            const conv = await ConversationModel.findOne({ messages: message._id })
            if (!conv) return

            const payload = {
                messageId: String(message._id),
                reactions: message.reactions
            }

            const roomId = getRoomId(conv.sender, conv.receiver)
            io.to(roomId).emit("reaction-update", payload)

        } catch (err) { }
    })

    // -----------------------------
    // TYPING INDICATOR (FIXED)
    // -----------------------------
    socket.on("typing", (data) => {
        const roomId = getRoomId(data.sender, data.receiver)
        socket.to(roomId).emit("typing", { sender: data.sender })
    })

    socket.on("stop-typing", (data) => {
        const roomId = getRoomId(data.sender, data.receiver)
        socket.to(roomId).emit("stop-typing", { sender: data.sender })
    })

    // -----------------------------
    // DISCONNECT
    // -----------------------------
    socket.on("disconnect", () => {
        if (socket.user?._id) {
            onlineUser.delete(socket.user._id.toString())
        }
    })
})

module.exports = { app, server }
