/* global toastr, console, document, fetch, SillyTavern, HTMLInputElement */

(function () {
    const extensionId = 'godot-middleware-ui';
    const extensionName = 'Godot Middleware Settings';
    const pluginApiUrl = '/api/plugins/godot-middleware/settings';

    // Helper to show toastr messages
    function showToast(message, type = 'info') {
        if (typeof toastr !== 'undefined') {
            toastr[type](message);
        } else {
            console.log(`Toast (${type}): ${message}`);
        }
    }

    // Helper functions to safely get input values
    function getInputValue(id, defaultValue = '') {
        const element = document.getElementById(id);
        if (element instanceof HTMLInputElement) {
            return element.value;
        }
        return defaultValue;
    }

    function getFloatValue(id, defaultValue = 0.0) {
        const value = getInputValue(id, String(defaultValue));
        return parseFloat(value);
    }

    function getIntValue(id, defaultValue = 0) {
        const value = getInputValue(id, String(defaultValue));
        return parseInt(value, 10);
    }

    // Function to create the settings UI
    function createSettingsUI(currentSettings) {
        const settingsHtml = `
            <div id="${extensionId}-settings" class="st-settings-panel">
                <h2>${extensionName}</h2>
                <div class="form-group">
                    <label for="aigc_api_url">AIGC API URL:</label>
                    <input type="text" id="aigc_api_url" class="text_pole" value="${currentSettings.aigc_api_url || ''}">
                </div>
                <div class="form-group">
                    <label for="nakama_api_url">Nakama API URL:</label>
                    <input type="text" id="nakama_api_url" class="text_pole" value="${currentSettings.nakama_api_url || ''}">
                </div>
                <div class="form-group">
                    <label for="ai_service_url">AI Service URL:</label>
                    <input type="text" id="ai_service_url" class="text_pole" value="${currentSettings.ai_service_url || ''}">
                </div>
                <div class="form-group">
                    <label for="default_temperature">Default Temperature:</label>
                    <input type="number" step="0.1" id="default_temperature" class="text_pole" value="${currentSettings.default_temperature || 0.7}">
                </div>
                <div class="form-group">
                    <label for="default_max_tokens">Default Max Tokens:</label>
                    <input type="number" step="1" id="default_max_tokens" class="text_pole" value="${currentSettings.default_max_tokens || 200}">
                </div>
                <button id="${extensionId}-save-button" class="menu_button">保存设置</button>
            </div>
        `;

        // Append to the settings panel (assuming there's a main settings container)
        // You might need to adjust this selector based on SillyTavern's actual DOM structure
        const settingsContainer = document.getElementById('extensions_settings');
        if (settingsContainer) {
            settingsContainer.insertAdjacentHTML('beforeend', settingsHtml);
        } else {
            console.error('Settings container not found. UI might not be rendered.');
            document.body.insertAdjacentHTML('beforeend', settingsHtml); // Fallback for testing
        }

        // Attach save event listener
        const saveButton = document.getElementById(`${extensionId}-save-button`);
        if (saveButton) {
            saveButton.addEventListener('click', saveSettings);
        } else {
            console.error('Save button not found.');
        }
    }

    // Function to load settings from the server
    async function loadSettings() {
        try {
            const response = await fetch(pluginApiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const settings = await response.json();
            createSettingsUI(settings);
            showToast('设置已加载。', 'success');
        } catch (error) {
            console.error('加载设置失败:', error);
            createSettingsUI({}); // Render with default empty values on error
            showToast(`加载设置失败: ${error.message}`, 'error');
        }
    }

    // Function to save settings to the server
    async function saveSettings() {
        const newSettings = {
            aigc_api_url: getInputValue('aigc_api_url'),
            nakama_api_url: getInputValue('nakama_api_url'),
            ai_service_url: getInputValue('ai_service_url'),
            default_temperature: getFloatValue('default_temperature', 0.7),
            default_max_tokens: getIntValue('default_max_tokens', 200),
        };

        try {
            const response = await fetch(pluginApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newSettings),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || response.statusText}`);
            }

            const result = await response.json();
            showToast(result.message || '设置已成功保存。', 'success');
        } catch (error) {
            console.error('保存设置失败:', error);
            showToast(`保存设置失败: ${error.message}`, 'error');
        }
    }

    // Ensure the logic runs after SillyTavern is fully loaded
    if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
        SillyTavern.getContext(() => {
            console.log(`[${extensionName}] UI Extension loaded.`);
            loadSettings();
        });
    } else {
        console.error('SillyTavern context not available. Running loadSettings directly (for development).');
        loadSettings(); // Fallback for direct browser testing without SillyTavern
    }
})();
