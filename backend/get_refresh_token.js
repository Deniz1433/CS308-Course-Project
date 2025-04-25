// get_refresh_token.js
const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

const oAuth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// generate a URL that asks for Gmail send scope
const authUrl = oAuth2.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send']
});
console.log('Authorize this app by visiting this URL:', authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Enter the code from that page here: ', async (code) => {
  const { tokens } = await oAuth2.getToken(code);
  console.log('Refresh Token:', tokens.refresh_token);
  rl.close();
});
