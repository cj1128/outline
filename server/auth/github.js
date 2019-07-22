import Router from 'koa-router';
import { githubAuth } from '../../shared/utils/routeHelpers';
import auth from '../middlewares/authentication';
import { User, Team } from '../models';
import fetch from 'isomorphic-fetch';
import { InvalidRequestError } from '../errors';
import qs from 'querystring'

const router = new Router();

const fetchUser = async token => {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        accept: 'application/json',
        Authorization: `token ${token}`
      },
    });

    return await res.json();
  } catch (err) {
    throw new InvalidRequestError(err.message)
  }
}

router.get('github', async ctx => {
  ctx.redirect(githubAuth());
});

router.get('github.callback', auth({ required: false }), async ctx => {
  const { code, error } = ctx.request.query;
  ctx.assertPresent(code || error, 'code is required');

  if (error) {
    ctx.redirect(`/?notice=auth-error&error=${error}`);
    return;
  }

  let data
  try {
    const res = await fetch(`https://github.com/login/oauth/access_token?${qs.stringify({
      client_id: process.env.GITHUB_KEY,
      client_secret: process.env.GITHUB_SECRET,
      code,
    })}`, {
      headers: { 'Accept': 'application/json'},
    });
    data = await res.json();
  } catch (err) {
    throw new InvalidRequestError(err.message)
  }

  if (!data.access_token) throw new InvalidRequestError(data.error);

  const info = await fetchUser(data.access_token)

  const [team, isFirstUser] = await Team.findOrCreate({
    where: {
      githubId: 'shuoye-team',
    },
    defaults: {
      name: 'shuoye',
      avatarUrl: 'http://pv0urvrtx.bkt.clouddn.com/IMG_0319.jpg',
    },
  });

  const [user, isFirstSignin] = await User.findOrCreate({
    where: {
      service: 'github',
      serviceId: String(info.id),
      teamId: team.id,
    },
    defaults: {
      name: info.name,
      email: info.email,
      isAdmin: isFirstUser,
      avatarUrl: info.avatar_url,
    },
  });

  if (isFirstUser) {
    await team.provisionFirstCollection(user.id);
  }

  if (!isFirstSignin && info.email !== user.email) {
    await user.update({ email: info.email });
  }

  ctx.signIn(user, team, 'github', isFirstSignin);
});

export default router;
