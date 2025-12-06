const jwt = require('jsonwebtoken')
const UserModel = require('../models/UserModel')

const getUserDetailsFromToken = async(token) => {
    console.log("=== DEBUG START ===")
    console.log("1. Received token:", token)
    console.log("2. JWT_SECRET_KEY from env:", process.env.JWT_SECRET_KEY)
    
    if(!token){
        return {
            message : "session out",
            logout : true,
        }
    }
    
    try {
        const decode = await jwt.verify(token, process.env.JWT_SECRET_KEY)
        console.log("3. Decoded token:", decode)
        
        const user = await UserModel.findById(decode.id).select('-password')
        console.log("4. Found user:", user)
        console.log("=== DEBUG END ===")
        
        return user
    } catch (error) {
        console.log("5. ERROR:", error.message)
        console.log("=== DEBUG END ===")
        return {
            message : "session out",
            logout : true,
        }
    }
}

module.exports = getUserDetailsFromToken