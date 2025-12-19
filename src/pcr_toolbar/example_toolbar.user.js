// ==UserScript==
// @name         Example Toolbar - EMS Incident IPC Demo
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Example script demonstrating IPC with EMS Incident Drawer
// @author       You
// @match        https://example.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function() {
    'use strict';

    let incidentDisplayArea = null;

    /**
     * Create the example toolbar UI
     */
    function createToolbar() {
        // Create a toolbar container
        const toolbar = document.createElement('div');
        toolbar.id = 'example-toolbar';
        toolbar.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            padding: 16px;
            background: #ffffff;
            border: 2px solid #0066cc;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            max-width: 600px;
        `;

        // Create title
        const title = document.createElement('h3');
        title.textContent = 'EMS Incident IPC Demo';
        title.style.cssText = `
            margin: 0 0 12px 0;
            font-size: 16px;
            color: #0066cc;
        `;
        toolbar.appendChild(title);

        // Create "EMS Incidents" button
        const incidentsBtn = document.createElement('button');
        incidentsBtn.textContent = 'EMS Incidents';
        incidentsBtn.style.cssText = `
            padding: 8px 16px;
            font-size: 14px;
            background: #0066cc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 12px;
        `;
        incidentsBtn.addEventListener('click', handleIncidentsClick);
        incidentsBtn.addEventListener('mouseenter', () => {
            incidentsBtn.style.background = '#0052a3';
        });
        incidentsBtn.addEventListener('mouseleave', () => {
            incidentsBtn.style.background = '#0066cc';
        });
        toolbar.appendChild(incidentsBtn);

        // Create display area for incident JSON
        incidentDisplayArea = document.createElement('pre');
        incidentDisplayArea.style.cssText = `
            background: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            border: 1px solid #ddd;
            max-height: 400px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        incidentDisplayArea.textContent = 'No incident selected yet.\n\nClick "EMS Incidents" to open the drawer and select an incident.';
        toolbar.appendChild(incidentDisplayArea);

        // Append toolbar to body
        document.body.appendChild(toolbar);

        console.log('Example toolbar created');
    }

    /**
     * Handle "EMS Incidents" button click
     * Opens the drawer using IPC
     */
    function handleIncidentsClick() {
        console.log('Opening drawer via IPC...');
        GM_setValue('ems:drawer:open', true);
    }

    /**
     * Handle incident selection from drawer
     * Displays the received incident as formatted JSON
     */
    function handleIncidentSelection(incidentObject) {
        console.log('Incident received from drawer:', incidentObject);

        if (incidentDisplayArea) {
            if (incidentObject) {
                // Format the JSON with indentation
                const formattedJson = JSON.stringify(incidentObject, null, 2);
                incidentDisplayArea.textContent = formattedJson;
            } else {
                incidentDisplayArea.textContent = 'Incident was cleared or set to null.';
            }
        }
    }

    /**
     * Initialize the script
     */
    function init() {
        console.log('Example Toolbar initializing...');

        // Clear any previously selected incident
        GM_setValue('ems:selectedIncident', null);

        // Set up listener for incident selection
        GM_addValueChangeListener('ems:selectedIncident', function(name, oldValue, newValue, remote) {
            console.log('ems:selectedIncident changed:', newValue);
            handleIncidentSelection(newValue);
        });

        // Create toolbar when page is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createToolbar);
        } else {
            createToolbar();
        }
    }

    // Start the script
    init();

})();
