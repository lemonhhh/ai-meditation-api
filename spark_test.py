import websocket
import base64
import hashlib
import hmac
import json
import time
import ssl
from urllib.parse import urlencode

# ======= 你的讯飞鉴权信息 =======
APPID = "977737ce"
APISecret = "YjFjODU5NGEwNjk0MDQyMWFhMjM1MTNi"
APIKey = "c406370db6cb1deb8ba647159ad857c0"
# =================================

def get_auth_url(hosturl, path="/v1/x1"):
    """生成带鉴权的 WebSocket URL"""
    now = time.gmtime()
    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", now)

    signature_origin = f"host: {hosturl}\ndate: {date}\nGET {path} HTTP/1.1"
    signature_sha = hmac.new(APISecret.encode("utf-8"),
                             signature_origin.encode("utf-8"),
                             digestmod=hashlib.sha256).digest()
    signature_sha_base64 = base64.b64encode(signature_sha).decode('utf-8')

    authorization_origin = (
        f'api_key="{APIKey}", algorithm="hmac-sha256", '
        f'headers="host date request-line", signature="{signature_sha_base64}"'
    )
    authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')

    params = {
        "authorization": authorization,
        "date": date,
        "host": hosturl
    }

    return f"wss://{hosturl}{path}?{urlencode(params)}"


def gen_req_data(question):
    """生成请求体"""
    return json.dumps({
        "header": {
            "app_id": APPID,
            "uid": "user_001"
        },
        "parameter": {
            "chat": {
                "domain": "x1",
                "temperature": 0.5,
                "max_tokens": 1024
            }
        },
        "payload": {
            "message": {
                "text": [
                    {"role": "user", "content": question}
                ]
            }
        }
    })


# 存放返回的最终文本
result_text = ""


def on_message(ws, message):
    global result_text
    data = json.loads(message)
    header = data.get("header", {})
    code = header.get("code", 0)

    if code != 0:
        print("❌ 出错：", header)
        ws.close()
        return

    payload = data.get("payload", {})
    choices = payload.get("choices", {})
    texts = choices.get("text", [])

    # 有的包不带 content，要先判断
    for item in texts:
        content = item.get("content")
        if content:
            result_text += content
            print(content, end="", flush=True)

    # status=2 表示最后一包
    if header.get("status") == 2:
        print("\n\n✅ 最终回复：", result_text)
        ws.close()


def on_error(ws, error):
    print("⚠️ 错误：", error)


def on_close(ws, code, msg):
    print("\n🔒 连接关闭")


def on_open(ws):
    question = "请帮我写一段温柔的冥想引导词，主题是放松身体。"
    ws.send(gen_req_data(question))


if __name__ == "__main__":
    host = "spark-api.xf-yun.com"
    ws_url = get_auth_url(host, "/v1/x1")
    print("🔗 连接地址：", ws_url)

    ws = websocket.WebSocketApp(
        ws_url,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )
    ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
