const jwt = require('jsonwebtoken')
const UserModel = require('../models/UserModel')

const getUserDetailsFromToken = async(token) => {
    //.log("=== DEBUG START ===")
    //.log("1. Received token:", token)
    //.log("2. JWT_SECRET_KEY from env:", process.env.JWT_SECRET_KEY)
    
    if(!token){
        return {
            message : "session out",
            logout : true,
        }
    }
    
    try {
        const decode = await jwt.verify(token, process.env.JWT_SECRET_KEY)
        //.log("3. Decoded token:", decode)
        
        const user = await UserModel.findById(decode.id).select('-password')
        //.log("4. Found user:", user)
        //.log("=== DEBUG END ===")
        
        return user
    } catch (error) {
        //.log("5. ERROR:", error.message)
        //.log("=== DEBUG END ===")
        return {
            message : "session out",
            logout : true,
        }
    }
}

module.exports = getUserDetailsFromToken