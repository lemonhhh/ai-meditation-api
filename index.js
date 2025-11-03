// index.js
import Fastify from "fastify";
import crypto from "crypto";
import fetch from "node-fetch"; // 用于HTTP请求

const app = Fastify();

// ======== 讯飞星火 API 账号信息 ========
const APPID = "977737ce";
const APISecret = "YjFjODU5NGEwNjk0MDQyMWFhMjM1MTNi";
const APIKey = "c406370db6cb1deb8ba647159ad857c0";
// ======================================

// 🔒 生成鉴权签名
function getSignature(host, date, path = "/v1.1/chat") {
  const signatureOrigin = `host: ${host}\ndate: ${date}\nPOST ${path} HTTP/1.1`;
  const signatureSha = crypto
    .createHmac("sha256", APISecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  return { authorization };
}

// 🧾 构建请求头
function buildHeaders(host, path = "/v1.1/chat") {
  const date = new Date().toUTCString();
  const { authorization } = getSignature(host, date, path);
  return {
    Authorization: authorization,
    Host: host,
    Date: date,
    "Content-Type": "application/json",
  };
}

async function callXunfei(prompt) {
    const host = "spark-api.xf-yun.com";
    const url = `https://${host}/v1.1/chat`;
    const headers = buildHeaders(host);
  
    const body = {
      header: {
        app_id: APPID,
        uid: "vercel_user",
      },
      parameter: {
        chat: {
          domain: "x1",
          temperature: 0.6,
          max_tokens: 1024,
        },
      },
      payload: {
        message: {
          text: [{ role: "user", content: prompt }],
        },
      },
    };
  
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  
    const raw = await res.text();
    console.log("🚀 讯飞原始返回：", raw); // 👈 把完整响应打印出来
  
    // ✅ 增加详细错误判断
    if (!res.ok) {
      throw new Error(`HTTP错误：${res.status} - ${res.statusText}`);
    }
  
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error("讯飞返回的不是有效 JSON：" + raw.slice(0, 200));
    }
  
    if (!data.header || data.header.code !== 0) {
      console.error("🚨 讯飞接口错误详情：", data);
      throw new Error(JSON.stringify(data.header || {}));
    }
  
    const content =
      data?.payload?.choices?.text?.[0]?.content ||
      data?.payload?.choices?.[0]?.content ||
      "（无内容返回）";
  
    return content;
  }

  
// 🧘‍♀️ 冥想生成接口
app.post("/generate", async (req, reply) => {
  const { duration = 5, purpose = "冥想", style = "放松身体" } = req.body;

  const prompt = `请用温柔的语气，生成一段约 ${duration} 分钟的冥想引导词。
主题：${purpose}，风格：${style}。`;

  try {
    const text = await callXunfei(prompt);
    reply.send({ text });
  } catch (err) {
    console.error("❌ 讯飞调用错误：", err);
    reply.code(500).send({ error: err.message });
  }
});

// ✅ 本地运行（开发用）
if (process.env.NODE_ENV !== "production") {
  app.listen({ port: 3000 }, () => {
    console.log("✅ 本地运行：http://localhost:3000");
  });
}

// ✅ 兼容 Vercel Serverless 的导出
export default async function handler(req, res) {
  await app.ready();
  app.server.emit("request", req, res);
}
