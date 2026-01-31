chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action } = message;

  switch (action) {
    case "fetch":
      handle.fetch(message, sendResponse);
      return true;

    case "chrome":
      handle.chrome(message, sendResponse);
      return true;

    default:
      sendResponse({ error: `Unknown action: ${action}` });
      return false;
  }
});

const handle = {
  fetch: async(message, sendResponse) => {
    try {
      const url = message.url;
      const options = message.options || {};

      const defaultOptions = {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      };

      const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...(options.headers || {})
        },
      };

      if (finalOptions.body && typeof finalOptions.body === "object") {
        finalOptions.body = JSON.stringify(finalOptions.body);
      }

      const res = await fetch(url, finalOptions);
      let bodyText = null;
      let bodyJson = null;

      try {
        bodyText = await res.text();
        try {
          bodyJson = JSON.parse(bodyText);
        } catch {
          bodyJson = null;
        }
      } catch (err) {
        bodyText = null;
      }

      if (!res.ok) {
        const errorMsg = `Request failed: ${res.status} ${bodyText || ''}`;
        if (message.force) return { error: errorMsg };
        else return sendResponse({ error: errorMsg });
      }

      if (message.force) return bodyJson ?? bodyText;
      else sendResponse(bodyJson ?? bodyText);
    } catch (err) {
      if (message.force) { return { error: err?.message || err }; }
      else { sendResponse({ error: err?.message || err }); }
    }
  },
  chrome: async(message, sendResponse) => {
    const { path, args = [] } = message;

    try {
      const parts = path.split(".");
      let target = chrome;
      let parent = chrome;

      for (const part of parts) {
        if (!(part in target)) {
          if (message.force) { return { error: `chrome.${path} does not exist` }; }
          else { sendResponse({ error: `chrome.${path} does not exist` }); }
          return;
        }
        parent = target;
        target = target[part];
      }

      if (typeof target !== "function") {
        if (message.force) { return { result: target }; }
        else { sendResponse({ result: target }); }
        return;
      }

      target.call(parent, ...args, result => {
        if (chrome.runtime.lastError) {
          if (message.force) { return { error: chrome.runtime.lastError.message }; }
          else { sendResponse({ error: chrome.runtime.lastError.message }); }
          return;
        }
        if (message.force) { return { result }; }
        else { sendResponse({ result }); }
      });
    } catch (err) {
      if (message.force) { return { error: err?.message || err }; }
      else { sendResponse({ error: err?.message || err }); }
    }
  },
}

self.handle = handle;
