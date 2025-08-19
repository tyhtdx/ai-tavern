const { URL } = require('url');

async function getLlmReply(userInput) {
    console.log(`[Godot Middleware] 模拟LLM调用，输入: ${userInput}`);
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(`这是AI的回复，你说了: ${userInput}`);
        }, 500);
    });
}

async function load({ expressApp }) {
    expressApp.post('/api/v1/send_message', async (req, res) => {
        try {
            const { user_input } = req.body;

            if (!user_input) {
                console.log('[Godot Middleware] 错误: 缺少 user_input 字段');
                return res.status(400).json({ status: 'error', message: '缺少 user_input 字段' });
            }

            console.log(`[Godot Middleware] 收到Godot请求，用户输入: ${user_input}`);
            const reply = await getLlmReply(user_input);
            console.log(`[Godot Middleware] LLM回复: ${reply}`);

            res.json({ status: 'success', reply: reply });
        } catch (error) {
            console.error(`[Godot Middleware] 处理请求时发生错误: ${error.message}`);
            res.status(500).json({ status: 'error', message: '内部服务器错误' });
        }
    });

    console.log('[Godot Middleware] API端点 /api/v1/send_message 已注册。');
}

module.exports = {
    load
};
