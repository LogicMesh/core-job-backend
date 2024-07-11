import logger from '@/config/logger';
import CustomError from '@/utils/Error';
import { MetaDataSchema } from '@/v1/schemas/job';
import jobService from '@/v1/services/job';
import taskService from '@/v1/services/task';
import { Request, Response, NextFunction } from 'express';

const token = process.env.CORE_ACCESS_TOKEN;

const startJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('----------------------------------------------------------------------');
    logger.info('startJob Controller');

    const job = req.jobData;

    const { id } = job.data[0];
    const { currentTask, tasksTodo, currentTaskToDoOrder, jobKey, status } = job.data[0].attributes;

    const launchpadToken = req.cookies[jobKey];

    // Validate request body
    const parsedBody = MetaDataSchema.safeParse(req.body.data);
    if (!parsedBody.success) {
      const error = CustomError.badRequest({
        message: 'Invalid request body',
        errors: parsedBody.error.errors,
        hints: 'Please check the request body and try again later',
      });
      return res.status(error.status).json(error);
    }

    // Extract meta data from parsed body
    const metadata = parsedBody.data?.metadata ?? null;

    if (status == 'NEW') {
      logger.info('STarting Job First Time - Updating Job STATUS to STARTED');
      // Update Job Status to STARTED
      await jobService.updateJobPayload(
        { data: { status: 'STARTED', startedOn: Date.now() } },
        id,
        token as string
      );

      // Added audit log entry
      const auditLogData = {
        data: {
          action: 'Job Started',
          description: `Job Started for first time`,
          job: id,
          metadata,
        },
      };
      await jobService.createAuditLog(auditLogData, token as string);
    }
    //----------------------------------------------------------------------------------------------
    logger.info('>> Find next App');
    let nextApp = await taskService.fetchNextAppID({
      tasksTodo,
      currentTaskToDoOrder,
    });

    // Check If next AppID is null
    if (!nextApp) {
      // NO MORE TASKS, Update the job status to DONE and get output of last task to insert into job output
      logger.info('>> This is Last Task, so fetch its output and end flow');
      let output: any = null;
      if (currentTask) {
        output = currentTask.data?.attributes?.output;
        output = output.map(({ id, ...rest }) => rest);
      }

      await jobService.updateJobPayload(
        { data: { status: 'DONE', completedOn: Date.now(), output } },
        id,
        token as string
      );

      // Added audit log entry
      const auditLogData = {
        data: {
          action: 'Job Done',
          description: `Job tasks completed, No more tasks.`,
          job: id,
          metadata,
        },
      };
      await jobService.createAuditLog(auditLogData, token as string);

      logger.info(
        '######################################### NO MORE TASKS - LAST TASK REACHED - JOB DONE'
      );
      return res.status(302).redirect(`/done`);
    }

    //----------------------------------------------------------------------------------------------
    //Next App exist
    const { application, taskOrder } = nextApp;
    logger.info(
      '######################################### NEXT APP FETCHED with taskOrder:' + taskOrder
    );
    //----------------------------------------------------------------------------------------------
    // RUN Pre-Checks
    const isPrechecksGood = await taskService.runPrechecks(application, res);

    if (!isPrechecksGood) {
      /**
       * Insufficient lisence or inactive application or powerlink found
       * Added audit log entry
       */
      console.log('PreChecks Failed' + res);
      const auditLogData = {
        data: {
          action: 'Job Error',
          description: `Insufficient License for powerLink or inactive application or inactive powerlink`,
          job: id,
          metadata,
        },
      };
      await jobService.createAuditLog(auditLogData, token as string);

      return res.status(302).redirect('/error?status=insufficientLicense');
    }
    logger.info('PreChecks Success ... Can proceed to create Task');
    //----------------------------------------------------------------------------------------------
    // All good, Proceed with task creation------
    // Config Object
    if (!application.data.attributes.powerlink) {
      throw new Error('powerLink is undefined!');
    }
    const config = await taskService.getAppConfiguration(
      token as string,
      application.data.id,
      application.data.attributes.powerlink.data.id
    );

    let input: any;

    //----------------------------------------------------------------------------------------------
    //Get Input object
    if (!currentTask || !currentTask.data) {
      // If there's no current task, it's the first task, so get input from the job
      input = job.data[0].attributes.input;
    } else {
      // Fetch the previous task details and get its output
      //const task = await taskService.getTaskById(currentTask.data.id, token as string);
      input = currentTask.data.attributes.output;
    }

    console.log('input fetched: ' + input);
    //----------------------------------------------------------------------------------------------
    // Create a new task
    const createdTask = await taskService.createTask({
      jobID: id,
      appID: application.data.id,
      config,
      input,
      token,
    });

    if (!createdTask) {
      throw new Error('Task is undefined!');
    }

    console.log('New Task Created: ' + createdTask.data.id);
    //----------------------------------------------------------------------------------------------
    // Update job with the created task id and set current task todo order as the order of the appId
    // Update the tasksTodoArray to include the new created task ID in the currentTask Order.
    const newTasksTodo = tasksTodo.map((item) => ({
      taskOrder: item.taskOrder,
      application: item.application.data.id,
      task: item.taskOrder === taskOrder ? createdTask.data.id : item.task?.data?.id,
    }));

    const updatePayload = {
      data: {
        currentTask: createdTask.data.id,
        currentTaskToDoOrder: taskOrder,
        tasksTodo: newTasksTodo,
      },
    };

    await jobService.updateJobPayload(updatePayload, id, token as string);

    // Added audit log entry
    const auditLogData = {
      data: {
        action: 'Task Created',
        description: `Task ID ${createdTask.data.id} Created`,
        job: id,
        metadata,
      },
    };

    await jobService.createAuditLog(auditLogData, token as string);

    //----------------------------------------------------------------------------------------------
    // Update cookie token to include the jobkey
    const { LoggedSessionExpiryTimeout } = job.data[0].attributes.workflow.data.attributes;
    console.log('2++++++++++++++ session Expiry timeout: ' + LoggedSessionExpiryTimeout);
    res.cookie(jobKey, launchpadToken, {
      httpOnly: true,
      maxAge: (LoggedSessionExpiryTimeout || 60) * 60 * 1000,
    });

    console.log('Update Cookie to ' + launchpadToken);

    const newTask = await taskService.getTaskById(createdTask.data.id, token as string);

    // Construct redirect URLs
    // const { customerAccessURL } = newTask.data.attributes.application.data.attributes.powerlink.data.attributes;
    const customerAccessURL =
      newTask?.data?.attributes?.application?.data?.attributes?.powerlink?.data?.attributes
        ?.customerAccessURL ?? null;

    console.log('New URL ' + customerAccessURL);

    if (customerAccessURL) {
      const redirectURL = `${customerAccessURL}/${newTask.data.attributes.taskKey}`;
      logger.info(
        '================================== END Redirecting to powerlink Task to: ' + redirectURL
      );
      return res.status(302).redirect(redirectURL);
    } else {
      return res.status(302).redirect('/error?status=invalidPowerLinkURL');
    }
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

export default startJob;
