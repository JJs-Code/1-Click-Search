// Background Service Worker for 1 Click Search
// Handles:
// 1. Detecting the user's browser default search engine
// 2. Updating the toolbar icon to match dark/light browser themes
// 3. Opening or focusing the Home tab when the toolbar icon is clicked
// 4. Learning favicons from visited tabs for use on the Home/Settings pages

/**
 * Extracts a friendly search engine name and root domain from a search result URL.
 * Used after running a probe query or user search to identify the browser's default engine.
 */
function resolveSearchEngineFromUrl(urlString) {
    try {
        if (!urlString || typeof urlString !== 'string') return null;
        if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) return null;

        const url = new URL(urlString);
        const host = url.hostname.toLowerCase();

        if (host.includes('google.')) return { name: 'Google', domain: 'google.com' };
        if (host.includes('bing.com')) return { name: 'Bing', domain: 'bing.com' };
        if (host.includes('duckduckgo.com')) return { name: 'DuckDuckGo', domain: 'duckduckgo.com' };
        if (host.includes('brave.com')) return { name: 'Brave Search', domain: 'search.brave.com' };
        if (host.includes('yahoo.com')) return { name: 'Yahoo', domain: 'search.yahoo.com' };
        if (host.includes('ecosia.org')) return { name: 'Ecosia', domain: 'ecosia.org' };
        if (host.includes('kagi.com')) return { name: 'Kagi', domain: 'kagi.com' };
        if (host.includes('startpage.com')) return { name: 'Startpage', domain: 'startpage.com' };
        if (host.includes('baidu.com')) return { name: 'Baidu', domain: 'baidu.com' };
        if (host.includes('yandex.')) return { name: 'Yandex', domain: 'yandex.com' };
        if (host.includes('qwant.com')) return { name: 'Qwant', domain: 'qwant.com' };

        // Fallback for custom search engines that have query parameters
        const hasQueryParam = url.searchParams.has('q') || url.searchParams.has('query') || url.searchParams.has('p') || url.searchParams.has('search') || url.searchParams.has('text');
        if (hasQueryParam) {
            const parts = host.replace(/^www\./, '').split('.');
            const cleanName = parts.length > 1 ? parts[parts.length - 2] : parts[0];
            const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
            return { name: capitalized, domain: host };
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Automatically detect default engine on first launch/install using an inactive background probe.
// Because Chrome's `search` API doesn't expose the default engine name directly, this opens a hidden
// background tab, runs a test search, reads the resulting URL, and immediately closes the tab.
function autoDetectDefaultSearchEngine() {
    chrome.storage.local.get(['confirmedDefaultSearch', 'autoDetectInProgress'], (data) => {
        // Skip if we already know the engine or another detection attempt ran within the last 10s
        if (data.confirmedDefaultSearch && data.confirmedDefaultSearch.name) return;
        if (data.autoDetectInProgress && (Date.now() - data.autoDetectInProgress < 10000)) return;

        chrome.storage.local.set({ autoDetectInProgress: Date.now() });

        // Open an inactive tab in the background so it doesn't steal focus
        chrome.tabs.create({ url: 'about:blank', active: false }, (tab) => {
            if (chrome.runtime.lastError || !tab || !tab.id) {
                chrome.storage.local.set({ autoDetectInProgress: null });
                return;
            }

            const targetTabId = tab.id;
            let finished = false;

            const closeTab = () => {
                if (finished) return;
                finished = true;
                chrome.storage.local.set({ autoDetectInProgress: null });
                chrome.tabs.remove(targetTabId, () => {
                    if (chrome.runtime.lastError) {}
                });
            };

            // Force-close the probe tab after 5 seconds if no search redirect is observed
            const safetyTimeout = setTimeout(closeTab, 5000);

            // Watch the probe tab until it navigates away from about:/chrome: to the search engine URL
            const probeListener = (tabId, changeInfo, updatedTab) => {
                if (tabId !== targetTabId) return;
                const url = changeInfo.url || updatedTab?.url;
                if (!url || url.startsWith('about:') || url.startsWith('chrome:')) return;

                const detected = resolveSearchEngineFromUrl(url);
                if (detected) {
                    clearTimeout(safetyTimeout);
                    chrome.tabs.onUpdated.removeListener(probeListener);
                    chrome.storage.local.set({
                        confirmedDefaultSearch: detected,
                        autoDetectInProgress: null,
                        awaitingDefaultSearchDetection: null
                    }, () => {
                        closeTab();
                    });
                }
            };

            chrome.tabs.onUpdated.addListener(probeListener);

            // Execute search targeting the inactive probe tab
            chrome.search.query({
                text: 'test',
                tabId: targetTabId
            }, () => {
                if (chrome.runtime.lastError) {
                    clearTimeout(safetyTimeout);
                    chrome.tabs.onUpdated.removeListener(probeListener);
                    closeTab();
                }
            });
        });
    });
}

/**
 * Switches the extension toolbar icon between White (for dark browser UI) and Black (for light UI).
 */
function updateToolbarIcon(isDark) {
    const variant = isDark ? 'White' : 'Black';
    chrome.action.setIcon({
        path: {
            "16": chrome.runtime.getURL(`Logo/Logo_${variant}_16x16.png`),
            "32": chrome.runtime.getURL(`Logo/Logo_${variant}_32x32.png`),
            "64": chrome.runtime.getURL(`Logo/Logo_${variant}_64x64.png`),
            "128": chrome.runtime.getURL(`Logo/Logo_${variant}_128x128.png`),
            "256": chrome.runtime.getURL(`Logo/Logo_${variant}_256x256.png`)
        }
    }, () => {
        // Ignore harmless errors if the action icon isn't ready yet
        if (chrome.runtime.lastError) {}
    });
}

/**
 * Restores the last known browser theme icon when the service worker wakes up.
 */
function restoreStoredToolbarIcon() {
    chrome.storage.local.get(['browserThemeIsDark'], (data) => {
        const isDark = typeof data.browserThemeIsDark === 'boolean' ? data.browserThemeIsDark : true;
        updateToolbarIcon(isDark);
    });
}

restoreStoredToolbarIcon();

// Auto-run on install and startup if engine not yet detected
chrome.runtime.onInstalled.addListener(() => {
    restoreStoredToolbarIcon();
    setTimeout(autoDetectDefaultSearchEngine, 1500);
});

chrome.runtime.onStartup.addListener(() => {
    restoreStoredToolbarIcon();
    setTimeout(autoDetectDefaultSearchEngine, 1500);
});

// Listen for messages from extension pages requesting detection or theme icon sync
chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (message.type === 'SYNC_COLOR_SCHEME') {
        const isDark = !!message.isDark;
        chrome.storage.local.set({ browserThemeIsDark: isDark });
        updateToolbarIcon(isDark);
        return;
    }
    if (message.type === 'CHECK_DEFAULT_SEARCH') {
        if (message.force) {
            chrome.storage.local.remove(['confirmedDefaultSearch', 'autoDetectInProgress'], () => {
                autoDetectDefaultSearchEngine();
            });
        } else {
            setTimeout(autoDetectDefaultSearchEngine, 1500);
        }
    }
});

// Clicking extension toolbar icon opens or switches to the home tab
chrome.action.onClicked.addListener(() => {
    const homeUrl = chrome.runtime.getURL('main.html');
    const isHomeTab = (t) => {
        const tabUrl = t.url || t.pendingUrl || '';
        return (
            tabUrl.startsWith(homeUrl) ||
            /^(chrome|edge|brave|vivaldi|opera):\/\/newtab\/?/i.test(tabUrl) ||
            t.title === 'Home: 1 Click Search'
        );
    };
    chrome.tabs.query({}, (tabs) => {
        const existingTab = tabs.find(isHomeTab);
        if (existingTab) {
            chrome.tabs.update(existingTab.id, { active: true });
            if (existingTab.windowId) {
                chrome.windows.update(existingTab.windowId, { focused: true });
            }
        } else {
            chrome.tabs.create({ url: homeUrl });
        }
    });
});

// User-initiated search detection and dynamic tab favicon learning.
// Whenever a tab updates, we:
// 1. Cache the site's favicon URL by hostname (and first path segment) for offline/fallback icon lookup
// 2. If the user just submitted a default-engine search, inspect the destination URL to confirm the engine
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const currentUrl = changeInfo.url || tab?.url;
    const favIconUrl = changeInfo.favIconUrl || tab?.favIconUrl;

    if (currentUrl && favIconUrl && /^https?:\/\//i.test(currentUrl) && /^https?:\/\//i.test(favIconUrl)) {
        try {
            const parsed = new URL(currentUrl);
            const cleanHost = parsed.hostname.replace(/^www\./, '').toLowerCase();
            const segments = parsed.pathname.split('/').filter(Boolean);
            const firstSegment = segments.length > 0 ? segments[0].toLowerCase() : '';
            if (cleanHost) {
                chrome.storage.local.get(['learnedFavicons'], (res) => {
                    const map = (res && res.learnedFavicons && typeof res.learnedFavicons === 'object') ? res.learnedFavicons : {};
                    map[cleanHost] = favIconUrl;
                    if (firstSegment) {
                        map[`${cleanHost}/${firstSegment}`] = favIconUrl;
                    }
                    chrome.storage.local.set({ learnedFavicons: map });
                });
            }
        } catch (e) {}
    }

    if (!currentUrl) return;

    chrome.storage.local.get(['awaitingDefaultSearchDetection', 'confirmedDefaultSearch'], (data) => {
        const awaitingTime = data.awaitingDefaultSearchDetection;
        const isAwaiting = awaitingTime && (Date.now() - awaitingTime < 30000);

        if (isAwaiting) {
            const detected = resolveSearchEngineFromUrl(currentUrl);
            if (detected) {
                chrome.storage.local.set({
                    confirmedDefaultSearch: detected,
                    awaitingDefaultSearchDetection: null
                });
            }
        }
    });
});
