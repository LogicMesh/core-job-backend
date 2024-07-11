import { Router } from 'express';
import { createJob, cancelJob, startJob } from '@/v1/controllers/job';
import strapiAuthenticate from '@/middlewares/strapi.auth.middleware';
import prechecks from '@/middlewares/prechecks.middleware';
import fetchWorkflowData from '@/middlewares/fetchWorkflowData.middleware';
import launchpadAuthenticate from '@/middlewares/launchpad.authenticate.middleware';
import launchpadAuthorize from '@/middlewares/launchpad.authorize.middleware';
import launchpadLogin from '@/middlewares/launchpad.login.middleware';
import launchpadCheckCurrentTask from '@/middlewares/launchpad.checkCurrentTask.middleware';

const router = Router();

router.post('/v1/jobs', strapiAuthenticate, fetchWorkflowData, prechecks, createJob);
router.post('/v1/jobs/:jobId/cancel', strapiAuthenticate, cancelJob);
router.post(
  '/v1/jobs/:jobKey/:accessKey?/start',
  launchpadAuthenticate,
  launchpadAuthorize,
  launchpadLogin,
  launchpadCheckCurrentTask,
  startJob
);

export default router;
