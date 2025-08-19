# `generateChatCompletion` 函数调用指南

本文档旨在提供关于如何调用 `src/endpoints/backends/chat-completions.js` 文件中导出的 `generateChatCompletion` 异步函数的简要指南。

## 函数签名

```javascript
export async function generateChatCompletion(request) {
    // ...
}
```

## 参数说明

`generateChatCompletion` 函数接收一个 `request` 对象作为参数，该对象模拟了 Express.js 的 `Request` 对象，其 `body` 属性包含了调用 AI 模型所需的所有配置和数据。

`request.body` 中需要包含的关键字段如下：

*   **`chat_completion_source`** (字符串, **必需**): 指定要使用的 AI 服务提供商。
    *   常见值包括：`"openai"`, `"claude"`, `"openrouter"`, `"custom"`, `"makersuite"`, `"vertexai"`, `"mistralai"`, `"cohere"`, `"deepseek"`, `"aimlapi"`, `"xai"`, `"perplexity"`, `"groq"`, `"nanogpt"`, `"zerooneai"`, `"pollinations"`。
*   **`model`** (字符串, **必需**): 指定要使用的 AI 模型名称。例如：`"gpt-3.5-turbo"`, `"glm-4.5"`, `"claude-3-opus-20240229"` 等。
*   **`messages`** (数组, **必需**): 聊天消息历史记录，遵循 OpenAI 消息格式。
    ```javascript
    [
        { "role": "system", "content": "你是一个有用的助手。" },
        { "role": "user", "content": "你好，世界！" }
    ]
    ```
*   **`stream`** (布尔值, **可选**, 默认为 `false`): 如果为 `true`，则启用流式响应。
*   **`max_tokens`** (数字, **可选**): 生成的最大 token 数量。
*   **`temperature`** (数字, **可选**): 控制生成文本的随机性。
*   **`top_p`** (数字, **可选**): 控制生成文本的多样性。
*   **`top_k`** (数字, **可选**): 仅适用于某些模型，控制采样时考虑的最高概率 token 数量。
*   **`stop`** (数组, **可选**): 停止序列，当模型生成这些序列时停止生成。
*   **`json_schema`** (对象, **可选**): 用于强制模型生成 JSON 格式响应的 JSON Schema。
    ```javascript
    {
        "name": "my_json_schema",
        "description": "A well-formed JSON object.",
        "value": {
            "type": "object",
            "properties": {
                "key": { "type": "string" }
            }
        }
    }
    ```
*   **`enable_web_search`** (布尔值, **可选**): 启用模型的网络搜索能力（如果模型支持）。
*   **`reasoning_effort`** (字符串, **可选**): 控制模型的推理努力程度（如果模型支持）。

### 自定义 API 源的额外字段 (`chat_completion_source: "custom"`)

当 `chat_completion_source` 设置为 `"custom"` 时，`request.body` 还需要包含以下字段：

*   **`custom_url`** (字符串, **必需**): 自定义 API 端点 URL。
*   **`proxy_password`** (字符串, **必需**): 自定义 API 的密钥。
*   **`custom_include_headers`** (对象, **可选**): 要包含在请求头中的额外自定义头。
*   **`custom_include_body`** (对象, **可选**): 要包含在请求体中的额外自定义参数。
*   **`custom_exclude_body`** (对象, **可选**): 要从请求体中排除的参数。

## 返回类型

`generateChatCompletion` 函数根据 `stream` 参数的值返回不同类型的结果：

*   **非流式响应 (`stream: false`)**:
    *   成功时，返回一个 JSON 对象，通常遵循 OpenAI Chat Completion API 的响应格式，包含 `choices` 数组和生成的文本内容。
    *   示例：`{ choices: [{ message: { content: "你好！很高兴见到你。" } }], ... }`
*   **流式响应 (`stream: true`)**:
    *   成功时，返回一个原始的 `node-fetch` `Response` 对象。此对象包含一个可读流 (`response.body`)，可以用于将流式数据直接管道传输到客户端。

## 错误处理

如果发生错误（例如 API 密钥缺失、网络通信失败、AI 模型返回错误等），`generateChatCompletion` 函数将抛出一个 `Error` 对象。调用者应该使用 `try...catch` 块来捕获和处理这些错误。

## 使用示例 (Node.js)

以下是如何在 Node.js 环境中调用 `generateChatCompletion` 函数的示例：

```javascript
import { generateChatCompletion } from './src/endpoints/backends/chat-completions.js'; // 假设您的文件路径正确

async function callChatCompletion() {
    const mockRequest = {
        body: {
            chat_completion_source: "custom",
            custom_url: "https://open.bigmodel.cn/api/paas/v4",
            proxy_password: "YOUR_API_KEY_HERE", // 替换为您的实际密钥
            model: "glm-4.5",
            messages: [
                {
                    "role": "system",
                    "content": "你是一个有用的助手。"
                },
                {
                    "role": "user",
                    "content": "你好，世界！"
                }
            ],
            stream: false, // 设置为 true 以测试流式响应
            max_tokens: 100,
            temperature: 0.7,
            top_p: 1
        },
        // 模拟 Express request 对象的 socket 属性，用于 AbortController
        socket: {
            removeAllListeners: () => {},
            on: (event, listener) => {},
        }
    };

    try {
        const result = await generateChatCompletion(mockRequest);

        if (mockRequest.body.stream) {
            // 处理流式响应
            console.log("接收到流式响应...");
            result.body.on('data', (chunk) => {
                process.stdout.write(chunk.toString());
            });
            result.body.on('end', () => {
                console.log("\n流式响应结束。");
            });
        } else {
            // 处理非流式 JSON 响应
            console.log("接收到非流式响应:", JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.error("调用 generateChatCompletion 失败:", error.message);
    }
}

// 调用函数
callChatCompletion();
