# SillyTavern 中间件 API 文档

本文档描述了 SillyTavern 作为对话中间件所提供和调用的接口，旨在帮助 Godot 游戏团队和 AI Service Hub 团队进行集成开发。

## 对 Godot 团队接口

### 1. 接收用户消息

SillyTavern 提供一个 API 端点，用于接收 Godot 客户端发送的用户消息。

*   **请求路径**: `/api/v1/send_message`
*   **请求方法**: `POST`
*   **请求体格式**: `application/json`

**请求体示例**:

```json
{
    "user_input": "你好，你是谁？"
}
```

**成功响应示例**:

```json
{
    "status": "success",
    "message": "Message received"
}
```

**错误响应示例**:

```json
{
    "status": "error",
    "message": "user_input field is missing"
}
```

## 对 AI Service Hub 团队接口

### 1. 转发 LLM 回复

SillyTavern 在从大语言模型（LLM）获得最终回复后，会调用 AI Service Hub 的 API 端点，将 LLM 的回复文本转发过去。

*   **请求路径**: `/v1/game/parse-intent`
*   **请求方法**: `POST`
*   **请求体格式**: `application/json`
*   **主机名**: `ai-service-hub.internal` (内部占位符，后续可配置)

**请求体示例**:

```json
{
    "text": "我是[角色名]，一个由[作者]创造的AI。"
}
```

**注意**: 这是一个“即发即忘”（fire-and-forget）的请求，SillyTavern 不会等待 AI Service Hub 的返回结果来阻塞主流程。
