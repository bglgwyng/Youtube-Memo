type App = {
    bookmarkFolderId: string,
};

(async () => {
    const app = await new Promise<App>((resolve) => chrome.storage.local.get(["app"], ({ app }) => resolve(app)));
    let bookmarkFolder;
    if (app && app.bookmarkFolderId) {
        const nodes = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve) => chrome.bookmarks.getTree(resolve));
        const findBookmark = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
            for(const i of nodes) {
                if(i.id === app.bookmarkFolderId) {
                    return i;
                }
                if(i.children) {
                    const x = findBookmark(i.children)
                    if(x) {
                        return x;
                    }
                }
            }
            return null;
        }
        bookmarkFolder = findBookmark(nodes);
    }
    if (!bookmarkFolder) {
        bookmarkFolder = await new Promise((resolve) => chrome.bookmarks.create(
            { 'title': 'Youtube Memo' },
            function (newFolder) {
                console.log("Bookmark Folder is created")
                chrome.storage.local.set({ app: { bookmarkFolderId: newFolder.id } }, () => resolve(newFolder))
            },
        ));
    }

    chrome.runtime.onMessage.addListener(async (message) => {
        if(message.type === "addBookmark") {
            const nodes = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve) => chrome.bookmarks.search(message.url, resolve));
            for(const i of nodes) {
                if(i.parentId === bookmarkFolder.id && i.url === message.url) {
                    return;
                }
            }
            chrome.bookmarks.create({
                parentId: bookmarkFolder.id,
                url: message.url,
                title: message.title,
            })
        }
    })

    const injectContentScript = ({ tabId }: { tabId: number }) => {
        chrome.tabs.executeScript(tabId, {
            file: "contentScript.js"
        }, function () {
            console.log("Injection is Completed");
        });
    }
    
    const filter = { url: [{ schemes: ["https"], hostEquals: "www.youtube.com", pathEquals: "/watch" }] };
    
    chrome.webNavigation.onCompleted.addListener(injectContentScript, filter);
    chrome.webNavigation.onHistoryStateUpdated.addListener(injectContentScript, filter);    
})();