console.log('[IG Helper Extension] indiegala-giveaways-card');
//  *-----------*
//  | VARIABLES |
//  *-----------*
var indiegala_giveaways_card = {
  loaded: false,
  loading: true,
  interval: { indiegala: null, init: null, }
};
var settings = {};
var account = {};
var platform = {};
var giveawaysDB = {};
var usersDB = {};
var steam = { app: {}, sub: {} };

//  *---------*
//  | ON LOAD |
//  *---------*
initGiveawaysCard();

//  *-----------*
//  | FUNCTIONS |
//  *-----------*
async function initGiveawaysCard() {
  await resetGiveaways();
  $('.card-page').addClass('relative');
  if ($('.card-contents-loading').length === 0)
    $('.card-page').append(`<div class="card-contents-loading"><i class="fa fa-spinner fa-pulse"></i></div>`);

  // Wait for indiegala variable
  await new Promise(resolve => {
    indiegala_giveaways_card.interval.indiegala = setInterval(function () {
      if (typeof indiegala !== 'undefined') {
        clearInterval(indiegala_giveaways_card.interval.indiegala);
        resolve();
      }
    }, 200)
  });

  account = await getAccountInfo();
  if (typeof account !== 'undefined' && ghf.is.json(account) && account?.sessionid) {
    settings = await getSettings();
    await new Promise(async (resolve) => {
      giveawaysDB = await ehf.storage.local.get('indiegalaGiveaways');
      usersDB = await ehf.storage.local.get('indiegalaUsers');
      steam.app = await ehf.storage.local.get('steamApps');
      steam.sub = await ehf.storage.local.get('steamSubs');
      platform = await getPlatformsOwnedProducts();
      resolve();
    });

    indiegala_giveaways_card.interval.init = setInterval(function () {
      if (!ghf.is.jsonEmpty(platform)
        && !ghf.is.jsonEmpty(settings)
        && $('.card-title > a').length > 0
        && $('.card-contents-loading').length > 0
      ) {
        clearInterval(indiegala_giveaways_card.interval.init);
        setTimeout(function () {
          $('.card-contents-loading').hide();
          indiegala_giveaways_card.loading = false;
          indiegala_giveaways_card.loaded = true;
          checkGiveaway();
        }, 500)
      }
    }, 200)
  } else {
    indiegala_giveaways_card.interval.init = setInterval(function () {
      if ($('.card-title > a').length > 0
        && $('.card-contents-loading').length > 0
      ) {
        clearInterval(indiegala_giveaways_card.interval.init);
        setTimeout(function () {
          $('.card-contents-loading').hide();
          indiegala_giveaways_card.loading = false;
          indiegala_giveaways_card.loaded = true;
        }, 500)
      }
    }, 200)
  }
}

async function resetGiveaways() {
  $('.card-contents-loading').show();
  indiegala_giveaways_card.loaded = false;
  indiegala_giveaways_card.loading = true;

  ghf.json.each(indiegala_giveaways_card.interval, function (key, value) {
    if (value !== null) {
      clearInterval(indiegala.interval[key]);
      value = null;
    }
  });
  account = {};
  platform = {};
  giveawaysDB = {};
  usersDB = {};
  steam = { app: {}, sub: {} };
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
              updateSteamLoginIndicator({ status: 'warning', tooltip: '🟡 There was a problem loading your owned Steam products', });
            }
          }).finally(() => { resolve(); });
      });
    } else if (
      platformKey === 'steam' 
      && (!(await checkSteamLogin()) 
        || (ownedProductsApp.length === 0 && ownedProductsSub.length === 0))
    ) {
      platformJSON.metadata.failedRequest = true;
      updateSteamLoginIndicator({ status: 'warning', tooltip: '🟡 There was a problem loading your owned Steam products', });
    }
    platformJSON.ownedProducts.app = ownedProductsApp;
    platformJSON.ownedProducts.sub = ownedProductsSub;
    platformJSON.ownedKeys.app = ownedKeysApp;
    platformJSON.ownedKeys.sub = ownedKeysSub;
  });
  return platforms;
}

function handleProductRefresh (giveaway, el) {
  $('.card-contents-loading').show();
  $('.card-page')
    .removeAttr('data-owned-platforms')
    .removeAttr('data-mentioned-platforms')
  $('.card-indicators-platforms').remove();
  processGiveaway(giveaway, { update: true });
}

async function toggleKeyOwnership(giveaway, el) {
  if (platform['steam'].ownedKeys[giveaway.productType].includes(giveaway.productID)) {
    platform['steam'].ownedKeys[giveaway.productType] = platform['steam'].ownedKeys[giveaway.productType].filter(id => id !== giveaway.productID)
  } else {
    platform['steam'].ownedKeys[giveaway.productType].push(giveaway.productID);
  }
  await ehf.storage.local.set(`steam_ownedKeys${ghf.camelize(giveaway.productType, { upperCamelCase: true })}`, platform['steam'].ownedKeys[giveaway.productType]);
  $('.card-contents-loading').show();
  $('.card-page')
    .removeAttr('data-owned-platforms')
    .removeAttr('data-mentioned-platforms')
  $('.card-indicators-platforms').remove();
  processGiveaway({
    id: giveaway.id,
    url: giveaway.url,
    productType: giveaway.productType,
    productID: giveaway.productID,
    productName: giveaway.productName,
  });
}
async function toggleProductOwnership(giveaway, el) {
  let mentionedPlatforms = ($(`.card-page`).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');
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
    $('.card-page').removeAttr('data-owned-platforms').find('.card-contents-loading').show();
    let productOwnershipBtn = $('.card-indicators-btns-product-ownership');
    if (ownership === 'off') {
      $(productOwnershipBtn).find('i').removeClass('fa-bookmark-o').addClass('fa-bookmark');
    } else {
      $(productOwnershipBtn).find('i').removeClass('fa-bookmark').addClass('fa-bookmark-o');
    }
    $(productOwnershipBtn).find('a').attr('data-product-ownership', newOwnership).attr('title', `[${newOwnership.toUpperCase()}] Toggle product ownership (${platform[mentionedPlatforms[0]].name})`);
    $('.card-indicators-platforms').remove();
    processGiveaway({
      id: giveaway.id,
      url: giveaway.url,
      productType: giveaway.productType,
      productID: giveaway.productID,
      productName: giveaway.productName,
    });
  }
}

async function getGiveawayData(giveaway) {
  let html = $('html').html();
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
  ) {
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
          console.log('Product update - [', giveaway.productType, '] ', giveaway.productID, ': ', productFetchData);
        }
        steam[giveaway.productType][giveaway.productID] = productFetchData;
        await ehf.storage.local.set(`steam${ghf.camelize(giveaway.productType, { upperCamelCase: true })}s`, steam[giveaway.productType])
        if (processData !== undefined) {
          processProduct(processData);
        }
        processProduct(giveaway);
        handleGiveawayLoading();
      });
  }
}
async function getOwnerData(giveaway) {
  let ownerID = giveawaysDB[giveaway.id].owner.id;
  if (usersDB[ownerID] === undefined) {
    let giveawayData = giveawaysDB[giveaway.id];
    let giveawayOwner = ghf.json.parse(ghf.json.stringify(giveawayData.owner));
    
    if (usersDB[giveawaysDB[giveaway.id].owner.id] === undefined) {
      giveawayOwner = { ...{ status: 'active', reputation: '0', reputationCount: '+0 | -0', level: '0', giveawaysCreated: '0', __settings: { lastUpdate: Date.now(), visible: true, } }, ...giveawayOwner };
    } else {
      giveawayOwner = { ...giveawayOwner, ...usersDB[giveawaysDB[giveaway.id].owner.id] };
      processOwner(giveaway);
    }
    ghf.json.value(giveawayOwner, '__settings.lastUpdate', Date.now());
    ghf.json.value(giveawayOwner, '__settings.visible', (usersDB?.[giveawaysDB[giveaway.id].owner.id]?.__settings?.visible ?? true));

    if (giveawayOwner.url !== '') {
      let html = await ehf.fetch(giveawayOwner.url).catch(() => { return 'removed' });
      try {
        if (html === 'removed') {
          giveawayOwner.status = 'removed';
        } else {
          giveawayOwner.status = $(html).find('.user-card-status').html();
          giveawayOwner.reputation = $(html).find('.user-card-giveaways .user-card-reputation').html();
          giveawayOwner.reputationCount = $(html).find('.user-card-giveaways .user-card-reputation-count').html();
          giveawayOwner.level = $(html).find('.user-card-giveaways .user-card-body-col:nth-child(2) .user-card-body-content').html();
          giveawayOwner.giveawaysCreated = $(html).find('.user-card-giveaways .user-card-body-sep ~ .user-card-body-col-left:first .user-card-body-content').html();
        }
      } catch (e) {
        console.error('getOwnerData id:', giveaway.id, '; error: ', e);
        getOwnerData(giveaway);
      }
    } else {
      giveawayOwner.level = '';
    }
    usersDB[giveawayOwner.id] = giveawayOwner;
    await ehf.storage.local.set('indiegalaUsers', usersDB)
    processOwner(giveaway);
  }
}

function checkProductOwnership(giveaway) {
  if (+giveaway.id > 0 && steam[giveaway.productType]?.[giveaway.productID] === undefined) {
    checkProductOwnership(giveaway);
  } else if (+giveaway.id > 0 && steam[giveaway.productType]?.[giveaway.productID] !== undefined) {
    let el = $(`.card-page`);
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
      let productOwnershipBtn = $(el).find('.card-indicators-btns-product-ownership');
      let owned = platform[mentionedPlatforms[0]].ownedProducts[giveaway.productType].includes(+giveaway.productID);
      let ownership = owned ? 'on' : 'off';
      if (ownership === 'off') {
        $(productOwnershipBtn).find('i').removeClass('fa-bookmark').addClass('fa-bookmark-o');
      } else {
        $(productOwnershipBtn).find('i').removeClass('fa-bookmark-o').addClass('fa-bookmark');
      }
      $(productOwnershipBtn).find('a').attr('data-product-ownership', ownership).attr('title', `[${ownership.toUpperCase()}] Toggle product ownership (${platform[mentionedPlatforms[0]].name})`).show();
      $(productOwnershipBtn).show();
    }
  }
}
function colorGiveaway(giveaway) {
  if (+giveaway.id > 0) {
    let el = $(`.card-page`);

    $(el).find('.card-title > h1').css('background', 'white');
    $(el).find('.card-title > h1').attr('class', '');
    $(el).find('.card-ticket').css('background', 'white');
    $(el).find('.card-ticket').removeClass(`igh-text-light-grey igh-text_outline-black`);
    $(el).find('.card-join-info').removeClass(`igh-text-light-grey`);
    if (!$(el).hasClass('card-blackout')) {
      let ownedPlatforms = ($(el).attr('data-owned-platforms') || '').split(';').filter(p => p !== '');
      let mentionedPlatforms = ($(el).attr('data-mentioned-platforms') || '').split(';').filter(p => p !== '');
      mentionedPlatforms = (mentionedPlatforms.length === 0 ? ['steam'] : mentionedPlatforms);
      if (ownedPlatforms.length > 0) {
        let gradient = [];
        ghf.each(ownedPlatforms, function (platformKey) { gradient.push(platform[platformKey].gradient.join(',')); });
        if (mentionedPlatforms.filter((mp) => !ownedPlatforms.includes(mp)).length === 0) {
          $(el).find('.card-title > h1').css('background', 'linear-gradient(135deg,' + gradient.join(',') + ')');
          $(el).find('.card-title > h1').addClass('igh-text-light-grey igh-text_outline-black');
          $(el).find('.card-join-info').addClass(`igh-text-light-grey`);
        }
        $(el).find('.card-ticket').css('background', 'linear-gradient(135deg,' + gradient.join(',') + ')');
        $(el).find('.card-ticket').addClass(`igh-text-light-grey igh-text_outline-black`);
        $(el).find('.card-join-info').addClass(`igh-text-light-grey`);
      }
      if (mentionedPlatforms.filter((mp) => !ownedPlatforms.includes(mp)).length > 0) {
        if (mentionedPlatforms.length > 1) {
          $(el).find('.card-title > h1').addClass('igh-text-gold-gradient');
        } else if (mentionedPlatforms.length === 1) {
          $(el).find('.card-title > h1').addClass((mentionedPlatforms[0] !== 'steam' ? `igh-text-${mentionedPlatforms[0]}` : ''));
        }
      }
    }
  }
}
function processGiveaway(giveaway, force = {}) { // TODO DA
  const { update } = force;
  if (giveawaysDB[giveaway.id] === undefined) {
    getGiveawayData(giveaway);
  } else {
    $('.card-page').attr('data-owner-id', giveawaysDB[giveaway.id].owner.id);

    processProduct(giveaway, { update });

    let giveawayData = giveawaysDB[giveaway.id];
    //  "Blackout" own giveaways || Giveaways with too high of a level
    if (giveawayData.owner.id === account.id
      || giveawayData.level > account.current_level) {
      $('.card-page').addClass('card-blackout');
    }

    //  Giveaway owner
    $('.card-indicators-icons-owner').attr('title', giveawayData.owner.name);
    $('.card-indicators-icons-owner img').attr('src', giveawayData.owner.avatar)
    if (giveawayData.owner.url !== '') {
      $('.card-indicators-icons-owner a').attr('href', giveawayData.owner.url).attr('target', '_blank').show();
    } else {
      $('.card-indicators-icons-owner').addClass('igh-bg-indiegala');
    }
    processOwner(giveaway);

    //  Giveaway description && mentioned platforms && feudalife in description
    $('.card-indicators-icons-description').attr('title', giveawayData.description);
    if ($('.card-page').attr('data-mentioned-platforms') === undefined) {
      $('.card-indicators-icons-description .platform-badge').remove();
      $('.card-indicators-icons-description .feudalife-badge').remove();
      let mentionedPlatforms = '';
      ghf.json.each(platform, function (platformKey, platformJSON) {
        if (platformKey !== 'steam'
          && platformJSON.keyWords.some((keyWord) => { return giveawayData.description.toLowerCase().indexOf(keyWord) > -1 })
        ) {
          mentionedPlatforms += (mentionedPlatforms.length ? ';' : '') + platformKey;
          $(`.card-indicators-icons-description`)
            .append(`
              <div class="absolute igh-rounded badge-top-right platform-badge" data-platform="${platformKey}">
                <img alt="${platformKey}-logo" title="${platformJSON.name}" src="${platformJSON.iconUrl}" class="igh-rounded">
              </div>`);
        }
      });
      if (giveawayData.description.toLowerCase().indexOf('feudalife') > -1
        || giveawayData.description.toLowerCase().indexOf('gameplay giveaway') > -1) {
        $('.card-indicators-icons-description')
          .append(`
            <div class="absolute igh-rounded badge-bottom-left feudalife-badge">
              <img alt="feudalife-logo" title="Feudalife" src="${chrome.runtime.getURL(`assets/images/icons/feudalife.png`)}" class="igh-rounded">
            </div>`)
      };
      if (mentionedPlatforms.length) { $('.card-page').attr('data-mentioned-platforms', mentionedPlatforms); };
    }

    //  Giveaway btns
    // Product refresh btn
    if (steam[giveaway.productType]?.[giveaway.productID] !== undefined) {
      $('.card-indicators-btns-product-refresh').show();
      // Product ownership btn
      // checkProductOwnership(giveaway);
    }
    
    //  Giveaway color
    colorGiveaway(giveaway);

    handleGiveawayLoading();
  }
}
async function processProduct(giveaway, force = {}) {
  const { update } = force;
  let productData = steam[giveaway.productType][giveaway.productID];
  if (productData === undefined
    || update
  ) {
    getProductData(giveaway, { update });
  } else {
    $('.card-title h1').attr('title', productData.data.name).html(productData.data.name);
    if (productData.data.header_image && $('.card-main-img img').attr('data-original-src') !== $('.card-main-img img').attr('src')) {
      $('.card-main-img img')
        .attr('data-original-src', $('.card-main-img img').attr('src'))
        .attr('src', productData.data.header_image)
      $('.card-outer-bg-gradient-inner')
        .css('background', `rgba(0, 0, 0, 0) url("${productData.data.header_image}") no-repeat scroll 50% 50% / cover padding-box border-box`);
    } else if (ghf.is.array(productData.data.apps)
      && productData.data.apps.length === 1
      && steam.app[productData.data.apps[0].id]
      && steam.app[productData.data.apps[0].id].data.header_image
        && $('.card-main-img img').attr('data-original-src') !== $('.card-main-img img').attr('src')
    ) {
      $('.card-main-img img')
        .attr('data-original-src', $('.card-main-img img').attr('src'))
        .attr('src', steam.app[productData.data.apps[0].id].data.header_image)
      $('.card-outer-bg-gradient-inner')
        .css('background', `rgba(0, 0, 0, 0) url("${steam.app[productData.data.apps[0].id].data.header_image}") no-repeat scroll 50% 50% / cover padding-box border-box`);
    }

    let giveawayID = $('.card-page').attr('data-giveaway-id');
    let giveawayURL = $('.card-page').attr('data-giveaway-url');

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
    $('.card-indicators-icons-product')
      .attr('title', (appType === 'dlc' ? appType.toUpperCase() : ghf.camelize(appType, { upperCamelCase: true })));

    //  Product icon
    if (!!productIcon) {
      $(`.card-indicators-icons-product > i`)
        .attr('class', `igh-pa-xxxs fa ${productIcon} product-type-${appType}-icon`);
    }
    //  Product status
    $(`.card-indicators-icons-product .product-status-badge`)
      .attr('title', ghf.camelize(productStatus, { upperCamelCase: true }).replace('-', ' '))
      .addClass(`igh-text-${productStatus}`)
      .show();

    //  Product base game badges
    if (appType === 'dlc' || appType === 'music') {
      $('.card-indicators-icons-product .product-base-game-badge').remove();
      $('.card-indicators-icons-product .product-base-game-owned-badge').remove();
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

        $('.card-indicators-icons-product')
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
          $(`.card-indicators-icons-product`)
            .append(`
                <div class="absolute igh-text-positive badge-bottom-left product-base-game-owned-badge igh-flex items-center no-wrap" title="${baseGameOwned}">
                  <i class="fa fa-circle"></i>
                </div>`);
        }
      }
    }

    //  Product package
    let packageInfo = { platform: {}, title: { ownedApps: '', ownedKeys: '', apps: '', }, };
    if (appType === 'package') {
      $('.card-indicators-icons-product .package-owned-apps-badge').remove();
      $('.card-indicators-icons-product .package-owned-keys-badge').remove();
      $('.card-indicators-icons-product .package-apps-badge').remove();
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

        $('.card-indicators-icons-product')
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

        $('.card-indicators-icons-product')
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

        $('.card-indicators-icons-product')
          .append(`
              <div 
                class="absolute igh-bg-info igh-text-white badge-bottom-right package-apps-badge igh-flex items-center no-wrap" 
                title="${packageInfo.title.apps}" 
              >
                ${productData.data.apps.length}
              </div>`);
      }
    }

    //  Products owned in platforms
    $('.card-page').removeAttr('data-owned-platforms');
    $('.card-indicators-platforms').remove();
    // $('.card-indicators-btns-key-ownership').show();
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
          $('.card-indicators-btns-key-ownership').hide();

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
          `<div class="card-indicators-platforms-${platformKey} igh-row no-wrap items-center">
              <div class="relative flex items-center">
                <img alt="${platformKey}-logo" title="Owned in ${platformJSON.name}" data-platform="${platformKey}" class="platform-icon" src="${platformJSON.iconUrl}">
                ${badge}
              </div>
            </div>`;

        ownedPlatforms += (ownedPlatforms.length ? ';' : '') + platformKey;
      }
    });
    if (ownedPlatforms.length) {
      $('.card-indicators > div')
        .append(`
            <div class="card-indicators-platforms igh-row no-wrap items-center igh-gutter-x-sm absolute absolute-right igh-pr-sm">
              ${ownedPlatformsHtml}
            </div>`);
    }
    $('.card-page').attr('data-owned-platforms', ownedPlatforms);

    //  Giveaway btns
    $('.card-indicators-btns-product-refresh').show();
    // checkProductOwnership(giveaway);

    //  Giveaway color
    colorGiveaway({
      id: giveawayID,
      url: giveawayURL,
      productType: giveaway.productType,
      productID: giveaway.productID,
      productName: giveaway.productName
    });

    handleGiveawayLoading();
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
      let status = ownerData.status;
      let statusIcon = (status === 'active' ? '🟢' : status === 'banned' ? '🔴' : status === 'removed' ? '⚫' : '⚪');
      $(`.card-indicators-icons-owner`)
        .attr('title', `Username: ${ownerData.name}\nLevel: ${ownerData.level}\nStatus: ${statusIcon} ${ghf.camelize(status, { upperCamelCase: true })}\nGiveaways created: ${giveawaysCreated}\n👍: ${reputationCountPositive} (${reputationPercentagePositive}%)\n👎: ${reputationCountNegative} (${reputationPercentageNegative}%)\n❔: ${reputationCountUnknown} (${reputationPercentageUnknown}%)`);
    }
    $(`.card-indicators-icons-owner`).css('background', reputationBorder);
    if (!!ownerData.level) {
      $(`.card-indicators-icons-owner .owner-level-badge`).show()
        .attr('title', `User level ${ownerData.level}`).html(ownerData.level);
    }
    if (ownerID === '') {
      $(`.card-indicators-icons-owner .owner-level-badge`).hide();
    }

    if ((usersDB[ownerID].__settings.lastUpdate + (24 * 60 * 60 * 1000)) < Date.now()) {
      getOwnerData(giveaway);
    }
  }
}
function handleGiveawayLoading () {
  if ($('.card-page').attr('data-owner-id') !== undefined && $('.card-page').attr('data-owned-platforms') !== undefined) {
    $('.card-page').find('.card-contents-loading').hide();
  }
}
function checkGiveaway() {
  if ($('.card-indicators').length === 0) {
    $('.card-title h1').attr('data-original-title', $('.card-title h1').html());
    $('.card-title > a').hide();

    let giveawayURL = ghf.url.path();
    let giveawayID = $('.card-join-info strong').html() || giveawayURL.split('/').reverse()[0];
    let headerURL = $('.card-main-img img').attr('src');
    let productType = headerURL.split('/').reverse()[2];
    productType = productType.substring(0, productType.length-1);
    let productID = ghf.number(headerURL.split('/').reverse()[1]);
    let productName = $('.card-main-img img').attr('alt') || $('.card-title h1').html() || giveawayURL.split('/').reverse()[1];

    $('.card-page')
      .attr('data-giveaway-id', giveawayID)
      .attr('data-giveaway-url', giveawayURL)
      .attr('data-product-type', productType)
      .attr('data-product-id', productID)

    // Indicators
    // Product type Badges
    let productStatusBadge = `
      <div class="absolute igh-rounded badge-top-left product-status-badge" title="" style="display:none;">
        <i class="fa fa-circle"></i>
      </div>`;

    // Product type
    let indicatorsIcons = `
      <div class="card-indicators-icons-product igh-bg-white igh-rounded relative flex items-center justify-center" title="${productName}">
        <i class="igh-pa-xxxs fa fa-steam product-type-unknown-icon"></i>
        <a class="absolute fit" href="https://store.steampowered.com/${productType}/${productID}/" target="_blank"></a>
        ${productStatusBadge}
      </div>`;
    // SteamDB
    indicatorsIcons += `
      <div class="card-indicators-icons-steamdb igh-bg-white igh-rounded relative flex items-center justify-center">
        <a class="absolute fit" href="https://steamdb.info/${productType}/${productID}" target="_blank" title="SteamDB"></a>
        <img alt="steamdb-logo" class="igh-pa-xxxs" src="${chrome.runtime.getURL(`assets/images/icons/steamdb.svg`)}">
      </div>`;
    // Giveaway owner
    indicatorsIcons += `
      <div class="card-indicators-icons-owner igh-bg-white igh-rounded relative flex items-center justify-center" title="">
        <a class="absolute fit" style="display:none;" href="" target="_blank"></a>
        <img class="igh-bg-white igh-rounded igh-pa-xxxs" src="">
        <div class="absolute igh-bg-info igh-text-white badge-bottom-right owner-level-badge igh-flex items-center no-wrap" title=""><i class="fa fa-spinner fa-pulse"></i></div>
      </div>`;
    // Giveaway description
    indicatorsIcons += `
      <div class="card-indicators-icons-description igh-bg-white igh-rounded relative flex items-center justify-center" title="__igh_description">
        <i class="igh-text-info igh-pa-xxxs fa fa-info-circle"></i>
      </div>`;

    // Refresh button
    let indicatorsBtns = `
      <div class="card-indicators-btns-product-refresh igh-bg-white igh-rounded relative flex items-center justify-center" style="display:none;">
        <i class="igh-pa-xxxs fa fa-refresh"></i>
        <a class="absolute fit" href="javascript:;" title="Refresh Product info"></a>
      </div>`;
    
    // Key ownership button
    indicatorsBtns += `
      <div class="card-indicators-btns-key-ownership igh-bg-white igh-rounded relative flex items-center justify-center" style="display:none;">
        <i class="igh-pa-xxxs fa fa-key"></i>  
        <a class="absolute fit" href="javascript:;" title="Toggle key owned (Steam)"></a>
      </div>`;

    // Ownership button
    indicatorsBtns += `
      <div class="card-indicators-btns-product-ownership igh-bg-white igh-rounded relative flex items-center justify-center" style="display:none;">
        <i class="igh-pa-xxxs fa fa-bookmark-o"></i>
        <a class="absolute fit" href="javascript:;" data-product-ownership="off" title="[OFF] Toggle product ownership"></a>
      </div>`;

    let cardIndicators = `
      <section class="card-indicators relative justify-center">
        <div class="fit">
          <div class="card-indicators-btns igh-row no-wrap items-center igh-gutter-x-sm absolute absolute-left igh-pl-sm">
            ${indicatorsBtns}
          </div>
          <div class="card-indicators-icons igh-row no-wrap items-center igh-gutter-x-sm absolute absolute-center">
            ${indicatorsIcons}
          </div>
        </div>
      </section>`;

    $('.card-title').after(cardIndicators);

    let giveaway = {
      id: giveawayID,
      url: giveawayURL,
      productType: productType,
      productID: productID,
      productName: productName,
    }

    // Buttons
    $('.card-indicators-btns-product-refresh > a').on("click", function (e) { //  Product refresh info
      handleProductRefresh(giveaway, this);
    });
    $('.card-indicators-btns-key-ownership > a').on("click", function (e) { //  Toggle key owned
      toggleKeyOwnership(giveaway, this);
    });
    $('.card-indicators-btns-product-ownership > a').on("click", function (e) { //  Toggle product ownership
      toggleProductOwnership(giveaway, this);
    });

    processGiveaway(giveaway);
  }
}
