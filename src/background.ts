import browser from 'webextension-polyfill'

browser.runtime.onMessage.addListener(({ data }) => {
  browser.tabs.create({ url: browser.runtime.getURL('index.html?id=' + data.characterId) })
})
