// Settings Coordinator
// Manages the Settings page version badge, sidebar hash navigation (#search, #bookmarks, #background, etc.),
// and smart navigation when clicking the top-left logo to return to the Home page.

const versionElem = document.getElementById('version');
if (versionElem && typeof versionNo !== 'undefined') {
    versionElem.textContent = 'Version ' + versionNo;
}

/**
 * Highlights the active sidebar menu item matching the current URL hash
 * and initializes page-specific controls (toggles and active bookmark column).
 */
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

// Logo switches to an existing Home tab if one is already open; otherwise opens main.html in the same tab
const logoContainer = document.getElementById('logoContainer');
if (logoContainer) {
    logoContainer.addEventListener('click', function(e) {
        e.preventDefault();
        focusOrOpenHomeTab();
    });
}