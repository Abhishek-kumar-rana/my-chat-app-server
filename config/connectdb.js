const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        const connection = mongoose.connection;
        connection.on("connected", () => {
            console.log("MongoDB connection established successfully");
        });
        connection.on("error", (err) => {
            console.error("MongoDB connection error:", err);
        }   );
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;