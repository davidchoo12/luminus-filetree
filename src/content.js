// document.body.style.border = "5px solid red";
console.log('content.js loaded');
// cannot declare with let cos background.js executes content.js multiple time
var headers;
var contentCache = {};
/*
sample contentCache:
{
  "cebc70c2-0152-49a9-a000-e97082ca6f8a": {
    "key": "cebc70c2-0152-49a9-a000-e97082ca6f8a",
    "title": "20192020 Sem 1 IS4301 Tutorial 1.pdf",
    "dlUrl": "https://luminus.nus.edu.sg/v2/api/files/download/e7795140-7921-4eaa-b2fa-ba5b3e0fe496"
  },
  "b674ca1c-c226-44c4-b5e8-5d4b38e79dcb": {
    "key": "b674ca1c-c226-44c4-b5e8-5d4b38e79dcb",
    "title": "Tutorial instructions",
    "folder": true,
    "dlUrl": "https://luminus.nus.edu.sg/v2/api/files/download/5ad9ae00-8f1b-420c-968b-869b56a0ac6a"
  }
}
*/
async function traverse(folderId) {
  // add placeholder to query string to skip background js request filter, otherwise will trigger infinite recursion
  // let folders = await fetch("https://luminus.azure-api.net/files/?placeholder=1&populate=totalFileCount%2CsubFolderCount%2CTotalSize&ParentID=" + folderId, {
  //   "headers": headers,
  //   "mode": "cors"
  // })
  let folders = await browser.runtime.sendMessage({ query: 'folders', folderId })
  .then(e => {
    if (e.code != '200') {
      console.log('response not ok');
      return;
    }
    return e.data;
  });
  let files = await browser.runtime.sendMessage({ query: 'files', folderId })
  .then(e => {
    if (e.code != '200') {
      console.log('response not ok');
      return;
    }
    return e.data;
  });
  let filesPromises = files.map(async function (e) { // cannot use arrow function cos it preserves this keyword, aka cannot modify this keyword
    let fileCache = contentCache[e.id];
    // let fileCache = this.folderCache.find(f => f.key == e.id);
    // console.log('fileCache', fileCache);
    let dlUrl;
    if (fileCache && fileCache.dlUrl) {
      dlUrl = fileCache.dlUrl;
      // console.log('using cached file dlUrl', dlUrl);
    } else {
      dlUrl = await browser.runtime.sendMessage({ query: 'fileDlUrl', fileId: e.id })
      .then(body => body.data);
    }
    // console.log({ ...e, dlUrl });
    contentCache[e.id] = { key: e.id, title: e.name, dlUrl };
    return contentCache[e.id];
  }); // second arg is value to assign to this keyword in the function

  let foldersPromises = folders.map(async function (e) {
    let currFolderCache = contentCache[e.id];
    // let currFolderCache = this.folderCache.find(f => f.key == e.id);
    let dlUrl;
    if (currFolderCache && currFolderCache.dlUrl) {
      dlUrl = currFolderCache.dlUrl;
    } else {
      dlUrl = e.totalSize && await browser.runtime.sendMessage({ query: 'folderDlUrl', folderId: e.id })
      .then(body => body.data)
      .catch(console.error);
    }
    // let currFolderCacheChildren = [];
    // if (currFolderCache && currFolderCache.children) {
    //   currFolderCacheChildren = currFolderCache.children;
    // }
    let content = await traverse(e.id);
    // console.log({ key: e.id, title: e.name, folder: true, children: content, dlUrl });
    contentCache[e.id] = { key: e.id, title: e.name, folder: true, dlUrl };
    return { ...contentCache[e.id], children: content };
  });
  let currentContent = await Promise.all(foldersPromises.concat(filesPromises))
  .catch(console.error);
  // console.log(currentContent);
  // console.log(JSON.stringify(currentContent, null, 2));

  return currentContent;
}

function setupUI() {
  let parent = $('tool-content list-view'); //.empty();
  let defaultUI = parent.children('section');
  let filetreeUI = $('<div id="filetree" style="display:none"></div>');
  parent.append(filetreeUI);
  $('.breadcrumb')
  .after('<input id="filetree-toggler" type="checkbox"><label for="filetree-toggler">File tree</label>');
  $('#filetree-toggler').on('change', e => {
    if (e.target.checked) {
      defaultUI.hide();
      filetreeUI.show();
    } else {
      defaultUI.show();
      filetreeUI.hide();
    }
  });
}

function updateCache(moduleId, contentCache) {
  let moduleCache = {};
  moduleCache[moduleId] = contentCache;
  browser.storage.sync.set(moduleCache).catch(console.error);
}
// var once = true; // ensure filetree toggler 
async function receiver(message, sender, sendResponse) {
  console.log('content.js message received');
  // if ($('#filetree-toggler').length) { // filetree initiated, do nothing
  //   console.log('filetree initiated, do nothing');
  //   return;
  // }
  // if (!once) {
  //   console.log('twice');
  // }
  let observer = new MutationObserver(ms => {
    console.log('observer triggered');
    let breadcrumbMutation = ms.filter(m => m.target.classList.contains('breadcrumb'));
    if (!breadcrumbMutation.length) { // guard condition
      return;
    }
    if ($('#filetree-toggler').length) {
      console.log('filetree toggler exists, observer disconnecting');
      observer.disconnect();
      return;
    }
    let breadcrumb = breadcrumbMutation[0].target;
    console.log(breadcrumb);
    setupUI();
    once = false;
    observer.disconnect(); // ensure filetree toggler only added once
  });
  if ($('.breadcrumb').length && $('.breadcrumb').text().includes('Files') && !$('#filetree-toggler').length) {
    console.log('breadcrumb exists, setting up UI');
    setupUI();
  } else {
    console.log('observing breadcrumb');
    observer.observe(document.querySelector('body'), { childList: true, subtree: true });
  }

  // cannot implement subfolder filetree cos cannot scrape folderId from url cos angular updates the url slower than the extension script
  // let idToTraverse;
  // let folderId = window.location.href.match(/modules\/(.{36})\/files\/(.{36})/);
  let moduleId = window.location.href.match(/modules\/(.{36})/)[1];
  // console.log('folderId', folderId);
  // if (folderId) { // url has folder id (regex has match)
  //   folderId = folderId[2]; // extract the actual id
  //   idToTraverse = folderId;
  // } else {
  //   idToTraverse = moduleId;
  // }
  // console.log('idToTraverse', idToTraverse);
  let token = message;
  headers = {
    "Authorization": token,
    "Ocp-Apim-Subscription-Key": "6963c200ca9440de8fa1eede730d8f7e",
    "Connection": "keep-alive"
  };
  // console.log(token, moduleId);
  // let filestructurePromise = traverse(moduleId);
  // await browser.storage.sync.clear();
  let moduleCache = await browser.storage.sync.get(moduleId).catch(console.error);
  // empty cache is {}, make default as []
  // else is { (moduleId): [...] }
  if (Object.keys(moduleCache).length && moduleCache[moduleId]) {
    // moduleCache = moduleCache[moduleId];
    contentCache = moduleCache[moduleId];
    console.log(JSON.stringify(contentCache, null, 2));
  } else {
    moduleCache[moduleId] = [];
    browser.storage.sync.set(moduleCache);
  }
  // console.log('contentCache', contentCache);
  let filestructure = await traverse(moduleId);
  console.log('filestructure', filestructure);
  updateCache(moduleId, contentCache);

  // $('#filetree').empty();
  $('#filetree').fancytree({
    source: filestructure,
    clickFolderMode: 2,
    minExpandLevel: 5,
    renderNode: (event, data) => {
      let node = data.node;
      let dlUrl = node.data.dlUrl;
      let span = $(node.span);
      if (dlUrl && !span.children('a').length) {
        if (node.folder) {
          span.append('   ');
          let link = $('<a href="' + dlUrl + '">zip</a>');
          link.on('click', async e => {
            let dlUrl = await browser.runtime.sendMessage({ query: 'folderDlUrl', folderId: node.key })
            .then(body => body.data)
            .catch(console.error);
            e.target.href = dlUrl;
            contentCache[node.key].dlUrl = dlUrl;
            updateCache(moduleId, contentCache);
          });
          span.append(link);
        } else {
          span.append('   ');
          let link = $('<a style="display:none" href="' + dlUrl + '">dl</a>');
          link.on('click', async e => {
            let dlUrl = await browser.runtime.sendMessage({ query: 'fileDlUrl', fileId: node.key })
            .then(body => body.data)
            .catch(console.error);
            e.target.href = dlUrl;
            contentCache[node.key].dlUrl = dlUrl;
            updateCache(moduleId, contentCache);
          });
          span.append(link);
        }
      }
    },
    click: (event, data) => {
      let node = data.node;
      let dlUrl = node.data.dlUrl;
      if (!node.folder && dlUrl) {
        $(node.span).children('a')[0].click();
      }
    }
  });

  browser.runtime.onMessage.removeListener(receiver); // so that listener doesnt keep repeating per message received
}
browser.runtime.onMessage.addListener(receiver);
