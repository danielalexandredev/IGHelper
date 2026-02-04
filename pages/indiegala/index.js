console.log('[IG Helper Extension] indiegala');
//  *-----------*
//  | VARIABLES |
//  *-----------*
var indiegala = {
  loaded: false,
  loading: true,
  interval: { 
    init: null, ighMenu: null, galasilver: null, accountProgress: null, 
    updateSteamLoginIndicator: null,
  },
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

  setupIghMenu();
  setupAccountProgress();
  indiegala.loading = false;
  indiegala.loaded = true;
}

async function resetIndiegala() {
  indiegala.loaded = false;
  indiegala.loading = true;

  ghf.json.each(indiegala.interval, function (key, value) {
    if (value !== null) {
      clearInterval(indiegala.interval[key]);
      value = null;
    }
  });
  ghf.json.each(indiegala.observer, function (key, value) {
    if (value !== undefined)
      indiegala_giveaways.observer[key].disconnect();
  });
}

async function setupIghMenu() {
  let counter = 0;
  indiegala.interval.ighMenu = setInterval(async function () {
    counter++;
    if ($('.header-menu').last().length > 0) {
      clearInterval(indiegala.interval.ighMenu);
      $('.header-menu').last().addClass('igh-menu');
      $('.igh-menu').last().find('ul')
        .prepend(`
          <li id="igh-galasilver" style="display:none;"><span><strong class="coins-amount"><i class="fa fa-spinner fa-spin"></i></strong> iS</span></li>
          <li id="igh-steam-login-status" class="" title="" style="display:none;"><i aria-hidden="true" class="fa fa-steam-square"></i></li>
        `);

      await setupGalaSilver();
      await setupSteamLoginIndicator();
    } else if (counter >= 100) {
      clearInterval(indiegala.interval.ighMenu);
      console.log('Timeout: indiegala.interval.ighMenu');
    }
  }, 200);
}

async function setupGalaSilver() {
  let counter = 0;
  indiegala.interval.galasilver = setInterval(async function () {
    counter++;
    if ($('#galasilver-amount').length > 0) {
      clearInterval(indiegala.interval.galasilver);

      $('#igh-galasilver').show();
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
      clearInterval(indiegala.interval.galasilver);
      console.log('Timeout: indiegala.interval.galasilver');
    }
  }, 200);
}

async function setupSteamLoginIndicator() {
  let steamLoginStatus = await checkSteamLogin();

  $('#igh-steam-login-status')
    .attr('class', (steamLoginStatus ? 'igh-text-positive' : 'igh-text-negative'))
    .attr('title', (steamLoginStatus ? `You're logged in to Steam in this browser` : `You're not logged in to Steam in this browser`))
    .show();

  // indiegala.interval.updateSteamLoginIndicator = setInterval(async function () {
  //   let steamLoginStatus = await checkSteamLogin();
  //   let statusClass = (steamLoginStatus ? 'igh-text-positive' : 'igh-text-negative');
  //   let statusTooltip = (steamLoginStatus ? `You're logged in to Steam in this browser` : `You're not logged in to Steam in this browser`);
  //   $('#igh-steam-login-status').attr('class', statusClass).attr('title', statusTooltip);
  // }, 5000);
}

function setupAccountProgress() {
  let counter = 0;
  indiegala.interval.accountProgress = setInterval(async function () {
    counter++;
    if ($('.user-wallet').length > 0) {
      clearInterval(indiegala.interval.accountProgress);
      $('.user-wallet > div').last().show();
      const accountInfo = await ehf.fetch("https://www.indiegala.com/library/giveaways/user-level-and-coins", { credentials: "include" });
      $('#userGiveawaysLevel').text(accountInfo.current_level);
      $('#userGiveawaysPoints').text(accountInfo.current_points);
    } else if (counter >= 100) {
      clearInterval(indiegala.interval.accountProgress);
      console.log('Timeout: indiegala.interval.accountProgress');
    }
  }, 200);
}
