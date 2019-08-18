// document.body.style.border = "5px solid red";
console.log('content.js loaded');
// cannot declare with let cos background.js executes content.js multiple time
var headers;
async function traverse(folderId) {
  // add placeholder to query string to skip background js request filter, otherwise will trigger infinite recursion
  let folders = await fetch("https://luminus.azure-api.net/files/?placeholder=1&populate=totalFileCount%2CsubFolderCount%2CTotalSize&ParentID=" + folderId, {
    "headers": headers,
    "mode": "cors"
  }).then(res => res.json())
  .then(e => {
    if (e.code != '200') {
      console.log('response not ok');
      return;
    }
    return e.data;
  });
  let files = await fetch('https://luminus.azure-api.net/files/' + folderId + '/file?populate=Creator%2ClastUpdatedUser%2Ccomment', {
    headers,
    mode: 'cors'
  }).then(res => res.json())
  .then(e => {
    if (e.code != '200') {
      console.log('response not ok');
      return;
    }
    return e.data;
  });
  let filesPromises = files.map(async e => {
    let dlUrl = await fetch('https://luminus.azure-api.net/files/file/' + e.id + '/downloadurl', {
      headers,
      mode: 'cors'
    })
    .then(res => res.json())
    .then(body => body.data);
    // console.log({ ...e, dlUrl });
    return { key: e.id, title: e.name, dlUrl };
  });

  let foldersPromises = folders.map(async e => {
    let dlUrl = e.totalSize && await fetch('https://luminus.azure-api.net/files/' + e.id + '/downloadurl', {
      headers,
      mode: 'cors'
    })
    .then(res => res.json())
    .then(body => body.data)
    .catch(console.error);
    let content = await traverse(e.id);
    // console.log({ key: e.id, title: e.name, folder: true, children: content, dlUrl });
    return { key: e.id, title: e.name, folder: true, dlUrl, children: content };
  });
  let currentContent = await Promise.all(foldersPromises.concat(filesPromises))
  .catch(console.error);
  // console.log(currentContent);
  // console.log(JSON.stringify(currentContent, null, 2));

  return currentContent;
}

async function receiver(message, sender, sendResponse) {
  console.log('content.js message received');
  // if ($('#filetree-toggler').length) { // filetree initiated, do nothing
  //   console.log('filetree initiated, do nothing');
  //   return;
  // }
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
  let filestructure = await traverse(moduleId);
  console.log('filestructure', filestructure);

  let parent = $('tool-content list-view'); //.empty();
  let defaultUI = parent.children('section');
  let filetreeUI = $('<div id="filetree" style="display:none"></div>');
  parent.append(filetreeUI);
  $('tool-layout > .fixed-things > tool-header > .breadcrumb')
  .after('<input id="filetree-toggler" type="checkbox"><label for="filetree-toggler">File tree</label>');
  $('#filetree-toggler').on('change', e => {
    if (e.target.checked) {
      defaultUI.hide();
      filetreeUI.show();
    } else {
      defaultUI.show();
      filetreeUI.hide();
    }
  })


  $('#filetree').fancytree({
    source: filestructure,
    clickFolderMode: 2,
    minExpandLevel: 2,
    renderNode: (event, data) => {
      let node = data.node;
      let dlUrl = node.data.dlUrl;
      let span = $(node.span);
      if (dlUrl && !span.children('a').length) {
        if (node.folder) {
          span.append('   ');
          let link = $('<a href="' + dlUrl + '">zip</a>');
          span.append(link);
        } else {
          span.append('   ');
          let link = $('<a style="display:none" href="' + dlUrl + '">dl</a>');
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