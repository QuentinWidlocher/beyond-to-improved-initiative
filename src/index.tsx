/* @refresh reload */
import { render } from 'solid-js/web'

import browser from 'webextension-polyfill'

import { createSignal, onMount } from 'solid-js'
import { BeyondSchema, convertBeyondToII } from './converter';
import { safeParse } from 'valibot';

import './index.css'

async function getCobaltSessionToken() {
  const cookies = await browser.cookies.getAll({
    name: "cobalt-token",
    domain: ".dndbeyond.com",
  });
  return cookies[0]?.value;
}

function App() {
  const [improvedInitiativeObject, setIIObject] = createSignal<string | null>(null);
  const [beyondObject, setBeyondObject] = createSignal<string | null>(null);

  const [iiCopied, setIICopied] = createSignal<boolean>(false);
  const [beyondCopied, setBeyondCopied] = createSignal<boolean>(false);

  const [error, setError] = createSignal<string | null>(null);

  onMount(async () => {
    const currentCharacterId = new URLSearchParams(location.search).get('id');

    if (currentCharacterId === null) {
      setError('You need to open this page by clicking "Add to Improved Initiative" in the "Manage" drawer of a character in Beyond');
      return;
    }

    const token = await getCobaltSessionToken();
    const rawData = await fetch(`https://character-service.dndbeyond.com/character/v5/character/${currentCharacterId}?includeCustomItems=true`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json());
    const parsed = safeParse(BeyondSchema, rawData.data);

    if (!parsed.success) {
      setError('Failed to convert Beyond data, you should try to try again after refreshing your character page.');
    } else {
      setBeyondObject(JSON.stringify(parsed.output, null, 2));
      const converted = convertBeyondToII(parsed.output);
      setIIObject(JSON.stringify(converted, null, 2));
    }

  })

  return (
    <div class="h-screen overflow-y-hidden p-5">
      {error() ? <section class="alert alert-error aler">
        <h2 class="font-bold">Error</h2>
        <p>{error()}</p>
      </section> : (
        <main class="grid h-full grid-cols-2 gap-5">
          <section class="card bg-base-100 overflow-hidden border-t-4 border-primary shadow-md">
            <div class="card-body gap-5 overflow-hidden">
              <h2 class="card-title font-title flex justify-between">
                <span> Beyond Data (heavy)</span>
                <button class="btn btn-primary" disabled={!beyondObject()} onClick={() => {
                  navigator.clipboard.writeText(beyondObject()!)
                  setBeyondCopied(true);
                  setTimeout(() => setBeyondCopied(false), 2000);
                }}>{beyondCopied() ? 'Copied !' : 'Copy'}</button>
              </h2>
              <div class="collapse bg-base-200 collapse-arrow">
                <input type="checkbox" />
                <div class="collapse-title text-xl font-medium">
                  Show Data (a lot of lines)
                </div>
                <div class="collapse-content overflow-y-auto">
                  <pre class="h-full">{beyondObject()}</pre>
                </div>
              </div>
            </div>
          </section>
          <section class="card bg-base-100 border-t-4 border-primary overflow-hidden shadow-md">
            <div class="card-body gap-5 overflow-hidden">
              <h2 class="card-title font-title flex justify-between">
                <span>Improved Initiative</span>
                <button class="btn btn-primary" disabled={!improvedInitiativeObject()} onClick={() => {
                  navigator.clipboard.writeText(improvedInitiativeObject()!)
                  setIICopied(true);
                  setTimeout(() => setIICopied(false), 2000);
                }}>{iiCopied() ? 'Copied !' : 'Copy'}</button>
              </h2>
              <pre class="h-full overflow-y-auto">{improvedInitiativeObject()}</pre>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}

render(() => <App />, document.getElementById('root')!)
