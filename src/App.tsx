import {Attachments, Bubble, Conversations, Prompts, Sender, useXAgent, useXChat, Welcome,} from '@ant-design/x';

import {createStyles} from 'antd-style';
import React, {useEffect} from 'react';

import {
  CloudUploadOutlined,
  CommentOutlined,
  EllipsisOutlined,
  FireOutlined,
  HeartOutlined,
  OpenAIOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReadOutlined,
  ShareAltOutlined,
  SmileOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {Badge, Button, type GetProp, Space} from 'antd';
import markdownit from 'markdown-it';
import {ChatMessage, sendSSERequest, SSEEvent} from "./utils/sseClient.ts";
import authStore from "./utils/authStore.ts";
import {createSession, getHistory, listSessions} from "./utils/apiClient.ts";
import {MessageStatus} from "@ant-design/x/es/useXChat";

// 定义会话项的类型
interface ConversationItem {
  key: string;    // 根据实际情况选择适当的类型
  label: string;  // 根据实际情况选择适当的类型
}

interface ChatSession {
  id: number;
  name: string;
}

interface ChatHistoryMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  liked: boolean;
  metadata: Record<string, unknown>;
  create_time: string;
}

const md = markdownit({html: true, breaks: true});

// 跟单条 Bubble 的做法一样
const renderMarkdown = (content: string) => (
  <div>
    <div dangerouslySetInnerHTML={{__html: md.render(content)}}/>
  </div>
);

// 渲染标题的辅助函数
const renderTitle = (icon: React.ReactElement, title: string) => (
  <Space align="start">
    {icon}
    <span>{title}</span>
  </Space>
);

// 默认会话列表项
// const defaultConversationsItems = [
//   {
//     key: '0',
//     label: 'New Chat',
//   },
// ];

// 样式定义
const useStyle = createStyles(({token, css}) => {
  return {
    layout: css`
      width: 100%;
      min-width: 1000px;
      height: 100%;
      border-radius: ${token.borderRadius}px;
      display: flex;
      background: ${token.colorBgContainer};
      font-family: AlibabaPuHuiTi, ${token.fontFamily}, sans-serif;

      .ant-prompts {
        color: ${token.colorText};
      }
    `,
    menu: css`
      background: ${token.colorBgLayout}80;
      width: 280px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    conversations: css`
      padding: 0 12px;
      flex: 1;
      overflow-y: auto;
    `,
    chat: css`
      height: 100%;
      width: 100%;
      max-width: 70%;
      margin: 0 auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: ${token.paddingLG}px;
      gap: 16px;
    `,
    messages: css`
      flex: 1;
    `,
    placeholder: css`
      padding-top: 32px;
    `,
    sender: css`
      box-shadow: ${token.boxShadow};
    `,
    logo: css`
      display: flex;
      height: 72px;
      align-items: center;
      justify-content: start;
      padding: 0 24px;
      box-sizing: border-box;

      img {
        width: 24px;
        height: 24px;
        display: inline-block;
      }

      span {
        display: inline-block;
        margin: 0 8px;
        font-weight: bold;
        color: ${token.colorText};
        font-size: 16px;
      }
    `,
    addBtn: css`
      background: #1677ff0f;
      border: 1px solid #1677ff34;
      width: calc(100% - 24px);
      margin: 0 12px 24px 12px;
    `,
  };
});

// 占位符提示项
const placeholderPromptsItems: GetProp<typeof Prompts, 'items'> = [
  {
    key: '1',
    label: renderTitle(<FireOutlined style={{color: '#FF4D4F'}}/>, 'Hot Topics'),
    description: 'What are you interested in?',
    children: [
      {
        key: '1-1',
        description: `How are you`,
      },
      {
        key: '1-2',
        description: `What's AGI?`,
      },
      {
        key: '1-3',
        description: `Where is the doc?`,
      },
    ],
  },
  {
    key: '2',
    label: renderTitle(<ReadOutlined style={{color: '#1890FF'}}/>, 'Design Guide'),
    description: 'How to design a good product?',
    children: [
      {
        key: '2-1',
        icon: <HeartOutlined/>,
        description: `Know the well`,
      },
      {
        key: '2-2',
        icon: <SmileOutlined/>,
        description: `Set the AI role`,
      },
      {
        key: '2-3',
        icon: <CommentOutlined/>,
        description: `Express the feeling`,
      },
    ],
  },
];

// 发送者提示项
const senderPromptsItems: GetProp<typeof Prompts, 'items'> = [
  {
    key: '1',
    description: 'Hot Topics',
    icon: <FireOutlined style={{color: '#FF4D4F'}}/>,
  },
  {
    key: '2',
    description: 'Design Guide',
    icon: <ReadOutlined style={{color: '#1890FF'}}/>,
  },
];

// 定义消息角色
const roles: GetProp<typeof Bubble.List, 'roles'> = {
  ai: {
    placement: 'start',
    typing: {step: 5, interval: 20},
    variant: 'shadow',
    styles: {
      content: {
        borderRadius: 16,
        fontSize: 15,
      },
    },

  },
  aiHistroy: {
    placement: 'start',
    variant: 'shadow',
    styles: {
      content: {
        borderRadius: 16,
        fontSize: 15,
      },
    },
  },
  local: {
    placement: 'end',
    variant: 'shadow',
    styles: {
      content: {
        fontSize: 15,
      }
    }
  },
};

const Independent: React.FC = () => {
  // ==================== 样式 ====================
  const {styles} = useStyle();

  // ==================== 状态 ====================
  const [headerOpen, setHeaderOpen] = React.useState(false);
  const [content, setContent] = React.useState('');
  const [conversationsItems, setConversationsItems] = React.useState<ConversationItem[]>([]);
  const [activeKey, setActiveKey] = React.useState('0');
  const activeKeyRef = React.useRef('0');
  const [attachedFiles, setAttachedFiles] = React.useState<GetProp<typeof Attachments, 'items'>>(
    [],
  );
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  const buildActiveKey = (sessionId: string) => {
    activeKeyRef.current = sessionId;
  }
  // ==================== 运行时逻辑 ====================
  const [agent] = useXAgent({
    request: async ({message}, {onSuccess, onUpdate, onError}) => {
      if (!message) return;
      let accumulatedContent = "";
      const sessionId = activeKeyRef.current;
      try {
        const accessToken = authStore.token;
        const userId = authStore.user.uid;
        const messagesPayload: ChatMessage[] = [{role: "user", content: message}];

        await sendSSERequest({
          accessToken,
          userId,
          sessionId,
          messages: messagesPayload,
          type: "translator", // 可根据业务需要修改
          onEvent: (event: SSEEvent) => {
            //console.log("SSE Event:", event);
            if (event.type === "delta") {
              // 注意：这里假设 event.data 是字符串内容
              const dataObj = JSON.parse(event.data)
              accumulatedContent += dataObj.content;
              onUpdate(accumulatedContent);
            } else if (event.type === "done") {
              onSuccess(accumulatedContent);
            } else {
              console.log(`Received event type ${event.type} with data: ${event.data}`);
            }
          },
        });
      } catch (error) {
        console.error("SSE Request Error:", error);
        onError(error as Error);
        onSuccess((error as Error).message);
      }
    },
  });


  const {onRequest, messages, setMessages} = useXChat({agent});

  const fetchHistory = async (sessionId: string) => {
    setLoadingHistory(true);
    try {
      const response = await getHistory({user_id: authStore.user.uid, session_id: sessionId, offset: 1, limit: 100});
      if (response.ok) {
        const history: ChatHistoryMessage[] = response.data;
        const newMessages = history.map((msg: ChatHistoryMessage) => ({
          id: msg.id.toString(),
          message: msg.content,
          // 注意：将接口中的角色映射到 UI 中定义的角色
          status: (msg.role === 'assistant' ? 'aiHistory' : 'local') as MessageStatus,
          isHistory: msg.role === 'assistant',  // 助手消息标记为历史消息
        }));
        setMessages(newMessages);
      } else {
        console.error("获取历史记录失败", response);
      }
    } catch (err) {
      console.error("调用 getHistory 接口出错", err);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeKey !== undefined) {
      setMessages([]);
    }
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const userId = authStore.user.uid;
        const response = await listSessions({user_id: userId});
        if (response.ok) {
          // 将会话数据转换为 Conversations 组件所需要的格式
          const sessions = response.data;
          const items = sessions.map((session: ChatSession) => ({
            key: session.id.toString(),
            label: session.name,
          }));
          setConversationsItems(items);
        } else {
          console.error("获取会话列表失败", response);
        }
      } catch (err) {
        console.error("调用 listSessions 接口出错", err);
      }
    };

    fetchSessions();
  }, []);

  // ==================== 事件处理 ====================
  const onSubmit = async (nextContent: string) => {
    if (!nextContent) return;
    // 如果当前 activeKey 为 "0"，说明还没有创建真正的会话，则使用用户输入的文字作为会话名称
    if (activeKeyRef.current === "0") {
      const userId = authStore.user.uid;
      try {
        const response = await createSession({user_id: userId, name: nextContent});
        if (response.ok) {
          const newSession = response.data;

          const sessionId = newSession.id.toString();
          buildActiveKey(sessionId);
          setConversationsItems([
            {key: sessionId, label: newSession.name},
            ...conversationsItems,
          ]);
        } else {
          console.error("创建会话失败", response);
          return;
        }
      } catch (err) {
        console.error("调用 createSession 接口出错", err);
        return;
      }
    }

    // 发送消息
    onRequest(nextContent);
    setContent("");
  };


  const onPromptsItemClick: GetProp<typeof Prompts, 'onItemClick'> = async (info) => {
    if (activeKeyRef.current === '0') {
      const response = await createSession({user_id: authStore.user.uid, name: info.data.description as string});
      if (response.ok) {
        const newSession = response.data;

        const sessionId = newSession.id.toString();
        buildActiveKey(sessionId);
        setConversationsItems([
          {key: sessionId, label: newSession.name},
          ...conversationsItems,
        ]);
      } else {
        console.error("创建会话失败", response);
        return;
      }
    }
    onRequest(info.data.description as string);
  };

  const onAddConversation = async () => {
    const userId = authStore.user.uid;
    try {
      const response = await createSession({user_id: userId, name: "New Chat"});
      if (response.ok) {
        const newSession = response.data;

        const sessionId = newSession.id.toString();
        buildActiveKey(sessionId);
        setActiveKey(sessionId);
        setConversationsItems([
          {key: sessionId, label: newSession.name},
          ...conversationsItems,
        ]);
      } else {
        console.error("创建会话失败", response);
        return;
      }
    } catch (err) {
      console.error("调用 createSession 接口出错", err);
      return;
    }
  };

  const onConversationClick: GetProp<typeof Conversations, 'onActiveChange'> = (key) => {
    setActiveKey(key);
    activeKeyRef.current = key;
    fetchHistory(key);
  };

  const handleFileChange: GetProp<typeof Attachments, 'onChange'> = (info) =>
    setAttachedFiles(info.fileList);

  // ==================== 节点 ====================
  const placeholderNode = (
    <Space direction="vertical" size={16} className={styles.placeholder}>
      <Welcome
        variant="borderless"
        icon="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*s5sNRo5LjfQAAAAAAAAAAAAADgCCAQ/fmt.webp"
        title="Hello, I'm Ant Design X"
        description="基于 Ant Design，AGI 产品界面解决方案，创造更智能的视觉体验~"
        extra={
          <Space>
            <Button icon={<ShareAltOutlined/>}/>
            <Button icon={<EllipsisOutlined/>}/>
          </Space>
        }
      />
      <Prompts
        title="Do you want?"
        items={placeholderPromptsItems}
        styles={{
          list: {
            width: '100%',
          },
          item: {
            flex: 1,
          },
        }}
        onItemClick={onPromptsItemClick}
      />
    </Space>
  );

  const items = messages.map((e) => {
    const {message, id, status, isHistory} = e as {
      message: string;
      id: string;
      status: MessageStatus;
      isHistory?: boolean;
    };
    //console.log("e:", e);
    const role = status === 'local' ? 'local' : 'ai';
    if (status === 'local') {
      return ({
        key: id,
        //loading: status === 'loading',
        role: role,
        messageRender: renderMarkdown,
        content: message,
        avatar: {icon: <UserOutlined/>}
      })
    } else if (isHistory) {
      return {
        key: id,
        role: 'aiHistroy',
        messageRender: renderMarkdown,
        content: message,
        avatar: {icon: <OpenAIOutlined/>},
      };
    } else {
      return ({
        key: id,
        //loading: status === 'loading',
        role: role,
        messageRender: renderMarkdown,
        content: message,
        avatar: {icon: <OpenAIOutlined/>}
      })
    }

  });

  const attachmentsNode = (
    <Badge dot={attachedFiles.length > 0 && !headerOpen}>
      <Button type="text" icon={<PaperClipOutlined/>} onClick={() => setHeaderOpen(!headerOpen)}/>
    </Badge>
  );

  const senderHeader = (
    <Sender.Header
      title="Attachments"
      open={headerOpen}
      onOpenChange={setHeaderOpen}
      styles={{
        content: {
          padding: 0,
        },
      }}
    >
      <Attachments
        beforeUpload={() => false}
        items={attachedFiles}
        onChange={handleFileChange}
        placeholder={(type) =>
          type === 'drop'
            ? {title: 'Drop file here'}
            : {
              icon: <CloudUploadOutlined/>,
              title: 'Upload files',
              description: '点击或拖拽文件到此区域进行上传',
            }
        }
      />
    </Sender.Header>
  );

  const logoNode = (
    <div className={styles.logo}>
      <img
        src="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*eco6RrQhxbMAAAAAAAAAAAAADgCCAQ/original"
        draggable={false}
        alt="logo"
      />
      <span>Ant Design X</span>
    </div>
  );

  // ==================== 渲染 ====================
  return (
    <div className={styles.layout}>
      <div className={styles.menu}>
        {/* 🌟 Logo */}
        {logoNode}
        {/* 🌟 添加会话 */}
        <Button
          onClick={onAddConversation}
          type="link"
          className={styles.addBtn}
          icon={<PlusOutlined/>}
        >
          New Conversation
        </Button>
        {/* 🌟 会话管理 */}
        <Conversations
          items={conversationsItems}
          className={styles.conversations}
          activeKey={activeKey}
          onActiveChange={onConversationClick}
        />
      </div>
      <div className={styles.chat}>
        {/* 🌟 消息列表 */}
        <Bubble.List
          items={
            loadingHistory
              ? [{content: <div style={{padding: '16px', textAlign: 'center'}}>加载中...</div>, variant: 'borderless'}]
              : (items.length > 0 ? items : [{content: placeholderNode, variant: 'borderless'}])
          }
          roles={roles}
          className={styles.messages}
        />
        {/* 🌟 提示词 */}
        <Prompts items={senderPromptsItems} onItemClick={onPromptsItemClick}/>
        {/* 🌟 输入框 */}
        <Sender
          value={content}
          header={senderHeader}
          onSubmit={onSubmit}
          onChange={setContent}
          prefix={attachmentsNode}
          loading={agent.isRequesting()}
          className={styles.sender}
        />
      </div>
    </div>
  );
};


export default Independent;
