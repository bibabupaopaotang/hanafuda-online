/**
 * 微信登录 — 获取 openid 并返回用户信息
 */

export interface UserInfo {
  id: string;      // openid
  nickname: string;
  avatar: string;
}

export async function wxLogin(): Promise<UserInfo> {
  // 1. 微信登录获取 code
  const loginRes = await new Promise<WechatMinigame.LoginSuccessCallbackResult>(
    (resolve, reject) => wx.login({ success: resolve, fail: reject })
  );

  console.log('[Auth] code:', loginRes.code);

  // 2. 用 code 换取 openid（通过云函数/自建服务）
  // MVP 阶段先用 code 当临时 ID，后续替换为真实 openid
  const openid = await fetchOpenId(loginRes.code);

  // 3. 获取用户信息
  const userProfile = await getUserProfile();

  return {
    id: openid,
    nickname: userProfile?.nickName || `玩家${openid.slice(0, 4)}`,
    avatar: userProfile?.avatarUrl || '',
  };
}

async function fetchOpenId(code: string): Promise<string> {
  // MVP: 用 code 后 8 位当临时 ID
  // TODO: 替换为真实云函数调用
  // const res = await wx.cloud.callFunction({ name: 'login', data: { code } });
  // return res.result.openid;
  return 'u_' + code.slice(-8);
}

async function getUserProfile(): Promise<{ nickName: string; avatarUrl: string } | null> {
  try {
    // wx.getUserProfile 需要用户授权
    const res = await new Promise<any>((resolve, reject) =>
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: resolve,
        fail: reject,
      })
    );
    return { nickName: res.userInfo.nickName, avatarUrl: res.userInfo.avatarUrl };
  } catch {
    // 用户拒绝授权，返回 null
    return null;
  }
}
