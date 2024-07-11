import nodemailer from 'nodemailer';

export interface EmailSettings {
    providerName: string;
    smtpServer: string;
    smtpPort: number;
    username: string;
    password: string;
}

export interface MailOptions {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string; // Add the html property
}

export const sendMail = (
    emailSettings: EmailSettings,
    mailOptions: MailOptions
): Promise<nodemailer.SentMessageInfo> => {
    let transporterConfig: any;

    if (emailSettings.providerName && emailSettings.providerName.toLowerCase() === 'smtp') {
        transporterConfig = {
            host: emailSettings.smtpServer,
            port: emailSettings.smtpPort,
            secure: emailSettings.smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: emailSettings.username,
                pass: emailSettings.password
            },
            debug: true, // Enable debug output
            logger: true // Optional logger output
        };
    } else {
        transporterConfig = {
            service: emailSettings.providerName,
            auth: {
                user: emailSettings.username,
                pass: emailSettings.password
            },
            debug: false, // Enable debug output
            logger: false // Optional logger output
        };
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    const options = {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html // Include the html property
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(options, (error, info) => {
            if (error) {
                return reject(error);
            }
            resolve(info);
        });
    });
};
