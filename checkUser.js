const bcrypt = require('bcrypt');

async function check_password(req_password, user_password) {
    try{
    const match = await bcrypt.compare(req_password, user_password);
    if (match) {
        return true;
    } else {
        return false;
    }}
    catch(err){console.log('error') }
}

module.exports = {
    check_password: check_password,
};
