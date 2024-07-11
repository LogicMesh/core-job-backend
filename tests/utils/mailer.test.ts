import nodemailer from 'nodemailer';
import { sendMail, EmailSettings, MailOptions } from '../../src/utils/mailer';

jest.mock('nodemailer');

describe('sendMail', () => {
  const emailSettings: EmailSettings = {
    providerName: 'smtp',
    smtpServer: 'smtp.test.com',
    smtpPort: 587,
    username: 'testUser',
    password: 'testPass',
  };

  const mailOptions: MailOptions = {
    from: 'sender@example.com',
    to: 'receiver@example.com',
    subject: 'Test Email',
    text: 'This is a test email',
    html: '<p>This is a test email</p>',
  };

  it('should send an email successfully using SMTP', async () => {
    const mockSendMail = jest.fn().mockImplementation((options, callback) => {
      callback(null, { response: '250 Message accepted' });
    });

    nodemailer.createTransport = jest.fn().mockReturnValue({
      sendMail: mockSendMail,
    });

    const result = await sendMail(emailSettings, mailOptions);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: emailSettings.smtpServer,
      port: emailSettings.smtpPort,
      secure: false,
      auth: {
        user: emailSettings.username,
        pass: emailSettings.password,
      },
      debug: true,
      logger: true,
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
      },
      expect.any(Function)
    );

    expect(result).toEqual({ response: '250 Message accepted' });
  });

  it('should handle email sending error', async () => {
    const mockError = new Error('Failed to send email');

    const mockSendMail = jest.fn().mockImplementation((options, callback) => {
      callback(mockError, null);
    });

    nodemailer.createTransport = jest.fn().mockReturnValue({
      sendMail: mockSendMail,
    });

    await expect(sendMail(emailSettings, mailOptions)).rejects.toThrow('Failed to send email');

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: emailSettings.smtpServer,
      port: emailSettings.smtpPort,
      secure: false, // Secure is false for port 587
      auth: {
        user: emailSettings.username,
        pass: emailSettings.password,
      },
      debug: true,
      logger: true,
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html,
      },
      expect.any(Function)
    );
  });
});
