console.log('[IG Helper Extension] indiegala');
//  *-----------*
//  | VARIABLES |
//  *-----------*
var indiegala = {
  loaded: false,
  loading: true,
  interval: { init: null },
  observer: { galasilver: undefined, },
}

//  *---------*
//  | ON LOAD |
//  *---------*
initIndiegala();

//  *-----------*
//  | FUNCTIONS |
//  *-----------*
async function initIndiegala() {
  await resetIndiegala();

  let counter = 0;
  indiegala.interval.init = setInterval(async function () {
    counter++;
    if ($('#galasilver-amount').length > 0) {
      clearInterval(indiegala.interval.init);

      $('.header-menu').last().find('ul').prepend('<li id="main-menu-galasilver"><span><strong class="coins-amount"><i class="fa fa-spinner fa-spin"></i></strong> iS</span></li>')
      updateGalaSilver();

      var galasilverEl = document.getElementById('galasilver-amount');
      indiegala.observer.galasilver = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            updateGalaSilver();
          }
        }
      });
      indiegala.observer.galasilver.observe(galasilverEl, { childList: true, subtree: true, characterData: true });
    } else if (counter >= 100) {
      clearInterval(indiegala.interval.init);
    }
  }, 200);
  indiegala.loading = false;
  indiegala.loaded = true;
}

async function resetIndiegala() {
  indiegala.loaded = false;
  indiegala.loading = true;
  if (indiegala.interval.init !== null) {
    clearInterval(indiegala.interval.init);
    indiegala.interval.init = null;
  }
  if (indiegala.observer.galasilver !== undefined)
    indiegala.observer.galasilver.disconnect();
}

function updateGalaSilver(galasilver) {
  galasilver = galasilver ?? $('#galasilver-amount').text();
  $('#main-menu-galasilver .coins-amount').html(galasilver);
  return galasilver;
}

async function getPlatforms() {
  let platforms = await ehf.fetch(chrome.runtime.getURL(`assets/json/platform.json`));
  ghf.json.each(platforms, function(platformKey, platformJSON) {
      platformJSON.iconUrl = chrome.runtime.getURL(`assets/images/icons/${platformKey}.ico`);
  });
  return platforms;
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

  const accountInfo = await ehf.fetch("https://www.indiegala.com/library/giveaways/user-level-and-coins", { credentials: "include" });
  Object.assign(indiegalaAccount, accountInfo);

  await ehf.storage.local.set('indiegalaAccount', indiegalaAccount);
  return indiegalaAccount;
}
