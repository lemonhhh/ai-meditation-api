// index.js (测试版：不调用AI；直接返回公网静态文件URL)
import Fastify from "fastify";

const app = Fastify();

// 自动识别 Vercel 线上域名，否则本地开发用 localhost
const BASE_URL =
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

// /tts：返回音频 URL（测试用）
app.post("/tts", async (req, reply) => {
  reply.send({
    message: "测试模式：返回公网音频文件",
    audio_url: `${BASE_URL}/meditation_full.mp3`,
  });
});

// /generateFull：返回文本/音频 URL + 预览（预览这里不再读文件，给个固定提示）
app.post("/generateFull", async (req, reply) => {
  // 这里不再用 fs 检查，只返回可公网访问的 URL
  reply.send({
    message: "测试模式：返回公网文件",
    duration: 5,
    purpose: "助眠",
    style: "温柔舒缓",
    text_url: `${BASE_URL}/meditation_full.txt`,
    audio_url: `${BASE_URL}/meditation_full.mp3`,
    // 预览：如果你想展示真实开头文本，可在本地模式时读取文件；线上建议直接让 iOS 端请求 text_url 获取内容
    preview: "（测试模式）请在客户端用 text_url 拉取真实文案内容。",
  });
});

// 本地开发时开启；Vercel 会自动托管为 Serverless Function（不用手动 listen）
if (!process.env.VERCEL) {
  app.listen({ port: 3000 }, () => {
    console.log("✅ 本地测试服务已启动：http://localhost:3000");
    console.log(`静态文件可访问: ${BASE_URL}/meditation_full.mp3`);
  });
}

export default async function handler(req, res) {
  // 让 Vercel 的 Node 适配 Fastify
  await app.ready();
  app.server.emit("request", req, res);
}
