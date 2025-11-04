// index.js (测试版：读取 public 文件，返回公网链接)
import Fastify from "fastify";
import fs from "fs";
import path from "path";

const app = Fastify();

// 你的部署基础 URL（改成你的 Vercel 地址）
const BASE_URL = "https://ai-meditation-api.vercel.app";

// ========= /tts =========
// 简单测试接口，返回固定音频文件信息
app.post("/tts", async (req, reply) => {
  const mp3Path = path.resolve("./public/meditation_full.mp3");
  if (!fs.existsSync(mp3Path)) {
    return reply
      .code(404)
      .send({ error: "音频文件不存在，请先将 meditation_full.mp3 放到 public 目录" });
  }

  reply.send({
    message: "测试模式：返回公网音频文件",
    audio_url: `${BASE_URL}/meditation_full.mp3`,
  });
});

// ========= /generateFull =========
// 模拟 AI 生成 + TTS 逻辑，直接读取 public 文件并返回公网可访问链接
app.post("/generateFull", async (req, reply) => {
  const txtPath = path.resolve("./public/meditation_full.txt");
  const mp3Path = path.resolve("./public/meditation_full.mp3");

  // 检查文件是否存在
  if (!fs.existsSync(txtPath) || !fs.existsSync(mp3Path)) {
    return reply.code(404).send({
      error: "public 目录下缺少 meditation_full.txt 或 meditation_full.mp3",
    });
  }

  // 读取文本
  const text = fs.readFileSync(txtPath, "utf8");

  // ✅ 返回公网可访问链接（iOS App 直接使用）
  reply.send({
    message: "测试模式：返回公网文件",
    duration: 5,
    purpose: "助眠",
    style: "温柔舒缓",
    text_url: `${BASE_URL}/meditation_full.txt`,
    audio_url: `${BASE_URL}/meditation_full.mp3`,
    preview: text.slice(0, 120) + (text.length > 120 ? "..." : ""),
  });
});

// ========= 启动服务 =========
app.listen({ port: 3000 }, () => {
  console.log("✅ 本地测试服务已启动：http://localhost:3000");
});
