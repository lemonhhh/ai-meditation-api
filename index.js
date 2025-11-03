import Fastify from "fastify";
import OpenAI from "openai";

const app = Fastify();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/test", async (req, reply) => {
  const { prompt = "请给我一句积极的冥想引导语。" } = req.body;

  try {
    const result = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.choices[0].message.content;
    reply.send({ text });
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

app.listen({ port: 3000 });
