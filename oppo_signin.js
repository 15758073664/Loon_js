const COOKIE_KEY = "oppo_cookie";

const cookie = $persistentStore.read(COOKIE_KEY);
if (!cookie) {
  $notification.post("OPPO 商城", "未检测到 Cookie", "请先手动打开商城签到一次");
  $done();
}

/**
 * 1. 获取当月签到 activityId
 */
function getActivityId() {
  return new Promise((resolve, reject) => {
    const options = {
      url: "https://hd.opposhop.cn/api/cn/oapi/marketing/cumulativeSignIn/queryActivityList",
      headers: {
        "Cookie": cookie,
        "User-Agent": "oppostore",
        "Accept": "application/json"
      }
    };

    $httpClient.get(options, (err, resp, data) => {
      if (err) return reject(err);

      try {
        const json = JSON.parse(data);
        const list = json?.data?.activityList || [];

        if (list.length === 0) {
          reject("未获取到签到活动");
        } else {
          resolve(list[0].activityId);
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * 2. 执行签到
 */
function signIn(activityId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      activityId: activityId,
      business: 1
    });

    const options = {
      url: "https://hd.opposhop.cn/api/cn/oapi/marketing/cumulativeSignIn/signIn",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookie,
        "User-Agent": "oppostore"
      },
      body: body
    };

    $httpClient.post(options, (err, resp, data) => {
      if (err) return reject(err);

      try {
        const json = JSON.parse(data);
        if (json.succeed) {
          resolve(json.data.awardValue || "签到成功");
        } else {
          reject(json.message);
        }
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * 主流程
 */
(async () => {
  try {
    const activityId = await getActivityId();
    const reward = await signIn(activityId);
    $notification.post("OPPO 商城", "签到成功 🎉", `获得奖励：${reward}`);
  } catch (e) {
    $notification.post("OPPO 商城", "签到失败 ❌", String(e));
  }
  $done();
})();
