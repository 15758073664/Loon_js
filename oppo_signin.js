const STORE_KEY = "oppo_auth";

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
      constToken
    };
    $persistentStore.write(JSON.stringify(auth), STORE_KEY);
    $notification.post("OPPO 商城", "登录信息获取成功", "Cookie & constToken 已保存");
  } else {
    $notification.post(
      "OPPO 商城",
      "登录信息不完整",
      "请从签到页面触发请求"
    );
  }

  $done({});
  return;
}

/**
 * 二、cron：自动签到
 */
const raw = $persistentStore.read(STORE_KEY);
if (!raw) {
  $notification.post("OPPO 商城", "未检测到登录信息", "请先手动签到一次");
  $done();
  return;
}

const auth = JSON.parse(raw);
const cookie = auth.cookie;
const constToken = auth.constToken;

/**
 * 获取当月 activityId
 */
function getActivityId() {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url: "https://hd.opposhop.cn/api/cn/oapi/marketing/cumulativeSignIn/queryActivityList",
        headers: {
          Cookie: cookie,
          constToken: constToken,
          Accept: "application/json",
          "User-Agent": "oppostore"
        }
      },
      (err, resp, data) => {
        if (err) return reject(err);
        try {
          const json = JSON.parse(data);
          const list = json?.data?.activityList || [];
          if (!list.length) reject("未获取到签到活动");
          else resolve(list[0].activityId);
        } catch (e) {
          reject("activityId 解析失败");
        }
      }
    );
  });
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
          activityId,
          business: 1
        })
      },
      (err, resp, data) => {
        if (err) return reject(err);
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
 * 主流程
 */
(async () => {
  try {
    const activityId = await getActivityId();
    const reward = await signIn(activityId);
    $notification.post("OPPO 商城", "签到成功 🎉", `奖励：${reward}`);
  } catch (e) {
    $notification.post("OPPO 商城", "签到失败 ❌", String(e));
  }
  $done();
})();
