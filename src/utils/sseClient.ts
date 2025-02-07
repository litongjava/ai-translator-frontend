// 定义消息数据结构，根据业务需要扩展字段
export interface ChatMessage {
  role: string;
  content: string;
}

// 定义 SSE 事件数据结构
export interface SSEEvent {
  type: string;
  data: string; // data 始终以字符串形式返回，由调用者自行解析 JSON 或其它格式
}

export async function sendSSERequest(options: {
  accessToken?: string | null;
  userId: string;
  sessionId: string;
  school_id?: string;
  messages: ChatMessage[];
  type?: string;
  app_id?: string;
  chat_type?: number;
  onEvent: (event: SSEEvent) => void;
}) {
  const {
    type = "general",
    accessToken,
    userId,
    sessionId,
    school_id,
    messages,
    app_id = "",
    chat_type = 0,
    onEvent,
  } = options;

  // 从 Vite 的环境变量中获取后端地址（需在 .env 文件中配置，例如 VITE_BACKEND_URL）
  const BASE_URL = import.meta.env.VITE_BACKEND_URL;
  if (!BASE_URL) {
    throw new Error("Missing backend URL in environment variables");
  }
  const url = `${BASE_URL}/api/v1/chat/send`;

  // 构造符合后端接口要求的请求体，并确保 chat_type 字段被发送
  const body = {
    provider: "openai", // 根据后端要求，如有需要调整为 "opneai"
    model: 'gpt-4o-mini',
    type, // 如 "general"、"kb" 等
    user_id: userId,
    session_id: sessionId,
    school_id: school_id,
    app_id,
    chat_type, // 已添加
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
    const {done, value} = await reader.read();
    if (done) {
      onEvent({type: 'done', data: ""});
      break;
    }
    buffer += decoder.decode(value, {stream: true});
    const parts = buffer.split("\r\n\r\n");
    // 最后一部分可能是不完整的数据，保留到下次拼接
    buffer = parts.pop() || "";
    for (const part of parts) {
      const event = parseSSEEvent(part);
      if (event) {
        onEvent(event);
      }
    }
  }
}

// 解析 SSE 事件，不主动解析 data 为 JSON，由调用者决定
function parseSSEEvent(raw: string): SSEEvent | null {
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
    return {type: eventType, data: dataStr};
  }
  return null;
}
