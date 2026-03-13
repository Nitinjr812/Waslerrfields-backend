// config/paypal.js - Updated (no old SDK needed)

let cachedToken = null;
let tokenExpiry = null;

async function getPayPalAccessToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

    const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    const response = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    const data = await response.json();

    if (!data.access_token) {
        throw new Error('Failed to get PayPal access token');
    }

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (8 * 60 * 60 * 1000);

    return cachedToken;
}

module.exports = { getPayPalAccessToken };