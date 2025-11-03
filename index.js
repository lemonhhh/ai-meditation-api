import Fastify from "fastify";
import WebSocket from "ws";
import crypto from "crypto";

const app = Fastify();

// 讯飞账号信息
const APPID = "977737ce";
const APISecret = "YjFjODU5NGEwNjk0MDQyMWFhMjM1MTNi";
const APIKey = "c406370db6cb1deb8ba647159ad857c0";

// 生成鉴权 URL
function getAuthUrl(host, path = "/v1/x1") {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = crypto
    .createHmac("sha256", APISecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  const url = `wss://${host}${path}?authorization=${encodeURIComponent(
    authorization
  )}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
  return url;
}

// 生成请求体
function buildRequest(prompt) {
  return JSON.stringify({
    header: {
      app_id: APPID,
      uid: "web_user_001",
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
  });
}

// 处理 POST /generate
app.post("/generate", async (req, reply) => {
  const { duration = 10, purpose = "冥想", style = "放松身体" } = req.body;

  const prompt = `请用温柔放松的语气，生成一段约 ${duration} 分钟的冥想引导词。
主题：${purpose}，风格：${style}。`;

  const host = "spark-api.xf-yun.com";
  const wsUrl = getAuthUrl(host, "/v1/x1");
  const ws = new WebSocket(wsUrl);

  return new Promise((resolve, reject) => {
    let resultText = "";

    ws.on("open", () => {
      ws.send(buildRequest(prompt));
    });

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        const code = data?.header?.code;
        if (code !== 0) {
          console.error("❌ 出错:", data.header);
          ws.close();
          reject(new Error("讯飞接口返回错误"));
          return;
        }

        const texts = data?.payload?.choices?.text;
        if (texts && Array.isArray(texts)) {
          for (const t of texts) {
            if (t.content) resultText += t.content;
          }
        }

        if (data.header.status === 2) {
          ws.close();
          resolve(resultText);
        }
      } catch (err) {
        console.error("解析出错:", err);
        reject(err);
      }
    });

    ws.on("error", (err) => {
      reject(err);
    });
  })
    .then((text) => {
      reply.send({ text });
    })
    .catch((err) => {
      reply.code(500).send({ error: err.message });
    });
});

// 启动本地测试（Vercel 不会执行 listen）
if (process.env.NODE_ENV !== "production") {
  app.listen({ port: 3000 }, () => {
    console.log("✅ 本地服务器运行在 http://localhost:3000");
  });
}

export default app;
