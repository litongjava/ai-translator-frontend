// apiClient.ts
const BASE_URL = import.meta.env.VITE_BACKEND_URL;
if (!BASE_URL) {
  throw new Error("Missing backend URL in environment variables");
}

/**
 * 创建会话
 */
export async function createSession(params: {
  user_id: string;
  name: string;
  school_id?: number;
  chat_type?: number;
  type?: string;
  app_id?: number | string;
}) {
  const response = await fetch(`${BASE_URL}/api/v1/chat/create`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({school_id: 1, chat_type: 0, ...params}),
  });
  return await response.json();
}

/**
 * 获取会话列表
 */
export async function listSessions(params: {
  user_id?: string;
  offset?: number;
  limit?: number;
  school_id?: number;
  chat_type?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.user_id) searchParams.append("user_id", params.user_id);
  if (params.offset) searchParams.append("offset", params.offset.toString());
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.school_id) searchParams.append("school_id", params.school_id.toString());
  if (params.chat_type !== undefined)
    searchParams.append("chat_type", params.chat_type.toString());
  const response = await fetch(`${BASE_URL}/api/v1/chat/list?${searchParams.toString()}`);
  return await response.json();
}

/**
 * 获取会话历史记录
 */
export async function getHistory(params: { user_id: string, session_id: string; offset?: number; limit?: number }) {
  const searchParams = new URLSearchParams({
    user_id: params.user_id,
    session_id: params.session_id,
    offset: params.offset?.toString() || "1",
    limit: params.limit?.toString() || "100",
  });
  const response = await fetch(`${BASE_URL}/api/v1/chat/history?${searchParams.toString()}`);
  return await response.json();
}
