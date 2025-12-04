const express = require('express')
const { Server } = require('socket.io')
const http  = require('http')
const getUserDetailsFromToken = require('../helper/GetUserDetailFromUser')
const UserModel = require('../models/UserModel')
const { ConversationModel,MessageModel } = require('../models/ConversationModel')
const GetConversation = require('../helper/GetConversation')
// const getConversation = require('../helpers/GetConversation')

const app = express()

/***socket connection */
const server = http.createServer(app)
const io = new Server(server,{
    cors : {
         origin: "*",
    credentials: true,   
    }
})   

/***
 * socket running at http://localhost:8080/
 */

//online user
const onlineUser = new Set()

io.on('connection',async(socket)=>{
    console.log("connect User ", socket.id)

    const token = socket.handshake.auth.token 
    console.log(token);
    //current user details 
    const user = await getUserDetailsFromToken(token)

    //create a room
    socket.join(user?._id.toString())
    onlineUser.add(user?._id?.toString())

    io.emit('onlineUser',Array.from(onlineUser))

    socket.on('message-page',async(userId)=>{
        console.log('userId',userId)
        const userDetails = await UserModel.findById(userId).select("-password")
        
        const payload = {
            _id : userDetails?._id,
            name : userDetails?.name,
            email : userDetails?.email,
            profile_pic : userDetails?.profile_pic,
            online : onlineUser.has(userId)
        }
        socket.emit('message-user',payload)


         //get previous message
         const getConversationMessage = await ConversationModel.findOne({
            "$or" : [
                { sender : user?._id, receiver : userId },
                { sender : userId, receiver :  user?._id}
            ]
        }).populate('messages').sort({ updatedAt : -1 })

        socket.emit('message',getConversationMessage?.messages || [])
    })


    //new message
    socket.on('new message',async(data)=>{

        //check conversation is available both user
         

        let conversation = await ConversationModel.findOne({
            "$or" : [
                { sender : data?.sender, receiver : data?.receiver },
                { sender : data?.receiver, receiver :  data?.sender}
            ]
        })

        //if conversation is not available
        if(!conversation){
            const createConversation = await ConversationModel({
                sender : data?.sender,
                receiver : data?.receiver
            })
            conversation = await createConversation.save()
        }
        
        const message = new MessageModel({
          text : data.text,
          imageUrl : data.imageUrl,
          videoUrl : data.videoUrl,
          msgByUserId :  data?.msgByUserId,
        })
        const saveMessage = await message.save()

        const updateConversation = await ConversationModel.updateOne({ _id : conversation?._id },{
            "$push" : { messages : saveMessage?._id }
        })

        const getConversationMessage = await ConversationModel.findOne({
            "$or" : [
                { sender : data?.sender, receiver : data?.receiver },
                { sender : data?.receiver, receiver :  data?.sender}
            ]
        }).populate('messages').sort({ updatedAt : -1 })


        io.to(data?.sender).emit('message',getConversationMessage?.messages || [])
        io.to(data?.receiver).emit('message',getConversationMessage?.messages || [])

        //send conversation
        const conversationSender = await GetConversation(data?.sender)
        const conversationReceiver = await GetConversation(data?.receiver)

        io.to(data?.sender).emit('conversation',conversationSender)
        io.to(data?.receiver).emit('conversation',conversationReceiver)
    })

    // delerte message
    // delete message
socket.on("delete-message", async ({ messageId }) => {
  try {
    if (!messageId || !user?._id) return;

    console.log("Delete message request:", messageId, "by user", user._id);

    // 1️⃣ Find the message
    const msg = await MessageModel.findById(messageId);
    if (!msg) {
      console.log("Message not found");
      return;
    }

    // 2️⃣ Allow only the sender to delete
    if (msg.msgByUserId.toString() !== user._id.toString()) {
      console.log("Not allowed to delete this message");
      return;
    }

    // 3️⃣ Find conversations that contain this message
    const conversations = await ConversationModel.find({ messages: messageId });

    // 4️⃣ Remove message from those conversations
    await ConversationModel.updateMany(
      { messages: messageId },
      { $pull: { messages: messageId } }
    );

    // 5️⃣ Delete the message document
    await MessageModel.findByIdAndDelete(messageId);

    // 6️⃣ Notify just the users in those conversations
    conversations.forEach((conv) => {
      const senderId = conv.sender.toString();
      const receiverId = conv.receiver.toString();

      io.to(senderId).emit("message-deleted", messageId);
      io.to(receiverId).emit("message-deleted", messageId);
    });

    console.log("Message deleted:", messageId);
  } catch (err) {
    console.error("Error deleting message:", err);
  }
});


    //sidebar
    socket.on('sidebar',async(currentUserId)=>{
        console.log("current user",currentUserId)

        const conversation = await GetConversation(currentUserId)

        socket.emit('conversation',conversation)
        
    })

    socket.on('seen',async(msgByUserId)=>{
        
        let conversation = await ConversationModel.findOne({
            "$or" : [
                { sender : user?._id, receiver : msgByUserId },
                { sender : msgByUserId, receiver :  user?._id}
            ]
        })

        const conversationMessageId = conversation?.messages || []

        const updateMessages  = await MessageModel.updateMany(
            { _id : { "$in" : conversationMessageId }, msgByUserId : msgByUserId },
            { "$set" : { seen : true }}
        )

        //send conversation
        const conversationSender = await GetConversation(user?._id?.toString())
        const conversationReceiver = await GetConversation(msgByUserId)

        io.to(user?._id?.toString()).emit('conversation',conversationSender)
        io.to(msgByUserId).emit('conversation',conversationReceiver)
    })

    //disconnect
    socket.on('disconnect',()=>{
        onlineUser.delete(user?._id?.toString())
        console.log('disconnect user ',socket.id)
    })
})

module.exports = {
    app,
    server
}
