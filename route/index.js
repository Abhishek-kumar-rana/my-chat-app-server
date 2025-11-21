

const express = require('express');
const RegisterUser = require('../controller/RegisterUser');
const CheckEmail = require('../controller/CheckEmail');
const CheckPassword = require('../controller/CheckPassword');
const UserDetails = require('../controller/UserDetails');
const LogOut = require('../controller/LogOut');
const UpdateUserDetails = require('../controller/UpdateUserDetails');
const SearchUser = require('../controller/SearchUser');

const router = express .Router()

//create user api
router.post('/register',RegisterUser);
router.post('/email',CheckEmail);
router.post('/password',CheckPassword); 

router.get('/user-details',UserDetails) 
router.get('/logout',LogOut); 
router.post('/update-user',UpdateUserDetails)
router.post('/search-user',SearchUser); 

  
module.exports = router 