const { csrfExemptions } = require('../../src/csrf-exemptions.js');

// 在全局范围声明一个变量，用于存储我们动态导入的核心函数
let generateChatCompletion;

// 必需的init函数
async function init(router) {
    // 1. 动态加载SillyTavern的核心聊天函数
    try {
        const chatCompletionsModule = await import('../../src/endpoints/backends/chat-completions.js');
        generateChatCompletion = chatCompletionsModule.generateChatCompletion;
        console.log('[Godot Middleware] Core function "generateChatCompletion" loaded successfully.');
    } catch (error) {
        console.error('[Godot Middleware] Failed to load core chat function:', error);
        return;
    }

    // 2. 注册CSRF豁免
    csrfExemptions.push('/api/plugins/godot-middleware/send_message');

    // 3. 注册我们的API端点
    router.post('/send_message', async (req, res) => {
        if (typeof generateChatCompletion !== 'function') {
            return res.status(500).json({ status: 'error', message: '核心聊天功能初始化失败' });
        }

        try {
            // 4. 从Godot的请求中解析输入
            const { character_uid, user_input } = req.body;
            if (!character_uid || !user_input) {
                return res.status(400).json({ status: 'error', message: 'character_uid 和 user_input 字段都是必需的' });
            }
            console.log(`[Godot Middleware] 收到Godot请求，角色UID: ${character_uid}, 用户输入: ${user_input}`);

            // 5. 构建符合 generateChatCompletion 规范的请求对象
            const mockRequest = {
                body: {
                    chat_completion_source: "openai", // 假设后端为OpenAI兼容模式
                    model: "gpt-3.5-turbo", // 示例模型，后续可从角色卡或请求中动态获取
                    messages: [
                        { "role": "system", "content": `你正在扮演名为 ${character_uid} 的角色。` },
                        { "role": "user", "content": user_input }
                    ],
                    stream: false,
                    max_tokens: 150,
                    temperature: 0.7,
                },
                socket: { // 模拟socket对象以兼容
                    removeAllListeners: () => {},
                    on: () => {},
                },
                user: req.user, // 传递真实的用户信息，用于读取密钥等
            };

            // 6. 调用SillyTavern的核心函数获取结果
            const result = await generateChatCompletion(mockRequest);

            // 7. 从结果中提取AI回复文本
            const replyText = result?.choices?.[0]?.message?.content ?? 'AI未能生成有效的回复。';
            console.log(`[Godot Middleware] 成功获得LLM回复: ${replyText}`);

            // 8. 将提取出的文本返回给Godot
            res.json({ status: 'success', reply: replyText });

        } catch (error) {
            console.error(`[Godot Middleware] 处理请求时发生错误:`, error);
            res.status(500).json({ status: 'error', message: '内部服务器错误' });
        }
    });

    console.log('[Godot Middleware] 插件初始化完成');
    console.log('[Godot Middleware] API端点: POST /api/plugins/godot-middleware/send_message');
}

async function exit() {
    console.log('[Godot Middleware] 插件正在卸载...');
}

const info = {
    id: 'godot-middleware',
    name: 'Godot Middleware',
    description: '提供API端点给Godot客户端，并实现与AI Service Hub的逻辑交互。'
};

module.exports = {
    init,
    exit,
    info
};
