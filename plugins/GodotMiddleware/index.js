// index.js - 最终、完整、未经删减的生产就绪版本 v3.0

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'node:url';
import extract from 'png-chunks-extract'; // 使用正确的包名

// --- 全局常量与变量 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SILLYTAVERN_DATA_PATH = path.join(process.cwd(), 'data', 'default-user');
const configPath = path.join(__dirname, 'config.json');
let pluginSettings = {};

// --- 辅助函数 ---

async function loadSettings() {
    try {
        const configContent = await fs.readFile(configPath, 'utf8');
        pluginSettings = JSON.parse(configContent);
        console.log('[Godot Middleware] 插件配置已成功加载到内存。');
    } catch (error) {
        console.error('[Godot Middleware] 加载配置文件失败，将使用默认值。', error);
        pluginSettings = { custom_openai_url: "", default_temperature: 0.7, default_max_tokens: 4096 };
    }
}

async function loadCharacterDefinition(characterFilename) {
    const characterFilePath = path.join(SILLYTAVERN_DATA_PATH, 'characters', characterFilename);
    const fileExtension = path.extname(characterFilename).toLowerCase();

    try {
        if (fileExtension === '.json') {
            console.log(`[Godot Middleware] 正在加载 JSON 角色文件: ${characterFilename}`);
            const data = await fs.readFile(characterFilePath, 'utf8');
            return JSON.parse(data);
        }
        else if (fileExtension === '.png') {
            console.log(`[Godot Middleware] 正在加载 PNG 角色卡: ${characterFilename}`);
            const buffer = await fs.readFile(characterFilePath);
            const chunks = extract(buffer);

            // 【关键修正】将 chunk.data 显式转换为字符串再调用 .includes()
            const charaChunk = chunks.find(chunk => chunk.name === 'tEXt' && Buffer.from(chunk.data).toString().includes('chara'));

            if (!charaChunk) {
                throw new Error('在PNG文件中未找到角色数据 (chara chunk)。');
            }

            const base64Data = Buffer.from(charaChunk.data).toString('utf8').split('\0').pop();

            if (base64Data === undefined) {
                throw new Error('PNG 角色卡数据格式不正确，无法提取 Base64 内容。');
            }

            const decodedData = Buffer.from(base64Data, 'base64').toString('utf8');
            return JSON.parse(decodedData);
        }
        else {
            throw new Error(`不支持的角色文件格式: ${fileExtension}`);
        }
    } catch (error) {
        console.error(`[Godot Middleware] 无法加载角色定义 ${characterFilename}: ${error.message}`);
        throw new Error(`无法加载角色定义：${characterFilename}`);
    }
}


async function loadChatHistory(characterId) {
    const chatHistoryDir = path.join(SILLYTAVERN_DATA_PATH, 'chats', characterId);
    try {
        const files = await fs.readdir(chatHistoryDir);
        const chatFiles = files.filter(file => file.endsWith('.jsonl')).sort().reverse();
        if (chatFiles.length === 0) return [];
        const latestChatFile = path.join(chatHistoryDir, chatFiles[0]);
        const data = await fs.readFile(latestChatFile, 'utf8');
        return data.split('\n')
                   .filter(line => line.trim() !== '')
                   .map(line => {
                       try {
                           const msg = JSON.parse(line);
                           return { role: msg.is_user ? 'user' : 'assistant', content: msg.mes };
                       } catch { return null; }
                   })
                   .filter(msg => msg !== null);
    } catch (error) {
        if (error.code === 'ENOENT') { return []; }
        throw new Error(`无法加载聊天历史：${characterId}`);
    }
}

async function loadApiKeys() {
    const secretsFilePath = path.join(SILLYTAVERN_DATA_PATH, 'secrets.json');
    try {
        const data = await fs.readFile(secretsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        throw new Error('无法加载 API 密钥。请确保 secrets.json 存在且可读。');
    }
}

function convertMessagesToGoogleFormat(messages) {
    const contents = [];
    let systemPrompt = null;
    const otherMessages = messages.filter(msg => {
        if (msg.role === 'system') { systemPrompt = msg.content; return false; }
        return true;
    });
    if (systemPrompt && otherMessages.length > 0 && otherMessages[0].role === 'user') {
        otherMessages[0].content = `${systemPrompt}\n\n${otherMessages[0].content}`;
    }
    for (const msg of otherMessages) {
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        });
    }
    return contents;
}

async function generateAIResponse(characterData, chatHistory, userInput, apiKeys, pluginSettings) {
    const system_prompt = characterData.char_persona || "你是一个AI助手。";
    const messages = [
        { role: 'system', content: system_prompt },
        ...chatHistory,
        { role: 'user', content: userInput }
    ];

    const customUrl = pluginSettings.custom_openai_url;
    const customKey = apiKeys.custom_openai;

    if (customUrl && customUrl.trim() !== '') {
        console.log(`[Godot Middleware] 检测到自定义URL: ${customUrl}`);

        // 【关键修正】智能判断并构建最终URL
        let endpointUrl = customUrl.replace(/\/$/, ''); // 先移除末尾可能存在的斜杠
        if (!endpointUrl.endsWith('/chat/completions')) {
            endpointUrl += '/chat/completions'; // 只有当URL不以/chat/completions结尾时，才添加它
        }

        console.log(`[Godot Middleware] 正在向最终的端点地址发送请求: ${endpointUrl}`);

        try {
            const response = await axios.post(endpointUrl, {
                model: 'glm-4.5',
                messages: messages,
                temperature: pluginSettings.default_temperature ?? 0.7,
                max_tokens: pluginSettings.default_max_tokens ?? 4096,
            }, {
                headers: { 'Authorization': `Bearer ${customKey}`, 'Content-Type': 'application/json' }
            });
            return response.data.choices[0].message.content;
        } catch (error) {
            if (error.response) { console.error(`自定义API错误响应: ${JSON.stringify(error.response.data)}`); }
            throw error;
        }
    }

    if (apiKeys.google) {
        const googleApiKey = apiKeys.google;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${googleApiKey}`;
        try {
            const response = await axios.post(url, { contents: convertMessagesToGoogleFormat(messages) }, { headers: { 'Content-Type': 'application/json' } });
            return response.data.candidates[0].content.parts[0].text;
        } catch (error) {
            if (error.response) { console.error(`Google LLM API 错误响应: ${JSON.stringify(error.response.data)}`); }
            throw error;
        }
    }

    if (apiKeys.openai) {
        const openaiApiKey = apiKeys.openai;
        const url = 'https://api.openai.com/v1/chat/completions';
        try {
            const response = await axios.post(url, {
                model: 'gpt-3.5-turbo',
                messages: messages,
                temperature: pluginSettings.default_temperature ?? 0.7,
                max_tokens: pluginSettings.default_max_tokens ?? 4096,
            }, {
                headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' }
            });
            return response.data.choices[0].message.content;
        } catch (error) {
            if (error.response) { console.error(`官方 OpenAI LLM API 错误响应: ${JSON.stringify(error.response.data)}`); }
            throw error;
        }
    }

    throw new Error('在 secrets.json 中未配置任何有效的 API 密钥，且未在插件设置中提供自定义URL。');
}


// --- 插件生命周期函数 ---

const init = async (router) => {
    const apiKeys = await loadApiKeys();
    await loadSettings();

    // **【必需】为UI提供支持的 /settings 路由**
    router.get('/settings', (req, res) => {
        res.json(pluginSettings);
    });

    router.post('/settings', async (req, res) => {
        try {
            const newConfig = { ...pluginSettings, ...req.body };
            await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
            await loadSettings();
            res.json({ success: true, message: '配置已成功保存并应用。' });
        } catch (error) {
            res.status(500).json({ success: false, message: '保存配置失败。' });
        }
    });

    // 用于处理Godot请求的核心路由
    router.post('/send_message', async (req, res) => {
        try {
            const { character_uid, user_input } = req.body;
            const characterFilename = character_uid;
            const characterId = characterFilename.replace(/\.(json|png|webp)$/, '');
            const characterData = await loadCharacterDefinition(characterFilename);
            const history = await loadChatHistory(characterId);
            const aiResponse = await generateAIResponse(characterData, history, user_input, apiKeys, pluginSettings);
            res.json({ success: true, reply: aiResponse });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    console.log('[Godot Middleware] 插件已加载，所有API端点已注册！');
};

const exit = async () => {
    console.log('[Godot Middleware] 插件正在卸载...');
};

const info = {
    id: 'godot-middleware',
    name: 'Godot Middleware',
    description: '连接 Godot 游戏引擎与 SillyTavern AI 对话功能的桥梁插件。',
    version: '3.0.0',
    author: 'Cline',
};

export {
    init,
    exit,
    info,
};
