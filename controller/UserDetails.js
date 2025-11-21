const GetUserDetailsFromToken = require("../helper/GetUserDetailFromUser")

async function UserDetails(request,response){
    try {
        const token = request.cookies.token || ""

        const user = await GetUserDetailsFromToken(token)

        return response.status(200).json({
            message : "user details",
            data : user
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true
        })
    }
}

module.exports = UserDetails