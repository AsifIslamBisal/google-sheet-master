export type IgCheckResult = {
  active: boolean;
  /** Instagram username (যদি API থেকে পাওয়া যায়) */
  igUsername?: string;
  reason?: string;
};

const IG_CHECK_URL =
  'https://www.instagram.com/api/v1/accounts/current_user/?edit=true';

const UA =
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 Instagram/319.0.0.0.75';

/**
 * Instagram cookie দিয়ে account active কিনা check করে।
 * Active হলে { active: true }, না হলে { active: false, reason: '...' }
 */
export const checkIgAccount = async (
  cookie: string,
): Promise<IgCheckResult> => {
  let res: Response;
  try {
    res = await fetch(IG_CHECK_URL, {
      method: 'GET',
      headers: {
        Cookie: cookie,
        'User-Agent': UA,
        Accept: '*/*',
        'X-IG-App-ID': '936619743392459',
        Referer: 'https://www.instagram.com/',
      },
      redirect: 'manual', // 302 = expired/logged out
    });
  } catch (err) {
    return {
      active: false,
      reason: err instanceof Error ? err.message : 'network error',
    };
  }

  // 302 = redirect to login page → session expired
  if (res.status === 302 || res.status === 301) {
    return { active: false, reason: 'session expired (redirect to login)' };
  }

  if (res.status === 401) {
    return { active: false, reason: 'unauthorized (401)' };
  }

  if (res.status === 403) {
    return { active: false, reason: 'forbidden (403) — may be checkpoint' };
  }

  if (res.status === 429) {
    return { active: false, reason: 'rate limited (429)' };
  }

  if (res.status !== 200) {
    return { active: false, reason: `unexpected status ${res.status}` };
  }

  // 200 → parse response to get username
  try {
    const body = (await res.json()) as {
      user?: { username?: string };
      status?: string;
    };
    if (body.status !== 'ok') {
      return { active: false, reason: `status=${body.status ?? 'unknown'}` };
    }
    return {
      active: true,
      igUsername: body.user?.username,
    };
  } catch {
    // JSON parse ব্যর্থ হলেও 200 পেয়েছি, active ধরব
    return { active: true };
  }
};
