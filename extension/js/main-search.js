// Main Search & Bookmarks View Controller (Home Page)
// Manages the live clock, pinned default search + custom search bars, keyboard shortcuts,
// left/right bookmark columns, direct home-page drag-and-drop + delete bin, dynamic layout sizing,
// cross-tab storage synchronization, and the interactive onboarding walkthrough.
(function() {
    let searchUrls = defaultSearches;
    let rawSearchData = localStorage.getItem("searchData");
    if (rawSearchData === null) {
        rawSearchData = localStorage.getItem("schData");
        if (rawSearchData !== null) {
            localStorage.setItem("searchData", rawSearchData);
            localStorage.removeItem("schData");
        }
    }
    if (rawSearchData) {
        try {
            const parsed = JSON.parse(rawSearchData);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                searchUrls = parsed;
            }
        } catch(e) {}
    }

    let bookmarkLeftData = defaultLeftBookmarks;
    let rawLeftBookmark = localStorage.getItem('bookmarkLeftData');
    if (rawLeftBookmark === null) {
        rawLeftBookmark = localStorage.getItem('bmLeftData');
        if (rawLeftBookmark !== null) {
            localStorage.setItem('bookmarkLeftData', rawLeftBookmark);
            localStorage.removeItem('bmLeftData');
        }
    }
    if (rawLeftBookmark) {
        try {
            const parsed = JSON.parse(rawLeftBookmark);
            if (parsed && typeof parsed === 'object') bookmarkLeftData = parsed;
        } catch(e) {}
    }

    let bookmarkRightData = defaultRightBookmarks;
    let rawRightBookmark = localStorage.getItem('bookmarkRightData');
    if (rawRightBookmark === null) {
        rawRightBookmark = localStorage.getItem('bmRightData');
        if (rawRightBookmark !== null) {
            localStorage.setItem('bookmarkRightData', rawRightBookmark);
            localStorage.removeItem('bmRightData');
        }
    }
    if (rawRightBookmark) {
        try {
            const parsed = JSON.parse(rawRightBookmark);
            if (parsed && typeof parsed === 'object') bookmarkRightData = parsed;
        } catch(e) {}
    }

    const searchBarContainer     = document.getElementById('searchBarContainer');
    const searchBarsElement      = document.getElementById('searchBars');
    const bookmarkAreaLeft       = document.getElementById('bookmarkAreaLeft');
    const bookmarkAreaRight      = document.getElementById('bookmarkAreaRight');
    const bookmarkContainerLeft  = document.getElementById('bookmarkContainerLeft');
    const bookmarkContainerRight = document.getElementById('bookmarkContainerRight');
    let clockIntervalId          = null;

    /** Toggles the 'no-header' class to show/hide the top logo on the Home page. */
    function applyHeaderVisibility() {
        const showLogoSetting = localStorage.getItem('showLogo');
        const isOff = showLogoSetting === '"off"' || showLogoSetting === 'off';
        if (isOff) {
            document.documentElement.classList.add('no-header');
            if (document.body) document.body.classList.add('no-header');
        } else {
            document.documentElement.classList.remove('no-header');
            if (document.body) document.body.classList.remove('no-header');
        }
    }

    /** Shows/hides the Home clock and starts or stops its 1-second update interval accordingly. */
    function applyClockVisibility() {
        const showClockSetting = localStorage.getItem('showClock');
        const isOff = showClockSetting === '"off"' || showClockSetting === 'off';
        if (isOff) {
            document.documentElement.classList.add('no-clock');
            if (document.body) document.body.classList.add('no-clock');
            if (clockIntervalId) {
                clearInterval(clockIntervalId);
                clockIntervalId = null;
            }
        } else {
            document.documentElement.classList.remove('no-clock');
            if (document.body) document.body.classList.remove('no-clock');
            updateClockDisplay();
            fitClockText();
            if (!clockIntervalId) {
                clockIntervalId = setInterval(updateClockDisplay, 1000);
            }
        }
    }

    /** Wraps each digit/colon in fixed-width spans so changing digits never shifts the time or date. */
    function formatTimeDigitHtml(timeString) {
        let html = '';
        for (let i = 0; i < timeString.length; i++) {
            const char = timeString[i];
            if (char >= '0' && char <= '9') {
                html += `<span class="clockDigit">${char}</span>`;
            } else if (char === ':') {
                html += `<span class="clockColon">:</span>`;
            } else {
                html += `<span class="clockUnit">${char}</span>`;
            }
        }
        return html;
    }

    function updateClockDisplay() {
        const timeElem = document.getElementById('clockTime');
        const dateElem = document.getElementById('clockDate');
        if (!timeElem || !dateElem) return;
        const now = new Date();
        const rawHours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');

        let format = localStorage.getItem('clockTimeFormat') || '24h';
        try { format = JSON.parse(format); } catch(e) {}

        let rawTimeString = '';
        if (format === '12h') {
            const h = rawHours % 12 || 12;
            const ampm = rawHours >= 12 ? 'pm' : 'am';
            rawTimeString = `${h}:${minutes}${ampm}`;
        } else {
            const hours = String(rawHours).padStart(2, '0');
            rawTimeString = `${hours}:${minutes}`;
        }

        const timeHtml = formatTimeDigitHtml(rawTimeString);
        if (timeElem._lastTimeHtml !== timeHtml) {
            timeElem._lastTimeHtml = timeHtml;
            timeElem.innerHTML = timeHtml;
        }

        const dateOptions = { weekday: 'long', month: 'long', day: 'numeric' };
        const currentDateText = now.toLocaleDateString(undefined, dateOptions);
        if (dateElem.textContent !== currentDateText) {
            dateElem.textContent = currentDateText;
            fitClockText();
        }
    }

    /** Dynamically scales down the clock font size on narrow viewports so time and date never collide. */
    function fitClockText() {
        const clockBar = document.getElementById('homeClockBar');
        const timeElem = document.getElementById('clockTime');
        const dateElem = document.getElementById('clockDate');
        if (!clockBar || !timeElem || !dateElem) return;

        // Reset to default 32pt font size before measuring natural widths
        timeElem.style.fontSize = '';
        dateElem.style.fontSize = '';

        const barWidth = clockBar.clientWidth;
        if (barWidth <= 0) return;

        const baseFontSize = parseFloat(window.getComputedStyle(timeElem).fontSize) || 42.67;
        const timeWidth = timeElem.scrollWidth;
        const dateWidth = dateElem.scrollWidth;

        // Only shrink when the space between time and date drops below a comfortable gap
        const minGap = 20;
        const spaceBetween = barWidth - (timeWidth + dateWidth);

        if (spaceBetween < minGap) {
            const scaleFactor = barWidth / (timeWidth + dateWidth + minGap);
            const newSize = Math.max(12, Math.floor(baseFontSize * scaleFactor));
            timeElem.style.fontSize = newSize + 'px';
            dateElem.style.fontSize = newSize + 'px';
        }
    }

    applyHeaderVisibility();
    applyClockVisibility();
    initialiseMainDashboard();

    /** Renders (or re-renders) the entire Home dashboard: visibility, search bars, bookmarks, drag-and-drop, and heights. */
    function initialiseMainDashboard() {
        applyHeaderVisibility();
        applyClockVisibility();
        renderMainSearchBars(searchUrls);
        bookmarkAreaLeft.innerHTML = '';
        bookmarkAreaRight.innerHTML = '';
        renderMainBookmarks(bookmarkAreaLeft, bookmarkLeftData);
        renderMainBookmarks(bookmarkAreaRight, bookmarkRightData);
        attachMainSearchDragListeners();
        attachMainBookmarkDragListeners(bookmarkAreaLeft, 'bookmarkLeftData');
        attachMainBookmarkDragListeners(bookmarkAreaRight, 'bookmarkRightData');
        updateAllContainerHeights();
    }

    function getConfirmedDefaultEngine() {
        try {
            const raw = localStorage.getItem('confirmedDefaultSearch');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.name && parsed.domain) return parsed;
            }
        } catch(e) {}
        return null;
    }

    /** Creates and inserts the live clock bar above the search stack (left-click -> Search Settings, right-click -> General). */
    function renderClockBar() {
        const showClockSetting = localStorage.getItem('showClock');
        if (showClockSetting === '"off"' || showClockSetting === 'off') {
            return;
        }

        const clockContainer = document.createElement("div");
        clockContainer.className = "inputContainer";
        clockContainer.id = "container-clock_widget";

        const clockBar = document.createElement("div");
        clockBar.id = "homeClockBar";

        const timeSpan = document.createElement("span");
        timeSpan.id = "clockTime";

        const dateSpan = document.createElement("span");
        dateSpan.id = "clockDate";

        clockBar.appendChild(timeSpan);
        clockBar.appendChild(dateSpan);
        clockContainer.appendChild(clockBar);

        clockBar.setAttribute('title', 'Click for Search Settings • Right-click for General Settings');

        clockBar.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openSettingsPage('search');
        });

        clockBar.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openSettingsPage('general');
        });

        searchBarsElement.appendChild(clockContainer);
    }

    /** Creates the permanently pinned Browser Default search bar at the top of the search stack. */
    function renderBrowserDefaultBar(confirmedDefault) {
        const displayName = confirmedDefault ? confirmedDefault.name : 'Browser Default';
        const inputContainer = document.createElement("div");
        inputContainer.className = "inputContainer";
        inputContainer.id = "container-browser_default";
        searchBarsElement.appendChild(inputContainer);

        const searchInput = document.createElement("input");
        searchInput.type = "search";
        searchInput.autocomplete = "off";
        searchInput.name = displayName;
        searchInput.placeholder = displayName;
        searchInput.id = "browser_default_search";
        searchInput.dataset.engine = "Browser Default";
        searchInput.dataset.isDefault = "true";
        inputContainer.appendChild(searchInput);

        const rootDomain = confirmedDefault ? confirmedDefault.domain : '';
        const anchor = document.createElement("a");
        anchor.href = rootDomain ? `https://${rootDomain}` : '#';

        const img = document.createElement("img");
        img.className = 'engine-icon';
        loadFaviconWithFallback(img, rootDomain, 32, placeholderSvg);

        anchor.appendChild(img);
        inputContainer.appendChild(anchor);
    }

    /** Builds the clock bar, pinned default search bar, and all enabled custom search bars. */
    function renderMainSearchBars(data) {
        searchBarsElement.innerHTML = '';

        // 1. Clock bar sits above the pinned default search if enabled
        renderClockBar();

        // 2. Browser Default search bar is permanently pinned below the clock
        const confirmedDefault = getConfirmedDefaultEngine();
        renderBrowserDefaultBar(confirmedDefault);

        // 3. Render user configured searches
        const entries = Object.entries(data);
        for (const [name, key] of entries) {
            if (name === 'Browser Default' || (key && (key.isBrowserDefault || key.url === 'BROWSER_DEFAULT'))) {
                continue; // Skip legacy Browser Default entry if present in stored data
            }
            if (key.state !== "off") {
                const codeName = name.replace(/\s+/g, "_");

                const inputContainer = document.createElement("div");
                inputContainer.className = "inputContainer";
                inputContainer.id = `container-${codeName}`;
                searchBarsElement.appendChild(inputContainer);

                const searchInput = document.createElement("input");
                searchInput.type = "search";
                searchInput.autocomplete = "off";
                searchInput.name = name;
                searchInput.placeholder = name;
                searchInput.id = codeName;
                searchInput.dataset.engine = name;
                inputContainer.appendChild(searchInput);

                let rootDomain = '';
                if (key.url) {
                    try { rootDomain = new URL(key.url).hostname; } catch (e) {}
                }

                const anchor = document.createElement("a");
                anchor.href = rootDomain ? `https://${rootDomain}` : '#';

                const img = document.createElement("img");
                img.className = 'engine-icon';
                loadFaviconWithFallback(img, rootDomain, 32, placeholderSvg);

                anchor.appendChild(img);
                inputContainer.appendChild(anchor);
            }
        }
        updateClockDisplay();
    }

    function updateDefaultSearchElements(confirmed) {
        if (!confirmed || !confirmed.name) return;
        const defaultInput = document.querySelector('input[data-is-default="true"]');
        if (defaultInput) {
            defaultInput.placeholder = confirmed.name;
            defaultInput.name = confirmed.name;
            const container = defaultInput.closest('.inputContainer');
            if (container) {
                const img = container.querySelector('img.engine-icon');
                const anchor = container.querySelector('a');
                if (anchor && confirmed.domain) {
                    anchor.href = `https://${confirmed.domain}`;
                }
                if (img && confirmed.domain) {
                    loadFaviconWithFallback(img, confirmed.domain, 32, placeholderSvg);
                }
            }
        }
    }

    // Sync confirmed engine from storage in real time
    if (typeof chrome !== 'undefined' && chrome.storage) {
        if (chrome.storage.local) {
            chrome.storage.local.get(['confirmedDefaultSearch'], (result) => {
                if (result && result.confirmedDefaultSearch) {
                    try {
                        localStorage.setItem('confirmedDefaultSearch', JSON.stringify(result.confirmedDefaultSearch));
                    } catch (e) {}
                    updateDefaultSearchElements(result.confirmedDefaultSearch);
                } else if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ type: 'CHECK_DEFAULT_SEARCH' }).catch(() => {});
                }
            });
        }
        if (chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local' && changes.confirmedDefaultSearch && changes.confirmedDefaultSearch.newValue) {
                    const confirmed = changes.confirmedDefaultSearch.newValue;
                    try {
                        localStorage.setItem('confirmedDefaultSearch', JSON.stringify(confirmed));
                    } catch (e) {}
                    updateDefaultSearchElements(confirmed);
                }
            });
        }
    }

    /** Renders all enabled bookmark tiles into either the left or right bookmark column. */
    function renderMainBookmarks(container, data) {
        if (!data || !container) return;
        const entries = Object.entries(data);
        for (const [name, key] of entries) {
            if (key.state === "on") {
                const bookmarkLink = document.createElement("a");
                bookmarkLink.className = "bookmarkItemContainer";
                bookmarkLink.href = key.url;
                container.appendChild(bookmarkLink);

                const img = document.createElement("img");
                img.className = 'bookmarkImage';
                loadFaviconWithFallback(img, key.url, 64, placeholderSvg);
                bookmarkLink.appendChild(img);

                const title = document.createElement("p");
                title.className = 'bookmarkTitle';
                title.innerHTML = name;
                bookmarkLink.appendChild(title);            
            }
        }
    }

    // Keyboard shortcuts inside search bars: Esc (clear/blur), Up/Down (switch bars & carry text), Enter (URL or search)
    searchBarsElement.addEventListener("keydown", function (submitEvent) {
        if (submitEvent.key === "Escape" && submitEvent.target.tagName === "INPUT" && submitEvent.target.type === "search") {
            submitEvent.preventDefault();
            const input = submitEvent.target;
            if (input.value !== "") {
                input.value = "";
            } else {
                input.blur();
            }
            return;
        }

        if ((submitEvent.key === "ArrowDown" || submitEvent.key === "ArrowUp") && submitEvent.target.tagName === "INPUT" && submitEvent.target.type === "search") {
            const allInputs = Array.from(searchBarsElement.querySelectorAll('input[type="search"]'));
            const currentIndex = allInputs.indexOf(submitEvent.target);
            if (currentIndex !== -1) {
                submitEvent.preventDefault();
                const currentInput = submitEvent.target;
                const targetIndex = submitEvent.key === "ArrowDown"
                    ? (currentIndex + 1) % allInputs.length
                    : (currentIndex - 1 + allInputs.length) % allInputs.length;
                const targetInput = allInputs[targetIndex];
                if (currentInput.value && currentInput !== targetInput) {
                    targetInput.value = currentInput.value;
                    currentInput.value = "";
                }
                targetInput.focus();
                const len = targetInput.value.length;
                targetInput.setSelectionRange(len, len);
                return;
            }
        }

        if (submitEvent.key === "Enter" && submitEvent.target.tagName === "INPUT" && submitEvent.target.type === "search") {
            submitEvent.preventDefault();
            const input = submitEvent.target;
            const query = input.value.trim();
            if (!query) return;

            // Smart direct URL detection: navigate directly if query has no spaces and is a URL or domain format
            const urlPattern = /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i;
            const isLocalhost = /^(https?:\/\/)?localhost(:\d+)?(\/.*)?$/i;
            if (!query.includes(' ') && (urlPattern.test(query) || isLocalhost.test(query) || /^https?:\/\//i.test(query))) {
                let directUrl = query;
                if (!directUrl.startsWith('http://') && !directUrl.startsWith('https://')) {
                    directUrl = 'https://' + directUrl;
                }
                input.value = "";
                window.location.href = directUrl;
                return;
            }

            const isBrowserDefault = input.dataset.isDefault === "true";
            const engine = input.dataset.engine || input.name;
            const engineConfig = searchUrls[engine];

            if (isBrowserDefault) {
                if (typeof chrome !== 'undefined' && chrome.search && chrome.search.query) {
                    const performQuery = () => {
                        chrome.search.query({
                            text: query,
                            disposition: 'CURRENT_TAB'
                        });
                        input.value = "";
                    };

                    if (chrome.storage && chrome.storage.local) {
                        chrome.storage.local.set({ awaitingDefaultSearchDetection: Date.now() }, () => {
                            performQuery();
                        });
                    } else {
                        performQuery();
                    }
                } else {
                    input.value = "";
                    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                }
            } else if (engineConfig && engineConfig.url) {
                const searchUrl = engineConfig.url.replace(/TESTSEARCH|SEARCHTEXT|%s/gi, encodeURIComponent(query));
                input.value = "";
                window.location.href = searchUrl;
            }
        }
    });

    // Press "/" anywhere on the home page to immediately focus the top search bar
    window.addEventListener("keydown", function(e) {
        if (e.key === "/" && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const activeTag = document.activeElement ? document.activeElement.tagName : '';
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable)) {
                return;
            }
            if (document.getElementById('walkthroughOverlay')) return;
            const defaultInput = document.getElementById('browser_default_search') || (searchBarsElement && searchBarsElement.querySelector('input[type="search"]'));
            if (defaultInput) {
                e.preventDefault();
                defaultInput.focus();
                const len = defaultInput.value.length;
                defaultInput.setSelectionRange(len, len);
            }
        }
    });

    window.addEventListener("pageshow", () => {
        const allSearchInputs = searchBarsElement.querySelectorAll('input[type="search"]');
        allSearchInputs.forEach(input => {
            input.value = "";
        });
    });

    /** Hides side bookmark columns, logo, or settings icon when the viewport becomes too narrow to avoid overlaps. */
    function handleDynamicHide() {
        const hideItems = document.querySelectorAll(".dynamicHide");
        hideItems.forEach(element => {
            if (window.innerWidth < 1010) {
                element.classList.add("hidden");
            } else {
                element.classList.remove("hidden");
            }
        });

        // Automatically hide the logo when the viewport width is narrow enough that search bars would clash with it
        const heading = document.getElementById('headingContainer');
        if (heading) {
            const searchBarLeft = Math.max(window.innerWidth * 0.05, (window.innerWidth - Math.min(window.innerWidth * 0.9, 700)) / 2);
            if (searchBarLeft < 330) {
                heading.classList.add("viewport-hidden");
            } else {
                heading.classList.remove("viewport-hidden");
            }
        }

        // Hide settings button when viewport width is small enough that it would clash with the clock / date
        const settingsBtn = document.getElementById('settingsPageButton');
        if (settingsBtn) {
            const searchBarRightMargin = (window.innerWidth - Math.min(window.innerWidth * 0.9, 700)) / 2;
            if (searchBarRightMargin < 70 || window.innerWidth <= 840) {
                settingsBtn.classList.add("viewport-hidden");
            } else {
                settingsBtn.classList.remove("viewport-hidden");
            }
        }

        fitClockText();
    }
    handleDynamicHide();
    window.addEventListener("resize", () => {
        handleDynamicHide();
        fitClockText();
        updateAllContainerHeights();
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => {
            handleDynamicHide();
            fitClockText();
            updateAllContainerHeights();
        });
    }

    window.addEventListener("storage", (e) => {
        if (e.key === 'showLogo') {
            applyHeaderVisibility();
            updateAllContainerHeights();
        }
        if (e.key === 'showClock') {
            applyClockVisibility();
            renderMainSearchBars(searchUrls);
            updateAllContainerHeights();
        }
        if (e.key === 'clockTimeFormat') {
            const timeElem = document.getElementById('clockTime');
            if (timeElem) timeElem._lastTimeHtml = '';
            updateClockDisplay();
            fitClockText();
        }
        if (e.key === 'searchData' || e.key === 'schData') {
            const raw = localStorage.getItem('searchData') || localStorage.getItem('schData');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        searchUrls = parsed;
                        renderMainSearchBars(searchUrls);
                        updateAllContainerHeights();
                    }
                } catch(err) {}
            }
        }
        if (e.key === 'bookmarkLeftData' || e.key === 'bmLeftData') {
            const raw = localStorage.getItem('bookmarkLeftData') || localStorage.getItem('bmLeftData');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        bookmarkLeftData = parsed;
                        bookmarkAreaLeft.innerHTML = '';
                        renderMainBookmarks(bookmarkAreaLeft, bookmarkLeftData);
                        updateAllContainerHeights();
                    }
                } catch(err) {}
            }
        }
        if (e.key === 'bookmarkRightData' || e.key === 'bmRightData') {
            const raw = localStorage.getItem('bookmarkRightData') || localStorage.getItem('bmRightData');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        bookmarkRightData = parsed;
                        bookmarkAreaRight.innerHTML = '';
                        renderMainBookmarks(bookmarkAreaRight, bookmarkRightData);
                        updateAllContainerHeights();
                    }
                } catch(err) {}
            }
        }
        if (e.key === 'startWalkthrough' && e.newValue) {
            localStorage.removeItem('startWalkthrough');
            startMainWalkthrough();
        }
    });

    // --- Direct Drag-and-Drop Reordering & Bin Deletion on Home Page ---

    const deleteBinButton = document.getElementById('deleteBinButton');

    function isCursorOverDeleteBin(clientX, clientY) {
        if (!deleteBinButton) return false;
        const rect = deleteBinButton.getBoundingClientRect();
        const pad = 22;
        return (
            clientX >= rect.left - pad &&
            clientX <= rect.right + pad &&
            clientY >= rect.top - pad &&
            clientY <= rect.bottom + pad
        );
    }

    function setDeleteBinHover(isOver) {
        if (!deleteBinButton) return;
        deleteBinButton.classList.toggle('bin-hover', !!isOver);
    }

    function deleteMainSearchByName(engineName) {
        if (!engineName || engineName === 'Browser Default') return;
        let storedData = {};
        try {
            let raw = localStorage.getItem('searchData');
            if (raw === null) raw = localStorage.getItem('schData');
            if (raw) storedData = JSON.parse(raw);
            else storedData = { ...defaultSearches };
        } catch(e) {
            storedData = { ...defaultSearches };
        }
        delete storedData[engineName];
        localStorage.setItem('searchData', JSON.stringify(storedData));
        localStorage.removeItem('schData');
        searchUrls = storedData;
    }

    function deleteMainBookmarkItem(card) {
        const titleElem = card ? card.querySelector('.bookmarkTitle') : null;
        const name = titleElem ? titleElem.textContent.trim() : '';
        if (name) {
            if (bookmarkLeftData && bookmarkLeftData[name]) {
                delete bookmarkLeftData[name];
            }
            if (bookmarkRightData && bookmarkRightData[name]) {
                delete bookmarkRightData[name];
            }
            try {
                const rawLeft = localStorage.getItem('bookmarkLeftData') || localStorage.getItem('bmLeftData');
                if (rawLeft) {
                    const parsedLeft = JSON.parse(rawLeft);
                    if (parsedLeft && parsedLeft[name]) {
                        delete parsedLeft[name];
                        localStorage.setItem('bookmarkLeftData', JSON.stringify(parsedLeft));
                    }
                }
            } catch (e) {}
            try {
                const rawRight = localStorage.getItem('bookmarkRightData') || localStorage.getItem('bmRightData');
                if (rawRight) {
                    const parsedRight = JSON.parse(rawRight);
                    if (parsedRight && parsedRight[name]) {
                        delete parsedRight[name];
                        localStorage.setItem('bookmarkRightData', JSON.stringify(parsedRight));
                    }
                }
            } catch (e) {}
        }
        saveMainBookmarksOrder();
    }

    function getDragAfterMainSearchElement(container, y) {
        const draggables = [...container.querySelectorAll('.inputContainer:not(.is-dragged-item):not(.drag-placeholder)')];
        return draggables.reduce((closest, child) => {
            // Cannot drop before the pinned browser default bar or the clock widget
            if (child.id === 'container-browser_default' || child.id === 'container-clock_widget') {
                return closest;
            }
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function saveMainSearchesOrder() {
        let storedData = searchUrls || { ...defaultSearches };
        try {
            let raw = localStorage.getItem('searchData');
            if (raw === null) raw = localStorage.getItem('schData');
            if (raw) storedData = JSON.parse(raw);
        } catch(e) {}

        const newSearchData = {};
        const containers = searchBarsElement.querySelectorAll('.inputContainer:not(.is-dragged-item):not(.drag-placeholder)');
        containers.forEach(c => {
            const inp = c.querySelector('input[type="search"]');
            if (!inp || inp.dataset.isDefault === "true") return;
            const name = inp.dataset.engine || inp.name;
            if (name && storedData[name]) {
                newSearchData[name] = storedData[name];
            }
        });
        // Retain any inactive searches in their relative order
        for (const [name, val] of Object.entries(storedData)) {
            if (val && val.state === 'off' && !newSearchData[name] && name !== 'Browser Default') {
                newSearchData[name] = val;
            }
        }
        localStorage.setItem('searchData', JSON.stringify(newSearchData));
        localStorage.removeItem('schData');
        searchUrls = newSearchData;
    }

    let pinnedTooltipTimeout = null;
    let lastPinnedFeedbackTime = 0;
    /** Shows a shake + tooltip when the user tries to drag or move past the pinned Browser Default bar. */
    function showPinnedFeedback(card) {
        if (!card) return;
        const now = Date.now();
        if (now - lastPinnedFeedbackTime < 1400) return;
        lastPinnedFeedbackTime = now;

        card.classList.remove('pinned-shake');
        card.offsetHeight; // force reflow
        card.classList.add('pinned-shake');
        setTimeout(() => card.classList.remove('pinned-shake'), 400);

        let tooltip = card.querySelector('.pinned-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'pinned-tooltip';
            tooltip.textContent = '🔒 Pinned as Default Search';
            card.appendChild(tooltip);
        }

        clearTimeout(pinnedTooltipTimeout);
        tooltip.classList.remove('show');
        tooltip.offsetHeight; // force reflow
        tooltip.classList.add('show');

        pinnedTooltipTimeout = setTimeout(() => {
            tooltip.classList.remove('show');
        }, 1600);
    }

    /** Enables pointer-based reordering and left-zone bin deletion for search bars on the Home page. */
    function attachMainSearchDragListeners() {
        if (searchBarsElement._hasMainDragListeners) return;
        searchBarsElement._hasMainDragListeners = true;

        searchBarsElement.addEventListener("mousedown", function(e) {
            const handle = e.target.classList.contains('engine-icon') ? e.target : e.target.closest('.engine-icon');
            if (!handle || e.button !== 0) return;

            const card = handle.closest('.inputContainer');
            if (!card) return;

            const anchor = handle.closest('a');
            const startY = e.clientY;
            const startX = e.clientX;

            // If user attempts to drag the Browser Default search bar, provide tactile feedback
            if (card.id === 'container-browser_default') {
                let defaultMoved = false;
                function onDefaultMouseMove(moveEvent) {
                    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >= 3) {
                        defaultMoved = true;
                        window.removeEventListener('mousemove', onDefaultMouseMove);
                        showPinnedFeedback(card);
                        if (anchor) anchor._justDragged = true;
                    }
                }
                function onDefaultMouseUp() {
                    window.removeEventListener('mousemove', onDefaultMouseMove);
                    window.removeEventListener('mouseup', onDefaultMouseUp);
                    if (defaultMoved && anchor) {
                        setTimeout(() => { anchor._justDragged = false; }, 100);
                    }
                }
                window.addEventListener('mousemove', onDefaultMouseMove);
                window.addEventListener('mouseup', onDefaultMouseUp);
                return;
            }

            let isDraggingActive = false;
            let placeholder = null;
            let grabOffsetY = 0;
            let initialCardLeft = 0;
            let originalNextSibling = null;
            let inDeleteZone = false;
            let flyingIcon = null;
            let cardReturnTimer = null;

            function isSearchInLeftDeleteZone(clientX) {
                return (startX - clientX >= 120) || (clientX <= window.innerWidth * 0.10);
            }

            function movePlaceholderWithFlip(targetBeforeElement) {
                if (!placeholder || placeholder.nextElementSibling === targetBeforeElement) return;
                const siblings = [...searchBarsElement.querySelectorAll('.inputContainer:not(.is-dragged-item):not(.drag-placeholder)')];
                const firstTops = new Map();
                siblings.forEach(el => firstTops.set(el, el.getBoundingClientRect().top));

                if (targetBeforeElement == null) {
                    searchBarsElement.appendChild(placeholder);
                } else {
                    searchBarsElement.insertBefore(placeholder, targetBeforeElement);
                }

                siblings.forEach(el => {
                    const firstTop = firstTops.get(el);
                    if (firstTop === undefined) return;
                    const lastTop = el.getBoundingClientRect().top;
                    const deltaY = firstTop - lastTop;

                    if (Math.abs(deltaY) > 0.5) {
                        el.style.transition = 'none';
                        el.style.transform = `translateY(${deltaY}px)`;
                        el.offsetHeight; // force reflow
                        el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
                        el.style.transform = '';

                        const onEnd = () => {
                            el.style.transition = '';
                            el.removeEventListener('transitionend', onEnd);
                        };
                        el.addEventListener('transitionend', onEnd);
                    }
                });
            }

            function enterSearchDeleteZone() {
                inDeleteZone = true;
                setDeleteBinHover(true);

                // Measure current search bar position before moving the original bar back
                const currentCardRect = card.getBoundingClientRect();

                // Restore placeholder (and sibling order) back to where this search bar was originally
                if (originalNextSibling && originalNextSibling.parentNode === searchBarsElement) {
                    movePlaceholderWithFlip(originalNextSibling);
                } else {
                    movePlaceholderWithFlip(null);
                }

                // Move the original search bar back to its original slot, shrink to 60%, and make it 50% transparent
                const slotRect = placeholder.getBoundingClientRect();
                clearTimeout(cardReturnTimer);
                card.classList.add('is-pending-delete');
                card.style.transition = 'top 0.22s cubic-bezier(0.2, 0, 0, 1), left 0.22s cubic-bezier(0.2, 0, 0, 1), transform 0.22s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease';
                card.style.top = slotRect.top + 'px';
                card.style.left = slotRect.left + 'px';

                // Detach a duplicate search bar that shrinks to 250px wide and 4/5ths standard height and flies to the bin
                if (flyingIcon) flyingIcon.remove();
                flyingIcon = card.cloneNode(true);
                flyingIcon.removeAttribute('id');
                flyingIcon.className = 'inputContainer flying-mini-searchbar';
                flyingIcon.style.position = 'fixed';
                flyingIcon.style.left = currentCardRect.left + 'px';
                flyingIcon.style.top = currentCardRect.top + 'px';
                flyingIcon.style.width = currentCardRect.width + 'px';
                flyingIcon.style.height = currentCardRect.height + 'px';
                flyingIcon.style.transform = 'none';
                flyingIcon.style.margin = '0';
                flyingIcon.style.opacity = '1';
                // Place in front of #container-browser_default (200), but behind #deleteBinButton (400)
                flyingIcon.style.zIndex = '300';
                flyingIcon.style.pointerEvents = 'none';
                document.body.appendChild(flyingIcon);

                // Force reflow, then animate the mini search bar to the right of the bin (overlapping slightly)
                flyingIcon.offsetHeight;
                const binRect = deleteBinButton.getBoundingClientRect();
                const targetWidth = 250;
                const targetHeight = Math.round(slotRect.height * 0.8);
                const targetLeft = binRect.right - 2;
                const targetTop = binRect.top + (binRect.height - targetHeight) / 2;
                flyingIcon.style.transition = 'left 0.22s cubic-bezier(0.2, 0, 0, 1), top 0.22s cubic-bezier(0.2, 0, 0, 1), width 0.22s cubic-bezier(0.2, 0, 0, 1), height 0.22s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease';
                flyingIcon.style.left = targetLeft + 'px';
                flyingIcon.style.top = targetTop + 'px';
                flyingIcon.style.width = targetWidth + 'px';
                flyingIcon.style.height = targetHeight + 'px';
            }

            function exitSearchDeleteZone(currentClientY) {
                inDeleteZone = false;
                setDeleteBinHover(false);
                card.classList.remove('is-pending-delete');

                // Smoothly move card to current cursor Y, restore full size/opacity, and fly the mini search bar back into it
                let targetCardTop = currentClientY - grabOffsetY;
                const defaultCard = document.getElementById('container-browser_default');
                if (defaultCard) {
                    const defaultRect = defaultCard.getBoundingClientRect();
                    const minAllowedCardTop = defaultRect.bottom + 6;
                    if (targetCardTop < minAllowedCardTop) {
                        targetCardTop = minAllowedCardTop;
                    }
                }
                card.style.transition = 'top 0.18s cubic-bezier(0.2, 0, 0, 1), transform 0.18s cubic-bezier(0.2, 0, 0, 1), opacity 0.18s ease';
                card.style.top = targetCardTop + 'px';
                clearTimeout(cardReturnTimer);
                cardReturnTimer = setTimeout(() => {
                    if (!inDeleteZone && isDraggingActive) {
                        card.style.transition = '';
                    }
                }, 190);

                if (flyingIcon) {
                    const miniBarToRemove = flyingIcon;
                    flyingIcon = null;
                    miniBarToRemove.style.transition = 'left 0.18s cubic-bezier(0.2, 0, 0, 1), top 0.18s cubic-bezier(0.2, 0, 0, 1), width 0.18s cubic-bezier(0.2, 0, 0, 1), height 0.18s cubic-bezier(0.2, 0, 0, 1), opacity 0.18s ease';
                    miniBarToRemove.style.left = initialCardLeft + 'px';
                    miniBarToRemove.style.top = targetCardTop + 'px';
                    miniBarToRemove.style.width = card.offsetWidth + 'px';
                    miniBarToRemove.style.height = card.offsetHeight + 'px';
                    miniBarToRemove.style.opacity = '0';
                    setTimeout(() => {
                        miniBarToRemove.remove();
                    }, 180);
                }
            }

            function onMouseMove(moveEvent) {
                if (!isDraggingActive) {
                    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 3) return;

                    isDraggingActive = true;
                    document.body.classList.add('is-dragging');
                    if (anchor) anchor._justDragged = true;

                    const cardRect = card.getBoundingClientRect();
                    grabOffsetY = startY - cardRect.top;
                    initialCardLeft = cardRect.left;
                    originalNextSibling = card.nextElementSibling;

                    placeholder = document.createElement('div');
                    placeholder.className = 'inputContainer drag-placeholder';
                    placeholder.style.height = cardRect.height + 'px';
                    placeholder.style.width = cardRect.width + 'px';
                    placeholder.style.marginTop = window.getComputedStyle(card).marginTop;
                    placeholder.style.marginBottom = window.getComputedStyle(card).marginBottom;

                    card.parentNode.insertBefore(placeholder, card);

                    card.classList.add('is-dragged-item');
                    card.style.position = 'fixed';

                    const defaultCard = document.getElementById('container-browser_default');
                    let minAllowedCardTop = 0;
                    if (defaultCard) {
                        const defaultRect = defaultCard.getBoundingClientRect();
                        minAllowedCardTop = defaultRect.bottom + 6;
                    }

                    const initialTop = Math.max(moveEvent.clientY - grabOffsetY, minAllowedCardTop);
                    card.style.top = initialTop + 'px';
                    card.style.left = initialCardLeft + 'px';
                    card.style.width = cardRect.width + 'px';
                    card.style.height = cardRect.height + 'px';
                    card.style.margin = '0';
                    card.style.zIndex = '100';
                    card.style.pointerEvents = 'none';
                }

                // Dragging ceiling: prevent dragged card from moving higher than the first search bar after the default search bar
                const defaultCard = document.getElementById('container-browser_default');
                let minAllowedCardTop = 0;
                if (defaultCard) {
                    const defaultRect = defaultCard.getBoundingClientRect();
                    minAllowedCardTop = defaultRect.bottom + 6;
                }

                let targetTop = moveEvent.clientY - grabOffsetY;
                if (minAllowedCardTop && targetTop < minAllowedCardTop) {
                    targetTop = minAllowedCardTop;
                    if (defaultCard) {
                        showPinnedFeedback(defaultCard);
                    }
                } else if (defaultCard) {
                    const defaultRect = defaultCard.getBoundingClientRect();
                    if (moveEvent.clientY < defaultRect.bottom + 20) {
                        showPinnedFeedback(defaultCard);
                    }
                }

                const shouldBeInDeleteZone = isSearchInLeftDeleteZone(moveEvent.clientX);
                if (shouldBeInDeleteZone) {
                    if (!inDeleteZone) {
                        enterSearchDeleteZone();
                    }
                    return;
                } else if (inDeleteZone) {
                    exitSearchDeleteZone(moveEvent.clientY);
                } else {
                    card.style.top = targetTop + 'px';
                }

                const afterElement = getDragAfterMainSearchElement(searchBarsElement, moveEvent.clientY);
                movePlaceholderWithFlip(afterElement);
            }

            function onMouseUp() {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                clearTimeout(cardReturnTimer);
                setDeleteBinHover(false);

                if (!isDraggingActive) {
                    document.body.classList.remove('is-dragging');
                    return;
                }

                if (inDeleteZone) {
                    document.body.classList.remove('is-dragging');
                    const inp = card.querySelector('input[type="search"]');
                    const engineName = inp ? (inp.dataset.engine || inp.name) : '';

                    const performDelete = () => {
                        if (flyingIcon) {
                            flyingIcon.style.transition = 'transform 0.16s ease, opacity 0.16s ease';
                            flyingIcon.style.transform = 'scale(0.1)';
                            flyingIcon.style.opacity = '0';
                            const iconToRemove = flyingIcon;
                            flyingIcon = null;
                            setTimeout(() => iconToRemove.remove(), 170);
                        }

                        const siblings = [...searchBarsElement.querySelectorAll('.inputContainer:not(.is-dragged-item):not(.drag-placeholder)')];
                        const firstTops = new Map();
                        siblings.forEach(el => firstTops.set(el, el.getBoundingClientRect().top));

                        if (placeholder && placeholder.parentNode) placeholder.remove();
                        card.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        setTimeout(() => card.remove(), 180);

                        deleteMainSearchByName(engineName);
                        updateAllContainerHeights();

                        siblings.forEach(el => {
                            const firstTop = firstTops.get(el);
                            if (firstTop === undefined) return;
                            const lastTop = el.getBoundingClientRect().top;
                            const deltaY = firstTop - lastTop;
                            if (Math.abs(deltaY) > 0.5) {
                                el.style.transition = 'none';
                                el.style.transform = `translateY(${deltaY}px)`;
                                el.offsetHeight;
                                el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
                                el.style.transform = '';
                                el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
                            }
                        });
                    };

                    const restoreCard = () => {
                        const targetRect = placeholder.getBoundingClientRect();
                        if (flyingIcon) {
                            const miniBarToRemove = flyingIcon;
                            flyingIcon = null;
                            miniBarToRemove.style.transition = 'left 0.18s cubic-bezier(0.2, 0, 0, 1), top 0.18s cubic-bezier(0.2, 0, 0, 1), width 0.18s cubic-bezier(0.2, 0, 0, 1), height 0.18s cubic-bezier(0.2, 0, 0, 1), opacity 0.18s ease';
                            miniBarToRemove.style.left = targetRect.left + 'px';
                            miniBarToRemove.style.top = targetRect.top + 'px';
                            miniBarToRemove.style.width = targetRect.width + 'px';
                            miniBarToRemove.style.height = targetRect.height + 'px';
                            miniBarToRemove.style.opacity = '0';
                            setTimeout(() => miniBarToRemove.remove(), 185);
                        }
                        card.classList.remove('is-pending-delete');
                        card.style.transition = 'top 0.18s cubic-bezier(0.2, 0, 0, 1), left 0.18s cubic-bezier(0.2, 0, 0, 1), transform 0.18s cubic-bezier(0.2, 0, 0, 1), opacity 0.18s ease';
                        card.style.top = targetRect.top + 'px';
                        card.style.left = targetRect.left + 'px';
                        setTimeout(() => {
                            if (placeholder && placeholder.parentNode) {
                                placeholder.parentNode.insertBefore(card, placeholder);
                                placeholder.remove();
                            }
                            card.style.position = '';
                            card.style.top = '';
                            card.style.left = '';
                            card.style.width = '';
                            card.style.height = '';
                            card.style.margin = '';
                            card.style.zIndex = '';
                            card.style.transition = '';
                            card.style.transform = '';
                            card.style.pointerEvents = '';
                            card.classList.remove('is-dragged-item');
                            if (anchor) setTimeout(() => { anchor._justDragged = false; }, 100);
                            saveMainSearchesOrder();
                            updateAllContainerHeights();
                        }, 195);
                    };

                    showBrowserDeleteConfirm(performDelete, restoreCard);
                    return;
                }

                if (flyingIcon) {
                    flyingIcon.remove();
                    flyingIcon = null;
                }
                handle.style.opacity = '';
                card.classList.remove('is-pending-delete');

                const targetRect = placeholder.getBoundingClientRect();
                card.style.transition = 'top 0.18s cubic-bezier(0.2, 0, 0, 1), left 0.18s cubic-bezier(0.2, 0, 0, 1), transform 0.18s cubic-bezier(0.2, 0, 0, 1)';
                card.style.top = targetRect.top + 'px';
                card.style.left = targetRect.left + 'px';
                card.style.transform = '';

                let cleanedUp = false;
                function finish() {
                    if (cleanedUp) return;
                    cleanedUp = true;

                    if (placeholder && placeholder.parentNode) {
                        placeholder.parentNode.insertBefore(card, placeholder);
                        placeholder.remove();
                    }

                    card.style.position = '';
                    card.style.top = '';
                    card.style.left = '';
                    card.style.width = '';
                    card.style.height = '';
                    card.style.margin = '';
                    card.style.zIndex = '';
                    card.style.transition = '';
                    card.style.transform = '';
                    card.style.pointerEvents = '';
                    card.classList.remove('is-dragged-item');
                    document.body.classList.remove('is-dragging');

                    if (anchor) {
                        setTimeout(() => { anchor._justDragged = false; }, 100);
                    }

                    saveMainSearchesOrder();
                    updateAllContainerHeights();
                }

                card.addEventListener('transitionend', finish, { once: true });
                setTimeout(finish, 220);
            }

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        searchBarsElement.addEventListener('click', function(e) {
            const anchor = e.target.closest('a');
            if (anchor && anchor._justDragged) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        searchBarsElement.addEventListener('contextmenu', function(e) {
            const handle = e.target.closest('.engine-icon');
            if (!handle) return;
            e.preventDefault();
            openSettingsPage('search');
        });
    }

    /** Focuses an existing Settings tab (navigating to `sectionHash`) or opens settings.html in a new tab. */
    function openSettingsPage(sectionHash, bookmarkSide) {
        if (bookmarkSide) {
            localStorage.setItem('activeBookmarkSide', bookmarkSide);
        }
        const targetUrl = `settings.html#${sectionHash || 'search'}`;
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime && chrome.runtime.getURL) {
            const settingsBaseUrl = chrome.runtime.getURL('settings.html');
            const fullTargetUrl = chrome.runtime.getURL(targetUrl);
            const isSettingsTab = (t) => {
                const tabUrl = t.url || t.pendingUrl || '';
                return tabUrl.startsWith(settingsBaseUrl) || t.title === 'Settings: 1 Click Search';
            };
            chrome.tabs.query({}, function(tabs) {
                const existingTab = tabs && tabs.find(isSettingsTab);
                if (existingTab) {
                    const updateProps = sectionHash ? { url: fullTargetUrl, active: true } : { active: true };
                    chrome.tabs.update(existingTab.id, updateProps);
                    if (existingTab.windowId && chrome.windows) {
                        chrome.windows.update(existingTab.windowId, { focused: true });
                    }
                } else {
                    window.open(targetUrl, '_blank');
                }
            });
        } else {
            window.open(targetUrl, '_blank');
        }
    }

    const settingsPageButton = document.getElementById('settingsPageButton');
    if (settingsPageButton) {
        settingsPageButton.addEventListener('click', function(e) {
            e.preventDefault();
            openSettingsPage();
        });
    }

    function getDragAfterMainBookmarkElement(container, y) {
        const draggables = [...container.querySelectorAll('.bookmarkItemContainer:not(.is-dragged-item):not(.drag-placeholder)')];
        return draggables.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function saveMainBookmarksOrder() {
        let leftStored = bookmarkLeftData || {};
        let rightStored = bookmarkRightData || {};
        try {
            const rawLeft = localStorage.getItem('bookmarkLeftData') || localStorage.getItem('bmLeftData');
            if (rawLeft) leftStored = JSON.parse(rawLeft);
        } catch(e) {}
        try {
            const rawRight = localStorage.getItem('bookmarkRightData') || localStorage.getItem('bmRightData');
            if (rawRight) rightStored = JSON.parse(rawRight);
        } catch(e) {}

        const newLeftData = {};
        const newRightData = {};
        const activeLeftNames = new Set();
        const activeRightNames = new Set();

        bookmarkAreaLeft.querySelectorAll('.bookmarkItemContainer:not(.is-dragged-item):not(.drag-placeholder)').forEach(item => {
            const titleElem = item.querySelector('.bookmarkTitle');
            const name = titleElem ? titleElem.textContent.trim() : '';
            if (name) {
                activeLeftNames.add(name);
                newLeftData[name] = leftStored[name] || rightStored[name] || { url: item.href, state: 'on' };
            }
        });

        bookmarkAreaRight.querySelectorAll('.bookmarkItemContainer:not(.is-dragged-item):not(.drag-placeholder)').forEach(item => {
            const titleElem = item.querySelector('.bookmarkTitle');
            const name = titleElem ? titleElem.textContent.trim() : '';
            if (name) {
                activeRightNames.add(name);
                newRightData[name] = rightStored[name] || leftStored[name] || { url: item.href, state: 'on' };
            }
        });

        // Retain any inactive bookmarks in their original column
        for (const [name, val] of Object.entries(leftStored)) {
            if (val && val.state === 'off' && !newLeftData[name] && !activeRightNames.has(name)) {
                newLeftData[name] = val;
            }
        }
        for (const [name, val] of Object.entries(rightStored)) {
            if (val && val.state === 'off' && !newRightData[name] && !activeLeftNames.has(name)) {
                newRightData[name] = val;
            }
        }

        localStorage.setItem('bookmarkLeftData', JSON.stringify(newLeftData));
        localStorage.setItem('bookmarkRightData', JSON.stringify(newRightData));
        localStorage.removeItem('bmLeftData');
        localStorage.removeItem('bmRightData');

        bookmarkLeftData = newLeftData;
        bookmarkRightData = newRightData;
        updateAllContainerHeights();
    }

    function attachMainBookmarkDragListeners(container) {
        if (!container || container._hasMainDragListeners) return;
        container._hasMainDragListeners = true;

        container.addEventListener("mousedown", function(e) {
            if (e.button !== 0) return;

            const card = e.target.closest('.bookmarkItemContainer');
            if (!card) return;

            const startY = e.clientY;
            const startX = e.clientX;
            let isDraggingActive = false;
            let placeholder = null;
            let grabOffsetY = 0;
            let grabOffsetX = 0;

            function onMouseMove(moveEvent) {
                if (!isDraggingActive) {
                    if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 3) return;

                    isDraggingActive = true;
                    document.body.classList.add('is-dragging');
                    card._justDragged = true;

                    const cardRect = card.getBoundingClientRect();
                    grabOffsetY = startY - cardRect.top;
                    grabOffsetX = startX - cardRect.left;

                    placeholder = document.createElement('div');
                    placeholder.className = 'bookmarkItemContainer drag-placeholder';
                    placeholder.style.height = cardRect.height + 'px';
                    placeholder.style.width = cardRect.width + 'px';
                    placeholder.style.marginTop = window.getComputedStyle(card).marginTop;
                    placeholder.style.marginBottom = window.getComputedStyle(card).marginBottom;

                    card.parentNode.insertBefore(placeholder, card);

                    card.classList.add('is-dragged-item');
                    card.style.position = 'fixed';
                    card.style.top = (moveEvent.clientY - grabOffsetY) + 'px';
                    card.style.left = (moveEvent.clientX - grabOffsetX) + 'px';
                    card.style.width = cardRect.width + 'px';
                    card.style.height = cardRect.height + 'px';
                    card.style.margin = '0';
                    card.style.zIndex = '300';
                    card.style.pointerEvents = 'none';
                }

                card.style.top = (moveEvent.clientY - grabOffsetY) + 'px';
                card.style.left = (moveEvent.clientX - grabOffsetX) + 'px';

                const overBin = isCursorOverDeleteBin(moveEvent.clientX, moveEvent.clientY);
                setDeleteBinHover(overBin);
                if (overBin) return;

                const targetContainer = moveEvent.clientX < window.innerWidth / 2 ? bookmarkAreaLeft : bookmarkAreaRight;
                const afterElement = getDragAfterMainBookmarkElement(targetContainer, moveEvent.clientY);
                if (placeholder.parentNode === targetContainer && placeholder.nextElementSibling === afterElement) return;

                // FLIP animation for siblings across both bookmark columns
                const siblings = [
                    ...bookmarkAreaLeft.querySelectorAll('.bookmarkItemContainer:not(.is-dragged-item):not(.drag-placeholder)'),
                    ...bookmarkAreaRight.querySelectorAll('.bookmarkItemContainer:not(.is-dragged-item):not(.drag-placeholder)')
                ];
                const firstTops = new Map();
                siblings.forEach(el => firstTops.set(el, el.getBoundingClientRect().top));

                if (afterElement == null) {
                    targetContainer.appendChild(placeholder);
                } else {
                    targetContainer.insertBefore(placeholder, afterElement);
                }

                updateAllContainerHeights();

                siblings.forEach(el => {
                    const firstTop = firstTops.get(el);
                    if (firstTop === undefined) return;
                    const lastTop = el.getBoundingClientRect().top;
                    const deltaY = firstTop - lastTop;

                    if (Math.abs(deltaY) > 0.5) {
                        el.style.transition = 'none';
                        el.style.transform = `translateY(${deltaY}px)`;
                        el.offsetHeight; // force reflow
                        el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
                        el.style.transform = '';

                        const onEnd = () => {
                            el.style.transition = '';
                            el.removeEventListener('transitionend', onEnd);
                        };
                        el.addEventListener('transitionend', onEnd);
                    }
                });
            }

            function onMouseUp(upEvent) {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                setDeleteBinHover(false);

                if (!isDraggingActive) {
                    document.body.classList.remove('is-dragging');
                    return;
                }

                const droppedInBin = isCursorOverDeleteBin(upEvent.clientX, upEvent.clientY);
                if (droppedInBin) {
                    document.body.classList.remove('is-dragging');

                    const performDelete = () => {
                        const siblings = [
                            ...bookmarkAreaLeft.querySelectorAll('.bookmarkItemContainer:not(.is-dragged-item):not(.drag-placeholder)'),
                            ...bookmarkAreaRight.querySelectorAll('.bookmarkItemContainer:not(.is-dragged-item):not(.drag-placeholder)')
                        ];
                        const firstTops = new Map();
                        siblings.forEach(el => firstTops.set(el, el.getBoundingClientRect().top));

                        if (placeholder && placeholder.parentNode) placeholder.remove();
                        card.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
                        card.style.transform = 'scale(0.2)';
                        card.style.opacity = '0';
                        setTimeout(() => card.remove(), 180);

                        deleteMainBookmarkItem(card);

                        siblings.forEach(el => {
                            const firstTop = firstTops.get(el);
                            if (firstTop === undefined) return;
                            const lastTop = el.getBoundingClientRect().top;
                            const deltaY = firstTop - lastTop;
                            if (Math.abs(deltaY) > 0.5) {
                                el.style.transition = 'none';
                                el.style.transform = `translateY(${deltaY}px)`;
                                el.offsetHeight;
                                el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)';
                                el.style.transform = '';
                                el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
                            }
                        });
                    };

                    const restoreCard = () => {
                        const targetRect = placeholder.getBoundingClientRect();
                        card.style.transition = 'top 0.18s cubic-bezier(0.2, 0, 0, 1), left 0.18s cubic-bezier(0.2, 0, 0, 1)';
                        card.style.top = targetRect.top + 'px';
                        card.style.left = targetRect.left + 'px';
                        setTimeout(() => {
                            if (placeholder && placeholder.parentNode) {
                                placeholder.parentNode.insertBefore(card, placeholder);
                                placeholder.remove();
                            }
                            card.style.position = '';
                            card.style.top = '';
                            card.style.left = '';
                            card.style.width = '';
                            card.style.height = '';
                            card.style.margin = '';
                            card.style.zIndex = '';
                            card.style.transition = '';
                            card.style.pointerEvents = '';
                            card.classList.remove('is-dragged-item');
                            setTimeout(() => { card._justDragged = false; }, 100);
                            saveMainBookmarksOrder();
                    updateAllContainerHeights();
                        }, 200);
                    };

                    showBrowserDeleteConfirm(performDelete, restoreCard);
                    return;
                }

                const targetRect = placeholder.getBoundingClientRect();
                card.style.transition = 'top 0.18s cubic-bezier(0.2, 0, 0, 1), left 0.18s cubic-bezier(0.2, 0, 0, 1)';
                card.style.top = targetRect.top + 'px';
                card.style.left = targetRect.left + 'px';

                let cleanedUp = false;
                function finish() {
                    if (cleanedUp) return;
                    cleanedUp = true;

                    if (placeholder && placeholder.parentNode) {
                        placeholder.parentNode.insertBefore(card, placeholder);
                        placeholder.remove();
                    }

                    card.style.position = '';
                    card.style.top = '';
                    card.style.left = '';
                    card.style.width = '';
                    card.style.height = '';
                    card.style.margin = '';
                    card.style.zIndex = '';
                    card.style.transition = '';
                    card.style.pointerEvents = '';
                    card.classList.remove('is-dragged-item');
                    document.body.classList.remove('is-dragging');

                    setTimeout(() => { card._justDragged = false; }, 100);

                    saveMainBookmarksOrder();
                    updateAllContainerHeights();
                }

                card.addEventListener('transitionend', finish, { once: true });
                setTimeout(finish, 220);
            }

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        container.addEventListener('click', function(e) {
            const link = e.target.closest('.bookmarkItemContainer');
            if (link && link._justDragged) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        container.addEventListener('contextmenu', function(e) {
            const link = e.target.closest('.bookmarkItemContainer');
            if (!link) return;
            e.preventDefault();
            const side = container === bookmarkAreaRight ? 'right' : 'left';
            openSettingsPage('bookmarks', side);
        });
    }

    window.addEventListener('dragstart', function(e) {
        if (document.body.classList.contains('is-dragging') ||
            (e.target && (e.target.classList.contains('engine-icon') || e.target.closest('.bookmarkItemContainer')))) {
            e.preventDefault();
        }
    });

    /** Hides the Home clock automatically when vertical space becomes too tight for search bars. */
    function checkClockSearchBarsGap() {
        const clockWidget = document.getElementById('container-clock_widget');
        if (!clockWidget) return;

        const showClockSetting = localStorage.getItem('showClock');
        if (showClockSetting === '"off"' || showClockSetting === 'off') {
            clockWidget.style.display = 'none';
            return;
        }

        const searchBars = [...searchBarsElement.querySelectorAll('.inputContainer:not(#container-clock_widget):not(.is-dragged-item):not(.drag-placeholder)')];
        const searchBarCount = searchBars.length;
        if (searchBarCount === 0) {
            clockWidget.style.display = '';
            return;
        }

        const firstBar = searchBars[0];
        const barHeight = firstBar.offsetHeight || 48;
        const totalItemsWithClock = searchBarCount + 1;
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const containerHeight = Math.min(viewportHeight, totalItemsWithClock * 150);
        const gapWithClock = (containerHeight - totalItemsWithClock * barHeight) / (totalItemsWithClock + 1);

        // When the gap between search bars reaches 3px or less, hide the time and date
        if (gapWithClock <= 3) {
            clockWidget.style.display = 'none';
        } else {
            clockWidget.style.display = '';
        }
    }

    function setDynamicContainerHeight(elementId, gap) {
        const container = document.getElementById(elementId);
        if (!container) return;
        const visibleChildren = [...container.children].filter(el =>
            !el.classList.contains('is-dragged-item') &&
            !el.classList.contains('pinned-tooltip') &&
            el.style.display !== 'none' &&
            window.getComputedStyle(el).display !== 'none'
        );
        const childCount = visibleChildren.length;
        const calculatedHeight = childCount * gap;
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const maxHeight = viewportHeight;
        const finalHeight = calculatedHeight > maxHeight ? maxHeight : calculatedHeight;
        container.style.maxHeight = finalHeight + 'px';
        container.style.height = '';
    }

    /** Centers bookmark columns on tall screens and switches to dense packing / hidden titles when space is tight. */
    function setDynamicBookmarkHeight(elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;
        const children = container.querySelectorAll(':scope > :not(.is-dragged-item):not(.drag-placeholder)');
        const childCount = children.length;
        if (childCount === 0) {
            container.style.maxHeight = '0px';
            container.style.marginTop = '0px';
            container.classList.remove('dense-packing');
            container.classList.remove('hide-bookmark-titles');
            if (container.parentElement) {
                container.parentElement.classList.remove('top-bar-constrained');
                container.parentElement.style.justifyContent = 'center';
            }
            return;
        }

        const standardGap = 135;
        const naturalHeight = childCount * standardGap;
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const topBarHeight = 78;
        const bottomBuffer = 18;

        // When centered vertically in the viewport, the top of the bookmarks container would be:
        const centeredTop = (viewportHeight - naturalHeight) / 2;

        if (centeredTop >= topBarHeight) {
            // Stay cleanly centered in the screen
            if (container.parentElement) {
                container.parentElement.classList.remove('top-bar-constrained');
                container.parentElement.style.justifyContent = 'center';
            }
            container.style.maxHeight = naturalHeight + 'px';
            container.style.marginTop = '0px';
            container.classList.remove('dense-packing');
            container.classList.remove('hide-bookmark-titles');
        } else {
            // Clashes with the top zone: constrain below the top bar and pack densely
            if (container.parentElement) {
                container.parentElement.classList.add('top-bar-constrained');
                container.parentElement.style.justifyContent = 'flex-start';
            }
            const availableHeight = viewportHeight - topBarHeight - bottomBuffer;
            const itemHeightWithText = 74;
            const gapWithText = (availableHeight - (childCount * itemHeightWithText)) / (childCount + 1);

            // Once the gap between bookmarks reaches 0 or less, remove the text
            const needsHideTitles = gapWithText <= 0;
            if (needsHideTitles) {
                container.classList.add('hide-bookmark-titles');
            } else {
                container.classList.remove('hide-bookmark-titles');
            }

            const minPerItem = needsHideTitles ? 48 : 74;
            container.style.maxHeight = Math.max(availableHeight, childCount * minPerItem) + 'px';
            container.style.marginTop = topBarHeight + 'px';
            container.classList.add('dense-packing');
        }
    }

    function updateAllContainerHeights() {
        checkClockSearchBarsGap();
        fitClockText();
        setDynamicContainerHeight('searchBars', 150);
        setDynamicBookmarkHeight('bookmarkAreaLeft');
        setDynamicBookmarkHeight('bookmarkAreaRight');
    }

    // --- Interactive Onboarding Walkthrough ---

    /** Launches the step-by-step spotlight walkthrough overlay on the Home page. */
    function startMainWalkthrough() {
        const existingOverlay = document.getElementById('walkthroughOverlay');
        if (existingOverlay) existingOverlay.remove();

        const clockBar = document.getElementById('homeClockBar');
        const isClockVisible = clockBar && window.getComputedStyle(clockBar).display !== 'none' && !document.documentElement.classList.contains('no-clock');

        const steps = [
            {
                title: 'Welcome to 1 Click Search',
                body: 'Your new multi-search home page! Search across your favourite websites in one click and keep your most-used bookmarks right at your fingertips.',
                getTarget: () => null,
                padding: 0,
                radius: '16px'
            }
        ];

        if (isClockVisible) {
            steps.push({
                title: 'Home Clock & Fast Shortcuts',
                body: 'The live clock keeps you on schedule, but it also doubles as a fast settings shortcut:<ul><li><b>Left-click</b> anywhere on the clock to jump straight to <b>Search Settings</b></li><li><b>Right-click</b> to open <b>General Settings</b> to switch between 12hr / 24hr formats or hide the clock</li></ul>',
                getTarget: () => document.getElementById('homeClockBar'),
                padding: 8,
                radius: '14px'
            });
        }

        steps.push(
            {
                title: 'Pinned Default Search & Shortcuts',
                body: 'The top search bar is permanently <b>pinned</b> to your browser\'s default search engine (Google, Bing, DuckDuckGo, etc.).<br><br>Type a search and press <kbd>Enter</kbd> (or paste any URL to go straight there). Press <kbd>/</kbd> anywhere to start searching, <kbd>Esc</kbd> to clear, or use <kbd>↑</kbd> / <kbd>↓</kbd> to carry your text between bars!',
                getTarget: () => document.getElementById('container-browser_default') || searchBarsElement.querySelector('.inputContainer:not(#container-clock_widget)'),
                padding: 10,
                radius: '34px'
            },
            {
                title: 'Site Icons: Click, Drag & Right-Click',
                body: 'Each custom search bar\'s site icon has three handy actions:<ul><li><b>Left-click</b> to go straight to that website\'s home page</li><li><b>Click & drag</b> up or down to reorder your search bars</li><li><b>Right-click</b> to jump directly to Search Bars settings</li></ul>',
                getTarget: () => {
                    const allIcons = searchBarsElement.querySelectorAll('.engine-icon');
                    return allIcons[1] || allIcons[0] || null;
                },
                padding: 8,
                radius: '50%'
            },
            {
                title: 'Left & Right Bookmarks',
                body: 'Your bookmarks sit in columns on the left and right.<ul><li><b>Click & drag</b> any bookmark to reorder it or move it to the opposite column</li><li><b>Right-click</b> a bookmark to manage that column in Settings</li></ul>',
                getTarget: () => {
                    const leftItems = bookmarkAreaLeft.querySelectorAll('.bookmarkItemContainer');
                    if (leftItems.length > 0) return bookmarkAreaLeft;
                    const rightItems = bookmarkAreaRight.querySelectorAll('.bookmarkItemContainer');
                    if (rightItems.length > 0) return bookmarkAreaRight;
                    return bookmarkAreaLeft;
                },
                padding: 6,
                radius: '18px',
                onEnter: () => document.body.classList.add('walkthrough-show-bookmarks'),
                onExit: () => document.body.classList.remove('walkthrough-show-bookmarks')
            },
            {
                title: 'Drag to the Bin to Delete',
                body: 'Want to remove a bookmark or search bar right from the home page? When you start dragging, this <b>Delete Bin</b> appears in the top-left corner—drop a bookmark onto the bin, or pull a search bar to the left to delete it.',
                getTarget: () => deleteBinButton,
                padding: 16,
                radius: '50%',
                onEnter: () => {
                    document.body.classList.add('walkthrough-show-bin');
                    setDeleteBinHover(true);
                },
                onExit: () => {
                    document.body.classList.remove('walkthrough-show-bin');
                    setDeleteBinHover(false);
                }
            },
            {
                title: 'Customise Everything in Settings',
                body: 'Click the <b>Settings</b> gear in the top-right to add custom search bars for any website, manage bookmarks, upload your own custom wallpaper or choose from presets, toggle the clock, and back up your config.',
                getTarget: () => document.getElementById('settingsPageButton'),
                padding: 16,
                radius: '50%'
            }
        );

        let currentStepIndex = 0;

        const overlay = document.createElement('div');
        overlay.id = 'walkthroughOverlay';
        overlay.innerHTML = `
            <div id="walkthroughBackdrop"></div>
            <div id="walkthroughSpotlight"></div>
            <div id="walkthroughCard" role="dialog" aria-modal="true">
                <div class="walkthroughHeader">
                    <span class="walkthroughStepBadge" id="walkthroughStepBadge"></span>
                    <button type="button" class="walkthroughSkipBtn" id="walkthroughSkipBtn">Skip tour</button>
                </div>
                <h3 class="walkthroughTitle" id="walkthroughTitle"></h3>
                <div class="walkthroughBody" id="walkthroughBody"></div>
                <div class="walkthroughFooter">
                    <div class="walkthroughDots" id="walkthroughDots"></div>
                    <div class="walkthroughNavBtns">
                        <button type="button" class="walkthroughBtn walkthroughBtnPrev" id="walkthroughPrevBtn">Back</button>
                        <button type="button" class="walkthroughBtn walkthroughBtnNext" id="walkthroughNextBtn">Next</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const backdrop = overlay.querySelector('#walkthroughBackdrop');
        const spotlight = overlay.querySelector('#walkthroughSpotlight');
        const card = overlay.querySelector('#walkthroughCard');
        const badgeEl = overlay.querySelector('#walkthroughStepBadge');
        const titleEl = overlay.querySelector('#walkthroughTitle');
        const bodyEl = overlay.querySelector('#walkthroughBody');
        const dotsContainer = overlay.querySelector('#walkthroughDots');
        const prevBtn = overlay.querySelector('#walkthroughPrevBtn');
        const nextBtn = overlay.querySelector('#walkthroughNextBtn');
        const skipBtn = overlay.querySelector('#walkthroughSkipBtn');

        steps.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = 'walkthroughDot';
            dot.title = `Step ${idx + 1}`;
            dot.addEventListener('click', () => goToStep(idx));
            dotsContainer.appendChild(dot);
        });

        function cleanupStepEffects() {
            steps.forEach(s => {
                if (typeof s.onExit === 'function') s.onExit();
            });
        }

        function closeWalkthrough() {
            cleanupStepEffects();
            window.removeEventListener('resize', positionCurrentStep);
            window.removeEventListener('keydown', onKeyDown, true);
            localStorage.setItem('walkthroughCompleted', 'true');
            localStorage.removeItem('startWalkthrough');
            overlay.remove();
        }

        function positionCurrentStep() {
            const step = steps[currentStepIndex];
            const target = step.getTarget ? step.getTarget() : null;

            const cardRect = card.getBoundingClientRect();
            const cardW = cardRect.width || 410;
            const cardH = cardRect.height || 230;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const margin = 20;

            if (!target) {
                backdrop.style.opacity = '1';
                spotlight.style.opacity = '0';
                spotlight.style.top = (vh / 2) + 'px';
                spotlight.style.left = (vw / 2) + 'px';
                spotlight.style.width = '0px';
                spotlight.style.height = '0px';

                card.style.left = Math.max(margin, (vw - cardW) / 2) + 'px';
                card.style.top = Math.max(margin, (vh - cardH) / 2) + 'px';
                return;
            }

            backdrop.style.opacity = '0';
            spotlight.style.opacity = '1';

            const rect = target.getBoundingClientRect();
            const pad = step.padding || 8;
            const spotTop = rect.top - pad;
            const spotLeft = rect.left - pad;
            const spotW = rect.width + pad * 2;
            const spotH = rect.height + pad * 2;

            spotlight.style.top = spotTop + 'px';
            spotlight.style.left = spotLeft + 'px';
            spotlight.style.width = spotW + 'px';
            spotlight.style.height = spotH + 'px';
            spotlight.style.borderRadius = step.radius || '14px';

            let targetLeft = spotLeft + (spotW - cardW) / 2;
            let targetTop = spotTop + spotH + 22;

            // If highlighting a side bookmark column, place card beside the column
            if (target === bookmarkAreaLeft) {
                targetLeft = spotLeft + spotW + 24;
                targetTop = spotTop + (spotH - cardH) / 2;
            } else if (target === bookmarkAreaRight) {
                targetLeft = spotLeft - cardW - 24;
                targetTop = spotTop + (spotH - cardH) / 2;
            } else if (target === deleteBinButton) {
                targetLeft = Math.max(margin, spotLeft);
                targetTop = spotTop + spotH + 20;
            } else if (target.id === 'settingsPageButton') {
                targetLeft = Math.min(vw - cardW - margin, spotLeft + spotW - cardW);
                targetTop = spotTop + spotH + 20;
            } else if (target.id === 'homeClockBar') {
                targetLeft = spotLeft + (spotW - cardW) / 2;
                targetTop = spotTop + spotH + 22;
            } else if (target.classList && target.classList.contains('engine-icon')) {
                targetLeft = spotLeft + spotW + 20;
                targetTop = spotTop + (spotH - cardH) / 2;
            }

            // Flip above if overflowing bottom
            if (targetTop + cardH > vh - margin) {
                targetTop = Math.max(margin, spotTop - cardH - 22);
            }
            // Clamp within viewport
            targetLeft = Math.min(Math.max(margin, targetLeft), vw - cardW - margin);
            targetTop = Math.min(Math.max(margin, targetTop), vh - cardH - margin);

            card.style.left = targetLeft + 'px';
            card.style.top = targetTop + 'px';
        }

        function goToStep(index) {
            cleanupStepEffects();
            currentStepIndex = Math.max(0, Math.min(steps.length - 1, index));
            const step = steps[currentStepIndex];

            if (typeof step.onEnter === 'function') {
                step.onEnter();
            }

            badgeEl.textContent = `Step ${currentStepIndex + 1} of ${steps.length}`;
            titleEl.textContent = step.title;
            bodyEl.innerHTML = step.body;

            dotsContainer.querySelectorAll('.walkthroughDot').forEach((d, i) => {
                d.classList.toggle('active', i === currentStepIndex);
            });

            prevBtn.style.visibility = currentStepIndex === 0 ? 'hidden' : 'visible';
            nextBtn.textContent = currentStepIndex === steps.length - 1 ? 'Finish' : 'Next';

            requestAnimationFrame(positionCurrentStep);
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeWalkthrough();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                if (currentStepIndex < steps.length - 1) {
                    goToStep(currentStepIndex + 1);
                } else {
                    closeWalkthrough();
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (currentStepIndex > 0) {
                    goToStep(currentStepIndex - 1);
                }
            }
        }

        prevBtn.addEventListener('click', () => {
            if (currentStepIndex > 0) goToStep(currentStepIndex - 1);
        });

        nextBtn.addEventListener('click', () => {
            if (currentStepIndex < steps.length - 1) {
                goToStep(currentStepIndex + 1);
            } else {
                closeWalkthrough();
            }
        });

        skipBtn.addEventListener('click', closeWalkthrough);
        window.addEventListener('resize', positionCurrentStep);
        window.addEventListener('keydown', onKeyDown, true);

        goToStep(0);
    }

    if (localStorage.getItem('walkthroughCompleted') !== 'true' || localStorage.getItem('startWalkthrough') !== null) {
        localStorage.removeItem('startWalkthrough');
        setTimeout(startMainWalkthrough, 120);
    }
})();