import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLUGIN_ID = 'godot-middleware';

// 核心编排函数，但现在它直接从 req 对象获取设置
async function handleGodotRequest(req, character_uid, user_input) {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configContent = await fs.readFile(configPath, 'utf8');
        const pluginSettings = JSON.parse(configContent);

        const { aigc_api_url, nakama_api_url, ai_service_url, default_temperature, default_max_tokens } = pluginSettings;
        if (!aigc_api_url || !nakama_api_url || !ai_service_url) {
            throw new Error('插件配置不完整，请检查相关API地址。');
        }

        const [characterData, nakamaStatus] = await Promise.all([
            fetch(`${aigc_api_url}/characters/${character_uid}`).then(res => res.json()),
            fetch(`${nakama_api_url}/status/${character_uid}`).then(res => res.json()),
        ]);

        const fullContext = {
            character_info: characterData,
            nakama_status: nakamaStatus,
            user_input: user_input,
            chat_history: [{ role: 'user', content: user_input }],
            temperature: default_temperature,
            max_tokens: default_max_tokens,
        };

        const aiServiceResponse = await fetch(ai_service_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullContext),
        });

        if (!aiServiceResponse.ok) {
            const errorText = await aiServiceResponse.text();
            throw new Error(`AI Service call failed: ${aiServiceResponse.statusText} - ${errorText}`);
        }

        const aiServiceJson = await aiServiceResponse.json();

        if (aiServiceJson && aiServiceJson.reply) {
            return { success: true, reply: aiServiceJson.reply };
        } else {
            throw new Error('AI Service 返回的响应格式不正确。');
        }
    } catch (error) {
        console.error(`[Godot Middleware] 编排错误: ${error.message}`);
        throw error;
    }
}

// init函数现在只接收router，这是我们已验证的正确签名
const init = async (router) => {
    router.post('/send_message', async (req, res) => {
        try {
            const { character_uid, user_input } = req.body;
            if (!character_uid || !user_input) {
                return res.status(400).json({ success: false, message: '缺少 character_uid 或 user_input。' });
            }

            // 将完整的 req 对象传递给核心函数，以便它能访问用户设置
            const result = await handleGodotRequest(req, character_uid, user_input);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/settings', async (req, res) => {
        try {
            const configPath = path.join(__dirname, 'config.json');
            const configContent = await fs.readFile(configPath, 'utf8');
            res.json(JSON.parse(configContent));
        } catch (error) {
            console.error(`[Godot Middleware] 读取配置失败: ${error.message}`);
            res.status(500).json({ success: false, message: '读取配置失败。' });
        }
    });

    router.post('/settings', async (req, res) => {
        try {
            const configPath = path.join(__dirname, 'config.json');
            const newConfig = req.body;
            await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
            res.json({ success: true, message: '配置已成功保存。' });
        } catch (error) {
            console.error(`[Godot Middleware] 保存配置失败: ${error.message}`);
            res.status(500).json({ success: false, message: '保存配置失败。' });
        }
    });

    console.log('[Godot Middleware] 插件初始化完成');
    console.log('[Godot Middleware] API端点: POST /api/plugins/godot-middleware/send_message');
};

const exit = async () => {
    console.log('GodotMiddleware 插件正在退出。');
};

const info = {
    id: 'godot-middleware',
    name: 'GodotMiddleware',
    description: '连接 Godot、AIGC Bounty 平台和 Nakama 游戏服务器的核心编排器。',
    version: '1.0.0',
    author: 'Cline',
};

export {
    init,
    exit,
    info,
};
