// A very small Chrome driver over the DevTools protocol, shared by the verification scripts.
//
// There is no browser automation library in this repository and none is wanted for three scripts:
// Chrome speaks a JSON protocol over a WebSocket, and Node 22 has a WebSocket client built in.
// What is here is only what the checks need — open a tab, go to an address, run an expression in
// the page, send a real key, read the console — and nothing else.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function chromeExecutable() {
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `No Chrome found. Tried:\n  ${candidates.join('\n  ')}\nSet CHROME_PATH to the executable.`,
    );
  }
  return found;
}

export async function launchChrome({ port = 9333, headless = true, windowSize } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'playhoot-verify-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    // The checks drive a local host over plain HTTP; nothing here touches a real site.
    '--allow-insecure-localhost',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');
  if (windowSize) args.unshift(`--window-size=${windowSize}`);
  const child = spawn(chromeExecutable(), args, { stdio: 'ignore' });

  const endpoint = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`).catch(() => null);
    if (!response?.ok) return null;
    return (await response.json()).webSocketDebuggerUrl;
  }, 'Chrome did not open its debugging port');

  const browser = await connect(endpoint);
  return {
    browser,
    async close() {
      browser.close();
      child.kill();
      await new Promise((resolve) => setTimeout(resolve, 200));
      fs.rmSync(profile, { recursive: true, force: true });
    },
    async newPage() {
      const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = list.find((entry) => entry.id === targetId);
      return openPage(await connect(target.webSocketDebuggerUrl));
    },
  };
}

async function waitFor(attempt, message, { tries = 100, interval = 100 } = {}) {
  for (let index = 0; index < tries; index += 1) {
    const value = await attempt();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(message);
}

function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  const listeners = new Set();
  let nextId = 1;

  const api = {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      socket.close();
    },
  };

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(api));
    socket.addEventListener('error', () => reject(new Error(`Cannot reach ${endpoint}`)));
  });
}

function openPage(session) {
  const console_ = [];
  session.on((message) => {
    if (message.method === 'Runtime.consoleAPICalled') {
      console_.push({
        level: message.params.type,
        text: message.params.args
          .map((argument) => argument.value ?? argument.description ?? '')
          .join(' '),
      });
    }
    if (message.method === 'Runtime.exceptionThrown') {
      console_.push({
        level: 'exception',
        text: message.params.exceptionDetails.exception?.description ?? 'exception',
      });
    }
  });

  const page = {
    session,
    console: console_,
    clearConsole() {
      console_.length = 0;
    },

    async ready() {
      await session.send('Page.enable');
      await session.send('Runtime.enable');
      await session.send('DOM.enable');
      return page;
    },

    async goto(url, { waitFor: expression = 'document.readyState === "complete"' } = {}) {
      await session.send('Page.navigate', { url });
      await page.waitFor(expression);
      return page;
    },

    // Runs `expression` in the page and returns its value. An expression that returns a promise
    // is awaited.
    async evaluate(expression) {
      const result = await session.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
        );
      }
      return result.result.value;
    },

    // `expression` may evaluate to a promise; it is awaited either way, so a condition that has
    // to ask the browser something asynchronous (a service worker registration, a cache) is
    // written the same as one that does not.
    async waitFor(expression, { tries = 150, interval = 100 } = {}) {
      return waitFor(
        () => page.evaluate(`Promise.resolve(${expression}).then((v) => !!v)`).catch(() => false),
        `Timed out waiting for: ${expression}`,
        { tries, interval },
      );
    },

    // A real click at the element's centre, so anything listening for a pointer sees one.
    async click(selector) {
      const box = await page.evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (!element) return null;
        element.scrollIntoView({ block: 'center' });
        const rectangle = element.getBoundingClientRect();
        return { x: rectangle.x + rectangle.width / 2, y: rectangle.y + rectangle.height / 2 };
      })()`);
      if (!box) throw new Error(`No element matches ${selector}`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await session.send('Input.dispatchMouseEvent', {
          type,
          x: box.x,
          y: box.y,
          button: 'left',
          clickCount: 1,
        });
      }
    },

    async type(text) {
      for (const character of text) {
        await session.send('Input.dispatchKeyEvent', { type: 'keyDown', text: character });
        await session.send('Input.dispatchKeyEvent', { type: 'keyUp', text: character });
      }
    },

    // A key that types a character (Enter, Space) needs it sent with the press, or a button or
    // checkbox focused at the time is never activated.
    async key(key, { code = key, windowsVirtualKeyCode, text } = {}) {
      const base = { key, code, ...(windowsVirtualKeyCode ? { windowsVirtualKeyCode } : {}) };
      const down = text ? { type: 'keyDown', text, unmodifiedText: text } : { type: 'rawKeyDown' };
      await session.send('Input.dispatchKeyEvent', { ...down, ...base });
      await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },

    // Cuts the tab off the network, the way losing a connection does: requests fail, nothing is
    // answered from a cache that would not have answered anyway.
    async setOffline(offline) {
      await session.send('Network.enable');
      await session.send('Network.emulateNetworkConditions', {
        offline,
        latency: 0,
        downloadThroughput: offline ? 0 : -1,
        uploadThroughput: offline ? 0 : -1,
      });
    },

    async resize(width, height) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
    },
  };
  return page.ready();
}

export { waitFor };
