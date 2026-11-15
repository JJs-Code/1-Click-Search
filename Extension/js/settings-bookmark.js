// Bookmark Settings Controller (Left and Right columns)
// Manages adding, editing, reordering, toggling, swapping, and deleting bookmarks
// across the left and right columns shown on the Home page.

const bookmarkDataContainerLeft  = document.getElementById('bookmarkDataContainerLeft');
const bookmarkDataContainerRight = document.getElementById('bookmarkDataContainerRight');
let activeBookmarkSide           = 'left';

const buttonSideLeft             = document.getElementById('buttonSideLeft');
const buttonSideRight            = document.getElementById('buttonSideRight');
const buttonSidesSwap            = document.getElementById('buttonSidesSwap');

/** Reads a bookmark column from localStorage, migrating legacy bmLeftData/bmRightData keys if present. */
function safeGetBookmarks(key, defaultData) {
    try {
        let raw = localStorage.getItem(key);
        if (!raw) {
            const legacyKey = key === 'bookmarkLeftData' ? 'bmLeftData' : (key === 'bookmarkRightData' ? 'bmRightData' : null);
            if (legacyKey) {
                raw = localStorage.getItem(legacyKey);
                if (raw) {
                    localStorage.setItem(key, raw);
                    localStorage.removeItem(legacyKey);
                }
            }
        }
        if (!raw) return defaultData;
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : defaultData;
    } catch (e) {
        return defaultData;
    }
}

initialiseBookmarkSettings();

/** Initializes both bookmark columns, wires tab/swap/add/save controls, and enables drag-and-drop. */
function initialiseBookmarkSettings() {
    let leftBookmarksData  = safeGetBookmarks('bookmarkLeftData', defaultLeftBookmarks);
    let rightBookmarksData = safeGetBookmarks('bookmarkRightData', defaultRightBookmarks);

    localStorage.setItem('bookmarkLeftData', JSON.stringify(leftBookmarksData));
    localStorage.setItem('bookmarkRightData', JSON.stringify(rightBookmarksData));
    localStorage.removeItem('bmLeftData');
    localStorage.removeItem('bmRightData');

    renderBookmarkSide(bookmarkDataContainerLeft, leftBookmarksData);
    renderBookmarkSide(bookmarkDataContainerRight, rightBookmarksData);

    setupBookmarkNavigation();
    attachBookmarkCardEvents(bookmarkDataContainerLeft, 'bookmarkLeftData');
    attachBookmarkCardEvents(bookmarkDataContainerRight, 'bookmarkRightData');
    attachBookmarkDragListeners(bookmarkDataContainerLeft, 'bookmarkLeftData');
    attachBookmarkDragListeners(bookmarkDataContainerRight, 'bookmarkRightData');
}

/** Loads the card's favicon and debounces live icon updates as the user edits its URL. */
function setupBookmarkCardFavicon(card) {
    if (typeof updateSettingsCardFavicon === 'function') {
        updateSettingsCardFavicon(card);
    }
    const urlInput = card.querySelector('.bookmarkUrl');
    if (urlInput) {
        let faviconTimer = null;
        urlInput.addEventListener('input', () => {
            clearTimeout(faviconTimer);
            faviconTimer = setTimeout(() => {
                if (typeof updateSettingsCardFavicon === 'function') {
                    updateSettingsCardFavicon(card);
                }
            }, 250);
        });
    }
}

/** Renders all bookmark cards for a single column (left or right). */
function renderBookmarkSide(container, data) {
    container.innerHTML = '';
    const entries = Object.entries(data);
    entries.forEach(([name, key]) => {
        const card = document.createElement('div');
        card.className = 'bookmarkContainer' + (key.state === 'off' ? ' inactive' : '');
        card.id = name !== 'blank' ? name.replace(/\s+/g, '_') : 'newBookmark';
        card.innerHTML = bookmarkHtml(name, key);
        setupBookmarkCardFavicon(card);
        container.appendChild(card);
    });
}

function displayBookmarkMessage(messageId, messageClass, flashClass, content) {
    let messageElement = document.getElementById(messageId);
    if (!messageElement) {
        messageElement = document.createElement('p');
        messageElement.id = messageId;
        messageElement.className = 'bookmarkMessage ' + (messageClass || '');
        messageElement.innerHTML = content;
        const msgContainer = document.getElementById('bookmarkMessageContainer');
        if (msgContainer) {
            msgContainer.appendChild(messageElement);
        }
    } else {
        messageElement.classList.add(flashClass);
        setTimeout(() => messageElement.classList.remove(flashClass), 500);
    }
}

function removeBookmarkMessage(messageId) {
    const el = document.getElementById(messageId);
    if (el) el.remove();
}

/** Validates all cards in the given column(s) for empty fields, invalid URLs, or duplicate names. */
function validateAndCheckBookmarks(containerToCheck) {
    const containers = containerToCheck ? [containerToCheck] : [bookmarkDataContainerLeft, bookmarkDataContainerRight];
    let hasEmpty = false;
    let hasBadUrl = false;
    let hasDuplicate = false;

    containers.forEach(container => {
        const seenNames = new Set();
        container.querySelectorAll('.bookmarkContainer').forEach(card => {
            const nameInput = card.querySelector('.bookmarkName');
            const urlInput  = card.querySelector('.bookmarkUrl');
            const nameVal   = nameInput ? nameInput.value.trim() : '';
            let urlVal      = urlInput ? urlInput.value.trim() : '';

            if (!nameVal || !urlVal) {
                hasEmpty = true;
            }
            if (nameVal) {
                if (seenNames.has(nameVal)) {
                    hasDuplicate = true;
                } else {
                    seenNames.add(nameVal);
                }
            }
            if (urlVal) {
                if (!urlVal.startsWith('http://') && !urlVal.startsWith('https://')) {
                    urlVal = 'https://' + urlVal;
                    if (urlInput) urlInput.value = urlVal;
                }
                try {
                    const parsed = new URL(urlVal);
                    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
                        hasBadUrl = true;
                    }
                } catch (e) {
                    hasBadUrl = true;
                }
                if (typeof updateSettingsCardFavicon === 'function') {
                    updateSettingsCardFavicon(card);
                }
            }
        });
    });

    return { hasEmpty, hasBadUrl, hasDuplicate };
}

/** Runs validation across both columns and saves to localStorage if there are no errors. */
function checkAndSaveBookmarks() {
    let errorCount = 0;
    const { hasEmpty, hasBadUrl, hasDuplicate } = validateAndCheckBookmarks();

    if (hasEmpty) {
        displayBookmarkMessage('bookmarkWarningMessage', undefined, 'bookmarkWarningFlash', 'Fill in all input fields before saving or adding new bookmarks');
        errorCount++;
    } else {
        removeBookmarkMessage('bookmarkWarningMessage');
    }

    if (hasBadUrl) {
        displayBookmarkMessage('bookmarkUrlMessage', 'bookmarkSyntaxMessage', 'bookmarkSyntaxFlash', "Please enter a valid website URL in the 'Site url' field");
        errorCount++;
    } else {
        removeBookmarkMessage('bookmarkUrlMessage');
    }

    if (hasDuplicate) {
        displayBookmarkMessage('bookmarkUniqueMessage', 'bookmarkSyntaxMessage', 'bookmarkSyntaxFlash', 'New name cannot be the same as an already existing bookmark name in the same column');
        errorCount++;
    } else {
        removeBookmarkMessage('bookmarkUniqueMessage');
    }

    if (errorCount === 0) {
        saveBookmarksToStorage(bookmarkDataContainerLeft, 'bookmarkLeftData');
        saveBookmarksToStorage(bookmarkDataContainerRight, 'bookmarkRightData');
        displayBookmarkMessage('bookmarkSavedMessage', undefined, 'bookmarkSavedFlash', 'Saved!');
    } else {
        removeBookmarkMessage('bookmarkSavedMessage');
    }
}

/** Switches the visible column tab in Bookmark Settings ('left' or 'right'). */
function setActiveBookmarkSideTab(side) {
    if (side === 'right') {
        activeBookmarkSide = 'right';
        buttonSideRight.classList.add('activeSide');
        buttonSideLeft.classList.remove('activeSide');
        bookmarkDataContainerRight.classList.remove('hidden');
        bookmarkDataContainerLeft.classList.add('hidden');
    } else {
        activeBookmarkSide = 'left';
        buttonSideLeft.classList.add('activeSide');
        buttonSideRight.classList.remove('activeSide');
        bookmarkDataContainerLeft.classList.remove('hidden');
        bookmarkDataContainerRight.classList.add('hidden');
    }
}

function setupBookmarkNavigation() {
    const initialSide = localStorage.getItem('activeBookmarkSide') === 'right' ? 'right' : 'left';
    setActiveBookmarkSideTab(initialSide);

    buttonSideLeft.addEventListener('click', () => {
        localStorage.setItem('activeBookmarkSide', 'left');
        setActiveBookmarkSideTab('left');
    });

    buttonSideRight.addEventListener('click', () => {
        localStorage.setItem('activeBookmarkSide', 'right');
        setActiveBookmarkSideTab('right');
    });

    buttonSidesSwap.addEventListener('click', () => {
        buttonSidesSwap.classList.remove('spinClick');
        void buttonSidesSwap.offsetWidth; // Force CSS reflow
        buttonSidesSwap.classList.add('spinClick');
        setTimeout(() => buttonSidesSwap.classList.remove('spinClick'), 400);

        saveBookmarksToStorage(bookmarkDataContainerLeft, 'bookmarkLeftData');
        saveBookmarksToStorage(bookmarkDataContainerRight, 'bookmarkRightData');

        const leftData  = safeGetBookmarks('bookmarkLeftData', defaultLeftBookmarks);
        const rightData = safeGetBookmarks('bookmarkRightData', defaultRightBookmarks);
        localStorage.setItem('bookmarkLeftData', JSON.stringify(rightData));
        localStorage.setItem('bookmarkRightData', JSON.stringify(leftData));
        localStorage.removeItem('bmLeftData');
        localStorage.removeItem('bmRightData');
        if (typeof populateImportExportField === 'function') populateImportExportField();

        renderBookmarkSide(bookmarkDataContainerLeft, rightData);
        renderBookmarkSide(bookmarkDataContainerRight, leftData);
        attachBookmarkCardEvents(bookmarkDataContainerLeft, 'bookmarkLeftData');
        attachBookmarkCardEvents(bookmarkDataContainerRight, 'bookmarkRightData');
        attachBookmarkDragListeners(bookmarkDataContainerLeft, 'bookmarkLeftData');
        attachBookmarkDragListeners(bookmarkDataContainerRight, 'bookmarkRightData');
    });

    document.getElementById('addNewBookmarkButton').addEventListener('click', (e) => {
        e.preventDefault();
        removeBookmarkMessage('bookmarkSavedMessage');
        const activeContainer = activeBookmarkSide === 'left' ? bookmarkDataContainerLeft : bookmarkDataContainerRight;
        const { hasEmpty } = validateAndCheckBookmarks(activeContainer);
        if (hasEmpty) {
            displayBookmarkMessage('bookmarkWarningMessage', undefined, 'bookmarkWarningFlash', 'Fill in all input fields before saving or adding new bookmarks');
            return;
        }
        removeBookmarkMessage('bookmarkWarningMessage');
        const newCard = document.createElement('div');
        newCard.className = 'bookmarkContainer';
        newCard.innerHTML = bookmarkHtml('blank', { url: '', state: 'on' });
        setupBookmarkCardFavicon(newCard);
        activeContainer.prepend(newCard);
        const storageKey = activeBookmarkSide === 'left' ? 'bookmarkLeftData' : 'bookmarkRightData';
        attachBookmarkCardEvents(activeContainer, storageKey);
        attachBookmarkDragListeners(activeContainer, storageKey);
    });

    document.getElementById('saveBookmarkButton').addEventListener('click', (e) => {
        e.preventDefault();
        checkAndSaveBookmarks();
    });
}

/** Serializes all bookmark cards in a column into localStorage and refreshes the export preview. */
function saveBookmarksToStorage(container, storageKey) {
    const data = {};
    container.querySelectorAll('.bookmarkContainer').forEach(card => {
        const nameInput   = card.querySelector('.bookmarkName');
        const urlInput    = card.querySelector('.bookmarkUrl');
        const activeInput = card.querySelector('.bookmarkActive');
        const name        = nameInput ? nameInput.value.trim() : '';
        let url           = urlInput ? urlInput.value.trim() : '';
        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
            if (urlInput) urlInput.value = url;
        }
        if (typeof updateSettingsCardFavicon === 'function') {
            updateSettingsCardFavicon(card);
        }
        const state       = activeInput && activeInput.checked ? 'on' : 'off';
        if (name) {
            data[name] = { url, state };
        }
    });
    localStorage.setItem(storageKey, JSON.stringify(data));
    const legacyKey = storageKey === 'bookmarkLeftData' ? 'bmLeftData' : (storageKey === 'bookmarkRightData' ? 'bmRightData' : null);
    if (legacyKey) localStorage.removeItem(legacyKey);
    if (typeof populateImportExportField === 'function') populateImportExportField();
}

function attachBookmarkCardEvents(container, storageKey) {
    container.querySelectorAll('.bookmarkButton.buttonRed').forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const card = btn.closest('.bookmarkContainer');
            if (!card) return;

            showBrowserDeleteConfirm(() => {
                card.remove();
                saveBookmarksToStorage(container, storageKey);
            });
        };
    });

    container.querySelectorAll('.bookmarkActive').forEach(toggle => {
        toggle.onchange = () => {
            const card = toggle.closest('.bookmarkContainer');
            card.classList.toggle('inactive', !toggle.checked);
            saveBookmarksToStorage(container, storageKey);
        };
    });
}

/** Attaches pointer-based vertical drag-and-drop reordering with FLIP sibling animation for a column. */
function attachBookmarkDragListeners(container, storageKey) {
    container._storageKey = storageKey;
    if (container._hasDragListeners) return;
    container._hasDragListeners = true;

    container.addEventListener("mousedown", function(e) {
        const handle = e.target.closest('.bookmarkButtonReorder, .settingsCardFavicon');
        if (!handle || e.button !== 0) return;

        const card = handle.closest('.bookmarkContainer');
        if (!card) return;

        e.preventDefault();

        const startY = e.clientY;
        const startX = e.clientX;
        let isDraggingActive = false;
        let placeholder = null;
        let grabOffsetY = 0;

        function onMouseMove(moveEvent) {
            if (!isDraggingActive) {
                if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 3) return;

                isDraggingActive = true;
                document.body.classList.add('is-dragging');

                const cardRect = card.getBoundingClientRect();
                grabOffsetY = startY - cardRect.top;

                placeholder = document.createElement('div');
                placeholder.className = 'bookmarkContainer drag-placeholder';
                placeholder.style.height = cardRect.height + 'px';
                placeholder.style.width = cardRect.width + 'px';
                placeholder.style.marginTop = window.getComputedStyle(card).marginTop;
                placeholder.style.marginBottom = window.getComputedStyle(card).marginBottom;

                card.parentNode.insertBefore(placeholder, card);

                card.classList.add('is-dragged-item');
                card.style.position = 'fixed';
                card.style.top = (moveEvent.clientY - grabOffsetY) + 'px';
                card.style.left = cardRect.left + 'px';
                card.style.width = cardRect.width + 'px';
                card.style.height = cardRect.height + 'px';
                card.style.margin = '0';
                card.style.zIndex = '100';
                card.style.pointerEvents = 'none';
            }

            card.style.top = (moveEvent.clientY - grabOffsetY) + 'px';

            const afterElement = getDragAfterBookmarkElement(container, moveEvent.clientY);
            if (placeholder.nextElementSibling === afterElement) return;

            // FLIP animation for siblings
            const siblings = [...container.querySelectorAll('.bookmarkContainer:not(.is-dragged-item):not(.drag-placeholder)')];
            const firstTops = new Map();
            siblings.forEach(el => firstTops.set(el, el.getBoundingClientRect().top));

            if (afterElement == null) {
                container.appendChild(placeholder);
            } else {
                container.insertBefore(placeholder, afterElement);
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

        function onMouseUp() {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (!isDraggingActive) {
                document.body.classList.remove('is-dragging');
                return;
            }

            const targetRect = placeholder.getBoundingClientRect();
            card.style.transition = 'top 0.18s cubic-bezier(0.2, 0, 0, 1)';
            card.style.top = targetRect.top + 'px';

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

                saveBookmarksToStorage(container, container._storageKey || storageKey);
            }

            card.addEventListener('transitionend', finish, { once: true });
            setTimeout(finish, 220);
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    window.addEventListener('dragstart', function(e) {
        if (document.body.classList.contains('is-dragging')) {
            e.preventDefault();
        }
    });
}

function getDragAfterBookmarkElement(container, y) {
    const draggables = [...container.querySelectorAll('.bookmarkContainer:not(.is-dragged-item):not(.drag-placeholder)')];
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

window.addEventListener('storage', (e) => {
    if (e.key === 'activeBookmarkSide') {
        setActiveBookmarkSideTab(e.newValue === 'right' ? 'right' : 'left');
    }
    if (e.key === 'bookmarkLeftData' || e.key === 'bmLeftData') {
        const leftData = safeGetBookmarks('bookmarkLeftData', defaultLeftBookmarks);
        renderBookmarkSide(bookmarkDataContainerLeft, leftData);
        attachBookmarkCardEvents(bookmarkDataContainerLeft, 'bookmarkLeftData');
        attachBookmarkDragListeners(bookmarkDataContainerLeft, 'bookmarkLeftData');
    }
    if (e.key === 'bookmarkRightData' || e.key === 'bmRightData') {
        const rightData = safeGetBookmarks('bookmarkRightData', defaultRightBookmarks);
        renderBookmarkSide(bookmarkDataContainerRight, rightData);
        attachBookmarkCardEvents(bookmarkDataContainerRight, 'bookmarkRightData');
        attachBookmarkDragListeners(bookmarkDataContainerRight, 'bookmarkRightData');
    }
});