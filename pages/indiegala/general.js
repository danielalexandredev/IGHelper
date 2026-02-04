console.log('[IG Helper Extension] indiegala (general)');
//  *-----------*
//  | FUNCTIONS |
//  *-----------*
function updateGalaSilver(galasilver) {
  galasilver = galasilver ?? $('#galasilver-amount').text();
  $('#igh-galasilver .coins-amount').html(galasilver);
  return galasilver;
}

async function getPlatforms() {
  let platforms = await ehf.fetch(chrome.runtime.getURL(`assets/json/platform.json`));
  ghf.json.each(platforms, function(platformKey, platformJSON) {
      platformJSON.iconUrl = chrome.runtime.getURL(`assets/images/icons/${platformKey}.ico`);
  });
  return platforms;
}

async function getSettings() {
  let defaultSettings = await ehf.fetch(chrome.runtime.getURL(`assets/json/settings.json`));
  let settings = await ehf.storage.local.get('settings', defaultSettings);
  Object.assign(settings, Object.assign(defaultSettings, settings));
  return settings;
}
async function setSettings(settings = {}) {
  if (!ghf.is.jsonEmpty(settings))
    await ehf.storage.local.set('settings', settings);
}

async function checkSteamLogin() {
  let loggedIn = false;
  if (!!(await ehf.chrome('cookies.get', { url: 'https://store.steampowered.com', name: 'steamLoginSecure' }))) {
    if (!!(await ehf.chrome('cookies.get', { url: 'https://store.steampowered.com', name: 'sessionid' }))) {
      loggedIn = true;
    }
  }
  return loggedIn;
}

async function getAccountInfo() {
  const sessionidCookie = await ehf.chrome('cookies.get', {
    url: 'https://www.indiegala.com',
    name: 'sessionid'
  });

  if (!sessionidCookie) {
    return;
  }

  let sessionid = sessionidCookie.value;
  let indiegalaAccount = await ehf.storage.local.get('indiegalaAccount');
  if (ghf.is.jsonEmpty(indiegalaAccount)) {
    indiegalaAccount = account;
    await ehf.storage.local.set('indiegalaAccount', indiegalaAccount);
  }
  if (!indiegalaAccount.sessionid || indiegalaAccount.sessionid !== sessionid) {
    indiegalaAccount.sessionid = sessionid;
    
    const libraryHtml = await ehf.fetch("https://www.indiegala.com/library");
    indiegalaAccount.link =
      $(libraryHtml).find('.profile-private-page-avatar a')?.attr('href') ?? '';

    indiegalaAccount.id = indiegalaAccount.link
      ? indiegalaAccount.link.split('/').pop()
      : '';

    indiegalaAccount.username =
      $(libraryHtml).find('.profile-private-page-user-row').html();
  }

  let settings = await getSettings();
  if (!indiegalaAccount.sessionid
    || indiegalaAccount.sessionid !== sessionid
    || ((settings?.lastIndiegalaAccountInfoRequest || 0) + (30 * 60 * 1000) < Date.now()) // 30m
  ) {
    settings.lastIndiegalaAccountInfoRequest = Date.now();
    await setSettings(settings);

    const accountInfo = await ehf.fetch("https://www.indiegala.com/library/giveaways/user-level-and-coins", { credentials: "include" });
    Object.assign(indiegalaAccount, accountInfo);
  }

  await ehf.storage.local.set('indiegalaAccount', indiegalaAccount);
  return indiegalaAccount;
}
