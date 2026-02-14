// This is just a sample app. You can structure your Neutralinojs app code as you wish.
// This example app is written with vanilla JavaScript and HTML.
// Feel free to use any frontend framework you like :)
// See more details: https://neutralino.js.org/docs/how-to/use-a-frontend-library

/*
    Function to display information about the Neutralino app.
    This function updates the content of the 'info' element in the HTML
    with details regarding the running Neutralino application, including
    its ID, port, operating system, and version information.
*/
function showInfo() {
    document.getElementById('info').innerHTML = `
        ${NL_APPID} is running on port ${NL_PORT} inside ${NL_OS}
        <br/><br/>
        <span>server: v${NL_VERSION} . client: v${NL_CVERSION}</span>
        `;
}

/*
    Function to open the official Neutralino documentation in the default web browser.
*/
function openDocs() {
    Neutralino.os.open("https://neutralino.js.org/docs");
}

/*
    Function to open a tutorial video on Neutralino's official YouTube channel in the default web browser.
*/
function openTutorial() {
    Neutralino.os.open("https://www.youtube.com/c/CodeZri");
}

/*
    Function to set up a system tray menu with options specific to the window mode.
    This function checks if the application is running in window mode, and if so,
    it defines the tray menu items and sets up the tray accordingly.
*/
function setTray() {
    // Tray menu is only available in window mode
    if(NL_MODE != "window") {
        console.log("INFO: Tray menu is only available in the window mode.");
        return;
    }

    // Define tray menu items
    let tray = {
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            {id: "VERSION", text: "Get version"},
            {id: "SEP", text: "-"},
            {id: "QUIT", text: "Quit"}
        ]
    };

    // Set the tray menu
    Neutralino.os.setTray(tray);
}

/*
    Function to handle click events on the tray menu items.
    This function performs different actions based on the clicked item's ID,
    such as displaying version information or exiting the application.
*/
function onTrayMenuItemClicked(event) {
    switch(event.detail.id) {
        case "VERSION":
            // Display version information
            Neutralino.os.showMessageBox("Version information",
                `Neutralinojs server: v${NL_VERSION} | Neutralinojs client: v${NL_CVERSION}`);
            break;
        case "QUIT":
            // Exit the application
            Neutralino.app.exit();
            break;
    }
}

/*
    Function to handle the window close event by gracefully exiting the Neutralino application.
*/
function onWindowClose() {
    Neutralino.app.exit();
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

// Conditional initialization: Set up system tray if not running on macOS
if(NL_OS != "Darwin") { // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
}

// Display app information
showInfo();

// Handle transcription updates
function updateTranscription(text) {
    const transcriptionElement = document.getElementById('transcription-text');
    if (transcriptionElement) {
        transcriptionElement.textContent = text;
        transcriptionElement.style.opacity = '1';
        
        // Auto-hide after 5 seconds of inactivity
        clearTimeout(window.transcriptionTimeout);
        window.transcriptionTimeout = setTimeout(() => {
            transcriptionElement.style.opacity = '0';
        }, 5000);
    }
}

// Debug function to test transcription display
function testTranscriptionDisplay() {
    console.log("Testing transcription display...");
    updateTranscription("");
}

// Set up polling to get transcriptions from our Express server
async function startTranscriptionPolling() {
    try {
        // Expose functions globally
        window.updateTranscription = updateTranscription;
        window.testTranscriptionDisplay = testTranscriptionDisplay;
        
        // Test after 2 seconds
        setTimeout(testTranscriptionDisplay, 2000);
        
        // Poll the transcription server every 500ms
        setInterval(async () => {
            try {
                const response = await fetch('http://localhost:3456/transcription');
                if (response.ok) {
                    const data = await response.json();
                    if (data.text && data.timestamp) {
                        const currentTimestamp = Date.now();
                        // Only show if the transcription is recent (within 5 seconds)
                        if ((currentTimestamp - data.timestamp) < 5000) {
                            updateTranscription(data.text);
                        }
                    }
                }
            } catch (err) {
                // Silently fail - server might not be running yet
            }
        }, 500);
        
        console.log("Transcription polling initialized");
        
    } catch (err) {
        console.error("Error initializing transcription polling:", err);
    }
}

// Initialize the transcription system
startTranscriptionPolling();
