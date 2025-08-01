const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"Waslerr" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('Email sending error:', err);
    throw err;
  }
}

module.exports = { sendEmail };
