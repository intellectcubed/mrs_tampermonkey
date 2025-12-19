// ==UserScript==
// @name         EMS Incident Manager
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  EMS Incident drawer with Supabase integration
// @author       You
// @match        https://example.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @require      https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
// @updateURL    https://raw.githubusercontent.com/intellectcubed/mrs_tampermonkey/main/src/incident_drawer/ems-incident-drawer.user.js
// @downloadURL  https://raw.githubusercontent.com/intellectcubed/mrs_tampermonkey/main/src/incident_drawer/ems-incident-drawer.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const SUPABASE_URL = 'https://wcvwtpgbghgypdyfxjha.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjdnd0cGdiZ2hneXBkeWZ4amhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDE0MTAsImV4cCI6MjA4MDgxNzQxMH0.Jz0xC8oROHDMKxLJMHQcwoLajdoKq_BrYdd-8vhqSaU';

    // ==================== STATE MANAGEMENT ====================
    let supabase;
    let currentView = 'login';
    let currentIncident = null;
    let incidents = [];
    let currentPage = 0;
    let searchFilters = {
        incidentNumber: '',
        date: ''
    };
    const PAGE_SIZE = 20;

    // ==================== SUPABASE INITIALIZATION ====================
    function initSupabase() {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // ==================== AUTHENTICATION ====================
    async function checkSession() {
        const sessionData = GM_getValue('ems:session');
        if (!sessionData) return false;

        try {
            const { data, error } = await supabase.auth.setSession(sessionData);
            if (error) {
                GM_deleteValue('ems:session');
                return false;
            }
            return true;
        } catch (e) {
            GM_deleteValue('ems:session');
            return false;
        }
    }

    async function login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                alert('Login failed: ' + error.message);
                return false;
            }

            GM_setValue('ems:session', data.session);
            return true;
        } catch (e) {
            alert('Login error: ' + e.message);
            return false;
        }
    }

    // ==================== DATA FETCHING ====================
    async function fetchIncidents(page = 0, filters = {}) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
            .from('incidents')
            .select('*', { count: 'exact' })
            .order('datetime', { ascending: false })
            .range(from, to);

        // Apply filters
        if (filters.incidentNumber) {
            query = query.ilike('incident_number', `%${filters.incidentNumber}%`);
        }

        if (filters.date) {
            const startDate = new Date(filters.date);
            const endDate = new Date(filters.date);
            endDate.setDate(endDate.getDate() + 1);
            query = query.gte('datetime', startDate.toISOString())
                        .lt('datetime', endDate.toISOString());
        } else {
            // Default: last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            query = query.gte('datetime', sevenDaysAgo.toISOString());
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching incidents:', error);
            return { data: [], count: 0 };
        }

        return { data, count };
    }

    async function fetchIncidentDetails(incidentId) {
        const { data: incident, error: incidentError } = await supabase
            .from('incidents')
            .select('*')
            .eq('id', incidentId)
            .single();

        if (incidentError) {
            console.error('Error fetching incident:', incidentError);
            return null;
        }

        const { data: statuses, error: statusError } = await supabase
            .from('incident_statuses')
            .select('*')
            .eq('incident_id', incidentId)
            .order('datetime', { ascending: false })
            .limit(20);

        if (statusError) {
            console.error('Error fetching statuses:', statusError);
            incident.statuses = [];
        } else {
            incident.statuses = statuses || [];
        }

        return incident;
    }

    // ==================== UI RENDERING ====================
    function renderLoginView() {
        return `
            <div class="ems-login-container">
                <div class="ems-login-card">
                    <h2>EMS Incident Manager</h2>
                    <p>Please log in to continue</p>
                    <form id="ems-login-form">
                        <div class="ems-form-group">
                            <label for="ems-email">Email</label>
                            <input type="email" id="ems-email" required autocomplete="username">
                        </div>
                        <div class="ems-form-group">
                            <label for="ems-password">Password</label>
                            <input type="password" id="ems-password" required autocomplete="current-password">
                        </div>
                        <button type="submit" class="ems-btn ems-btn-primary">Login</button>
                    </form>
                </div>
            </div>
        `;
    }

    function renderIncidentListView() {
        return `
            <div class="ems-list-container">
                <h2>EMS Incidents – Last 7 Days</h2>

                <div class="ems-search-area">
                    <div class="ems-form-group">
                        <label for="ems-search-number">Incident Number</label>
                        <input type="text" id="ems-search-number" value="${searchFilters.incidentNumber}">
                    </div>
                    <div class="ems-form-group">
                        <label for="ems-search-date">Date</label>
                        <input type="date" id="ems-search-date" value="${searchFilters.date}">
                    </div>
                    <button id="ems-search-btn" class="ems-btn ems-btn-secondary">Search</button>
                </div>

                <div class="ems-table-container">
                    <table class="ems-table">
                        <thead>
                            <tr>
                                <th>Incident Number</th>
                                <th>Unit ID</th>
                                <th>Date/Time</th>
                                <th>Address</th>
                                <th>Incident Type</th>
                            </tr>
                        </thead>
                        <tbody id="ems-incidents-tbody">
                            <tr><td colspan="5" class="ems-loading">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="ems-pagination">
                    <button id="ems-prev-btn" class="ems-btn ems-btn-secondary" ${currentPage === 0 ? 'disabled' : ''}>Previous</button>
                    <span class="ems-page-info">Page ${currentPage + 1}</span>
                    <button id="ems-next-btn" class="ems-btn ems-btn-secondary">Next</button>
                </div>
            </div>
        `;
    }

    function renderIncidentRows(incidents) {
        if (incidents.length === 0) {
            return '<tr><td colspan="5" class="ems-empty">No incidents found</td></tr>';
        }

        return incidents.map(incident => `
            <tr class="ems-incident-row" data-incident-id="${incident.id}">
                <td>${incident.incident_number || 'N/A'}</td>
                <td>${incident.unit_id || 'N/A'}</td>
                <td>${formatDateTime(incident.datetime)}</td>
                <td>${incident.address || 'N/A'}</td>
                <td>${incident.incident_type || 'N/A'}</td>
            </tr>
        `).join('');
    }

    function renderIncidentDetailsView(incident) {
        return `
            <div class="ems-details-container">
                <a href="#" id="ems-back-link" class="ems-back-link">← Back to incidents</a>
                <h2>Incident Details – ${incident.incident_number || 'N/A'}</h2>

                <div class="ems-panel">
                    <h3>Incident Information</h3>
                    <div class="ems-detail-grid">
                        <div class="ems-detail-item">
                            <label>Incident Number:</label>
                            <span>${incident.incident_number || 'N/A'}</span>
                        </div>
                        <div class="ems-detail-item">
                            <label>Unit ID:</label>
                            <span>${incident.unit_id || 'N/A'}</span>
                        </div>
                        <div class="ems-detail-item">
                            <label>Date/Time:</label>
                            <span>${formatDateTime(incident.datetime)}</span>
                        </div>
                        <div class="ems-detail-item">
                            <label>Incident Type:</label>
                            <span>${incident.incident_type || 'N/A'}</span>
                        </div>
                        <div class="ems-detail-item ems-full-width">
                            <label>Address:</label>
                            <span>${incident.address || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="ems-panel">
                    <h3>Status History</h3>
                    <table class="ems-table">
                        <thead>
                            <tr>
                                <th>Date/Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderStatusRows(incident.statuses)}
                        </tbody>
                    </table>
                </div>

                <button id="ems-select-btn" class="ems-btn ems-btn-primary ems-btn-large">Select</button>
            </div>
        `;
    }

    function renderStatusRows(statuses) {
        if (!statuses || statuses.length === 0) {
            return '<tr><td colspan="2" class="ems-empty">No status history available</td></tr>';
        }

        return statuses.map(status => `
            <tr>
                <td>${formatDateTime(status.datetime)}</td>
                <td>${status.status || 'N/A'}</td>
            </tr>
        `).join('');
    }

    // ==================== UTILITIES ====================
    function formatDateTime(datetime) {
        if (!datetime) return 'N/A';
        const date = new Date(datetime);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    // ==================== VIEW MANAGEMENT ====================
    async function navigateTo(view, data = null) {
        currentView = view;
        const content = document.getElementById('ems-drawer-content');

        switch(view) {
            case 'login':
                content.innerHTML = renderLoginView();
                attachLoginHandlers();
                break;
            case 'list':
                content.innerHTML = renderIncidentListView();
                attachListHandlers();
                await loadIncidents();
                break;
            case 'details':
                if (data && data.incidentId) {
                    const incident = await fetchIncidentDetails(data.incidentId);
                    if (incident) {
                        currentIncident = incident;
                        content.innerHTML = renderIncidentDetailsView(incident);
                        attachDetailsHandlers();
                    }
                }
                break;
        }
    }

    async function loadIncidents() {
        const tbody = document.getElementById('ems-incidents-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="ems-loading">Loading...</td></tr>';

        const { data, count } = await fetchIncidents(currentPage, searchFilters);
        incidents = data;

        tbody.innerHTML = renderIncidentRows(incidents);
        attachIncidentRowHandlers();

        // Update pagination buttons
        const prevBtn = document.getElementById('ems-prev-btn');
        const nextBtn = document.getElementById('ems-next-btn');

        if (prevBtn) prevBtn.disabled = currentPage === 0;
        if (nextBtn) nextBtn.disabled = data.length < PAGE_SIZE;
    }

    // ==================== EVENT HANDLERS ====================
    function attachLoginHandlers() {
        const form = document.getElementById('ems-login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('ems-email').value;
            const password = document.getElementById('ems-password').value;

            const success = await login(email, password);
            if (success) {
                navigateTo('list');
            }
        });
    }

    function attachListHandlers() {
        const searchBtn = document.getElementById('ems-search-btn');
        const prevBtn = document.getElementById('ems-prev-btn');
        const nextBtn = document.getElementById('ems-next-btn');

        searchBtn.addEventListener('click', () => {
            searchFilters.incidentNumber = document.getElementById('ems-search-number').value;
            searchFilters.date = document.getElementById('ems-search-date').value;
            currentPage = 0;
            loadIncidents();
        });

        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                loadIncidents();
            }
        });

        nextBtn.addEventListener('click', () => {
            currentPage++;
            loadIncidents();
        });
    }

    function attachIncidentRowHandlers() {
        const rows = document.querySelectorAll('.ems-incident-row');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const incidentId = row.getAttribute('data-incident-id');
                navigateTo('details', { incidentId });
            });
        });
    }

    function attachDetailsHandlers() {
        const backLink = document.getElementById('ems-back-link');
        const selectBtn = document.getElementById('ems-select-btn');

        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo('list');
        });

        selectBtn.addEventListener('click', () => {
            GM_setValue('ems:selectedIncident', currentIncident);
            alert('Incident selected and saved!');
        });
    }

    // ==================== DRAWER TOGGLE ====================
    function toggleDrawer() {
        const drawer = document.getElementById('ems-drawer');
        drawer.classList.toggle('ems-drawer-open');
    }

    // ==================== STYLES ====================
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Floating Button */
            #ems-floating-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                padding: 12px 24px;
                background: #0066cc;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                transition: background 0.2s;
            }

            #ems-floating-btn:hover {
                background: #0052a3;
            }

            /* Drawer */
            #ems-drawer {
                position: fixed;
                top: 0;
                right: -25%;
                width: 25%;
                min-width: 400px;
                height: 100vh;
                background: #ffffff;
                box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                z-index: 9999;
                transition: right 0.3s ease;
                overflow-y: auto;
            }

            #ems-drawer.ems-drawer-open {
                right: 0;
            }

            #ems-drawer-content {
                padding: 20px;
            }

            /* Login View */
            .ems-login-container {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
            }

            .ems-login-card {
                background: #f8f9fa;
                padding: 32px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                max-width: 320px;
                width: 100%;
            }

            .ems-login-card h2 {
                margin: 0 0 8px 0;
                font-size: 20px;
                color: #1a1a1a;
            }

            .ems-login-card p {
                margin: 0 0 24px 0;
                color: #666;
                font-size: 14px;
            }

            /* Form Elements */
            .ems-form-group {
                margin-bottom: 16px;
            }

            .ems-form-group label {
                display: block;
                margin-bottom: 6px;
                font-size: 13px;
                font-weight: 600;
                color: #333;
            }

            .ems-form-group input {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            }

            .ems-form-group input:focus {
                outline: none;
                border-color: #0066cc;
            }

            /* Buttons */
            .ems-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.2s;
            }

            .ems-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .ems-btn-primary {
                background: #0066cc;
                color: white;
                width: 100%;
            }

            .ems-btn-primary:hover:not(:disabled) {
                background: #0052a3;
            }

            .ems-btn-secondary {
                background: #f0f0f0;
                color: #333;
            }

            .ems-btn-secondary:hover:not(:disabled) {
                background: #e0e0e0;
            }

            .ems-btn-large {
                padding: 14px 28px;
                font-size: 16px;
                width: 100%;
                margin-top: 20px;
            }

            /* List View */
            .ems-list-container h2 {
                margin: 0 0 20px 0;
                font-size: 20px;
                color: #1a1a1a;
            }

            .ems-search-area {
                display: grid;
                grid-template-columns: 1fr 1fr auto;
                gap: 12px;
                margin-bottom: 20px;
                padding: 16px;
                background: #f8f9fa;
                border-radius: 6px;
            }

            .ems-search-area .ems-form-group {
                margin-bottom: 0;
            }

            .ems-search-area .ems-btn {
                margin-top: 26px;
            }

            /* Table */
            .ems-table-container {
                max-height: calc(100vh - 350px);
                overflow-y: auto;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                margin-bottom: 16px;
            }

            .ems-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }

            .ems-table thead {
                background: #f8f9fa;
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .ems-table th {
                padding: 12px 8px;
                text-align: left;
                font-weight: 600;
                color: #333;
                border-bottom: 2px solid #e0e0e0;
            }

            .ems-table td {
                padding: 10px 8px;
                border-bottom: 1px solid #f0f0f0;
                color: #555;
            }

            .ems-incident-row {
                cursor: pointer;
                transition: background 0.1s;
            }

            .ems-incident-row:hover {
                background: #f8f9fa;
            }

            .ems-loading, .ems-empty {
                text-align: center;
                padding: 40px !important;
                color: #999;
            }

            /* Pagination */
            .ems-pagination {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
            }

            .ems-page-info {
                font-size: 14px;
                color: #666;
            }

            /* Details View */
            .ems-details-container h2 {
                margin: 0 0 20px 0;
                font-size: 20px;
                color: #1a1a1a;
            }

            .ems-back-link {
                display: inline-block;
                margin-bottom: 16px;
                color: #0066cc;
                text-decoration: none;
                font-size: 14px;
                font-weight: 600;
            }

            .ems-back-link:hover {
                text-decoration: underline;
            }

            .ems-panel {
                background: #f8f9fa;
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 20px;
            }

            .ems-panel h3 {
                margin: 0 0 16px 0;
                font-size: 16px;
                color: #1a1a1a;
            }

            .ems-detail-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }

            .ems-detail-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .ems-detail-item.ems-full-width {
                grid-column: 1 / -1;
            }

            .ems-detail-item label {
                font-size: 12px;
                font-weight: 600;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .ems-detail-item span {
                font-size: 14px;
                color: #1a1a1a;
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== INITIALIZATION ====================
    async function init() {
        // Initialize Supabase
        initSupabase();

        // Inject styles
        injectStyles();

        // Create floating button
        const floatingBtn = document.createElement('button');
        floatingBtn.id = 'ems-floating-btn';
        floatingBtn.textContent = 'EMS Incidents';
        floatingBtn.addEventListener('click', toggleDrawer);
        document.body.appendChild(floatingBtn);

        // Create drawer
        const drawer = document.createElement('div');
        drawer.id = 'ems-drawer';
        drawer.innerHTML = '<div id="ems-drawer-content"></div>';
        document.body.appendChild(drawer);

        // Check session and navigate to appropriate view
        const hasSession = await checkSession();
        if (hasSession) {
            navigateTo('list');
        } else {
            navigateTo('login');
        }
    }

    // Start the application
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
