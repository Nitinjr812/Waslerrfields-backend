// config/paypal.js
const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

function client() {
  return new checkoutNodeJssdk.core.PayPalHttpClient(environment());
}

function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (process.env.PAYPAL_ENVIRONMENT === 'production') {
    return new checkoutNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
  } else {  
    return new checkoutNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
  }
}

async function prettyPrint(jsonData, pre = "") {
  let pretty = "";
  function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  }
  for (let key in jsonData) {
    if (jsonData.hasOwnProperty(key)) {
      if (isNaN(key)) {
        pretty += pre + capitalize(key) + ": ";
      } else {
        pretty += pre + (parseInt(key) + 1) + ": ";
      }
      if (typeof jsonData[key] === "object") {
        pretty += "\n";
        pretty += await prettyPrint(jsonData[key], pre + "    ");
      } else {
        pretty += jsonData[key] + "\n";
      }
    }
  }
  return pretty;
}

module.exports = { client, prettyPrint };