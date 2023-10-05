chrome.runtime.onInstalled.addListener((detail) => {
    if (detail.reason === 'install') {
        chrome.tabs.create({ url: 'https://pochocosta.com/extension' });
        chrome.tabs.create({ url: 'https://chat.openai.com', active: true });
    } else {
        chrome.tabs.create({ url: 'https://pochocosta.com/extension' });
    }
});
