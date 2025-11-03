import Fastify from "fastify";
import OpenAI from "openai";

const app = Fastify();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/generate", async (req, reply) => {
  const { duration = 10, purpose = "冥想", style = "放松身体" } = req.body;

  const prompt = `
  你是一名冥想导师，请生成一段约 ${duration} 分钟的冥想引导词。
  主题：${purpose}，风格：${style}。
  使用温柔、放松的语气，不要使用医学术语。
  `;

  const result = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: "你是一名冥想导师" },
               { role: "user", content: prompt }],
  });

  const text = result.choices[0].message.content;

  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: text
  });

  const arrayBuffer = await speech.arrayBuffer();
  reply
    .header("Content-Type", "audio/mpeg")
    .send(Buffer.from(arrayBuffer));
});

app.listen({ port: 3000 });
