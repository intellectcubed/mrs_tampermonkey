// ==UserScript==
// @name         PCR Toolbar
// @namespace    http://tampermonkey.net/
// @version      1.4.1
// @description  PCR Toolbar enhancement script - Automates populating call times
// @author       Your Name
// @match        https://newjersey.imagetrendelite.com/Elite/Organizationnewjersey/Agencymartinsvil/EmsRunForm
// @icon         https://www.google.com/s2/favicons?sz=64&domain=imagetrendelite.com
// @updateURL    https://raw.githubusercontent.com/intellectcubed/mrs_tampermonkey/main/src/pcr_toolbar/pcr_toolbar.user.js
// @downloadURL  https://raw.githubusercontent.com/intellectcubed/mrs_tampermonkey/main/src/pcr_toolbar/pcr_toolbar.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    // Set to true to show the Debug button on the toolbar
    const SHOW_DEBUG_BUTTON = false;

    // Field mapping configuration - Update field IDs here as needed
    const fieldMapping = {
        "incidentTimes": {
            "cad": "819240",
            "times": {
                "notifiedByDispatch": {
                    "date": "819243Date",
                    "time": "819243Time"
                },
                "enRoute": {
                    "date": "819245Date",
                    "time": "819245Time"
                },
                "onScene": {
                    "date": "819246Date",
                    "time": "819246Time"
                },
                "arrivedAtPatient": {
                    "date": "819247Date",
                    "time": "819247Time"
                },
                "leftScene": {
                    "date": "819248Date",
                    "time": "819248Time"
                },
                "ptArrivedAtDestination": {
                    "date": "819249Date",
                    "time": "819249Time"
                },
                "destinationPatientTransferOfCare": {
                    "date": "819250Date",
                    "time": "819250Time"
                },
                "backInService": {
                    "date": "819251Date",
                    "time": "819251Time"
                }
            }
        },
        "incidentLocation": {
            "location_name": "850922",
            "street_address": "819256",
            "apartment": "819258",
            "zip_code": "819259"
        }
    };

    // UI elements
    let timesBtn = null;
    let addressBtn = null;
    let incidentNumberSpan = null;
    let incidentsBtn = null;
    let incidentDisplayField = null;

    /**
     * Sleep/delay function
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Click a section by its name
     * @param {string} sectionName - The section name to click
     */
    function clickSection(sectionName) {
        const label = Array.from(document.querySelectorAll('.section .text-padding'))
            .find(el => el.textContent.trim() === sectionName);

        if (label) {
            label.closest('.section').click();
            console.log(`Clicked ${sectionName} section.`);
            return true;
        } else {
            console.log(`Section "${sectionName}" not found.`);
            return false;
        }
    }

    /**
     * Navigate to the Mileage/CAD/Times section
     */
    async function navigateToMileageSection() {
        console.log('Starting navigation to Mileage/CAD/Times section...');

        // Click Dispatch Info
        if (!clickSection("Dispatch Info")) {
            throw new Error('Failed to click "Dispatch Info" section');
        }

        // Wait 5 seconds
        await sleep(5000);

        // Click Mileage / CAD / Times
        if (!clickSection("Mileage / CAD / Times")) {
            throw new Error('Failed to click "Mileage / CAD / Times" section');
        }

        // Wait 5 seconds for section to load
        await sleep(5000);

        console.log('Navigation complete');
    }

    /**
     * Set value of a form field by ID
     * @param {string} fieldId - The ID of the field
     * @param {string} value - The value to set
     */
    function setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = value;
            // Trigger change event in case the page listens for it
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`Set field ${fieldId} = ${value}`);
            return true;
        } else {
            console.warn(`Field with ID "${fieldId}" not found`);
            return false;
        }
    }

    /**
     * Populate fields based on data and field mapping
     * @param {object} data - The call times data
     */
    function populateFields(data) {
        if (!fieldMapping) {
            throw new Error('Field mapping configuration not loaded');
        }

        if (!data.incidentTimes) {
            throw new Error('Invalid data format: missing incidentTimes');
        }

        let successCount = 0;
        let failCount = 0;

        // Populate CAD number
        if (data.incidentTimes.cad && fieldMapping.incidentTimes.cad) {
            if (setFieldValue(fieldMapping.incidentTimes.cad, data.incidentTimes.cad)) {
                successCount++;
            } else {
                failCount++;
            }
        }

        // Populate time fields
        if (data.incidentTimes.times && fieldMapping.incidentTimes.times) {
            const times = data.incidentTimes.times;
            const timeMappings = fieldMapping.incidentTimes.times;

            for (const [key, value] of Object.entries(times)) {
                if (timeMappings[key]) {
                    // Set date field
                    if (value.date && timeMappings[key].date) {
                        if (setFieldValue(timeMappings[key].date, value.date)) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                    }

                    // Set time field
                    if (value.time && timeMappings[key].time) {
                        if (setFieldValue(timeMappings[key].time, value.time)) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                    }
                }
            }
        }

        console.log(`Population complete: ${successCount} succeeded, ${failCount} failed`);
        return { successCount, failCount };
    }

    /**
     * Get incident data from unsafeWindow.EMSIncidentData (set by ems-incident-integration script)
     * @returns {object|null}
     */
    function getIncidentData() {
        try {
            // Read from unsafeWindow.EMSIncidentData which is set by ems-incident-integration.user.js
            if (unsafeWindow.EMSIncidentData) {
                return unsafeWindow.EMSIncidentData;
            }
            return null;
        } catch (error) {
            console.error('Error getting incident data:', error);
            return null;
        }
    }

    /**
     * Check if we're on the Mileage/CAD/Times page
     * @returns {boolean}
     */
    function isOnTimesPage() {
        const panelHeader = document.getElementById('panel-header');
        if (!panelHeader) {
            return false;
        }
        return panelHeader.textContent.trim() === 'Mileage / CAD / Times';
    }

    /**
     * Check if we're on the Incident Address page
     * @returns {boolean}
     */
    function isOnAddressPage() {
        const panelHeader = document.getElementById('panel-header');
        if (!panelHeader) {
            return false;
        }
        return panelHeader.textContent.trim() === 'Incident Address';
    }

    /**
     * Update button states based on current page and data availability
     */
    function updateButtonStates() {
        const incidentData = getIncidentData();
        const onTimesPage = isOnTimesPage();
        const onAddressPage = isOnAddressPage();

        // Check if data exists AND has the required fields
        const hasTimesData = incidentData !== null && incidentData.incidentTimes !== undefined;
        const hasAddressData = incidentData !== null && incidentData.incidentLocation !== undefined;

        // Update Times button - only active on Times page with valid times data
        if (timesBtn) {
            const shouldEnableTimes = onTimesPage && hasTimesData;
            timesBtn.disabled = !shouldEnableTimes;
            if (shouldEnableTimes) {
                timesBtn.style.opacity = '1';
                timesBtn.style.cursor = 'pointer';
            } else {
                timesBtn.style.opacity = '0.5';
                timesBtn.style.cursor = 'not-allowed';
            }
        }

        // Update Address button - only active on Address page with valid address data
        if (addressBtn) {
            const shouldEnableAddress = onAddressPage && hasAddressData;
            addressBtn.disabled = !shouldEnableAddress;
            if (shouldEnableAddress) {
                addressBtn.style.opacity = '1';
                addressBtn.style.cursor = 'pointer';
            } else {
                addressBtn.style.opacity = '0.5';
                addressBtn.style.cursor = 'not-allowed';
            }
        }

        // Update incident number display
        if (incidentNumberSpan) {
            if (incidentData && incidentData.incidentNumber) {
                incidentNumberSpan.textContent = incidentData.incidentNumber;
                incidentNumberSpan.style.display = 'inline-block';
            } else {
                incidentNumberSpan.textContent = '';
                incidentNumberSpan.style.display = 'none';
            }
        }
    }

    /**
     * Handle Times button click
     */
    async function handleTimesClick() {
        try {
            // Get incident data
            const incidentData = getIncidentData();
            if (!incidentData) {
                console.error('No incident data available');
                return;
            }

            // Populate fields
            console.log('Populating time fields...');
            const result = populateFields(incidentData);

            console.log(`Population complete: ${result.successCount} succeeded, ${result.failCount} failed`);

        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Handle Address button click
     */
    async function handleAddressClick() {
        try {
            // Get incident data
            const incidentData = getIncidentData();
            if (!incidentData) {
                console.error('No incident data available');
                return;
            }

            if (!incidentData.incidentLocation) {
                console.error('No incident location data available');
                return;
            }

            console.log('Populating address fields...');
            const location = incidentData.incidentLocation;
            const mapping = fieldMapping.incidentLocation;
            let successCount = 0;
            let failCount = 0;

            // Populate location_name if available
            if (location.location_name && mapping.location_name) {
                if (setFieldValue(mapping.location_name, location.location_name)) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            // Populate street_address if available
            if (location.street_address && mapping.street_address) {
                if (setFieldValue(mapping.street_address, location.street_address)) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            // Populate apartment if available
            if (location.apartment && mapping.apartment) {
                if (setFieldValue(mapping.apartment, location.apartment)) {
                    successCount++;
                } else {
                    failCount++;
                }
            }

            // Populate zip_code and trigger lookup button if available
            if (location.zip_code && mapping.zip_code) {
                if (setFieldValue(mapping.zip_code, location.zip_code)) {
                    successCount++;

                    // Wait a moment for the field to update, then click the lookup button
                    await sleep(500);

                    // Find and click the "Incident Address Postal Code Lookup" button
                    const lookupButton = Array.from(document.querySelectorAll('button'))
                        .find(btn => btn.textContent.trim() === 'Incident Address Postal Code Lookup');

                    if (lookupButton) {
                        lookupButton.click();
                        console.log('Clicked "Incident Address Postal Code Lookup" button');
                    } else {
                        console.warn('Could not find "Incident Address Postal Code Lookup" button');
                    }
                } else {
                    failCount++;
                }
            }

            console.log(`Address population complete: ${successCount} succeeded, ${failCount} failed`);

        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Handle Incidents button click
     */
    function handleIncidentsClick() {
        console.log('[PCR Toolbar] Dispatching openDrawer event...');
        const event = new CustomEvent('ems:openDrawer');
        window.dispatchEvent(event);
    }

    /**
     * Handle incident selection from drawer
     */
    function handleIncidentSelection(incidentObject) {
        if (incidentObject && incidentObject.incident_number) {
            // Copy to unsafeWindow for PCR toolbar to use
            unsafeWindow.EMSIncidentData = incidentObject;

            // Update display field
            if (incidentDisplayField) {
                incidentDisplayField.value = incidentObject.incident_number;
            }

            console.log('Incident selected:', incidentObject.incident_number);
        } else {
            console.log('No valid incident selected');
        }
    }

    /**
     * Handle Debug button click
     */
    function handleDebugClick() {
        console.log('=== PCR TOOLBAR DEBUG INFO ===');

        // Check incident data
        const incidentData = getIncidentData();
        console.log('Incident Data exists:', incidentData !== null);
        console.log('Incident Data:', incidentData);

        // Check panel header
        const panelHeader = document.getElementById('panel-header');
        console.log('panel-header element found:', panelHeader !== null);
        if (panelHeader) {
            console.log('panel-header textContent:', `"${panelHeader.textContent}"`);
            console.log('panel-header textContent (trimmed):', `"${panelHeader.textContent.trim()}"`);
            console.log('panel-header innerHTML:', panelHeader.innerHTML);
        } else {
            // Try to find it by other means
            console.log('Searching for elements that might be the header...');
            const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="header"], [class*="title"]');
            headers.forEach((header, index) => {
                const text = header.textContent.trim();
                if (text.includes('Mileage') || text.includes('CAD') || text.includes('Times')) {
                    console.log(`Possible header ${index}:`, {
                        element: header.tagName,
                        id: header.id,
                        className: header.className,
                        text: text
                    });
                }
            });
        }

        // Check page state
        const onTimesPage = isOnTimesPage();
        console.log('isOnTimesPage():', onTimesPage);

        // Check button states
        console.log('Times button disabled:', timesBtn ? timesBtn.disabled : 'button not found');
        console.log('Address button disabled:', addressBtn ? addressBtn.disabled : 'button not found');

        // Check unsafeWindow.EMSIncidentData (shared across scripts)
        console.log('unsafeWindow.EMSIncidentData exists:', unsafeWindow.EMSIncidentData !== undefined);
        console.log('unsafeWindow.EMSIncidentData:', unsafeWindow.EMSIncidentData);

        // Check GM storage raw value (for comparison - won't work across scripts)
        const rawValue = GM_getValue("incident_json");
        console.log('Raw GM_getValue("incident_json") [isolated to this script]:', rawValue);

        console.log('=== END DEBUG INFO ===');
    }


    /**
     * Create the toolbar UI
     */
    function createToolbar() {
        // Find the top-pane div
        const topPane = document.getElementById('top-pane');
        if (!topPane) {
            console.error('Could not find #top-pane element. Toolbar not created.');
            return false;
        }

        // Check if toolbar already exists to avoid duplicates
        if (document.getElementById('pcr-toolbar')) {
            console.log('PCR Toolbar already exists, skipping creation.');
            return true;
        }

        // Create a container for our injected buttons with distinctive styling
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'pcr-toolbar';
        buttonContainer.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-left: 10px;
            padding: 4px 8px;
            border: 2px solid #0066cc;
            border-radius: 4px;
            background-color: rgba(0, 102, 204, 0.1);
        `;

        // Create Incidents button (leftmost)
        incidentsBtn = document.createElement('button');
        incidentsBtn.textContent = 'Incidents';
        incidentsBtn.style.cssText = `
            padding: 4px 10px;
            font-size: 12px;
            cursor: pointer;
            opacity: 1;
            border: 1px solid #0066cc;
            background-color: #0066cc;
            color: white;
            border-radius: 3px;
        `;
        incidentsBtn.addEventListener('click', handleIncidentsClick);
        buttonContainer.appendChild(incidentsBtn);

        // Create incident number display (old display, hidden now)
        incidentNumberSpan = document.createElement('span');
        incidentNumberSpan.style.cssText = `
            color: #0066cc;
            font-size: 13px;
            font-weight: bold;
            display: none;
            margin-right: 4px;
        `;
        buttonContainer.appendChild(incidentNumberSpan);

        // Create Times button (initially disabled)
        timesBtn = document.createElement('button');
        timesBtn.textContent = 'Times';
        timesBtn.disabled = true;
        timesBtn.style.cssText = `
            padding: 4px 10px;
            font-size: 12px;
            cursor: not-allowed;
            opacity: 0.5;
            border: 1px solid #0066cc;
            background-color: #0066cc;
            color: white;
            border-radius: 3px;
        `;
        timesBtn.addEventListener('click', handleTimesClick);
        buttonContainer.appendChild(timesBtn);

        // Create Address button (initially disabled)
        addressBtn = document.createElement('button');
        addressBtn.textContent = 'Address';
        addressBtn.disabled = true;
        addressBtn.style.cssText = `
            padding: 4px 10px;
            font-size: 12px;
            cursor: not-allowed;
            opacity: 0.5;
            border: 1px solid #0066cc;
            background-color: #0066cc;
            color: white;
            border-radius: 3px;
        `;
        addressBtn.addEventListener('click', handleAddressClick);
        buttonContainer.appendChild(addressBtn);

        // Create Debug button (only if enabled in configuration)
        if (SHOW_DEBUG_BUTTON) {
            const debugBtn = document.createElement('button');
            debugBtn.textContent = 'Debug';
            debugBtn.style.cssText = `
                padding: 4px 10px;
                font-size: 12px;
                cursor: pointer;
                opacity: 1;
                border: 1px solid #0066cc;
                background-color: #0066cc;
                color: white;
                border-radius: 3px;
            `;
            debugBtn.addEventListener('click', handleDebugClick);
            buttonContainer.appendChild(debugBtn);
        }

        // Create incident display field (rightmost)
        incidentDisplayField = document.createElement('input');
        incidentDisplayField.type = 'text';
        incidentDisplayField.readOnly = true;
        incidentDisplayField.value = 'No Incident';
        incidentDisplayField.style.cssText = `
            padding: 4px 10px;
            font-size: 12px;
            border: 1px solid #0066cc;
            background-color: #f0f0f0;
            color: #333;
            border-radius: 3px;
            min-width: 120px;
            text-align: center;
        `;
        buttonContainer.appendChild(incidentDisplayField);

        // Append button container to top-pane
        topPane.appendChild(buttonContainer);

        console.log('PCR Toolbar created successfully and integrated into top-pane');

        // Set up periodic checks for button state updates
        setInterval(updateButtonStates, 1000);

        // Initial button state update
        updateButtonStates();

        return true;
    }

    /**
     * Wait for the top-pane element to exist, then create the toolbar
     */
    function waitForTopPane() {
        const topPane = document.getElementById('top-pane');
        if (topPane) {
            console.log('Found #top-pane element, creating toolbar...');
            createToolbar();
        } else {
            console.log('Waiting for #top-pane element...');
            setTimeout(waitForTopPane, 500);
        }
    }

    /**
     * Initialize the script
     */
    function init() {
        console.log('PCR Toolbar script initializing...');
        console.log('Field mapping configuration loaded:', fieldMapping);

        // Clear global incident data from memory
        unsafeWindow.EMSIncidentData = null;

        // Clear any stored incident data from persistent storage
        const oldValue = GM_getValue("incident_json");
        if (oldValue !== undefined) {
            console.log('pcr_toolbar:: Found old incident data, deleting...', oldValue);
            GM_deleteValue("incident_json");
            // Verify deletion
            const checkValue = GM_getValue("incident_json");
            console.log('pcr_toolbar:: After deletion, value is:', checkValue);
        } else {
            console.log('pcr_toolbar:: No old incident data to delete');
        }

        // Listen for incident selection events from drawer
        console.log('[PCR Toolbar] Setting up event listener for ems:incidentSelected');
        window.addEventListener('ems:incidentSelected', function(e) {
            console.log('[PCR Toolbar] *** EVENT RECEIVED ***');
            console.log('[PCR Toolbar] Event detail:', e.detail);
            console.log('[PCR Toolbar] Full event:', e);
            if (e.detail && e.detail.incident) {
                console.log('[PCR Toolbar] Calling handleIncidentSelection with:', e.detail.incident);
                handleIncidentSelection(e.detail.incident);
            } else {
                console.log('[PCR Toolbar] Event detail or incident is missing');
            }
        });
        console.log('[PCR Toolbar] Event listener registered successfully');

        // Wait for page to be ready, then wait for top-pane element
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForTopPane);
        } else {
            waitForTopPane();
        }
    }

    // Start the script
    init();

})();
