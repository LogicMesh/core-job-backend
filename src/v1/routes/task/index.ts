import powerlinkAuthenticate from '@/middlewares/powerlink.authentication.middleware';
import powerlinkAuthorize from '@/middlewares/powerlink.authorization.middleware';
import { startTask, submitTask, rejectTask } from '@/v1/controllers/task';
import { Router } from 'express';

const router = Router();

router.post('/v1/tasks/:taskKey/start', powerlinkAuthenticate, powerlinkAuthorize, startTask);
router.post('/v1/tasks/:taskKey/submit', powerlinkAuthenticate, powerlinkAuthorize, submitTask);
router.post('/v1/tasks/:taskKey/reject', powerlinkAuthenticate, powerlinkAuthorize, rejectTask);

export default router;
