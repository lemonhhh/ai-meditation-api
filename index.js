// index.js
import Fastify from "fastify";
import crypto from "crypto";
import WebSocket from "ws";

// ======== 讯飞星火账号信息 ========
const APPID = "977737ce";
const APIKey = "c406370db6cb1deb8ba647159ad857c0";
const APISecret = "YjFjODU5NGEwNjk0MDQyMWFhMjM1MTNi";
// ==================================

// ✅ 生成鉴权URL
function getAuthUrl(host = "spark-api.xf-yun.com", path = "/v1/x1") {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = crypto
    .createHmac("sha256", APISecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  const params = new URLSearchParams({ authorization, date, host });
  return `wss://${host}${path}?${params.toString()}`;
}

// ✅ 调用讯飞星火接口
function callXunfei(prompt) {
  return new Promise((resolve, reject) => {
    const wsUrl = getAuthUrl();
    const ws = new WebSocket(wsUrl);
    let result = "";

    ws.on("open", () => {
      const body = {
        header: { app_id: APPID, uid: "vercel_user" },
        parameter: {
          chat: { domain: "x1", temperature: 0.6, max_tokens: 1024 },
        },
        payload: {
          message: { text: [{ role: "user", content: prompt }] },
        },
      };
      ws.send(JSON.stringify(body));
    });

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);
      if (data?.header?.code !== 0) {
        reject(new Error("讯飞返回错误: " + JSON.stringify(data.header)));
        ws.close();
        return;
      }

      const texts = data?.payload?.choices?.text || [];
      for (const t of texts) {
        if (t.content) result += t.content;
      }

      if (data?.header?.status === 2) {
        ws.close();
        resolve(result.trim());
      }
    });

    ws.on("error", (err) => reject(err));
  });
}

// ✅ Fastify 实例
const app = Fastify();

app.post("/generate", async (req, reply) => {
  const { duration = 5, purpose = "冥想", style = "放松身体" } = req.body || {};
  const prompt = `请用温柔的语气，生成一段约 ${duration} 分钟的冥想引导词。\n主题：${purpose}，风格：${style}。`;

  try {
    const text = await callXunfei(prompt);
    reply.send({ text });
  } catch (err) {
    console.error("❌ 调用讯飞错误：", err);
    reply.code(500).send({ error: err.message });
  }
});

// ✅ 本地运行
if (process.env.NODE_ENV !== "production") {
  app.listen({ port: 3000 }, () => {
    console.log("✅ 本地运行：http://localhost:3000");
  });
}

// ✅ 兼容 Vercel Serverless 导出
export default async function handler(req, res) {
  await app.ready();
  app.server.emit("request", req, res);
}
