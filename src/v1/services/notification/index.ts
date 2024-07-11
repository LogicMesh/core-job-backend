import axios from 'axios';
import { STRAPI_URL } from '@/config/config_url';
import logger from '@/config/logger';
import generateAccessKey from '@/utils/generateAccessKey';
import { sendMail, EmailSettings, MailOptions } from '@/utils/mailer';
import smsglobal from 'smsglobal';
import { SMSOptions } from '@/types';
import { marked } from 'marked';

class NotificationService {
  /**
   * Get organization settings
   * @returns Organization settings
   */
  public async getOrganizationSettings(token: string) {
    try {
      const response = await axios.get(`${STRAPI_URL}/organization?populate=*`, {
        headers: {
          Authorization: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  //=================================================================================
  /**
   * Send email notification to the customer using NodeMailer
   */
  private async sendEmail(
    mailOptions: MailOptions,
    organizationSettings: any
  ): Promise<{ status: string; message: any }> {
    logger.info('............ sending Email');

    if (!organizationSettings.data.attributes.emailSettings) {
      logger.error('............ Organization Email settings not defined');
      return {
        status: 'FAILED',
        message: 'Organization Email Settings not defined',
      };
    }

    const { providerName, smtpServer, smtpPort, username, password } =
      organizationSettings.data.attributes.emailSettings;

    const emailSettings: EmailSettings = {
      providerName: providerName,
      smtpServer: smtpServer,
      smtpPort: smtpPort,
      username: username,
      password: password,
    };

    try {
      const info = await sendMail(emailSettings, mailOptions);
      logger.info('Email has been sent successfully');

      return { status: 'SENT', message: 'Email has been sent successfully' };
    } catch (error) {
      logger.error('Error sending email');
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { status: 'FAILED', message: errorMessage };
    }
  }

  //=================================================================================
  private async sendSMS(
    payload: SMSOptions,
    organizationSettings: any
  ): Promise<{ status: string; message: any }> {
    logger.info('sending SMS ............');

    const smsSettings = organizationSettings?.data?.attributes?.smsSettings;
    if (!smsSettings) {
      logger.error('............ Organization SMS settings not defined');
      return {
        status: 'FAILED',
        message: 'Organization SMS Settings not defined',
      };
    }

    try {
      const { apiKey, apiSecret, providerName } = smsSettings;

      // Switch case on SMS provider
      switch (providerName) {
        case 'smsglobal':
          // Initialize the SMS client
          logger.info('-> SMS Global provider to send sms');
          const smsglobalProvider = smsglobal(apiKey, apiSecret);
          await smsglobalProvider.sms.send(payload);
          break;

        default:
          break;
      }

      return { status: 'SENT', message: 'SMS has been sent successfully' };
    } catch (error: any) {
      logger.error('Error sending SMS');
      const errorMessage = JSON.stringify(error, null, 2); // Convert the error object to a readable string
      return { status: 'FAILED', message: errorMessage };
    }
  }

  //=================================================================================
  /**
   * Send WhatsApp notification to the customer
   */
  private async sendWhatsApp(options: any) {
    try {
      //TODO: Send WhatsApp notification
      return 'SENT';
    } catch (err) {
      logger.error('Error sending WhatsApp: ', err);
      return 'FAILED';
    }
  }

  //=================================================================================
  /**
   * Template for the notification message
   */
  private messageBodyTemplate(
    template: string,
    customerAccessURL: string,
    customer: any,
    user: any,
    loginCode: string,
    html: boolean
  ): string {
    logger.info(`............ messageBodyTemplate`);

    if (!template) {
      logger.error('Template Undefined, Consider Empty');
      return '';
    }

    // Replace placeholders in the Markdown template
    let messageContent = template
      .replace('%customerAccessURL%', customerAccessURL || '')
      .replace('%customerName%', customer?.name || '')
      .replace('%userName%', user?.name || '')
      .replace('%PINCode%', loginCode || '');

    // Convert the Markdown to HTML
    if (html) {
      messageContent = marked(messageContent) as string;
    }

    logger.info(`............ HTML: htmlContent` + messageContent);

    return messageContent;
  }

  //=================================================================================
  /**
   * Send notification message to the customer based on the notification type (SMS, WhatsApp, Email)
   */
  private async sendNotificationMessage(
    organizationSettings: any,
    whatsappConfig: any,
    smsConfig: any,
    emailConfig: any,
    customer: any,
    customerAccessURL: string,
    user: any,
    createdJob: any,
    token: string,
    language: string = 'en',
    metadata: any
  ) {
    try {
      logger.info('......... Starting sendNotificationMessage');
      // Initialize the status and message for each notification type (SMS, WhatsApp, Email)
      let email: string | null = null;
      let sms: string | null = null;
      let whatsapp: string | null = null;
      let emailMessage: string | null = null;
      let smsMessage: string | null = null;
      let whatsappMessage: string | null = null;

      //-----------------------------------------------------------------------------------
      //Email Check Active and Send:
      //----------------------------
      if (emailConfig && emailConfig.isActive) {
        logger.info('......... Email Notification Active, Constructing Message Body');
        emailMessage =
          language === 'en'
            ? this.messageBodyTemplate(
                emailConfig.enBody,
                customerAccessURL,
                customer,
                user,
                createdJob.data.attributes.loginCode,
                true
              )
            : this.messageBodyTemplate(
                emailConfig.arBody,
                customerAccessURL,
                customer,
                user,
                createdJob.data.attributes.loginCode,
                true
              );

        // Send email notification
        const result = await this.sendEmail(
          {
            from: emailConfig.sender,
            to: customer.email,
            subject: language === 'en' ? emailConfig.enSubject : emailConfig.arSubject,
            html: emailMessage,
          },
          organizationSettings
        );

        email = result.status;
        emailMessage = result.message; // Output: Email has been sent successfully.
      } else {
        email = 'OFF';
      }

      //-----------------------------------------------------------------------------------
      //SMS Check Active and Send:
      //--------------------------
      if (smsConfig && smsConfig.isActive) {
        logger.info('SMS Notification Active, Constructing SMS Body ......... ');
        smsMessage =
          language === 'en'
            ? this.messageBodyTemplate(
                smsConfig.enBody,
                customerAccessURL,
                customer,
                user,
                createdJob.data.attributes.loginCode,
                false
              )
            : this.messageBodyTemplate(
                smsConfig.arBody,
                customerAccessURL,
                customer,
                user,
                createdJob.data.attributes.loginCode,
                false
              );

        // Send sms notification
        const result: any = await this.sendSMS(
          {
            origin: smsConfig.senderID, // Please provide your valid number to which we can send SMS as the sender ID.
            destination: customer.mobile,
            message: smsMessage as string,
          },
          organizationSettings
        );

        sms = result.status;
        smsMessage = result.message;
      } else {
        sms = 'OFF';
      }

      //-----------------------------------------------------------------------------------
      //WhatsApp Check Active and Send:
      //-------------------------------
      if (whatsappConfig && whatsappConfig.isActive) {
        logger.info('......... WhatsApp Notification Active, Sending WhatsApp');
        whatsappMessage =
          language === 'en'
            ? this.messageBodyTemplate(
                whatsappConfig.enBody,
                customerAccessURL,
                customer,
                user,
                createdJob.data.attributes.loginCode,
                false
              )
            : this.messageBodyTemplate(
                whatsappConfig.arBody,
                customerAccessURL,
                customer,
                user,
                createdJob.data.attributes.loginCode,
                false
              );

        // Send Whatsapp notification
        whatsapp = await this.sendWhatsApp({
          phoneNumberID: whatsappConfig.phoneNumberID,
          to: customer.mobile,
          text: whatsappMessage,
        });
      } else {
        whatsapp = 'OFF';
      }

      return {
        email,
        emailMessage,
        sms,
        smsMessage,
        whatsapp,
        whatsappMessage,
      };
    } catch (err) {
      logger.error('Error sending notification message: ', err);
      throw err;
    }
  }

  //=================================================================================
  /**
   * Construct the urls and send the notifications
   */
  public async constructURLsAndSendNotifications(
    jobData: any,
    workflow: any,
    user: any,
    createdJob: any,
    token: string
  ) {
    try {
      logger.info('... Starting constructURLsAndSendNotifications');

      const { customer, language, metadata } = jobData;
      const { jobKey, secret } = createdJob.data.attributes;

      // Get the workflow notification settings
      const {
        smsNotification,
        whatsappNotification,
        emailNotification,
        loginCodeWhatsappNotification,
        loginCodeSMSNotification,
        loginCodeEmailNotification,
        requiresCustomerLogin,
        customerLoginType,
      } = workflow.data.attributes;

      // Construct the access key for the customer
      const accessKey = generateAccessKey(jobKey, secret);

      // Get organization settings to construct the customer access URL
      const organizationSettings = await this.getOrganizationSettings(token);
      const { launchPadURL } = organizationSettings.data.attributes;
      const customerAccessURL = `${launchPadURL}/${jobKey}/${accessKey}`;

      let notificationStatus: any = null;
      let loginCodeNotificationStatus: any = null;

      //-----------------------------------------------------------------------
      // Send main notification message
      logger.info('... Checking if main message notifications is enabled in any channel');
      // Check if any of the notifications enabled so send the main notification message to the customer
      if (
        (smsNotification && smsNotification.isActive) ||
        (whatsappNotification && whatsappNotification.isActive) ||
        (emailNotification && emailNotification.isActive)
      ) {
        logger.info('...... Found Notification Active. Starting Sending Main Notification Message');
        // Notification options based on the workflow settings
        //yes notifications enabled and need to send notification
        notificationStatus = await this.sendNotificationMessage(
          organizationSettings,
          whatsappNotification,
          smsNotification,
          emailNotification,
          customer,
          customerAccessURL,
          user,
          createdJob,
          token,
          language,
          metadata
        );

        // Save notification message status to the notificationStatus
        createdJob.data.attributes.notificationStatus = notificationStatus;
      } else {
        logger.info('...... No Notification exist or active to send main message');
      }

      //-----------------------------------------------------------------------
      // Check if need to send notification Message for loginCode
      logger.info(
        '... Checking if login required and need to send login Code in seprate Notification Message'
      );
      // Check if the customer login is required and any of the notifications enabled
      if (
        requiresCustomerLogin &&
        ((loginCodeSMSNotification && loginCodeSMSNotification.isActive) ||
          (loginCodeWhatsappNotification && loginCodeWhatsappNotification.isActive) ||
          (loginCodeEmailNotification && loginCodeEmailNotification.isActive))
      ) {
        logger.info(
          '...... Found loginCode Notification Active. Starting Sending loginCode Notification Message'
        );

        logger.info('... Checking loginType ' + customerLoginType);
        if (customerLoginType == 'PINCode') {
          logger.info('... Sending Login Code for PINCode in Create');
          loginCodeNotificationStatus = await this.sendNotificationMessage(
            organizationSettings,
            loginCodeWhatsappNotification,
            loginCodeSMSNotification,
            loginCodeEmailNotification,
            customer,
            customerAccessURL,
            user,
            createdJob,
            token,
            language,
            metadata
          );

          // Save notification message to the pinCodeNotificationStatus
          createdJob.data.attributes.loginCodeNotificationStatus = loginCodeNotificationStatus;
        } else {
          logger.info('#### Login Code is not PINCode so will send on start Job');
        }
      } else {
        logger.info('...... No loginCode Notifications Active or no login Required');
      }

      // Return job key
      return {
        jobKey,
        customerAccessURL,
        notificationStatus,
        loginCodeNotificationStatus,
      };
    } catch (err) {
      logger.error('Error constructing URLs and sending notifications: ', err);
      throw err;
    }
  }

  //=================================================================================
  /**
   * Construct the urls and send the notifications
   */
  public async onJobStartConstructLoginCodeURLsAndSendNotifications(job: any, token: string) {
    try {
      logger.info('************* Starting onJobStartConstructLoginCodeURLsAndSendNotifications');

      const { customer, language, requiresCustomerLogin, jobKey, secret } = job.data.attributes;

      // Get the workflow notification settings
      const {
        workflow: {
          data: {
            attributes: {
              loginCodeWhatsappNotification,
              loginCodeSMSNotification,
              loginCodeEmailNotification,
            },
          },
        },
      } = job.data.attributes;

      // Get organization settings to construct the customer access URL
      const organizationSettings = await this.getOrganizationSettings(token);
      let loginCodeNotificationStatus: any = null;

      //-----------------------------------------------------------------------
      // Check if need to send notification Message for loginCode
      logger.info(
        '... Checking if login required and need to send login Code in seprate Notification Message'
      );
      // Check if the customer login is required and any of the notifications enabled
      if (
        requiresCustomerLogin &&
        ((loginCodeSMSNotification && loginCodeSMSNotification.isActive) ||
          (loginCodeWhatsappNotification && loginCodeWhatsappNotification.isActive) ||
          (loginCodeEmailNotification && loginCodeEmailNotification.isActive))
      ) {
        logger.info(
          '...... Found loginCode Notification Active. Starting Sending loginCode Notification Message'
        );

        logger.info('... Sending Login Code on START Job');

        loginCodeNotificationStatus = await this.sendNotificationMessage(
          organizationSettings,
          loginCodeWhatsappNotification,
          loginCodeSMSNotification,
          loginCodeEmailNotification,
          customer,
          '', //customerAccessURL,
          '', //user,
          job,
          token,
          language,
          '' //metadata
        );

        // Save notification message to the pinCodeNotificationStatus
        job.data.attributes.loginCodeNotificationStatus = loginCodeNotificationStatus;
      } else {
        logger.info('...... No loginCode Notifications Active or no login Required');
      }

      // Return job key
      return {
        loginCodeNotificationStatus,
      };
    } catch (err) {
      logger.error('Error constructing URLs and sending loginCode notifications: ', err);
      throw err;
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
