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
  
    const text = await res.text(); // 改成纯文本，方便调试
    console.log("🚀 讯飞原始返回：", text); // 打印出来
  
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("讯飞返回的不是有效 JSON：" + text.slice(0, 200));
    }
  
    if (data?.header?.code !== 0) {
      throw new Error(JSON.stringify(data.header));
    }
  
    const content = data?.payload?.choices?.text?.[0]?.content || "（空返回）";
    return content;
  }
  