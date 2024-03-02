import { render } from "solid-js/web";
import browser from 'webextension-polyfill'

function waitForElement(selector: string): Promise<Element | null> {
  return new Promise(resolve => {
    const element = document.querySelector(selector);
    if (element != null) {
      return resolve(element);
    }

    const observer = new MutationObserver(_ => {
      const element = document.querySelector(selector);
      if (element != null) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

const root = await waitForElement('.ct-character-manage-pane__intro');

render(() =>
  <div style={{ "margin-top": '10px' }} class="ct-character-manage-pane__feature-callout">
    <button
      style={{ "background-color": 'inherit' }}
      onClick={() => {
        const characterId = window.location.href.split('/').pop()
        browser.runtime.sendMessage({ message: "addCharacter", data: { characterId } })
      }}
      class="ct-character-header-desktop__button ct-character-manage-pane__decorate-button" >
      <span class="ct-character-header-desktop__button-label">Add to Improved Initiative</span>
    </button>
  </div>
  , root!)
