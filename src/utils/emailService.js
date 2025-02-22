const nodemailer = require('nodemailer');

// Email Configuration
const createEmailTransporter = () => {
    try {
        // Validate email credentials
        if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
            console.error('Email credentials are missing in environment variables!');
            console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME ? 'Present' : 'Missing');
            console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Present' : 'Missing');
            return null;
        }

        // Create transporter with Gmail settings
        return nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            },
            debug: true // Enable debug logs
        });
    } catch (error) {
        console.error('Error creating email transporter:', error);
        return null;
    }
};

// Initialize email transporter
const emailTransporter = createEmailTransporter();


// Verify email transport configuration
const verifyEmailConfig = async () => {
    try {
        if (!emailTransporter) {
            throw new Error('Email transporter not initialized');
        }
        await emailTransporter.verify();
        console.log('Email server is ready to send messages');
        return true;
    } catch (error) {
        console.error('Email configuration error:', error.message);
        return false;
    }
};

// Call verification on startup
verifyEmailConfig().catch(console.error);

// Generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Email
const sendEmailOTP = async (email, otp, subject = 'Save Rush - Email Verification Code', customHtml = null) => {
    try {
        if (!emailTransporter) {
            throw new Error('Email transporter not initialized. Please check your email configuration.');
        }

        // Verify configuration before sending
        const isConfigValid = await verifyEmailConfig();
        if (!isConfigValid) {
            throw new Error('Email configuration is invalid');
        }

        const mailOptions = {
            from: {
                name: 'Save Rush',
                address: process.env.EMAIL_USERNAME
            },
            to: email,
            subject: subject,
            html: customHtml || `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #2c3e50; text-align: center;">Email Verification</h1>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="font-size: 16px;">Your verification code is:</p>
                        <h2 style="color: #2c3e50; text-align: center; font-size: 32px; letter-spacing: 5px;">${otp}</h2>
                        <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
                        <p style="color: #666; font-size: 14px;">Please enter this code in the verification page to verify your email address.</p>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        If you didn't request this verification code, please ignore this email.
                    </p>
                </div>
            `
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        if (error.code === 'EAUTH') {
            console.error('Authentication failed. Please check your email credentials.');
        }
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

// Test email configuration on startup
(async () => {
    try {
        const isValid = await verifyEmailConfig();
        if (isValid) {
            console.log('Email configuration is valid and ready to use');
        } else {
            console.error('Email configuration is invalid. Please check your settings.');
        }
    } catch (error) {
        console.error('Error testing email configuration:', error);
    }
})();

module.exports = {
    generateOTP,
    sendEmailOTP
};
