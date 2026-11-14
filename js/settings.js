// Settings Coordinator
const versionElem = document.getElementById('version');
if (versionElem && typeof versionNo !== 'undefined') {
    versionElem.textContent = 'Version ' + versionNo;
}

function handleUrlNavigation() {
    const currentUrl = window.location.href;    
    for (const pageName in menuPages) {
        const itemId = menuPages[pageName];
        const menuItemElement = document.getElementById(itemId);
        if (menuItemElement) menuItemElement.classList.remove('active');
        if (currentUrl.includes(pageName)) {
            if (menuItemElement) menuItemElement.classList.add('active');
        }      
    }
    setTimeout(() => { 
        if (typeof setupAllToggles === 'function') setupAllToggles(); 
        if (typeof setActiveBookmarkSideTab === 'function') {
            setActiveBookmarkSideTab(localStorage.getItem('activeBookmarkSide') === 'right' ? 'right' : 'left');
        }
    }, 5);
}

window.addEventListener('hashchange', handleUrlNavigation);
handleUrlNavigation();

// Logo switches to existing home tab if open, otherwise opens home page in the same tab
const logoContainer = document.getElementById('logoContainer');
if (logoContainer) {
    logoContainer.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query && chrome.runtime && chrome.runtime.getURL) {
            const homeUrl = chrome.runtime.getURL('main.html');
            const isHomeTab = (t) => {
                const tabUrl = t.url || t.pendingUrl || '';
                return (
                    tabUrl.startsWith(homeUrl) ||
                    /^(chrome|edge|brave|vivaldi|opera):\/\/newtab\/?/i.test(tabUrl) ||
                    t.title === 'Home: 1 Click Search'
                );
            };
            chrome.tabs.query({}, function(tabs) {
                const existingTab = tabs && tabs.find(isHomeTab);
                if (existingTab) {
                    chrome.tabs.update(existingTab.id, { active: true });
                    if (existingTab.windowId && chrome.windows) {
                        chrome.windows.update(existingTab.windowId, { focused: true });
                    }
                } else {
                    window.location.href = 'main.html';
                }
            });
        } else {
            window.location.href = 'main.html';
        }
    });
}