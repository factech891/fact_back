const User = require('../models/user.model');

// Create a new user

const createUser = async (user) => {
    const newUser = new User(
        user
    );
    const userSucced = await newUser.save();
    if(userSucced === undefined || userSucced === null ) {
        throw new Error();
    } else {
        return userSucced
    }
}