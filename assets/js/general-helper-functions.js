console.log("General Helper Functions")

const ghf = {
  is: {
    text: (value) => { /* Returns a bool indicating whether the value is a text. */
      return (typeof value === 'string' || value instanceof String)
    },
    number: (value) => { /* Returns a bool indicating whether the value is a number. */
      if (ghf.is.text(value))
        value = ghf.replace(value, ',', '.');
      let float = parseFloat(value);
      return (!isNaN(float) && float == value);
    },
    array: (value) => { /* Returns a bool indicating whether the value is an array. */
      return Array.isArray(value);
    },
    json: (value) => { /* Returns a bool indicating whether the value is a JSON. */
      return (value !== undefined && value !== null && value.constructor === Object);
    },
    date: (value) => { /* Returns a bool indicating whether the value is a date. */
      return value && {}.toString.call(value) === '[object Date]';
    },
    function: (value) => { /* Returns a bool indicating whether the value is a function. */
      return typeof value === 'function';
    },
    boolean: (value) => { /* Returns a bool indicating whether the value is a boolean. */
      return (value === true || value === false);
    },
    file: (value) => { /* Returns a bool indicating whether the value is a file. */
      return (value !== undefined && value !== null && value.constructor === File);
    },
    numberWhole: (value) => { /* Returns a bool indicating whether the value is a whole number. */
      if (!ghf.is.number(value))
          return false;
      value = parseFloat(value);
      return !((value - Math.floor(value)) !== 0);
    },
    jsonEmpty: (value) => { /* Returns whether a json is empty */
      if (ghf.is.json(value))
          return Object.keys(value).length === 0;
      return true;
    },
    mobile: () => { /* Returns a bool indicating whether the current device is mobile */
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
        return true
      else
        return false
    },
  },
  number: (value) => { /* Converts a value to a number. */
    if (value === '')
        return 0;
    if (ghf.is.text(value))
        value = ghf.replace(value, ',', '.');
    var val = parseFloat(value);
    val = isNaN(val) ? 0 : val;
    return val;
  },
  percentage: (value, total, decimals) => { /* Returns percentage of value relative to total */
    if ((value === undefined || !ghf.is.number(value)) || (total === undefined || !ghf.is.number(total)))
        return 0;
    if (decimals === undefined || !ghf.is.number(decimals))
        decimals = 0;
    return parseFloat(((ghf.number(value) * 100) / ghf.number(total)).toFixed(ghf.number(decimals)));
  },
  each: (array, handler) => { /* Loops through an array, running an handler (value, index, array) for each item. */
    if (array === null)
      array = [];
    else if (!ghf.is.array(array))
      array = [array];
    let status;
    for (let i = 0; i < array.length; i++) {
      status = handler(array[i], i, array);
      if (status === false) { break; }
    }
  },
  json: {
    each: (json, handler) => { /* Loops through a JSON, running an handler (key, value, json) for each property. */
      if (json === null || !ghf.is.json(json))
        json = {};
      let status;
      for (let [key, value] of Object.entries(json)) {
        status = handler(key, value, json);
        if (status === false) { break; }
      }
    },
    value: function (obj, path, value) { /* Returns and/or sets value of JSON using path (string) */
      let v = undefined;
      if (value === undefined && arguments.length < 3) {
        try {
          if (ghf.is.text(path)) {
            v = path.split('.').reduce((acc, key) => acc?.[key], obj);
          }
        } catch (e) { };
      } else {
        const keys = path.split('.');
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
          const key = keys[i];
          if (!(key in current)) {
            current[key] = {};
          }
          current = current[key];
        }
        v = (current[keys[keys.length - 1]] = value);
      }
      return v;
    },
    stringify: function () { /* Converts value to a string */
      let string = '';
      try {
          string = JSON.stringify.apply(null, arguments) || '';
      } catch { }
      return string;
    },
    parse: function () { /* Parses a string into JSON */
      let json = null;
      try {
          json = JSON.parse.apply(null, arguments) || null;
      } catch { }
      return json;
    },
  },
  generateString: (length, charactersTypes) => { /* Returns a generated string based on character types (numeric, lowercase, uppercase) */
    let string = '';
    if (length) {
        let characters = [];
        if (ghf.is.text(charactersTypes))
          charactersTypes = charactersTypes.split(',').map(c => c.trim());
        if (!ghf.is.array(charactersTypes)) 
          charactersTypes = [];
        charactersTypes = charactersTypes.filter(c => c.length).map(c => c.toLowerCase()).filter(c => (c === 'numeric' || c === 'uppercase' || c === 'lowercase'));
        if (charactersTypes.includes('numeric') || !charactersTypes.length)
          characters = [...characters, ...'0123456789'.split('')]
        if (charactersTypes.includes('uppercase') || !charactersTypes.length)
          characters = [...characters, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]
        if (charactersTypes.includes('lowercase') || !charactersTypes.length)
          characters = [...characters, ...'abcdefghijklmnopqrstuvwxyz'.split('')]
        characters = characters.join('');
        for (let i = 0; i < length; i++) { string += characters.charAt(Math.floor(Math.random() * characters.length)); }
    }
    return string;
  },
  camelize: (string, options = {}) => { /* Camelizes a string (default is Lower Camel Case) */
    if (ghf.is.text(string)) {
      return string.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? (options.upperCamelCase ? word.toUpperCase() : word.toLowerCase()) : word.toUpperCase();
      }).replace(/\s+/g, '');
    }
    return string;
  },
  normalize: (value, options = {}) => { /* ECMA6+. Normalizes a value to Unicode. */
    try {
      value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
      if (options.noSpecialCharacters)
        value = value.replace(/[^A-Za-z0-9]/g, '');
    } catch (e) { }
    return value;
  },
  replace: (text, before, after, options = {}) => { /* Returns a text where we replace some text for another. */
    if (text) {
        text = text.toString();
        try {
            return text.replace(new RegExp(before, 'gm' + (options.caseSensitive ? 'i' : '')), after);
        } catch { };
    }
    return text;
  },
  contains: (text, value) => { /* Returns a bool indicating if a text contains another text. */
    if (!ghf.is.text(text))
      text = text.toString();
    if (ghf.is.array(value)) {
      var found = false;
      ghf.each(value, function (val) {
        if (value.indexOf(val) > -1) {
          found = true;
          return false;
        }
      });
      return found;
    }
    return text.indexOf(value) > -1;
  },
  hex: {
    from: {
      file: async(file) => { /* Returns Hex string from a file. (Promise) */
          let hexString = '';
          if (ghf.is.file(file)) {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            hexString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
          }
          return ('0x' + hexString);
      },
    },
  },
  color: {
    hex: {
      from: {
        string: (value) => { /* Returns Hex value based on a string */
          let hash = 0;
          for (let i = 0; i < value.length; i++) {
            hash = value.charCodeAt(i) + ((hash << 5) - hash);
          }
          let c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
          return '#' + '00000'.substring(0, 6 - c.length) + c;
        },
        rgb: function (r, g, b) { /* Returns Hex value based on RGB */
          if (arguments.length === 1 && ghf.is.json(arguments[0])) {
            let { r, g, b } = arguments[0];
            return ghf.color.hex.from.rgb(r, g, b);
          } else {
            let componentToHex = function (c) {
              var hex = c.toString(16);
              return hex.length == 1 ? "0" + hex : hex;
            }
            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
          }
        },
      },
    },
    rgb: {
      from: {
        hex: (hex) => { /* Returns RGB value based on Hex */
          var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
          hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
          })
          var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : null;
        },
      },
    },
    forecolor: {
      from: {
        rgb: function (r, g, b) { /* Returns best forecolor for RGB */
          if (arguments.length === 1 && ghf.is.json(arguments[0])) {
            let { r, g, b } = arguments[0];
            return ghf.color.forecolor.from.rgb(r, g, b);
          } else {
            return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? "#FFFFFF" : "#000000";
          }
        },
        hex: (hex) => { /* Returns best forecolor for Hex */
          let rgb = ghf.color.rgb.from.hex(hex);
          return ghf.color.forecolor.from.rgb(rgb);
        },
      }
    },
  },
  url: {
    current: () => { /* Returns the current URL. */
      return (typeof window !== 'undefined' ? window : self).location.href;
    },
    origin: () => { /* Returns the current URL origin. */
      return (typeof window !== 'undefined' ? window : self).location.origin;
    },
    path: () => { /* Returns the current URL path. */
      return (typeof window !== 'undefined' ? window : self).location.pathname;
    },
    page: () => { /* Returns the current URL page. */
      return ghf.url.path().substring(1);
    },
    open: (url, tab = true) => { /* Opens an URL. */
      if (tab)
        window.open(url, '_blank');
      else
        window.open(url, '_self');
    },
    param: {
      get: (param) => {  /* Returns a URL param value. */
        param = param ?? '';
        const url = new URL(ghf.url.current());
        const params = new URLSearchParams(url.search);
        return params.get(param);
      },
      getAll: () => { /* Returns the current URL params as a json. */
        const url = new URL(ghf.url.current());
        const params = new URLSearchParams(url.search);
        let json = {};
        params.forEach(function (value, key) {
          json[key] = value;
        });
        return json;
      },
      set: (param, value) => { /* Sets a URL param value. */
        const url = new URL(ghf.url.current());
        const params = new URLSearchParams(url.search);
        if (ghf.is.array(value) || ghf.is.json(value))
            value = ghf.json.stringify(value);
        params.set(param, value);
        const newUrl = ghf.url.current().split('?')[0] + (params.size ? '?' + params.toString() : '');
        (typeof window !== 'undefined' ? window : self).history.replaceState({ path: newUrl }, '', newUrl);
      },
      delete: (param) => { /* Deletes a URL param */
        const url = new URL(ghf.url.current());
        const params = new URLSearchParams(url.search);
        params.delete(param);
        const newUrl = ghf.url.current().split('?')[0] + (params.size ? '?' + params.toString() : '');
        (typeof window !== 'undefined' ? window : self).history.replaceState({ path: newUrl }, '', newUrl);
      },
    },
  },
};

self.ghf = ghf;