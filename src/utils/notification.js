const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Email Configuration
const createEmailTransporter = () => {
    try {
        if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
            console.error('Email credentials are missing in environment variables!');
            console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME ? 'Present' : 'Missing');
            console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'Present' : 'Missing');
            return null;
        }

        return nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            },
            debug: true
        });
    } catch (error) {
        console.error('Error creating email transporter:', error);
        return null;
    }
};

const emailTransporter = createEmailTransporter();
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

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

// Generic utility functions
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const formatPhoneNumber = (phoneNumber) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
        return `+91${cleaned}`;
    }
    
    if (cleaned.startsWith('91') && cleaned.length === 12) {
        return `+${cleaned}`;
    }
    
    if (phoneNumber.startsWith('+')) {
        return phoneNumber;
    }
    
    return `+${cleaned}`;
};

// New generic notification functions
const sendEmail = async (to, subject, htmlContent) => {
    try {
        if (!emailTransporter) {
            throw new Error('Email transporter not initialized. Please check your email configuration.');
        }

        const isConfigValid = await verifyEmailConfig();
        if (!isConfigValid) {
            throw new Error('Email configuration is invalid');
        }

        const mailOptions = {
            from: {
                name: 'Save Rush',
                address: process.env.EMAIL_USERNAME
            },
            to,
            subject,
            html: htmlContent
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

const sendSMS = async (to, message) => {
    try {
        if (!twilioClient) {
            throw new Error('Twilio configuration is missing');
        }

        if (!process.env.TWILIO_VERIFY_SERVICE_SID) {
            throw new Error('Twilio Verify Service SID is not configured');
        }

        const formattedPhoneNumber = formatPhoneNumber(to);

        const verification = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verifications
            .create({
                to: formattedPhoneNumber,
                channel: 'sms',
                channelConfiguration: {
                    template: message
                }
            });

        return {
            status: verification.status,
            valid: true,
            message: 'SMS sent successfully'
        };
    } catch (error) {
        console.error('Error sending SMS:', error.message);
        throw new Error(`Failed to send SMS: ${error.message}`);
    }
};

// Backward compatible functions using new generic functions
const sendEmailOTP = async (email, otp, subject = 'Save Rush - Email Verification Code', customHtml = null) => {
    const defaultHtml = `
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
    `;

    return sendEmail(email, subject, customHtml || defaultHtml);
};

const sendSMSOTP = async (phoneNumber, otp = null) => {
    const message = 'Your Save Rush verification code is: {{code}}. Valid for 10 minutes. Do not share this code with anyone.';
    return sendSMS(phoneNumber, message);
};

const verifyPhoneOTP = async (phoneNumber, code) => {
    try {
        console.log('Starting phone verification process...');
        
        if (!twilioClient) {
            throw new Error('Twilio configuration is missing');
        }

        if (!process.env.TWILIO_VERIFY_SERVICE_SID) {
            throw new Error('Twilio Verify Service SID is not configured');
        }

        const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
        console.log('Formatted phone number:', formattedPhoneNumber);

        console.log('Attempting verification check with Twilio...');
        const verificationCheck = await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SERVICE_SID)
            .verificationChecks
            .create({ to: formattedPhoneNumber, code });
        
        console.log('Twilio verification response:', verificationCheck);

        return {
            valid: verificationCheck.status === 'approved',
            status: verificationCheck.status,
            message: verificationCheck.status === 'approved' 
                ? 'Verification successful' 
                : 'Invalid verification code'
        };
    } catch (error) {
        console.error('Detailed Twilio error:', {
            message: error.message,
            code: error.code,
            status: error.status,
            moreInfo: error.moreInfo,
            details: error.details
        });
        
        if (error.code === 20404) {
            throw new Error('Verification code has expired or is invalid');
        } else if (error.code === 60200) {
            throw new Error('Invalid phone number format');
        } else if (error.code === 60202) {
            throw new Error('Max check attempts reached');
        } else if (error.code === 60203) {
            throw new Error('Max send attempts reached');
        }
        
        throw new Error(`Failed to verify phone code: ${error.message}`);
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
    // Original exports for backward compatibility
    generateOTP,
    sendEmailOTP,
    sendSMSOTP,
    verifyPhoneOTP,
    
    // New generic functions
    sendEmail,
    sendSMS
};