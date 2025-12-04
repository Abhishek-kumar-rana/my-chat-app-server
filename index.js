
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/connectdb');
const router = require('./route/index');
const cookieParser = require('cookie-parser');
const { app,server } = require('./socket');

dotenv.config();

// const app = express();  
app.use(cors({
    origin: "*",
    credentials: true,         
})); 
    
app.use(express.json());
app.use(cookieParser());   
 
const PORT = process.env.PORT || 5000;
// const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp';
 
app.get('/', (req, res) => {
    // res.send('API is running... on');
    res.json({ message: 'API is running...on' });
});

app.use('/api',router);

connectDB() 
    .then(() => {
        console.log('MongoDB connected successfully');
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
