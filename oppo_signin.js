/*********************************
 * OPPO 商城 自动签到（升级版）
 * 适用环境：Loon
 *
 * 特性：
 * - Cookie + constToken 登录态
 * - activityId 本地缓存
 * - 自动失效刷新
 * - 无需每月手动签到
 *********************************/

const AUTH_KEY = "oppo_auth";
const ACTIVITY_KEY = "oppo_activity_id";

/**
 * 一、http-request：抓登录态
 */
if (typeof $request !== "undefined") {
  const headers = $request.headers || {};
  const cookie = headers["Cookie"] || headers["cookie"];
  const constToken = headers["constToken"] || headers["consttoken"];

  if (cookie && constToken) {
    const auth = {
      cookie,
      constToken,
      time: Date.now()
    };
    $persistentStore.write(JSON.stringify(auth), AUTH_KEY);
    $notification.post(
      "OPPO 商城",
      "登录信息获取成功",
      "Cookie & constToken 已保存"
    );
  } else {
    $notification.post(
      "OPPO 商城",
      "登录信息获取失败",
      "请从签到页面触发"
    );
  }

  $done({});
  return;
}

/**
 * 二、cron：自动签到
 */
const rawAuth = $persistentStore.read(AUTH_KEY);
if (!rawAuth) {
  $notification.post(
    "OPPO 商城",
    "未检测到登录信息",
    "请先手动签到一次"
  );
  $done();
  return;
}

const auth = JSON.parse(rawAuth);
const cookie = auth.cookie;
const constToken = auth.constToken;

/**
 * 查询活动列表并缓存 activityId
 */
function fetchActivityId() {
  return new Promise((resolve, reject) => {
    const url =
      "https://hd.opposhop.cn/api/cn/oapi/marketing/cumulativeSignIn/queryActivityList" +
      "?business=1&scene=1";

    $httpClient.get(
      {
        url,
        headers: {
          Cookie: cookie,
          constToken: constToken,
          Accept: "application/json",
          "User-Agent": "oppostore"
        }
      },
      (err, resp, data) => {
        if (err) return reject("活动接口请求失败");

        try {
          const json = JSON.parse(data);
          const list = json?.data?.activityList || [];

          if (!list.length) {
            reject("未获取到签到活动");
          } else {
            const activityId = list[0].activityId;
            $persistentStore.write(activityId, ACTIVITY_KEY);
            resolve(activityId);
          }
        } catch (e) {
          reject("活动响应解析失败");
        }
      }
    );
  });
}

/**
 * 获取 activityId（优先缓存）
 */
async function getActivityId() {
  const cached = $persistentStore.read(ACTIVITY_KEY);
  if (cached) return cached;
  return await fetchActivityId();
}

/**
 * 执行签到
 */
function signIn(activityId) {
  return new Promise((resolve, reject) => {
    $httpClient.post(
      {
        url: "https://hd.opposhop.cn/api/cn/oapi/marketing/cumulativeSignIn/signIn",
        headers: {
          Cookie: cookie,
          constToken: constToken,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "oppostore"
        },
        body: JSON.stringify({
          activityId: activityId,
          business: 1
        })
      },
      (err, resp, data) => {
        if (err) return reject("签到接口请求失败");

        try {
          const json = JSON.parse(data);
          if (json.succeed) {
            resolve(json.data?.awardValue || "签到成功");
          } else {
            reject(json.message || "签到失败");
          }
        } catch (e) {
          reject("签到响应解析失败");
        }
      }
    );
  });
}

/**
 * 主流程：带 activityId 自动刷新
 */
(async () => {
  try {
    let activityId = await getActivityId();

    try {
      const reward = await signIn(activityId);
      $notification.post(
        "OPPO 商城",
        "签到成功 🎉",
        `奖励：${reward}`
      );
    } catch (e) {
      // 活动失效，自动刷新
      if (String(e).includes("活动")) {
        $persistentStore.write("", ACTIVITY_KEY);
        activityId = await fetchActivityId();
        const reward = await signIn(activityId);
        $notification.post(
          "OPPO 商城",
          "签到成功（已刷新活动）🎉",
          `奖励：${reward}`
        );
      } else {
        throw e;
      }
    }
  } catch (e) {
    $notification.post(
      "OPPO 商城",
      "签到失败 ❌",
      String(e)
    );
  }
  $done();
})();
