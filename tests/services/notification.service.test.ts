import notificationService from '../../src/v1/services/notification';
import { sendMail } from '../../src/utils/mailer';
import smsglobal from 'smsglobal';

jest.mock('../../src/utils/mailer');
jest.mock('smsglobal');

describe('NotificationService', () => {
  describe('sendEmail', () => {
    const mailOptions = {
      from: 'test@example.com',
      to: 'customer@example.com',
      subject: 'Test Email',
      text: 'This is a test email.',
    };

    const organizationSettings = {
      data: {
        attributes: {
          emailSettings: {
            providerName: 'TestProvider',
            smtpServer: 'smtp.example.com',
            smtpPort: 587,
            username: 'user@example.com',
            password: 'password123',
          },
        },
      },
    };

    const organizationSettingsNoEmail = {
      data: {
        attributes: {},
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send an email successfully', async () => {
      (sendMail as jest.Mock).mockResolvedValue('Email sent successfully');

      const result = await notificationService['sendEmail'](mailOptions, organizationSettings);

      expect(sendMail).toHaveBeenCalledWith(
        {
          providerName: 'TestProvider',
          smtpServer: 'smtp.example.com',
          smtpPort: 587,
          username: 'user@example.com',
          password: 'password123',
        },
        mailOptions
      );

      expect(result).toEqual({ status: 'SENT', message: 'Email has been sent successfully' });
    });

    it('should fail if email settings are not defined', async () => {
      const result = await notificationService['sendEmail'](
        mailOptions,
        organizationSettingsNoEmail
      );

      expect(sendMail).not.toHaveBeenCalled();

      expect(result).toEqual({
        status: 'FAILED',
        message: 'Organization Email Settings not defined',
      });
    });

    it('should handle errors when sending email', async () => {
      const error = new Error('SMTP error');
      (sendMail as jest.Mock).mockRejectedValue(error);

      const result = await notificationService['sendEmail'](mailOptions, organizationSettings);

      expect(sendMail).toHaveBeenCalledWith(
        {
          providerName: 'TestProvider',
          smtpServer: 'smtp.example.com',
          smtpPort: 587,
          username: 'user@example.com',
          password: 'password123',
        },
        mailOptions
      );
      expect(result).toEqual({ status: 'FAILED', message: 'SMTP error' });
    });
  });

  describe('sendSMS', () => {
    const payload = {
      origin: '+1234567890',
      destination: '+3234567899',
      message: 'Test SMS message',
    };

    const organizationSettings = {
      data: {
        attributes: {
          smsSettings: {
            providerName: 'smsglobal',
            apiKey: 'test-api-key',
            apiSecret: 'test-api-secret',
          },
        },
      },
    };

    const organizationSettingsNoSMS = {
      data: {
        attributes: {},
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should send an SMS successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue('SMS sent successfully');
      (smsglobal as jest.Mock).mockImplementation(() => ({
        sms: { send: mockSend },
      }));

      const result = await notificationService['sendSMS'](payload, organizationSettings);

      expect(mockSend).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ status: 'SENT', message: 'SMS has been sent successfully' });
    });

    it('should fail if SMS settings are not defined', async () => {
      const result = await notificationService['sendSMS'](payload, organizationSettingsNoSMS);

      expect(smsglobal).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: 'FAILED',
        message: 'Organization SMS Settings not defined',
      });
    });

    it('should handle errors when sending SMS', async () => {
      const error = new Error('SMS error');
      const mockSend = jest.fn().mockRejectedValue(error);
      (smsglobal as jest.Mock).mockImplementation(() => ({
        sms: { send: mockSend },
      }));

      const result = await notificationService['sendSMS'](payload, organizationSettings);

      expect(mockSend).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ status: 'FAILED', message: JSON.stringify(error, null, 2) });
    });
  });
});
