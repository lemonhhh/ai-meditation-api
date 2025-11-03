import Fastify from "fastify";
import crypto from "crypto";
import fetch from "node-fetch";

const app = Fastify();

// 讯飞账号信息
const APPID = "977737ce";
const APISecret = "YjFjODU5NGEwNjk0MDQyMWFhMjM1MTNi";
const APIKey = "c406370db6cb1deb8ba647159ad857c0";

// 签名函数
function getSignature(host, date, path = "/v1.1/chat") {
  const signatureOrigin = `host: ${host}\ndate: ${date}\nPOST ${path} HTTP/1.1`;
  const signatureSha = crypto
    .createHmac("sha256", APISecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  return { authorization, signatureSha };
}

// 生成完整鉴权头
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

// 调用讯飞 API
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

  const data = await res.json();

  if (data?.header?.code !== 0) {
    throw new Error(JSON.stringify(data.header));
  }

  const content = data?.payload?.choices?.text?.[0]?.content || "";
  return content;
}

// 接口：生成冥想引导词
app.post("/generate", async (req, reply) => {
  const { duration = 10, purpose = "冥想", style = "放松身体" } = req.body;
  const prompt = `请用温柔的语气，生成一段约 ${duration} 分钟的冥想引导词。
主题：${purpose}，风格：${style}。`;

  try {
    const text = await callXunfei(prompt);
    reply.send({ text });
  } catch (err) {
    console.error(err);
    reply.code(500).send({ error: err.message });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen({ port: 3000 }, () => {
    console.log("✅ 本地运行 http://localhost:3000");
  });
}

export default async function handler(req, res) {
  await app.ready();
  app.server.emit("request", req, res);
}
