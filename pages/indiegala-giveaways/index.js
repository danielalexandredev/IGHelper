console.log('[IG Helper Extension] indiegala-giveaways');
//  *-----------*
//  | VARIABLES |
//  *-----------*
var indiegala_giveaways = {
  loaded: false,
  loading: true,
  interval: { indiegala: null, init_giveaways: null, init_giveawaysCurtain: null, init_giveawaysCarousel: null, },
  observer: { curtain: undefined, results: undefined, },
};
var settings = {};
var account = {
  id: undefined, username: undefined, link: '', sessionid: '',
  current_level: 0, points_to_next_level: '-', experience_bar_width: 0, status: 'ok', current_points: 0, current_floor: 5000
};
var platform = {};
var giveawaysDB = {};
var usersDB = {};
var steam = { app: {}, sub: {} };

var productUpdating = { app: [], sub: [], };
var ownerUpdating = [];

//  *---------*
//  | ON LOAD |
//  *---------*
initGiveaways();

//  *-----------*
//  | FUNCTIONS |
//  *-----------*
async function initGiveaways() {
  await resetGiveaways();

  // Carousel
  indiegala_giveaways.interval.init_giveawaysCarousel = setInterval(function () {
    $('.carousel, .carousel-control-prev, .carousel-control-prev, .page-slider-title').hide();
    if (indiegala?.loaded === true && indiegala_giveaways?.loaded === true) {
      clearInterval(indiegala_giveaways.interval.init_giveawaysCarousel);
      if (!account || !account?.sessionid) {
        $('.carousel, .carousel-control-prev, .carousel-control-prev, .page-slider-title').show();
      }
    }
  }, 200);

  await new Promise(resolve => {
    indiegala_giveaways.interval.init_giveawaysCurtain = setInterval(function () {
      if ($('.page-contents-ajax-list-cover').length > 0) {
        clearInterval(indiegala_giveaways.interval.init_giveawaysCurtain);
        resolve();
      }
    }, 200)
  });
  $('.page-contents-ajax-list-cover').html('<div class="page-contents-ajax-list-cover-loading"><i class="fa fa-spinner fa-pulse"></i></div>');
  $([document.documentElement, document.body]).animate({
    scrollTop: $(".page-contents-list-menu-sort-col-xs-auto").offset().top - 80
  }, 200);
  $('.page-contents-ajax-list-cover').css('display', 'block');
  $('.page-contents-ajax-list').css('opacity', '0.25');

  await new Promise(resolve => {
    indiegala_giveaways.interval.indiegala = setInterval(function () {
      if (typeof indiegala !== 'undefined') {
        clearInterval(indiegala_giveaways.interval.indiegala);
        resolve();
      }
    }, 200)
  });

  account = await getAccountInfo();
  if (typeof account !== 'undefined' && account.sessionid) {
    settings = await getSettings();
    await new Promise(async (resolve) => {
      platform = await getPlatformsOwnedProducts();
      giveawaysDB = await ehf.storage.local.get('indiegalaGiveaways');
      await processGiveawaysDB();
      usersDB = await ehf.storage.local.get('indiegalaUsers');
      await processUsersDB();
      steam.app = await ehf.storage.local.get('steamApps');
      steam.sub = await ehf.storage.local.get('steamSubs');
      await processSteamDB('steamApps');
      await processSteamDB('steamSubs');
      resolve();
    });

    await new Promise(resolve => {
      indiegala_giveaways.interval.init_giveaways = setInterval(function () {
        if (
          indiegala?.loaded === true
          && !ghf.is.jsonEmpty(platform)
          && $('.page-contents-list-menu-sort-col-xs-auto').length > 0
          && $('.page-contents-ajax-list').length > 0
          && $('.page-contents-list .items-list-col').length > 0
        ) {
          clearInterval(indiegala_giveaways.interval.init_giveaways);
          resolve();
        }
      }, 200);
    });

    createGiveawaysToolbarElements();

    const curtainEl = document.getElementsByClassName("page-contents-ajax-list-cover")[0];
    indiegala_giveaways.observer.curtain = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          if ($(curtainEl).is(":visible")) {
            toggleLoading(true);
          } else {
            toggleLoading(false);
            if (indiegala_giveaways.loaded)
              checkGiveaways();
          }
        }
      });
    });
    indiegala_giveaways.observer.curtain.observe(curtainEl, { attributes: true });

    const resultsEl = document.getElementsByClassName("page-contents-ajax-results")[0];
    indiegala_giveaways.observer.results = new MutationObserver(() => {
      checkGiveaways('.page-contents-ajax-results .page-contents-list .items-list-col');
    });
    indiegala_giveaways.observer.results.observe(resultsEl, { childList: true, subtree: true, attributes: true, characterData: true });
  }
  setTimeout(() => {
    $('.page-contents-ajax-list-cover').hide();
    $('.page-contents-ajax-list').css('opacity', '1');
    indiegala_giveaways.loading = false;
    indiegala_giveaways.loaded = true;
  }, 700);
}

async function resetGiveaways() {
  indiegala_giveaways.loaded = false;
  indiegala_giveaways.loading = true;

  ghf.json.each(indiegala_giveaways.interval, function (key, value) {
    if (value !== null) {
      clearInterval(indiegala.interval[key]);
      value = null;
    }
  });
  ghf.json.each(indiegala_giveaways.observer, function (key, value) {
    if (value !== undefined)
      indiegala_giveaways.observer[key].disconnect();
  });
  account = {
    id: undefined, username: undefined, link: '', sessionid: '',
    current_level: 0, points_to_next_level: '-', experience_bar_width: 0, status: 'ok', current_points: 0, current_floor: 5000
  };
  platform = {};
  giveawaysDB = {};
  usersDB = {};
  steam = { app: {}, sub: {} };
  productUpdating = { app: [], sub: [], };
  ownerUpdating = [];
}

async function getPlatformsOwnedProducts() {
  let platforms = await getPlatforms();
  ghf.json.each(platforms, async function (platformKey, platformJSON) {
    let ownedProductsApp = await ehf.storage.local.get(`${platformKey}_ownedProductsApp`, []);
    let ownedProductsSub = await ehf.storage.local.get(`${platformKey}_ownedProductsSub`, []);
    let ownedKeysApp = await ehf.storage.local.get(`${platformKey}_ownedKeysApp`, []);
    let ownedKeysSub = await ehf.storage.local.get(`${platformKey}_ownedKeysSub`, []);
    if (
      platformKey === 'steam'
      && await checkSteamLogin()
      && (settings?.lastSteamOwnedProductsRequest || 0) + (30 * 60 * 1000) < Date.now()) // 30m
    {
      settings.lastSteamOwnedProductsRequest = Date.now();
      await setSettings(settings);
      await new Promise(async (resolve) => {
        await ehf.fetch('https://store.steampowered.com/dynamicstore/userdata/', { credentials: 'include' })
          .then(async (userData) => {
            if (userData.rgOwnedApps.length > 0 || userData.rgOwnedPackages.length > 0) {
              ownedProductsApp = userData.rgOwnedApps;
              ownedProductsSub = userData.rgOwnedPackages;
              await ehf.storage.local.set(`${platformKey}_ownedProductsApp`, ownedProductsApp);
              await ehf.storage.local.set(`${platformKey}_ownedProductsSub`, ownedProductsSub);
            } else {
              platformJSON.metadata.failedRequest = true;
            }
          }).finally(() => { resolve(); });
      });
    } else if (
      platformKey === 'steam'
      && (!(await checkSteamLogin())
        || (ownedProductsApp.length === 0 && ownedProductsSub.length === 0))
    ) {
      platformJSON.metadata.failedRequest = true;
    }
    platformJSON.ownedProducts.app = ownedProductsApp;
    platformJSON.ownedProducts.sub = ownedProductsSub;
    platformJSON.ownedKeys.app = ownedKeysApp;
    platformJSON.ownedKeys.sub = ownedKeysSub;
  });
  return platforms;
}

async function processGiveawaysDB() {
  let checkOldGiveaways = false;
  ghf.json.each(giveawaysDB, function (giveawayID, giveawayData) {
    if (giveawayData.timeEnd + (24 * 60 * 60 * 1000) < Date.now()) { // 24H
      console.log('Clear giveaway - ', giveawayID, ': ', ghf.json.parse(ghf.json.stringify(giveawayData)));
      delete giveawaysDB[giveawayID];
      checkOldGiveaways = true;
    }
  });
  if (checkOldGiveaways === true) { await ehf.storage.local.set('indiegalaGiveaways', giveawaysDB); };
}
async function processUsersDB() {
  let checkUsers = false;
  ghf.json.each(usersDB, function (userID, userData) {
    if (!ghf.is.jsonEmpty(userData)
      && ((userData?.__settings?.lastUpdate || 0) + ((24 * 60 * 60 * 1000) * 7) < Date.now()) // 7 days
      && userData?.__settings?.visible !== false
    ) {
      console.log('Clear user - ', userID, ': ', ghf.json.parse(ghf.json.stringify(userData)));
      delete usersDB[userID];
      checkUsers = true;
    }
  });
  if (checkUsers === true) { await ehf.storage.local.set('indiegalaUsers', usersDB); };
}
async function processSteamDB(key) {
  let checkSteamDB = false;
  let type = (key === 'steamSubs' ? 'sub' : 'app');
  ghf.json.each(steam[type], function (id, data) {
    if (!ghf.is.jsonEmpty(data)
      && ((data?.__settings?.lastUpdate || 0) + (24 * 60 * 60 * 1000) < Date.now()) // 24H
      && data?.__settings?.visible !== false
    ) {
      console.log('Clear (' + key + ') - ', id, ': ', ghf.json.parse(ghf.json.stringify(data)));
      delete steam[type][id];
      checkSteamDB = true;
    }
  });
  if (!!checkSteamDB) { await ehf.storage.local.set(key, steam[type]); };
}

function createGiveawaysToolbarElements() {
  //  Left
  let leftHtml = '';
  leftHtml += `<div id="indiegala-giveaways-toolbar-left-count" title=""></div>`;
  leftHtml += `<div id="indiegala-giveaways-toolbar-left-loading" style="display:none;"><i class="fa fa-spinner fa-pulse"></i></div>`;
  //  Toggle carousel
  leftHtml += `
    <a id="indiegala-giveaways-toolbar-left-toggle-carousel" class="igh-text-white flex items-center" href="javascript:;" data-carousel-visibility="off" title="[OFF] Carousel visibility">
      <i class="fa fa-columns"></i>
    </a>`;
  let leftEl = $('.page-contents-list-menu-sort-col-xs-auto').prev();
  leftEl.addClass('igh-gutter-x-sm').attr('id', 'indiegala-giveaways-toolbar-left').html(leftHtml);

  //  Right
  let rightHtml = '';
  // Toggle smart visibility
  rightHtml += `
    <a id="indiegala-giveaways-toolbar-right-toggle-smart-visibility" class="igh-text-white flex items-center" href="javascript:;" data-smart-visibility="off" title="[OFF] Smart visibility">
      <i class="fa fa-toggle-off"></i>
    </a>`;
  // Toggle all giveaways visibility
  rightHtml += `
      <a id="indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility" class="igh-text-white flex items-center" href="javascript:;" data-all-giveaways-visibility="off" title="[OFF] All giveaways visibility">
        <i class="fa fa-eye-slash"></i>
      </a>`;
  let rightEl = $('.page-contents-list-menu-sort-col-xs-auto').next();
  rightEl.addClass('igh-gutter-x-sm').attr('id', 'indiegala-giveaways-toolbar-right').html(rightHtml);
  $([document.documentElement, document.body]).animate({
    scrollTop: $("#indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility").offset().top - 80
  }, 200);

  //  Toolbar buttons Javascript
  $('#indiegala-giveaways-toolbar-left-toggle-carousel').on("click", function (e) { //  Toggle carousel
    let el = this;
    let visibility = $(el).attr('data-carousel-visibility');
    let newVisibility = visibility === 'off' ? 'on' : 'off';
    $(el).attr('data-carousel-visibility', newVisibility).attr('title', `[${newVisibility.toUpperCase()}] Carousel visibility`);
    if (newVisibility === 'on') {
      $('.carousel, .carousel-control-prev, .carousel-control-prev, .page-slider-title').show();
      $([document.documentElement, document.body]).animate({
        scrollTop: $(".page-slider-title").offset().top - 80
      }, 200);
    } else if (newVisibility === 'off') {
      $('.carousel, .carousel-control-prev, .carousel-control-prev, .page-slider-title').hide();
      $([document.documentElement, document.body]).animate({
        scrollTop: $(".page-contents-list-menu-sort-col-xs-auto").offset().top - 80
      }, 200);
    }
  });
  $('#indiegala-giveaways-toolbar-right-toggle-smart-visibility').on("click", function (e) { // Smart visibility
    if (!indiegala_giveaways.loading) {
      let el = this;
      let visibility = $(el).attr('data-smart-visibility');
      let newVisibility = visibility === 'off' ? 'on' : 'off';
      if (visibility === 'off') {
        $(el).find('i').removeClass('fa-toggle-off').addClass('fa-toggle-on');
        if ($('#indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility').attr('data-all-giveaways-visibility') === 'on') { $('#indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility').click(); }
      } else {
        $(el).find('i').removeClass('fa-toggle-on').addClass('fa-toggle-off');
      }
      $(el).attr('data-smart-visibility', newVisibility).attr('title', `[${newVisibility.toUpperCase()}] Smart visibility`);
      updateAllGiveawaysVisibility();
    }
  });
  $('#indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility').on("click", function (e) { // All giveaways visibility
    if (!indiegala_giveaways.loading) {
      let el = this;
      let visibility = $(el).attr('data-all-giveaways-visibility');
      let newVisibility = visibility === 'off' ? 'on' : 'off';
      if (visibility === 'off') {
        $(el).find('i').removeClass('fa-eye-slash').addClass('fa-eye');
        if ($('#indiegala-giveaways-toolbar-right-toggle-smart-visibility').attr('data-smart-visibility') === 'on') { $('#indiegala-giveaways-toolbar-right-toggle-smart-visibility').click(); }
      } else {
        $(el).find('i').removeClass('fa-eye').addClass('fa-eye-slash');
      }
      $(el).attr('data-all-giveaways-visibility', newVisibility).attr('title', `[${newVisibility.toUpperCase()}] All giveaways visibility`);
      updateAllGiveawaysVisibility();
      $([document.documentElement, document.body]).animate({
        scrollTop: $("#indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility").offset().top - 80
      }, 200);
    }
  });
}
function toggleLoading(value) {
  indiegala_giveaways.loading = value;
  let removeClass = !!value ? '' : 'igh-disabled';
  let addClass = !!value ? 'igh-disabled' : '';
  if (!!value) {
    $('#indiegala-giveaways-toolbar-left-count').attr('title', '').html('');
    $('#indiegala-giveaways-toolbar-left-loading').show();
  } else {
    $('#indiegala-giveaways-toolbar-left-loading').hide();
    let giveawaysElems = $('.page-contents-list .items-list-col');
    $('#indiegala-giveaways-toolbar-left-count').attr('title', `${giveawaysElems.length} giveaways loaded`).html(giveawaysElems.length);
    if ($('#igh-pagination').length === 0)
      $('.pagination .page-link-cont.left:first').text(`${$('.page-contents-ajax-list .page-contents-list .items-list-col').length} of ${$('.pagination .page-link-cont.left:first').text()}`).attr('id', 'igh-pagination');
  }
  $('#indiegala-giveaways-toolbar-right-toggle-smart-visibility, #indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility').removeClass(removeClass).addClass(addClass);
}
function updateAllGiveawaysVisibility() {
  $('.page-contents-list .items-list-col').each((i, el) => {
    let giveawayID = $(el).attr('data-giveaway-id');
    updateGiveawayVisibility(giveawayID);
  });
}
function updateGiveawayVisibility(giveawayID) {
  if (+giveawayID > 0) {
    let visibility = $('#indiegala-giveaways-toolbar-right-toggle-all-giveaways-visibility').attr('data-all-giveaways-visibility');
    let smartVisibility = $('#indiegala-giveaways-toolbar-right-toggle-smart-visibility').attr('data-smart-visibility');
    let productVisibility = (giveawaysDB?.[giveawayID] ? (steam[giveawaysDB[giveawayID].product.type]?.[giveawaysDB[giveawayID].product.id]?.__settings?.visible ?? true) : true);
    let ownerVisibility = (giveawaysDB?.[giveawayID] ? (usersDB[giveawaysDB[giveawayID].owner.id]?.__settings?.visible ?? true) : true);
    let el = $(`.indiegala-giveaway[data-giveaway-id="${giveawayID}"]`);
    $(el).show();
    if (visibility === 'off') {
      if (giveawaysDB[giveawayID]?.owner?.id === account.id
        || giveawaysDB[giveawayID]?.level > account.current_level
        || (giveawaysDB[giveawayID] !== undefined && !giveawaysDB[giveawayID].__settings.visible)
        || !productVisibility
        || !ownerVisibility
        || $(el).find('.items-list-item-data-cont').length === 0
      ) { $(el).hide(); }
      if (smartVisibility === 'on' && el.length) {
        let description = $(el).find('.items-list-item-indicators-icons-description').attr('title');
        if (description !== '__igh_description') {
          let ownedPlatforms = ($(el).attr('data-owned-platforms') || '').split(';').filter(p => p !== '');
          let mentionedPlatforms = ($(el).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');

          if (mentionedPlatforms.length === 0) {
            if (ownedPlatforms.includes('steam')) { $(el).hide(); }
          } else {
            let check = true;
            ghf.each(mentionedPlatforms, function (platformKey) {
              if (!ownedPlatforms.includes(platformKey)) { check = false; return false; }
            });
            if (check) { $(el).hide(); }
          }
        }
      }
    }
  }
}
function handleProductRefresh (giveaway, el) {
  $(`.indiegala-giveaway[data-product-type="${giveaway.productType}"][data-product-id="${giveaway.productID}"]`).find('.items-list-item-loading').show();
  let gEl = $(`.indiegala-giveaway[data-giveaway-id="${giveaway.id}"]`);
  $(gEl)
    .removeAttr('data-owned-platforms')
    .removeAttr('data-mentioned-platforms')
  $(gEl).find('.items-list-item-indicators-platforms').remove();
  processGiveaway(giveaway, { update: true });
}
async function toggleKeyOwnership(giveaway, el) {
  if (platform['steam'].ownedKeys[giveaway.productType].includes(giveaway.productID)) {
    platform['steam'].ownedKeys[giveaway.productType] = platform['steam'].ownedKeys[giveaway.productType].filter(id => id !== giveaway.productID)
  } else {
    platform['steam'].ownedKeys[giveaway.productType].push(giveaway.productID);
  }
  await ehf.storage.local.set(`steam_ownedKeys${ghf.camelize(giveaway.productType, { upperCamelCase: true })}`, platform['steam'].ownedKeys[giveaway.productType]);
  $(`.indiegala-giveaway[data-product-type="${giveaway.productType}"][data-product-id="${giveaway.productID}"]`).each(async function (i, gEl) {
    $(gEl).find('.items-list-item-loading').show();
    $(gEl)
      .removeAttr('data-owned-platforms')
      .removeAttr('data-mentioned-platforms')
    $(gEl).find('.items-list-item-indicators-platforms').remove();
    processGiveaway({
      id: $(gEl).attr('data-giveaway-id'),
      url: $(gEl).attr('data-giveaway-url'),
      productType: giveaway.productType,
      productID: giveaway.productID,
      productName: giveaway.productName,
    });
  });

  // let mentionedPlatforms = ($(`.indiegala-giveaway[data-giveaway-id="${giveaway.id}"]`).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');
  // mentionedPlatforms = (mentionedPlatforms.length === 0 ? ['steam'] : mentionedPlatforms);
  // if (platform[mentionedPlatforms[0]].ownedKeys[giveaway.productType].includes(giveaway.productID)) {
  //   platform[mentionedPlatforms[0]].ownedKeys[giveaway.productType].splice(platform[mentionedPlatforms[0]].ownedKeys[giveaway.productType].indexOf(giveaway.productID), 1)
  // } else {
  //   platform[mentionedPlatforms[0]].ownedKeys[giveaway.productType].push(giveaway.productID);
  // }
  // await ehf.storage.local.set(`${mentionedPlatforms[0]}_ownedKeys${ghf.camelize(giveaway.productType, { upperCamelCase: true })}`, platform[mentionedPlatforms[0]].ownedKeys[giveaway.productType]);
  // $(`.indiegala-giveaway[data-product-type="${giveaway.productType}"][data-product-id="${giveaway.productID}"]`).each(async function (i, gEl) {
  //   $(gEl).find('.items-list-item-loading').show();
  //   if (mentionedPlatforms.length === 1) {
  //     $(gEl)
  //       .removeAttr('data-owned-platforms')
  //       .removeAttr('data-mentioned-platforms')
  //     $(gEl).find('.items-list-item-indicators-platforms').remove();
  //     processGiveaway({
  //       id: $(gEl).attr('data-giveaway-id'),
  //       url: $(gEl).attr('data-giveaway-url'),
  //       productType: giveaway.productType,
  //       productID: giveaway.productID,
  //       productName: giveaway.productName,
  //     });
  //   } else {
  //     $(gEl).find('.items-list-item-loading').hide();
  //   }
  // });
}
async function toggleProductOwnership(giveaway, el) {
  let mentionedPlatforms = ($(`.indiegala-giveaway[data-giveaway-id="${giveaway.id}"]`).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');
  mentionedPlatforms = (mentionedPlatforms.length === 0 ? ['steam'] : mentionedPlatforms);
  if (mentionedPlatforms.length === 1
    && (
      mentionedPlatforms[0] !== 'steam'
      || (
        mentionedPlatforms[0] === 'steam'
        && platform.steam.metadata.failedRequest
      )
    )
  ) {
    let ownership = $(el).attr('data-product-ownership');
    let newOwnership = ownership === 'off' ? 'on' : 'off';
    if (ownership === 'off') {
      platform[mentionedPlatforms[0]].ownedProducts[giveaway.productType].push(giveaway.productID);
    } else {
      platform[mentionedPlatforms[0]].ownedProducts[giveaway.productType] = platform[mentionedPlatforms[0]].ownedProducts[giveaway.productType].filter(id => id !== giveaway.productID);
    }
    await ehf.storage.local.set(`${mentionedPlatforms[0]}_ownedProducts${ghf.camelize(giveaway.productType, { upperCamelCase: true })}`, platform[mentionedPlatforms[0]].ownedProducts[giveaway.productType]);
    $(`.indiegala-giveaway[data-product-type="${giveaway.productType}"][data-product-id="${giveaway.productID}"]`).each(async function (i, gEl) {
      let gEl_mentionedPlatforms = ($(gEl).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');
      gEl_mentionedPlatforms = (gEl_mentionedPlatforms.length === 0 ? ['steam'] : gEl_mentionedPlatforms);
      if (gEl_mentionedPlatforms.length === 1 && gEl_mentionedPlatforms[0] === mentionedPlatforms[0]) {
        $(gEl).removeAttr('data-owned-platforms').find('.items-list-item-loading').show();
        let productOwnershipBtn = $(gEl).find('.items-list-item-type-left-btns-product-ownership');
        if (ownership === 'off') {
          $(productOwnershipBtn).find('i').removeClass('fa-bookmark-o').addClass('fa-bookmark');
        } else {
          $(productOwnershipBtn).find('i').removeClass('fa-bookmark').addClass('fa-bookmark-o');
        }
        $(productOwnershipBtn).attr('data-product-ownership', newOwnership).attr('title', `[${newOwnership.toUpperCase()}] Toggle product ownership (${platform[mentionedPlatforms[0]].name})`);
        $(gEl).find('.items-list-item-indicators-platforms').remove();
        processGiveaway({
          id: $(gEl).attr('data-giveaway-id'),
          url: $(gEl).attr('data-giveaway-url'),
          productType: giveaway.productType,
          productID: giveaway.productID,
          productName: giveaway.productName,
        });
      }
    });
  }
}
async function toggleGiveawayVisibility(giveawayID, el) {
  if (giveawaysDB[giveawayID] !== undefined) {
    let visibility = $(el).attr('data-giveaway-visibility');
    let newVisibility = visibility === 'off' ? 'on' : 'off';
    if (visibility === 'off') {
      $(el).find('i').removeClass('fa-eye-slash').addClass('fa-eye');
    } else {
      $(el).find('i').removeClass('fa-eye').addClass('fa-eye-slash');
    }
    $(el).attr('data-giveaway-visibility', newVisibility).attr('title', `[${newVisibility.toUpperCase()}] Giveaway visibility`);
    giveawaysDB[giveawayID].__settings.visible = (newVisibility === 'on');
    await ehf.storage.local.set('indiegalaGiveaways', giveawaysDB);
    updateGiveawayVisibility(giveawayID);
  }
}
async function toggleProductVisibility(product, el) {
  if (steam[product.type]?.[product.id] !== undefined) {
    let visibility = $(el).attr('data-product-visibility');
    let newVisibility = visibility === 'off' ? 'on' : 'off';
    $(`.indiegala-giveaway[data-product-type="${product.type}"][data-product-id="${product.id}"]`).each((i, gEl) => {
      let productVisibilityBtn = $(gEl).find('.items-list-item-type-right-btns-product-visibility');
      if (visibility === 'off') {
        $(productVisibilityBtn).find('i').removeClass('fa-bell-slash-o').addClass('fa-bell-o');
      } else {
        $(productVisibilityBtn).find('i').removeClass('fa-bell-o').addClass('fa-bell-slash-o');
      }
      $(productVisibilityBtn).attr('data-product-visibility', newVisibility).attr('title', `[${newVisibility.toUpperCase()}] Product visibility`)
    });
    steam[product.type][product.id].__settings.visible = (newVisibility === 'on');
    await ehf.storage.local.set(`steam${ghf.camelize(product.type, { upperCamelCase: true })}s`, steam[product.type]);
    updateAllGiveawaysVisibility();
  }
}
async function toggleOwnerVisibility(giveawayID, el) {
  let ownerID = $(`.indiegala-giveaway[data-giveaway-id="${giveawayID}"]`).attr('data-owner-id');
  if (usersDB?.[ownerID] !== undefined) {
    let visibility = $(el).attr('data-owner-visibility');
    let newVisibility = visibility === 'off' ? 'on' : 'off';
    $(`.indiegala-giveaway[data-owner-id="${ownerID}"]`).each((i, gEl) => {
      let ownerVisibilityBtn = $(gEl).find('.items-list-item-type-right-btns-owner-visibility');
      if (visibility === 'off') {
        $(ownerVisibilityBtn).find('i').removeClass('fa-user-times').addClass('fa-user');
      } else {
        $(ownerVisibilityBtn).find('i').removeClass('fa-user').addClass('fa-user-times');
      }
      $(ownerVisibilityBtn).attr('data-owner-visibility', newVisibility).attr('title', `[${newVisibility.toUpperCase()}] Owner visibility`)
    });
    usersDB[ownerID].__settings.visible = (newVisibility === 'on');
    await ehf.storage.local.set('indiegalaUsers', usersDB);
    updateAllGiveawaysVisibility();
  }
}
async function getGiveawayData(giveaway) {
  let html = await ehf.fetch(giveaway.url);
  try {
    let giveawayTimeEnd = 
    (html.match(/(?<=var timeend = new Date\(Date.UTC\( \s*).*?(?=\s* \)\);)/gs)[0])
      .split(',')
      .map((t, i) => { if (t.indexOf('-') > -1) { t = t.split('-').map(n => +n); t = t[0] - t[1]; }; return +t; });
    let productUrl = $(html).find('.card-title a').attr('href');
    let productID = productUrl.split('/')[4];
    let productType = productUrl.split('/')[3];
    let ownerUrl = $(html).find('.card-owner-col a')?.attr('href') ?? '';
    let ownerID = (ownerUrl !== '' ? ownerUrl.split('/')[3] : '');
    let ownerName = $(html).find('.card-owner-col img')?.attr('alt');
    let ownerAvatar = $(html).find('.card-owner-col img').attr('src');

    giveawayTimeEnd = Date.UTC.apply(null, giveawayTimeEnd);
    if (ownerName.indexOf(' avatar') > -1) {
      ownerName = ownerName?.split(' avatar')[0];
    } else {
      ownerName = ownerName?.split('by ')[1];
    }
    let giveawayData = {
      id: giveaway.id,
      description: $(html).find('.card-description').html().replaceAll('"', '”').replaceAll("'", "’"),
      level: $($(html).find('.card-data-text')[1]).html(),
      url: giveaway.url,
      timeEnd: giveawayTimeEnd,
      price: $(html).find('.card-join a').attr('data-price'),
      product: {
        id: ghf.number(productID),
        type: productType,
        name: $(html).find('.card-title h1').html() || giveaway.productName,
        url: productUrl
      },
      owner: {
        id: ownerID,
        url: ownerUrl,
        name: ownerName,
        avatar: ownerAvatar,
      },
      __settings: { visible: true, },
    }

    giveawaysDB[giveaway.id] = giveawayData;
    await ehf.storage.local.set('indiegalaGiveaways', giveawaysDB)
    processGiveaway(giveaway);
  } catch (e) {
    console.error('getGiveawayData id:', giveaway.id, '; error: ', e);
    getGiveawayData(giveaway);
  }
}
async function getProductData(giveaway, force = {}) {
  const { processData, update } = force;
  if ((steam[giveaway.productType][giveaway.productID] === undefined
    || (steam[giveaway.productType][giveaway.productID] !== undefined
      && (steam[giveaway.productType][giveaway.productID].__settings.lastUpdate + (24 * 60 * 60 * 1000)) < Date.now()) // 24H
    || update)
    && !productUpdating[giveaway.productType].includes(+giveaway.productID)
  ) {
    productUpdating[giveaway.productType].push(+giveaway.productID);
    let productData = {
      success: false,
      data: { type: 'unknown', name: giveaway.productName },
      __settings: {
        visible: true,
        lastUpdate: 1,
      }
    };
    if (steam[giveaway.productType][giveaway.productID] !== undefined) {
      productData.__settings.visible = steam[giveaway.productType][giveaway.productID].__settings.visible;
    }

    let url = `https://store.steampowered.com/api/appdetails?appids=${giveaway.productID}`;
    if (giveaway.productType === 'sub') {
      url = `https://store.steampowered.com/api/packagedetails?packageids=${giveaway.productID}`;
    }

    ehf.fetch(url)
      .then(async (fetchData) => {
        let productFetchData = fetchData[giveaway.productID];
        productFetchData.data = { ...productData.data, ...(productFetchData.data || {}) };
        productFetchData.__settings = { visible: productData.__settings.visible ?? true, lastUpdate: Date.now(), };
        if (giveaway.productType === 'sub') {
          productFetchData.data.type = 'package';
          if (productFetchData.data?.apps !== undefined) {
            ghf.each(productFetchData.data.apps, async function (app) {
              await getProductData({ id: 0, url: '', productType: 'app', productID: app.id, productName: app.name }, { processData: giveaway });
            });
          } else { productFetchData.data.apps = []; }
        } else if (giveaway.productType === 'app' && productFetchData.data?.fullgame !== undefined) {
          let fullgame = productFetchData.data.fullgame;
          await getProductData({ id: 0, url: '', productType: 'app', productID: fullgame.appid, productName: fullgame.name }, { processData: giveaway });
        }
        if (steam[giveaway.productType][giveaway.productID] !== undefined
          && ((steam[giveaway.productType][giveaway.productID].__settings.lastUpdate + (24 * 60 * 60 * 1000)) < Date.now())) { // 24H
          console.log('Update product - [', giveaway.productType, '] ', giveaway.productID, ': ', productFetchData);
        }
        steam[giveaway.productType][giveaway.productID] = productFetchData;
        await ehf.storage.local.set(`steam${ghf.camelize(giveaway.productType, { upperCamelCase: true })}s`, steam[giveaway.productType])
        if (processData !== undefined)
          processProduct(processData);
        processProduct(giveaway);
        handleGiveawayLoading($(`.indiegala-giveaway[data-product-type="${giveaway.productType}"][data-product-id="${giveaway.productID}"]`));
      })
      .finally(() => {
        let productUpdatingIndex = productUpdating[giveaway.productType].indexOf(+giveaway.productID);
        if (productUpdatingIndex > -1) { productUpdating[giveaway.productType].splice(+productUpdatingIndex, 1) }
      });
  }
}
async function getOwnerData(giveaway) {
  let ownerID = giveawaysDB[giveaway.id].owner.id;
  if ((usersDB[ownerID] === undefined
    || (usersDB[ownerID] !== undefined
      && ((usersDB[ownerID].__settings.lastUpdate + (24 * 60 * 60 * 1000)) < Date.now()))) // 24H
    && !ownerUpdating.includes(ownerID)
  ) {
    let giveawayData = giveawaysDB[giveaway.id];
    let giveawayOwner = ghf.json.parse(ghf.json.stringify(giveawayData.owner));
    ownerUpdating.push(giveawayOwner.id);
    if (usersDB[giveawaysDB[giveaway.id].owner.id] === undefined) {
      giveawayOwner = { ...{ reputation: '0', reputationCount: '+0 | -0', level: '0', giveawaysCreated: '0', __settings: { lastUpdate: Date.now(), visible: true, } }, ...giveawayOwner };
    } else {
      giveawayOwner = { ...giveawayOwner, ...usersDB[giveawaysDB[giveaway.id].owner.id] };
      // processOwner(giveaway);
    }
    ghf.json.value(giveawayOwner, '__settings.lastUpdate', Date.now());
    ghf.json.value(giveawayOwner, '__settings.visible', (usersDB?.[giveawaysDB[giveaway.id].owner.id]?.__settings?.visible ?? true));

    if (giveawayOwner.url !== '') {
      let html = await ehf.fetch(giveawayOwner.url);
      giveawayOwner.reputation = $(html).find('.user-card-giveaways .user-card-reputation').html();
      giveawayOwner.reputationCount = $(html).find('.user-card-giveaways .user-card-reputation-count').html();
      giveawayOwner.level = $(html).find('.user-card-giveaways .user-card-body-col:nth-child(2) .user-card-body-content').html();
      giveawayOwner.giveawaysCreated = $(html).find('.user-card-giveaways .user-card-body-sep ~ .user-card-body-col-left:first .user-card-body-content').html();
    } else {
      giveawayOwner.level = '';
    }
    if (usersDB[giveawayOwner.id] !== undefined
      && ((usersDB[giveawayOwner.id].__settings.lastUpdate + (24 * 60 * 60 * 1000)) < Date.now())) { // 24H
      console.log('Update user - ', giveawayOwner.id, ': ', giveawayOwner);
    }
    usersDB[giveawayOwner.id] = giveawayOwner;
    await ehf.storage.local.set('indiegalaUsers', usersDB)
    processOwner(giveaway);
    let ownerUpdatingIndex = ownerUpdating.indexOf(giveawayOwner.id);
    if (ownerUpdatingIndex > -1) { ownerUpdating.splice(+ownerUpdatingIndex, 1) }
  }
}
function checkProductOwnership(giveaway) {
  if (+giveaway.id > 0 && steam[giveaway.productType]?.[giveaway.productID] === undefined) {
    checkProductOwnership(giveaway);
  } else if (+giveaway.id > 0 && steam[giveaway.productType]?.[giveaway.productID] !== undefined) {
    let el = $(`.indiegala-giveaway[data-giveaway-id="${giveaway.id}"]`);
    let mentionedPlatforms = ($(el).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');
    mentionedPlatforms = (mentionedPlatforms.length === 0 ? ['steam'] : mentionedPlatforms);
    if (
      mentionedPlatforms.length === 1
      && (
        mentionedPlatforms[0] !== 'steam'
        || (
          mentionedPlatforms[0] === 'steam'
          && platform.steam.metadata.failedRequest
        )
      )
    ) {
      let productOwnershipBtn = $(el).find('.items-list-item-type-left-btns-product-ownership');
      let owned = platform[mentionedPlatforms[0]].ownedProducts[giveaway.productType].includes(+giveaway.productID);
      let ownership = owned ? 'on' : 'off';
      if (ownership === 'off') {
        $(productOwnershipBtn).find('i').removeClass('fa-bookmark').addClass('fa-bookmark-o');
      } else {
        $(productOwnershipBtn).find('i').removeClass('fa-bookmark-o').addClass('fa-bookmark');
      }
      $(productOwnershipBtn).attr('data-product-ownership', ownership).attr('title', `[${ownership.toUpperCase()}] Toggle product ownership (${platform[mentionedPlatforms[0]].name})`).show();
    }
  }
}
function checkProductVisibility(giveaway) {
  if (+giveaway.id > 0 && steam[giveaway.productType]?.[giveaway.productID] === undefined) {
    checkProductVisibility(giveaway);
  } else if (+giveaway.id > 0 && steam[giveaway.productType]?.[giveaway.productID] !== undefined) {
    $(`.indiegala-giveaway[data-product-type="${giveaway.productType}"][data-product-id="${giveaway.productID}"]`).each(async function (i, el) {
      let productVisibilityBtn = $(el).find('.items-list-item-type-right-btns-product-visibility');
      let visible = steam[giveaway.productType][giveaway.productID].__settings.visible;
      let visibility = visible ? 'on' : 'off';
      if (visibility === 'off') {
        $(productVisibilityBtn).find('i').removeClass('fa-bell-o').addClass('fa-bell-slash-o');
      } else {
        $(productVisibilityBtn).find('i').removeClass('fa-bell-slash-o').addClass('fa-bell-o');
      }
      $(productVisibilityBtn).attr('data-product-visibility', visibility).attr('title', `[${visibility.toUpperCase()}] Product visibility`).show();
    });
  }
}
function checkOwnerVisibility(giveaway) {
  if (+giveaway.id > 0 && (giveawaysDB[giveaway.id] === undefined || usersDB[giveawaysDB[giveaway.id].owner.id] === undefined)) {
    checkOwnerVisibility(giveaway);
  } else if (+giveaway.id > 0 && giveawaysDB[giveaway.id] !== undefined && usersDB[giveawaysDB[giveaway.id].owner.id] !== undefined) {
    $(`.indiegala-giveaway[data-owner-id="${giveawaysDB[giveaway.id].owner.id}"]`).each(async function (i, el) {
      let ownerVisibilityBtn = $(el).find('.items-list-item-type-right-btns-owner-visibility');
      let visible = usersDB[giveawaysDB[giveaway.id].owner.id].__settings.visible;
      let visibility = visible ? 'on' : 'off';
      if (visibility === 'off') {
        $(ownerVisibilityBtn).find('i').removeClass('fa-user').addClass('fa-user-times');
      } else {
        $(ownerVisibilityBtn).find('i').removeClass('fa-user-times').addClass('fa-user');
      }
      $(ownerVisibilityBtn).attr('data-owner-visibility', visibility).attr('title', `[${visibility.toUpperCase()}] Owner visibility`).show();
    });
  }
}
function colorGiveaway(giveaway) {
  if (+giveaway.id > 0) {
    let el = $(`.indiegala-giveaway[data-giveaway-id="${giveaway.id}"]`);

    $(el).find('h5.items-list-item-title').css('background', 'white');
    $(el).find('h5.items-list-item-title a').attr('class', '');
    $(el).find('.items-list-item-data').css('background', 'white');
    $(el).find('.items-list-item-data').removeClass(`igh-text-light-grey igh-text_outline-black`);
    if (!$(el).hasClass('indiegala-giveaway-blackout')) {
      let ownedPlatforms = ($(el).attr('data-owned-platforms') || '').split(';').filter(p => p !== '');
      let mentionedPlatforms = ($(el).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');
      mentionedPlatforms = (mentionedPlatforms.length === 0 ? ['steam'] : mentionedPlatforms);
      if (ownedPlatforms.length > 0) {
        let gradient = [];
        ghf.each(ownedPlatforms, function (platformKey) { gradient.push(platform[platformKey].gradient.join(',')); });
        if (mentionedPlatforms.filter((mp) => !ownedPlatforms.includes(mp)).length === 0) {
          $(el).find('h5.items-list-item-title').css('background', 'linear-gradient(135deg,' + gradient.join(',') + ')');
          $(el).find('h5.items-list-item-title a').addClass('igh-text-light-grey igh-text_outline-black');
        }
        $(el).find('.items-list-item-data').css('background', 'linear-gradient(135deg,' + gradient.join(',') + ')');
        $(el).find('.items-list-item-data').addClass(`igh-text-light-grey igh-text_outline-black`);
      }
      if (mentionedPlatforms.filter((mp) => !ownedPlatforms.includes(mp)).length > 0) {
        if (mentionedPlatforms.length > 1) {
          $(el).find('h5.items-list-item-title a').addClass('igh-text-gold-gradient');
        } else if (mentionedPlatforms.length === 1) {
          $(el).find('h5.items-list-item-title a').addClass((mentionedPlatforms[0] !== 'steam' ? `igh-text-${mentionedPlatforms[0]}` : ''));
        }
      }
    }
  }
}
function processGiveaway(giveaway, force = {}) {
  const { update } = force;
  let el = $(`.indiegala-giveaway[data-giveaway-id="${giveaway.id}"]`);

  if (giveawaysDB[giveaway.id] === undefined) {
    getGiveawayData(giveaway);
  } else {
    $(el).attr('data-owner-id', giveawaysDB[giveaway.id].owner.id);

    processProduct(giveaway, { update });

    let giveawayData = giveawaysDB[giveaway.id];
    // "Blackout" own giveaways || Giveaways with too high of a level
    if (giveawayData.owner.id === account.id
      || giveawayData.level > account.current_level) {
      $(el).addClass('indiegala-giveaway-blackout');
    }

    // Giveaway owner
    $(el).find('.items-list-item-indicators-icons-owner').attr('title', giveawayData.owner.name);
    $(el).find('.items-list-item-indicators-icons-owner img').attr('src', giveawayData.owner.avatar)
    if (giveawayData.owner.url !== '') {
      $(el).find('.items-list-item-indicators-icons-owner a').attr('href', giveawayData.owner.url).attr('target', '_blank').show();
    } else {
      $(el).find('.items-list-item-indicators-icons-owner').addClass('igh-bg-indiegala');
    }
    processOwner(giveaway);

    // Giveaway description && mentioned platforms && feudalife in description
    $(el).find('.items-list-item-indicators-icons-description').attr('title', giveawayData.description);
    if ($(el).attr('data-mentioned-platforms') === undefined) {
      $(el).find('.items-list-item-indicators-icons-description .platform-badge').remove();
      $(el).find('.items-list-item-indicators-icons-description .feudalife-badge').remove();
      let mentionedPlatforms = '';
      ghf.json.each(platform, function (platformKey, platformJSON) {
        if (platformKey !== 'steam'
          && platformJSON.keyWords.some((keyWord) => { return giveawayData.description.toLowerCase().indexOf(keyWord) > -1 })
        ) {
          mentionedPlatforms += (mentionedPlatforms.length ? ';' : '') + platformKey;
          $(el)
            .find(`.items-list-item-indicators-icons-description`)
            .append(`
              <div class="absolute igh-rounded badge-top-right platform-badge" data-platform="${platformKey}">
                <img alt="${platformKey}-logo" title="${platformJSON.name}" src="${platformJSON.iconUrl}" class="igh-rounded">
              </div>`);
        }
      });
      if (giveawayData.description.toLowerCase().indexOf('feudalife') > -1
        || giveawayData.description.toLowerCase().indexOf('gameplay giveaway') > -1) {
        $(el)
          .find('.items-list-item-indicators-icons-description')
          .append(`
            <div class="absolute igh-rounded badge-bottom-left feudalife-badge">
              <img alt="feudalife-logo" title="Feudalife" src="${chrome.runtime.getURL(`assets/images/icons/feudalife.png`)}" class="igh-rounded">
            </div>`)
      };
      if (mentionedPlatforms.length) { $(el).attr('data-mentioned-platforms', mentionedPlatforms); };
    }

    // Giveaway btns
    // Giveaway visibility btn
    let giveawayVisibilityBtn = $(el).find('.items-list-item-type-right-btns-giveaway-visibility');
    $(giveawayVisibilityBtn).show();
    let visible = giveawaysDB[giveaway.id].__settings.visible;
    let visibility = visible ? 'on' : 'off';
    if (visibility === 'off') {
      $(giveawayVisibilityBtn).find('i').removeClass('fa-eye').addClass('fa-eye-slash');
    } else {
      $(giveawayVisibilityBtn).find('i').removeClass('fa-eye-slash').addClass('fa-eye');
    }
    $(giveawayVisibilityBtn).attr('data-giveaway-visibility', visibility).attr('title', `[${visibility.toUpperCase()}] Giveaway visibility`).show();
    // Product refresh btn
    if (steam[giveaway.productType]?.[giveaway.productID] !== undefined) {
      $(el).find('.items-list-item-type-left-btns-product-refresh').show();
      // Product ownership btn
      checkProductOwnership(giveaway);
      // Product visibility btn
      checkProductVisibility(giveaway);
    }

    // Giveaway color
    colorGiveaway(giveaway);

    // Giveaway visibility
    updateGiveawayVisibility(giveaway.id);

    handleGiveawayLoading($(el));
  }
}
function processProduct(giveaway, force = {}) {
  const { update } = force;
  let productData = steam[giveaway.productType][giveaway.productID];
  if (productData === undefined
    || productData !== undefined && (productData.__settings.lastUpdate + (24 * 60 * 60 * 1000)) < Date.now()
    || update
  ) {
    getProductData(giveaway, { update });
  } else {
    $(`.indiegala-giveaway[data-product-type="${giveaway.productType}"][data-product-id="${giveaway.productID}"]`).each(async function (i, el) {
      $(el).find('h5.items-list-item-title a').attr('title', productData.data.name).html(productData.data.name);
      if (productData.data.header_image && $(el).find('figure a img').attr('data-original-src') !== $(el).find('figure a img').attr('src')) {
        $(el).find('figure a img')
          .attr('data-original-src', $(el).find('figure a img').attr('src'))
          .attr('src', productData.data.header_image)
      } else if (ghf.is.array(productData.data.apps)
        && productData.data.apps.length === 1
        && steam.app[productData.data.apps[0].id]
        && steam.app[productData.data.apps[0].id].data.header_image
         && $(el).find('figure a img').attr('data-original-src') !== $(el).find('figure a img').attr('src')
      ) {
        $(el).find('figure a img')
          .attr('data-original-src', $(el).find('figure a img').attr('src'))
          .attr('src', steam.app[productData.data.apps[0].id].data.header_image)
      }

      let giveawayID = $(el).attr('data-giveaway-id');
      let giveawayURL = $(el).attr('data-giveaway-url');

      let productIcon = 'fa-steam';
      let productStatus = (productData.success === false ? 'removed' : 'active');
      let appType = (giveaway.productType === 'sub' ? 'package' : (productData.data.type ?? 'unknown'));
      if (giveaway.productType === 'sub') {
        productIcon = 'fa-archive';
        if (productData.data.price === undefined) { productStatus = 'unavailable' };
      } else if (giveaway.productType === 'app') {
        if (appType === 'game') {
          productIcon = 'fa-gamepad';
        } else if (appType === 'dlc') {
          productIcon = 'fa-download';
        } else if (appType === 'music') {
          productIcon = 'fa-music';
        } else if (appType === 'hardware') {
          productIcon = 'fa-desktop';
        } else if (appType === 'mod') { //  e.g.: 317790
          productIcon = 'fa-wrench';
        } else if (appType === 'demo') {  //  e.g: 3240360
          productIcon = 'fa-flask';
        } else if (appType === 'video' || appType === 'episode' || appType === 'series') { //  e.g: 1494730 ||  579353  ||  1456090
          productIcon = 'fa-file-video-o';
        }
        if (productData.data.price_overview === undefined
          && productData.data.packages === undefined
          && productData.data.is_free === false
        ) {
          productStatus = 'unavailable';
          if (productData.data.release_date.coming_soon === true) { productStatus = 'coming-soon'; }
        } else if (productData.data.is_free === true) {
          productStatus = 'free';
        };
      }
      $(el)
        .find('.items-list-item-indicators-icons-product')
        .attr('title', (appType === 'dlc' ? appType.toUpperCase() : ghf.camelize(appType, { upperCamelCase: true })));

      // Product icon
      if (!!productIcon) {
        $(el).find(`.items-list-item-indicators-icons-product > i`)
          .removeClass('fa-steam product-type-unknown-icon')
          .addClass(`${productIcon} product-type-${appType}-icon`);
      }
      // Product status
      $(el).find(`.items-list-item-indicators-icons-product .product-status-badge`)
        .attr('title', ghf.camelize(productStatus, { upperCamelCase: true }).replace('-', ' '))
        .addClass(`igh-text-${productStatus}`)
        .show();

      // Product base game badges
      if (appType === 'dlc' || appType === 'music') {
        $(el).find('.items-list-item-indicators-icons-product .product-base-game-badge').remove();
        $(el).find('.items-list-item-indicators-icons-product .product-base-game-owned-badge').remove();
        let baseGameID = productData?.data?.fullgame?.appid;
        let baseGameData = steam.app[baseGameID];
        let baseGameName = productData?.data?.fullgame?.name || baseGameData?.data?.name || '';
        if (baseGameID !== undefined && baseGameData === undefined) {
          await getProductData({ id: 0, url: '', productType: 'app', productID: baseGameID, productName: baseGameName }, { processData: giveaway });
        } else if (baseGameID !== undefined && baseGameData !== undefined) {
          let baseGameStatus = (!baseGameData?.success ? 'removed' : 'active');
          if (baseGameData?.data?.price_overview === undefined
            && baseGameData?.data?.packages === undefined
            && baseGameData?.data?.is_free === false
          ) {
            baseGameStatus = 'unavailable';
            if (baseGameStatus?.data?.release_date?.coming_soon === true) { baseGameStatus = 'coming-soon'; }
          } else if (baseGameData?.data?.is_free === true) {
            baseGameStatus = 'free';
          }

          $(el)
            .find('.items-list-item-indicators-icons-product')
            .append(`
              <div
                class="absolute igh-rounded badge-top-right product-base-game-badge flex justify-center items-center igh-bg-${baseGameStatus} igh-text-white" 
                title="[${ghf.camelize(baseGameStatus, { upperCamelCase: true })}] - ${baseGameName}"
              >
                <a class="absolute fit" href="https://store.steampowered.com/app/${baseGameID}" target="_blank"></a>
                <i class="fa fa-gamepad"></i>
              </div>`);

          let baseGameOwned = '';
          ghf.json.each(platform, function (platformKey, platformJSON) {
            if (platformJSON.ownedProducts.app.includes(+baseGameID)) {
              if (baseGameOwned !== '') { baseGameOwned += `\n`; }
              baseGameOwned += `[${platformJSON.name}]\n`;
              baseGameOwned += `[${ghf.camelize(baseGameData?.data?.type, { upperCamelCase: true })}] ${baseGameName}`;
            }
          });
          if (baseGameOwned !== '') {
            baseGameOwned = `Owned Base game(s):\n${baseGameOwned}`;
            $(el)
              .find(`.items-list-item-indicators-icons-product`)
              .append(`
                <div class="absolute igh-text-positive badge-bottom-left product-base-game-owned-badge igh-flex items-center no-wrap" title="${baseGameOwned}">
                  <i class="fa fa-circle"></i>
                </div>`);
          }
        }
      }

      // Product package
      let packageInfo = { platform: {}, title: { ownedApps: '', ownedKeys: '', apps: '', }, };
      if (appType === 'package') {
        $(el).find('.items-list-item-indicators-icons-product .package-owned-apps-badge').remove();
        $(el).find('.items-list-item-indicators-icons-product .package-owned-keys-badge').remove();
        $(el).find('.items-list-item-indicators-icons-product .package-apps-badge').remove();
        ghf.json.each(platform, function (platformKey, platformJSON) {
          if (packageInfo.platform[platformKey] === undefined) { packageInfo.platform[platformKey] = { ownedApps: [], ownedKeys: [], }; };

          packageInfo.platform[platformKey].ownedApps = productData.data.apps.filter((app) => platform[platformKey].ownedProducts.app.includes(+app.id));
          packageInfo.platform[platformKey].ownedKeys = productData.data.apps.filter((app) => platform[platformKey].ownedKeys.app.includes(+app.id));

          if (packageInfo.platform[platformKey].ownedApps.length > 0) {
            packageInfo.title.ownedApps += `[${platform[platformKey].name}]\n`;
            packageInfo.title.ownedApps += packageInfo.platform[platformKey].ownedApps.map((app) => {
              let appType = steam?.app?.[app.id]?.data?.type;
              appType = (appType === 'dlc' ? appType.toUpperCase() : ghf.camelize(appType, { upperCamelCase: true }));
              return `[${appType}] ${steam?.app?.[app.id]?.data?.name || app.name}`;
            }).join(`\n`);
          }
          if (packageInfo.platform[platformKey].ownedKeys.length > 0) {
            packageInfo.title.ownedKeys += `[${platform[platformKey].name}]\n`;
            packageInfo.title.ownedKeys += packageInfo.platform[platformKey].ownedKeys.map((app) => {
              let appType = steam?.app?.[app.id]?.data?.type;
              appType = (appType === 'dlc' ? appType.toUpperCase() : ghf.camelize(appType, { upperCamelCase: true }));
              return `[${appType}] ${steam?.app?.[app.id]?.data?.name || app.name}`;
            }).join(`\n`);
          }
        });

        if (packageInfo.title.ownedApps !== '') {
          packageInfo.title.ownedApps = `Owned product(s) in package:\n${packageInfo.title.ownedApps}`;
          
          $(el)
            .find('.items-list-item-indicators-icons-product')
            .append(`
              <div 
                class="absolute igh-text-positive badge-bottom-left package-owned-apps-badge igh-flex items-center no-wrap" 
                title="${packageInfo.title.ownedApps}"
              >
                <i class="fa fa-circle"></i>
              </div>`);
        }
        if (packageInfo.title.ownedKeys !== '') {
          packageInfo.title.ownedKeys = `Owned product(s) key(s) in package:\n${packageInfo.title.ownedKeys}`;
          
          $(el)
            .find('.items-list-item-indicators-icons-product')
            .append(`
              <div 
                class="absolute igh-rounded igh-bg-warning igh-text-white badge-top-right package-owned-keys-badge flex justify-center items-center" 
                title="${packageInfo.title.ownedKeys}"
              >
                <i class="igh-pa-xxxs fa fa-key"></i>
              </div>`);
        }
        if (productData.data.apps.length > 0) {
          packageInfo.title.apps = `Product(s) in package:\n`;
          packageInfo.title.apps += productData.data.apps.map((app) => {
            let appType = steam?.app?.[app.id]?.data?.type;
            appType = (appType === 'dlc' ? appType.toUpperCase() : ghf.camelize(appType, { upperCamelCase: true }));
            return `[${appType}] ${steam?.app?.[app.id]?.data?.name || productData.data.name}`;
          }).join(`\n`);

          $(el)
            .find('.items-list-item-indicators-icons-product')
            .append(`
              <div 
                class="absolute igh-bg-info igh-text-white badge-bottom-right package-apps-badge igh-flex items-center no-wrap" 
                title="${packageInfo.title.apps}" 
              >
                ${productData.data.apps.length}
              </div>`);
        }
      }

      // Products owned in platforms
      $(el).removeAttr('data-owned-platforms');
      $(el).find('.items-list-item-indicators-platforms').remove();
      $(el).find('.items-list-item-type-left-btns-key-ownership').show();
      let ownedPlatforms = '';
      let ownedPlatformsHtml = '';
      ghf.json.each(platform, function (platformKey, platformJSON) {
        if (
          (platformJSON.ownedKeys[giveaway.productType].includes(+giveaway.productID)
            || platformJSON.ownedProducts[giveaway.productType].includes(+giveaway.productID))
          || (appType === 'package'
            && productData.data.apps.length > 0
            && productData.data.apps.length === packageInfo.platform[platformKey].ownedApps.length)
        ) {
          let badge = '';
          if (platformKey === 'steam' && platformJSON.ownedProducts[giveaway.productType].includes(+giveaway.productID))
            $(el).find('.items-list-item-type-left-btns-key-ownership').hide();

          if (!platformJSON.ownedProducts[giveaway.productType].includes(+giveaway.productID) && platformJSON.ownedKeys[giveaway.productType].includes(+giveaway.productID)) {
            badge = `
              <div class="absolute igh-rounded igh-bg-warning igh-text-white badge-top-right key-owned-badge flex justify-center items-center" title="Key owned">
                <i class="igh-pa-xxs fa fa-key"></i>
              </div>`;
          } else if (appType === 'package'
            && productData.data.apps.length > 0
            && productData.data.apps.length === packageInfo.platform[platformKey].ownedApps.length
          ) {
            badge = `
              <div class="absolute igh-rounded igh-text-package badge-top-right package-items-owned-badge" title="All products inside the package are owned">
                <i class="igh-pa-xxs fa fa-archive"></i>
              </div>`;
          }

          ownedPlatformsHtml +=
            `<div class="items-list-item-indicators-platforms-${platformKey} igh-row no-wrap items-center">
              <div class="relative flex items-center">
                <img alt="${platformKey}-logo" title="Owned in ${platformJSON.name}" data-platform="${platformKey}" class="platform-icon" src="${platformJSON.iconUrl}">
                ${badge}
              </div>
            </div>`;

          ownedPlatforms += (ownedPlatforms.length ? ';' : '') + platformKey;
        }
      });
      if (ownedPlatforms.length) {
        $(el)
          .find('.items-list-item-indicators')
          .removeClass('justify-center').addClass('justify-around')
          .append(`
            <div class="items-list-item-indicators-platforms igh-row no-wrap items-center igh-gutter-x-sm">
              ${ownedPlatformsHtml}
            </div>`);
      } else {
        $(el).find('.items-list-item-indicators').removeClass('justify-around').addClass('justify-center');
      }
      $(el).attr('data-owned-platforms', ownedPlatforms);

      //  Giveaway btns
      $(el).find('.items-list-item-type-left-btns-product-refresh').show();
      checkProductOwnership(giveaway);
      checkProductVisibility(giveaway);

      //  Giveaway color
      colorGiveaway({
        id: giveawayID,
        url: giveawayURL,
        productType: giveaway.productType,
        productID: giveaway.productID,
        productName: giveaway.productName
      });

      //  Giveaway visibility
      updateGiveawayVisibility(giveawayID);

      handleGiveawayLoading($(el));
    });
  }
}
function processOwner(giveaway) {
  let ownerID = giveawaysDB[giveaway.id].owner.id;
  if (usersDB[ownerID] === undefined) {
    getOwnerData(giveaway);
  } else {
    let ownerData = usersDB[ownerID];
    let reputationBorder = 'conic-gradient(white 0% 100%)';
    
    if (ownerData.id === '') {
      reputationBorder = 'unset';
    } else {
      let giveawaysCreated = +ownerData.giveawaysCreated;
      let reputationCountPositive = Math.abs(ownerData.reputationCount.split('|')[0].trim());
      let reputationCountNegative = Math.abs(ownerData.reputationCount.split('|')[1].trim());
      if (giveawaysCreated === (reputationCountPositive + reputationCountNegative)) { giveawaysCreated = giveawaysCreated + 1; }
      let reputationCountUnknown = giveawaysCreated - (reputationCountPositive + reputationCountNegative) || 1;
      let reputationPercentagePositive = Math.round((10000*reputationCountPositive)/giveawaysCreated)/100 || 0;
      let reputationPercentageNegative = Math.round((10000*reputationCountNegative)/giveawaysCreated)/100 || 0;
      let reputationPercentageUnknown = Math.round((10000*reputationCountUnknown)/giveawaysCreated)/100 || 0;
      reputationBorder = `conic-gradient(
                          #21BA45 0% ${reputationPercentagePositive}%, 
                          #C10015 ${reputationPercentagePositive}% ${reputationPercentagePositive+reputationPercentageNegative}%,
                          #212121 ${reputationPercentagePositive+reputationPercentageNegative}% 100%
                        `;
      $(`.indiegala-giveaway[data-owner-id="${ownerID}"] .items-list-item-indicators-icons-owner`)
        .attr('title', `Username: ${ownerData.name}\nLevel: ${ownerData.level}\nGiveaways created: ${giveawaysCreated}\n👍: ${reputationCountPositive} (${reputationPercentagePositive}%)\n👎: ${reputationCountNegative} (${reputationPercentageNegative}%)\n❔: ${reputationCountUnknown} (${reputationPercentageUnknown}%)`);
    }
    $(`.indiegala-giveaway[data-owner-id="${ownerID}"] .items-list-item-indicators-icons-owner`).css('background', reputationBorder);
    if (!!ownerData.level) {
      $(`.indiegala-giveaway[data-owner-id="${ownerID}"] .items-list-item-indicators-icons-owner .owner-level-badge`).show()
        .attr('title', `User level ${ownerData.level}`).html(ownerData.level);
    }
    if (ownerID === '') {
      $(`.indiegala-giveaway[data-owner-id="${ownerID}"] .items-list-item-indicators-icons-owner .owner-level-badge`).hide();
    }

    if ((usersDB[ownerID].__settings.lastUpdate + (24 * 60 * 60 * 1000)) < Date.now()) { // 24H
      getOwnerData(giveaway);
    } else {
      // Owner visibility btn
      checkOwnerVisibility(giveaway);
    }
  }
}
function handleGiveawayLoading (el) {
  if ($(el).attr('data-owner-id') !== undefined && $(el).attr('data-owned-platforms') !== undefined) {
    $(el).find('.items-list-item-loading').hide();
  }
}
function checkGiveaways(cards) {
  toggleLoading(false);
  let giveawaysElems = $('.page-contents-ajax-list .page-contents-list .items-list-col');
  if (cards !== undefined)
    giveawaysElems = $(cards);

  //  Loop giveaways (Cards)
  giveawaysElems.each((i, el) => {
    if ($(el).find('.items-list-item-indicators').length === 0) {
      if ($(el).find('h5.items-list-item-title a').html() === '') {
        $(el).find('h5.items-list-item-title a').html('&#8203;').addClass('giveaway-untitled');
      };

      let giveawayURL = $(el).find('h5.items-list-item-title a').attr('href');
      let giveawayID = giveawayURL.split('/').reverse()[0];
      let headerURL = $(el).find('figure a img').attr('src');
      let productType = headerURL.split('/').reverse()[2];
      productType = productType.substring(0, productType.length-1);
      let productID = ghf.number(headerURL.split('/').reverse()[1]);
      let productName = $(el).find('figure a').attr('title') || $(el).find('h5.items-list-item-title a').html() || giveawayURL.split('/').reverse()[1];

      $(el)
        .addClass('indiegala-giveaway')
        .attr('data-giveaway-id', giveawayID)
        .attr('data-giveaway-url', giveawayURL)
        .attr('data-product-type', productType)
        .attr('data-product-id', productID)
      
      $(el).find('.items-list-item > .relative').append(`<div class="items-list-item-loading"><i class="fa fa-spinner fa-pulse"></i></div>`);
      $(el).find('h5.items-list-item-title a').attr('data-original-title', $(el).find('h5.items-list-item-title a').html());

      //  Indicators
      //  Product type Badges
      let productStatusBadge = `
        <div class="absolute igh-rounded badge-top-left product-status-badge" title="" style="display:none;">
          <i class="fa fa-circle"></i>
        </div>`;

      //  Product type
      let indicatorsIcons = `
        <div class="items-list-item-indicators-icons-product igh-bg-white igh-rounded relative flex items-center justify-center igh-pa-sm" title="${productName}">
          <i class="fa fa-steam product-type-unknown-icon"></i>
          <a class="absolute fit" href="https://store.steampowered.com/${productType}/${productID}/" target="_blank"></a>
          ${productStatusBadge}
        </div>`;
      //  SteamDB
      indicatorsIcons += `
        <div class="items-list-item-indicators-icons-steamdb igh-bg-white igh-rounded relative flex items-center justify-center">
          <a class="absolute fit" href="https://steamdb.info/${productType}/${productID}" target="_blank" title="SteamDB"></a>
          <img alt="steamdb-logo" class="igh-pa-xxs" src="${chrome.runtime.getURL(`assets/images/icons/steamdb.svg`)}">
        </div>`;
      //  Giveaway owner
      indicatorsIcons += `
        <div class="items-list-item-indicators-icons-owner igh-bg-white igh-rounded relative flex items-center justify-center" title="">
          <a class="absolute fit" style="display:none;" href="" target="_blank"></a>
          <img class="igh-bg-white igh-rounded igh-pa-xxxs" src="">
          <div class="absolute igh-bg-info igh-text-white badge-bottom-right owner-level-badge igh-flex items-center no-wrap" title=""><i class="fa fa-spinner fa-pulse"></i></div>
        </div>`;
      // Giveaway description
      indicatorsIcons += `
        <div class="items-list-item-indicators-icons-description igh-bg-white igh-rounded relative flex items-center justify-center igh-pa-sm" title="__igh_description">
          <i class="igh-text-info fa fa-info-circle"></i>
        </div>`;

      let itemsListItemIndicators = `
        <div class="items-list-item-indicators relative justify-center">
          <div class="items-list-item-indicators-icons igh-row no-wrap items-center igh-gutter-x-sm">
            ${indicatorsIcons}
          </div>
        </div>`;
      //  items-list-item-indicators
      $(el)
        .find('h5.items-list-item-title')
        .after(itemsListItemIndicators);

      //  items-list-item-type
      let itemTypeHTML = $(el)
                          .find('.items-list-item-type').html()
                          .replaceAll('single ticket', `<i class="fa fa-ticket" title="Single ticket"></i>`)
                          .replaceAll('extra odds', `<i class="fa fa-cubes" title="Extra odds"></i>`);
      $(el).find('.items-list-item-type').html(itemTypeHTML);

      // Action buttons
      let productRefreshBtn = `
        <a class="items-list-item-type-left-btns-product-refresh igh-text-white" style="display:none;" href="javascript:;" title="Refresh product info">
          <i class="fa fa-refresh"></i>
        </a>`;
      let productKeyOwnershipBtn = `
        <a class="items-list-item-type-left-btns-key-ownership igh-text-white" style="display:none;" href="javascript:;" title="Toggle key owned (Steam)">
          <i class="fa fa-key"></i>
        </a>`;
      let productOwnershipBtn = `
        <a class="items-list-item-type-left-btns-product-ownership igh-text-white" style="display:none;" href="javascript:;" data-product-ownership="off" title="[OFF] Toggle product ownership">
          <i class="fa fa-bookmark-o"></i>
        </a>`;
      
      // Visibility buttons
      let ownerVisibilityBtn = `
        <a class="items-list-item-type-right-btns-owner-visibility igh-text-white" style="display:none;" href="javascript:;" data-owner-visibility="on" title="[ON] Owner visibility">
          <i class="fa fa-user"></i>
        </a>`;
      let productVisibilityBtn = `
        <a class="items-list-item-type-right-btns-product-visibility igh-text-white" style="display:none;" href="javascript:;" data-product-visibility="on" title="[ON] Product visibility">
          <i class="fa fa-bell-o"></i>
        </a>`;
      let giveawayVisibilityBtn = `
        <a class="items-list-item-type-right-btns-giveaway-visibility igh-text-white" style="display:none;" href="javascript:;" data-giveaway-visibility="on" title="[ON] Giveaway visibility">
          <i class="fa fa-eye"></i>
        </a>`;

      // Process giveaway
      let giveaway = {
        id: giveawayID,
        url: giveawayURL,
        productType: productType,
        productID: productID,
        productName: productName
      };

      //  Left buttons
      $(el)
        .find('.items-list-item-type')
        .append(`
          <div class="items-list-item-type-left-btns absolute-top-left igh-pl-sm igh-gutter-x-sm igh-row no-wrap">
            ${productRefreshBtn}
            ${productKeyOwnershipBtn}
            ${productOwnershipBtn}
          </div>`);
      $(el).find('.items-list-item-type-left-btns-product-refresh').on("click", function (e) { //  Product refresh info
        handleProductRefresh(giveaway, this);
      });
      $(el).find('.items-list-item-type-left-btns-key-ownership').on("click", function (e) { //  Toggle key owned
        toggleKeyOwnership(giveaway, this);
      });
      $(el).find('.items-list-item-type-left-btns-product-ownership').on("click", function (e) { //  Toggle product ownership
        toggleProductOwnership(giveaway, this);
      });

      //  Right buttons
      $(el)
        .find('.items-list-item-type')
        .append(`
          <div class="items-list-item-type-right-btns absolute-top-right igh-pr-sm igh-gutter-x-sm igh-row no-wrap">
            ${ownerVisibilityBtn}
            ${productVisibilityBtn}
            ${giveawayVisibilityBtn}
          </div>`);
      $(el).find('.items-list-item-type-right-btns-owner-visibility').on("click", function (e) { //  Owner visibility
        toggleOwnerVisibility(giveawayID, this);
      });
      $(el).find('.items-list-item-type-right-btns-product-visibility').on("click", function (e) { //  Product visibility
        toggleProductVisibility({ type: productType, id: productID, name: productName }, this);
      });
      $(el).find('.items-list-item-type-right-btns-giveaway-visibility').on("click", function (e) { //  Giveaway visibility
        toggleGiveawayVisibility(giveawayID, this);
      });

      processGiveaway(giveaway);
    }
  });
}
