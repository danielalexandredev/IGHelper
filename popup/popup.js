import { createApp, h } from "../assets/js/vue/3.5.26/vue.runtime.esm-browser.prod.js"

// console.log('popup.js ghf.is.number: ', ghf.is.number(0));
// // var test = ehf.chrome('runtime');
// // console.log(test);
// async function test() {
//   return await ehf.chrome('runtime');
// }
// console.log(test());
// console.log(chrome);

var app = undefined;
createApp({
  data() {
    return {
      platform: {},
    }
  },
  mounted() {
    app = this;
    app.init();
  },
  methods: {
    async init() {
      app.getPlatforms();
    },
    async getPlatforms() {
      let platforms = await ehf.fetch(chrome.runtime.getURL(`assets/json/platform.json`));
      ghf.json.each(platforms, function(platformKey, platformJSON) {
          platformJSON.iconUrl = chrome.runtime.getURL(`assets/images/icons/${platformKey}.ico`);
      });
      app.platform = platforms;
    }
  },
  render() {
    return (() => {
      return ([
        h('h1', { class: 'title', }, 'IG Helper')
      ])
    })();
  },
}).mount('#v-app');