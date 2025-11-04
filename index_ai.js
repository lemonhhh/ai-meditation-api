// index.js
import Fastify from "fastify";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import WebSocket from "ws";

// ========= 基本配置 =========
const APPID = "977737ce";
const APIKey = "c406370db6cb1deb8ba647159ad857c0";
const APISecret = "YjFjODU5NGEwNjk0MDQyMWFhMjM1MTNi";

// 星火模型（生成文案）
const SPARK_HOST = "spark-api.xf-yun.com";
const SPARK_PATH = "/v1/x1";

// 长文本语音合成 WebAPI
const HOST = "api-dx.xf-yun.com";
const CREATE_PATH = "/v1/private/dts_create";
const QUERY_PATH = "/v1/private/dts_query";

// ========= 公共：HTTP 鉴权签名 =========
function buildAuthHeader(host, path, apiSecret, apiKey) {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nPOST ${path} HTTP/1.1`;
  const signatureSha = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  return { date, authorization };
}

// ========= 公共：WS 鉴权（星火） =========
function buildAuthWSUrl(host, path, apiSecret, apiKey) {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = crypto.createHmac("sha256", apiSecret).update(signatureOrigin).digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  const params = new URLSearchParams({ authorization, date, host });
  return `wss://${host}${path}?${params.toString()}`;
}

// ========= 生成冥想文案（星火） =========
function generateMeditationText({ duration = 5, purpose = "助眠", style = "温柔舒缓" }) {
  return new Promise((resolve, reject) => {
    const wsUrl = buildAuthWSUrl(SPARK_HOST, SPARK_PATH, APISecret, APIKey);
    const ws = new WebSocket(wsUrl);
    let result = "";

    ws.on("open", () => {
      const body = {
        header: { app_id: APPID, uid: "local_user" },
        parameter: { chat: { domain: "x1", temperature: 0.7, max_tokens: 2048 } },
        payload: {
          message: {
            text: [
              {
                role: "user",
                content: `请用温柔、细腻、缓慢的语气，生成一段约 ${duration} 分钟的冥想引导词。\n主题：${purpose}\n风格：${style}\n要求：\n1) 包含开场引导、呼吸引导、身体扫描、情绪安抚、收尾。\n2) 语言自然、轻柔，可读性强。\n3) 避免机械化句式或重复短语。\n4) 长度适中，可持续朗读 ${duration} 分钟左右。`,
              },
            ],
          },
        },
      };
      ws.send(JSON.stringify(body));
    });

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);
      if (data?.header?.code !== 0) {
        reject(new Error(`星火错误: ${JSON.stringify(data.header)}`));
        ws.close();
        return;
      }
      const texts = data?.payload?.choices?.text || [];
      for (const t of texts) if (t?.content) result += t.content;
      if (data?.header?.status === 2) {
        ws.close();
        resolve(result.trim());
      }
    });

    ws.on("error", (err) => reject(err));
  });
}

// ========= 创建语音合成任务（注意：text 需 base64） =========
async function createTask(textUtf8) {
  // 限制：最大约10万字符
  if (textUtf8.length > 100000) {
    throw new Error(`文本过长（${textUtf8.length}），请控制在 100000 字以内`);
  }

  const textBase64 = Buffer.from(textUtf8, "utf8").toString("base64");
  const { date, authorization } = buildAuthHeader(HOST, CREATE_PATH, APISecret, APIKey);
  const url = `https://${HOST}${CREATE_PATH}?host=${HOST}&date=${encodeURIComponent(date)}&authorization=${encodeURIComponent(authorization)}`;

  const body = {
    header: { app_id: APPID },
    parameter: {
      dts: {
        vcn: "x4_qianxue", // ✅ 发音人
        language: "zh",
        speed: 50,
        volume: 50,
        pitch: 50,
        rhy: 1,
        audio: { encoding: "lame", sample_rate: 16000 }, // mp3
        pybuf: { encoding: "utf8", compress: "raw", format: "plain" },
      },
    },
    payload: {
      text: {
        encoding: "utf8",
        compress: "raw",
        format: "plain",
        text: textBase64, // ✅ 必须是 base64
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.header.code !== 0) {
    throw new Error(`创建任务失败: ${data.header.message}`);
  }
  return data.header.task_id;
}

// ========= 查询任务 =========
async function queryTask(taskId) {
  const { date, authorization } = buildAuthHeader(HOST, QUERY_PATH, APISecret, APIKey);
  const url = `https://${HOST}${QUERY_PATH}?host=${HOST}&date=${encodeURIComponent(date)}&authorization=${encodeURIComponent(authorization)}`;
  const body = { header: { app_id: APPID, task_id: taskId } };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return await res.json();
}

// ========= 拉取结果并保存 mp3 =========
async function synthesizeLongText(text, outMp3Path) {
  const taskId = await createTask(text);
  console.log(`🎙️ 已创建任务: ${taskId}`);

  let status = 0;
  let audioUrl = null;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000)); // 每5秒轮询
    const res = await queryTask(taskId);
    if (res?.header?.code !== 0) {
      throw new Error(`查询失败: ${res?.header?.message || "unknown"}`);
    }

    status = Number(res.header.task_status);
    if (status === 5) {
      // 音频 URL 是 base64 编码
      audioUrl = Buffer.from(res.payload.audio.audio, "base64").toString("utf8");
      console.log("✅ 任务完成，音频URL:", audioUrl);
      break;
    } else if (status === 4) {
      throw new Error("任务处理失败");
    } else {
      console.log(`⌛ 状态(${status})处理中...`);
    }
  }

  if (!audioUrl) throw new Error("任务未完成或超时");

  const audioRes = await fetch(audioUrl);
  const buffer = await audioRes.arrayBuffer();
  fs.writeFileSync(outMp3Path, Buffer.from(buffer));
  console.log("🎵 已保存音频:", outMp3Path);
  return outMp3Path;
}

// ========= Fastify 服务 =========
const app = Fastify();

// 纯文本 -> 语音（备用）
app.post("/tts", async (req, reply) => {
  const { text } = req.body || {};
  if (!text) return reply.code(400).send({ error: "缺少 text 参数" });

  const mp3Path = path.resolve("./tts_result.mp3");
  try {
    await synthesizeLongText(text, mp3Path);
    reply.send({ message: "合成成功", file: mp3Path });
  } catch (err) {
    console.error(err);
    reply.code(500).send({ error: err.message });
  }
});

// 生成文案 -> 语音（你的 curl 用这个）
app.post("/generateFull", async (req, reply) => {
  const { duration = 5, purpose = "助眠", style = "温柔舒缓" } = req.body || {};
  const txtPath = path.resolve("./meditation_full.txt");
  const mp3Path = path.resolve("./meditation_full.mp3");

  try {
    console.log("🧘 正在生成冥想文案...");
    const text = await generateMeditationText({ duration, purpose, style });
    if (!text || text.length < 50) throw new Error("生成文案过短或为空");

    fs.writeFileSync(txtPath, text, "utf8");
    console.log("📝 文案已保存:", txtPath);

    console.log("🎧 开始语音合成...");
    await synthesizeLongText(text, mp3Path);

    reply.send({
      message: "生成成功",
      duration,
      purpose,
      style,
      text_file: txtPath,
      audio_file: mp3Path,
      preview: text.slice(0, 120) + (text.length > 120 ? "..." : ""),
    });
  } catch (err) {
    console.error(err);
    reply.code(500).send({ error: err.message });
  }
});

app.listen({ port: 3000 }, () => {
  console.log("✅ 服务已启动：http://localhost:3000");
});
