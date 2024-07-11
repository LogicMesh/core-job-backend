import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import generatePinCode from '@/utils/generatePinCode';
import jobService from '@/v1/services/job';
import notificationService from '@/v1/services/notification';
import logger from '@/config/logger';

const accessToken = process.env.CORE_ACCESS_TOKEN;

const launchpadLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('... Start Middleware launchpadLogin');

    const job = req.jobData;
    const { id } = job?.data[0];
    const { jobKey, requiresCustomerLogin, secret, customerLoginType, workflow } =
      job.data[0].attributes;
    let { failedLoginTrials, lastFailedLogin, lastSuccessfulLogin, loginCode } =
      job.data[0].attributes;
    const { maxLoginTrials, maxLoginTrialsLockTimeout, LoggedSessionExpiryTimeout } =
      workflow.data.attributes;

    // Check if customer login is not required
    console.log('...... isLoginRequired ' + requiresCustomerLogin);
    //------------------------------------------------------------------
    // No Login Required
    if (!requiresCustomerLogin) {
      logger.info(
        '...... No Login Required -> Generate Login token as reaching here means all good'
      );
      // Generate new cookie token
      const payload = {
        jobKey,
        loggedIn: true,
        loginType: 'None',
      };

      const token = jwt.sign(payload, secret, {
        expiresIn: (LoggedSessionExpiryTimeout || 60) * 60,
      });

      res.cookie(jobKey, token, {
        httpOnly: true,
        maxAge: (LoggedSessionExpiryTimeout || 60) * 60 * 1000,
      });
      req.cookies[jobKey] = token;

      console.log('new JWT for the Cookie:' + token);
      logger.info(
        '================ NO Login Required - all Good with launchpadLogin / New JWT generated proceed to next ============'
      );
      return next(); // No login required, proceed to next middleware
    }
    //------------------------------------------------------------------
    // Login Required
    const launchpadToken = req.cookies[jobKey];
    console.log('3. launchpadLogin Cookie Value in Request: ' + launchpadToken);

    // Cookie must be valid here, already checked before it it was exist, so just check on the loggedin flag
    if (launchpadToken) {
      try {
        const decoded: any = jwt.verify(launchpadToken, secret);
        // Check if the user is logged in already
        if (decoded.loggedIn === true) {
          return next(); // Token is valid and user is logged in, proceed to next middleware
        }
      } catch (err) {
        throw err;
      }
    }

    logger.info('login required and token is empty or loggedIn flag is false');

    //******************* NEEDS LOGIN **************/
    // Check if failed login trials is reached max loging trails and check if lock time reached.
    console.log('......failed trials:' + failedLoginTrials);
    console.log('......Max allowed trials:' + maxLoginTrials);
    if (failedLoginTrials >= maxLoginTrials) {
      //########################################### MAX TRIALS REACHED
      // Max Trials Reached
      logger.info('################################ Max trials Reached');
      const lockoutEndTime =
        new Date(lastFailedLogin).getTime() + maxLoginTrialsLockTimeout * 60 * 1000;
      console.log('### Locked Until: ' + lockoutEndTime);

      if (Date.now() < lockoutEndTime) {
        const lockoutEndDateTime = new Date(lockoutEndTime);
        const lastfailedDate = new Date(lastFailedLogin);
        console.log('### Last failed time: ' + lastfailedDate.toLocaleString());
        console.log('### locked until: ' + lockoutEndDateTime.toLocaleString());
        logger.info('################################ Still in Lock Time');

        //Still in Lock Time
        const locktime = lockoutEndTime - Date.now();
        res.clearCookie(jobKey);
        return res.status(302).redirect(`/loginLocked?till=${locktime}`);
      } else {
        //########################################### AFTER LOCK TIME
        logger.info('### After Lock Time');
        /**
         * After locktime
         * Update the job the new failedLoginTrials and lastFailedLoginTime in the job in strapi
         */
        failedLoginTrials = 0;
        lastFailedLogin = null;

        const jobUpdatedPayload = {
          data: {
            failedLoginTrials,
            lastFailedLogin,
          },
        };

        await jobService.updateJobPayload(jobUpdatedPayload, id, accessToken as string);

        if (customerLoginType === 'OTP') {
          //########################################### RESET OTP AFTER LOCK TIME
          logger.info('### After Lock Time & Its OTP, so Generate new OTP and send to client');
          // Update the job.login code null in the job in strapi
          const newOtp = generatePinCode();
          loginCode = newOtp;
          // Update the job.login code with newOTP in the job in strapi
          const jobUpdatedPayload = {
            data: {
              loginCode,
            },
          };

          job.data[0].attributes.loginCode = loginCode;

          await jobService.updateJobPayload(jobUpdatedPayload, id, accessToken as string);

          // TODO: Send the OTP
          let loginCodeNotificationStatus =
            await notificationService.onJobStartConstructLoginCodeURLsAndSendNotifications(
              { data: job.data[0] },
              accessToken as string
            );
          if (loginCodeNotificationStatus) {
            await jobService.updateJobNotificationStatus(
              id,
              null,
              loginCodeNotificationStatus.loginCodeNotificationStatus,
              accessToken as string
            );
          }
          return res.status(302).redirect('/login?type="OTP"&error="Please Enter OTP"');
        }
      }
    }

    // check if body includes the login details
    // const { inputLoginCode } = req.body.data;
    const { inputLoginCode } = (req.body && req.body.data) || { inputLoginCode: null };

    // Switch case based on customer login type
    switch (customerLoginType) {
      case 'PINCode':
        logger.info('...... customerLoginType = PINCode');
        console.log('...... inputLoginCode from request = ' + inputLoginCode);
        if (inputLoginCode) {
          //Then this is login Trial
          console.log('...... loginCode from Job = ' + loginCode);
          if (inputLoginCode === loginCode) {
            // Successful login
            failedLoginTrials = 0;
            lastSuccessfulLogin = Date.now();

            // Save updated job payload in the strapi for successfull login
            const jobUpdatedPayload = {
              data: {
                failedLoginTrials,
                lastSuccessfulLogin,
              },
            };
            await jobService.updateJobPayload(jobUpdatedPayload, id, accessToken as string);

            // Generate new cookie token
            const payload = {
              jobKey,
              loggedIn: true,
              loginType: 'PINCode',
            };

            const token = jwt.sign(payload, secret, {
              expiresIn: (LoggedSessionExpiryTimeout || 60) * 60,
            });

            res.cookie(jobKey, token, {
              httpOnly: true,
              maxAge: (LoggedSessionExpiryTimeout || 60) * 60 * 1000,
            });
            req.cookies[jobKey] = token;
            console.log('##### Login success full and new cookie is: ' + token);
            logger.info(
              '================================ Login Required and login success - all Good with launchpadLogin proceed to next ============'
            );
            return next(); // PINCode valid, proceed to next middleware
          } else {
            //-------------------------------------------
            // Failed PinCode Login trial
            logger.info('##### INVALID Login Trial');
            failedLoginTrials += 1;
            lastFailedLogin = Date.now();

            // Save updated job payload in the strapi for failed login
            const jobUpdatedPayload = {
              data: {
                failedLoginTrials,
                lastFailedLogin,
              },
            };
            await jobService.updateJobPayload(jobUpdatedPayload, id, accessToken as string);
            res.clearCookie(jobKey);

            return res.status(302).redirect(`/login?type="PINCode"&error="Invalid PINCode"`);
          }
        }
        logger.info('...... No customerLoginType - REDIRECT to Login Page ');
        res.clearCookie(jobKey);
        return res.status(302).redirect(`/login?type="PINCode"&error="Please Enter PINCode"`);

      case 'OTP':
        logger.info('...... customerLoginType = OTP');
        console.log('...... inputLoginCode from request = ' + inputLoginCode);
        console.log('...... loginCode = ' + loginCode);
        if (!loginCode) {
          //######################################### FIRST TIME - GENERATE OTP
          logger.info('...... FIRST LOGIN - GENERATE NEW OTP, Send It and save in Job');
          const newOtp = generatePinCode();

          loginCode = newOtp;
          failedLoginTrials = 0;

          // Update the job.login code with newOTP in the job in strapi
          const jobUpdatedPayload = {
            data: {
              failedLoginTrials,
              loginCode,
            },
          };

          job.data[0].attributes.loginCode = loginCode;

          await jobService.updateJobPayload(jobUpdatedPayload, id, accessToken as string);

          //Send OTP to customer with new login Code as OTP message based on the loginCode status in the 3 channels.
          let loginCodeNotificationStatus =
            await notificationService.onJobStartConstructLoginCodeURLsAndSendNotifications(
              { data: job.data[0] },
              accessToken as string
            );
          if (loginCodeNotificationStatus) {
            //Update job.loginCodeNotificationStatus
            await jobService.updateJobNotificationStatus(
              id,
              null,
              loginCodeNotificationStatus.loginCodeNotificationStatus,
              accessToken as string
            );
          }

          return res.status(302).redirect('/login?type="OTP"&error="Please Enter OTP"');
        } else if (inputLoginCode === loginCode) {
          //######################################### OTP MATCH - LOGIN
          //Then this is login trial and OTP exist before.
          failedLoginTrials = 0;
          lastSuccessfulLogin = Date.now();

          // Save updated job payload in the strapi
          const jobUpdatedPayload = {
            data: {
              failedLoginTrials,
              lastSuccessfulLogin,
            },
          };
          await jobService.updateJobPayload(jobUpdatedPayload, id, accessToken as string);

          // Generate new cookie token
          const payload = {
            jobKey,
            loggedIn: true,
            loginType: 'OTP',
          };

          const token = jwt.sign(payload, secret, {
            expiresIn: (LoggedSessionExpiryTimeout || 60) * 60,
          });

          res.cookie(jobKey, token, {
            httpOnly: true,
            maxAge: (LoggedSessionExpiryTimeout || 60) * 60 * 1000,
          });

          req.cookies[jobKey] = token;
          console.log('##### Login success full and new cookie is: ' + token);
          logger.info(
            '================================ Login Required OTP and login success - all Good with launchpadLogin proceed to next ============'
          );

          return next(); // PINCode valid, proceed to next middleware
        } else {
          //######################################### FAILED LOGIN
          failedLoginTrials += 1;
          lastFailedLogin = Date.now();

          // Save updated job payload in the strapi
          const jobUpdatedPayload = {
            data: {
              failedLoginTrials,
              lastFailedLogin,
            },
          };
          await jobService.updateJobPayload(jobUpdatedPayload, id, accessToken as string);
          res.clearCookie(jobKey);
          return res.status(302).redirect(`/login?type="OTP"&error="Invalid OTP"`);
        }

      case 'Google Authentication':
        // TODO: Login with google auth
        //res.clearCookie(jobKey);
        return res.status(302).redirect(`/login?type="Google"&error="Please do Google Login"`);
        break;

      default:
        return res.status(400).json({ error: 'Invalid login type' });
    }

    next();
  } catch (error) {
    logger.error('Error in login middleware:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default launchpadLogin;
