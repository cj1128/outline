// @flow
import uuid from 'uuid';
import Router from 'koa-router';
import format from 'date-fns/format';
import { uploadFile } from '../utils/qiniu';
import { ValidationError } from '../errors';
import { Event, User, Team } from '../models';
import auth from '../middlewares/authentication';
import pagination from './middlewares/pagination';
import userInviter from '../commands/userInviter';
import { presentUser } from '../presenters';
import policy from '../policies';
import multer from 'koa-multer';

const { authorize } = policy;
const router = new Router();

router.post('users.list', auth(), pagination(), async ctx => {
  const user = ctx.state.user;

  const users = await User.findAll({
    where: {
      teamId: user.teamId,
    },
    order: [['createdAt', 'DESC']],
    offset: ctx.state.pagination.offset,
    limit: ctx.state.pagination.limit,
  });

  ctx.body = {
    pagination: ctx.state.pagination,
    data: users.map(listUser =>
      presentUser(listUser, { includeDetails: user.isAdmin })
    ),
  };
});

router.post('users.info', auth(), async ctx => {
  ctx.body = {
    data: presentUser(ctx.state.user),
  };
});

router.post('users.update', auth(), async ctx => {
  const { user } = ctx.state;
  const { name, avatarUrl } = ctx.body;
  const endpoint = publicS3Endpoint();

  if (name) user.name = name;
  if (avatarUrl && avatarUrl.startsWith(`${endpoint}/uploads/${user.id}`)) {
    user.avatarUrl = avatarUrl;
  }

  await user.save();

  ctx.body = {
    data: presentUser(user, { includeDetails: true }),
  };
});

router.post('users.upload', auth(), multer({ storage: multer.memoryStorage() }).any(), async ctx => {
  ctx.body = {
    data: {
      url: await uploadFile(ctx.req.body.name, ctx.req.files[0].buffer),
    },
  }
});

// Admin specific

router.post('users.promote', auth(), async ctx => {
  const userId = ctx.body.id;
  const teamId = ctx.state.user.teamId;
  ctx.assertPresent(userId, 'id is required');

  const user = await User.findByPk(userId);
  authorize(ctx.state.user, 'promote', user);

  const team = await Team.findByPk(teamId);
  await team.addAdmin(user);

  ctx.body = {
    data: presentUser(user, { includeDetails: true }),
  };
});

router.post('users.demote', auth(), async ctx => {
  const userId = ctx.body.id;
  const teamId = ctx.state.user.teamId;
  ctx.assertPresent(userId, 'id is required');

  const user = await User.findByPk(userId);
  authorize(ctx.state.user, 'demote', user);

  const team = await Team.findByPk(teamId);
  try {
    await team.removeAdmin(user);
  } catch (err) {
    throw new ValidationError(err.message);
  }

  ctx.body = {
    data: presentUser(user, { includeDetails: true }),
  };
});

router.post('users.suspend', auth(), async ctx => {
  const admin = ctx.state.user;
  const userId = ctx.body.id;
  const teamId = ctx.state.user.teamId;
  ctx.assertPresent(userId, 'id is required');

  const user = await User.findByPk(userId);
  authorize(ctx.state.user, 'suspend', user);

  const team = await Team.findByPk(teamId);
  try {
    await team.suspendUser(user, admin);
  } catch (err) {
    throw new ValidationError(err.message);
  }

  ctx.body = {
    data: presentUser(user, { includeDetails: true }),
  };
});

router.post('users.activate', auth(), async ctx => {
  const admin = ctx.state.user;
  const userId = ctx.body.id;
  const teamId = ctx.state.user.teamId;
  ctx.assertPresent(userId, 'id is required');

  const user = await User.findByPk(userId);
  authorize(ctx.state.user, 'activate', user);

  const team = await Team.findByPk(teamId);
  await team.activateUser(user, admin);

  ctx.body = {
    data: presentUser(user, { includeDetails: true }),
  };
});

router.post('users.invite', auth(), async ctx => {
  const { invites } = ctx.body;
  ctx.assertPresent(invites, 'invites is required');

  const user = ctx.state.user;
  authorize(user, 'invite', User);

  const invitesSent = await userInviter({ user, invites });

  ctx.body = {
    data: invitesSent,
  };
});

router.post('users.delete', auth(), async ctx => {
  const { confirmation } = ctx.body;
  ctx.assertPresent(confirmation, 'confirmation is required');

  const user = ctx.state.user;
  authorize(user, 'delete', user);

  try {
    await user.destroy();
  } catch (err) {
    throw new ValidationError(err.message);
  }

  ctx.body = {
    success: true,
  };
});

export default router;
