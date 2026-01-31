console.log("Extension Helper Functions")

const ehf = {
  fetch: async (url, options = {}) => {
    const resolvedUrl = new URL(url, (typeof window !== 'undefined' ? window : self).location.origin).href;
    let response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "fetch", url: resolvedUrl, options },
        response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (response.error) {
            reject(response.error);
            return;
          }

          resolve(response);
        }
      );
    });
    return response;
  },
  chrome: async (path, ...args) => {
    let response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "chrome", path, args },
        response => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (response.error) {
            reject(response.error);
            return;
          }

          resolve(response.result);
        }
      );
    });
    return response;
  },
  storage: {
    local: {
      set: async (key, data) => {
        await chrome.storage.local.set({ [key]: data });
      },
      get: async (key, defaultValue = {}) => {
        let response = await new Promise(async (resolve, reject) => {
          let data = await chrome.storage.local.get(key);
          if (key && ghf.is.jsonEmpty(data)) {
            data = defaultValue;
            await ehf.storage.local.set(key, data);
            resolve(data);
          }
          if (key)
            resolve(data[key]);
          resolve(data);
        });
        return response;
      },
    },
  },
};

self.ehf = ehf;
