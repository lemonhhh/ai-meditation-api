// index.js (测试版：不调用AI，只返回本地文件)
import Fastify from "fastify";
import fs from "fs";
import path from "path";

const app = Fastify();

// 纯文本 → 语音（直接返回已保存的mp3路径）
app.post("/tts", async (req, reply) => {
  const mp3Path = path.resolve("./meditation_full.mp3");
  if (!fs.existsSync(mp3Path)) {
    return reply.code(404).send({ error: "音频文件不存在，请先生成 meditation_full.mp3" });
  }
  reply.send({
    message: "返回本地测试音频",
    audio_file: mp3Path,
  });
});

// 自动生成文案 → 合成语音（测试模式：直接读取本地文件）
app.post("/generateFull", async (req, reply) => {
  const txtPath = path.resolve("./meditation_full.txt");
  const mp3Path = path.resolve("./meditation_full.mp3");

  if (!fs.existsSync(txtPath) || !fs.existsSync(mp3Path)) {
    return reply.code(404).send({
      error: "本地文件不存在，请先生成 meditation_full.txt 与 meditation_full.mp3",
    });
  }

  const text = fs.readFileSync(txtPath, "utf8");

  reply.send({
    message: "测试模式：返回本地文件",
    duration: 5,
    purpose: "助眠",
    style: "温柔舒缓",
    text_file: txtPath,
    audio_file: mp3Path,
    preview: text.slice(0, 120) + (text.length > 120 ? "..." : ""),
  });
});

app.listen({ port: 3000 }, () => {
  console.log("✅ 本地测试服务启动：http://localhost:3000");
});
