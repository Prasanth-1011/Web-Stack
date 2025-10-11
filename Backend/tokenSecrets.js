const crypto = require('crypto');

function createRandomString(length) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

const accessTokenSecret = createRandomString(32);
const refreshTokenSecret = createRandomString(32);

console.log('Access Token Secret:', accessTokenSecret);
console.log('Refresh Token Secret:', refreshTokenSecret);

module.exports = {
    accessTokenSecret,
    refreshTokenSecret
};