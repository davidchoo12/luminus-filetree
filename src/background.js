function listener(requestDetails) {
  console.log('background.js triggered');
  // console.log(requestDetails);
  // console.log(requestDetails.method + requestDetails.url);
  // let match = requestDetails.url.match(/ParentID=(.+)/);
  // if (match) {
  //   let moduleId = match[1]; // the ParentID capture group
  // }
  let tokenFilter = requestDetails.requestHeaders.filter(e => e.name == 'Authorization');
  // let refererFilter = requestDetails.requestHeaders.filter(e => e.name == 'Referer'); // to get mod id from headers
  if (tokenFilter.length > 0 && requestDetails.method == 'GET') { // filter for only GET method calls cos requests always comes in OPTION and GET pairs, and i just need 1
    let token = tokenFilter[0].value;
    // let moduleId = refererFilter[0].value.match(/modules\/(.{36})/)[1];
    // console.log(token);
    // console.log('executing content.js');
    browser.tabs.insertCSS({ file: 'ui.fancytree.min.css' })
    .then(() => browser.tabs.insertCSS({ file: 'custom.css' }))
    .then(() => browser.tabs.executeScript({ file: 'jquery.min.js' }))
    .then(() => browser.tabs.executeScript({ file: 'jquery.fancytree-all-deps.min.js' }))
    .then(() => browser.tabs.executeScript({ file: 'content.js' }))
    .then(result => {
      console.log('result', result);
      var querying = browser.tabs.query({
          active: true,
          currentWindow: true
      });
      return querying;
    }).then(tabs => {
      console.log('tabs', tabs);
      browser.tabs.sendMessage(tabs[0].id, token);
    });
  }
  // return { cancel: true }; // dont continue the request, let content.js handle
}

browser.webRequest.onBeforeSendHeaders.addListener(
  listener,
  {urls: ['https://luminus.azure-api.net/files/?populate=totalFileCount%2CsubFolderCount%2CTotalSize&ParentID=*']},
  ['blocking', 'requestHeaders']
);
