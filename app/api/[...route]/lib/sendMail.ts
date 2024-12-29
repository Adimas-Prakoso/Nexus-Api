import nodemailer from 'nodemailer';

interface EmailParams {
  to: string;
  subject: string;
  htmlContent: string;
}

interface EmailResponse {
  message: string;
  messageId: string;
}

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: 'adimasdevs@gmail.com',
        pass: 'fmrrdckwkqcemfbv'
    }
});

// Verify transporter configuration
transporter.verify(function (error: Error | null, success: boolean) {
    if (error) {
        console.log('Error with email configuration:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

export const sendEmail = async ({ to, subject, htmlContent }: EmailParams): Promise<EmailResponse> => {
    if (!to || !subject || !htmlContent) {
        throw new Error('Missing required fields: to, subject, and htmlContent are required');
    }

    const mailOptions = {
        from: 'adimasdevs@gmail.com',
        to,
        subject,
        html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    
    return {
        message: 'Email sent successfully',
        messageId: info.messageId
    };
};
