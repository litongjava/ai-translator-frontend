// sseClient.ts
export async function sendSSERequest(options: {
  accessToken: string;
  userId: string;
  sessionId: string;
  messages: any[];
  type?: string;
  app_id?: string;
  chat_type?: number;
  onEvent: (event: { type: string; data: any }) => void;
}) {
  const {
    accessToken,
    userId,
    sessionId,
    messages,
    type = 'general',
    app_id = '',
    chat_type = 0,
    onEvent,
  } = options;

  // 从环境变量中获取后端地址（例如在 .env 文件中配置 REACT_APP_BACKEND_URL）
  const BASE_URL = process.env.REACT_APP_BACKEND_URL;
  if (!BASE_URL) {
    throw new Error("Missing backend URL in environment variables");
  }
  const url = `${BASE_URL}/api/v1/chat/send`;

  // 构造符合后端接口要求的请求体
  const body = {
    user_id: userId,
    session_id: sessionId,
    type, // 如 "general"、"kb" 等
    provider: "openai", // 注意：根据后端要求，可调整为 "opneai"
    school_id: 1, // 如需动态，可修改为传入参数
    app_id,
    messages,
    stream: true,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error("Network response error or empty body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    // 最后一部分可能是不完整的数据，留作下次拼接
    buffer = parts.pop() || "";
    for (const part of parts) {
      const event = parseSSEEvent(part);
      if (event) {
        onEvent(event);
      }
    }
  }
}

function parseSSEEvent(raw: string): { type: string; data: any } | null {
  // 根据 SSE 协议，每个事件块由多行组成，其中以 "event:" 指定事件类型，以 "data:" 指定数据
  const lines = raw.split("\n").map(line => line.trim()).filter(Boolean);
  let eventType = "message";
  let dataStr = "";
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.substring("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataStr += line.substring("data:".length).trim();
    }
  }
  if (dataStr) {
    try {
      return { type: eventType, data: JSON.parse(dataStr) };
    } catch (err) {
      // 非 JSON 格式，直接返回原始字符串
      return { type: eventType, data: dataStr };
    }
  }
  return null;
}
