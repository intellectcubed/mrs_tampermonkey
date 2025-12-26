// ==UserScript==
// @name         EMS Incident Drawer
// @namespace    http://tampermonkey.net/
// @version      1.4.3
// @description  EMS Incident drawer with Supabase integration
// @author       You
// @match        https://example.com/*
// @match        https://newjersey.imagetrendelite.com/Elite/Organizationnewjersey/Agencymartinsvil/EmsRunForm*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      wcvwtpgbghgypdyfxjha.supabase.co
// @updateURL    https://raw.githubusercontent.com/intellectcubed/mrs_tampermonkey/main/src/incident_drawer/ems-incident-drawer.user.js
// @downloadURL  https://raw.githubusercontent.com/intellectcubed/mrs_tampermonkey/main/src/incident_drawer/ems-incident-drawer.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const SUPABASE_URL = 'https://wcvwtpgbghgypdyfxjha.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjdnd0cGdiZ2hneXBkeWZ4amhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNDE0MTAsImV4cCI6MjA4MDgxNzQxMH0.Jz0xC8oROHDMKxLJMHQcwoLajdoKq_BrYdd-8vhqSaU';

    // ==================== STATE MANAGEMENT ====================
    let supabaseClient;
    let currentView = 'login';
    let currentIncident = null;
    let incidents = [];
    let currentPage = 0;
    let searchFilters = {
        incidentNumber: '',
        date: ''
    };
    let totalCount = 0;
    const PAGE_SIZE = 7;

    // ==================== SUPABASE REST CLIENT ====================
    // Simple REST client implementation to avoid library loading issues
    class SupabaseClient {
        constructor(url, anonKey) {
            this.url = url;
            this.anonKey = anonKey;
            this.authToken = null;
        }

        async request(endpoint, options = {}) {
            const headers = {
                'apikey': this.anonKey,
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: `${this.url}${endpoint}`,
                    headers: headers,
                    data: options.body ? JSON.stringify(options.body) : undefined,
                    onload: (response) => {
                        try {
                            // Check for JWT expiration (401 Unauthorized)
                            if (response.status === 401) {
                                console.log('JWT expired, logging out...');
                                GM_deleteValue('ems:session');
                                this.authToken = null;
                                // Navigate to login if we're not already there
                                if (currentView !== 'login') {
                                    navigateTo('login');
                                }
                                resolve({ data: null, error: { message: 'Session expired' }, responseHeaders: response.responseHeaders });
                                return;
                            }

                            const data = JSON.parse(response.responseText);
                            if (response.status >= 400) {
                                resolve({ data: null, error: data, responseHeaders: response.responseHeaders });
                            } else {
                                resolve({ data, error: null, responseHeaders: response.responseHeaders });
                            }
                        } catch (e) {
                            reject(e);
                        }
                    },
                    onerror: (error) => reject(error)
                });
            });
        }

        auth = {
            signInWithPassword: async ({ email, password }) => {
                const result = await this.request('/auth/v1/token?grant_type=password', {
                    method: 'POST',
                    body: { email, password }
                });

                if (result.data && result.data.access_token) {
                    this.authToken = result.data.access_token;
                    return {
                        data: {
                            session: {
                                access_token: result.data.access_token,
                                refresh_token: result.data.refresh_token,
                                user: result.data.user
                            }
                        },
                        error: null
                    };
                }

                return result;
            },

            setSession: async (session) => {
                if (session && session.access_token) {
                    this.authToken = session.access_token;
                    return { data: { session }, error: null };
                }
                return { data: null, error: new Error('Invalid session') };
            }
        };

        from(table) {
            return new SupabaseQueryBuilder(this, table);
        }
    }

    class SupabaseQueryBuilder {
        constructor(client, table) {
            this.client = client;
            this.table = table;
            this.queryParams = new URLSearchParams();
            this.headers = {};
            this.method = 'GET';
            this.body = null;
        }

        select(columns = '*', options = {}) {
            this.queryParams.set('select', columns);
            if (options.count) {
                this.headers['Prefer'] = 'count=exact';
            }
            return this;
        }

        eq(column, value) {
            this.queryParams.set(column, `eq.${value}`);
            return this;
        }

        ilike(column, pattern) {
            this.queryParams.set(column, `ilike.${pattern}`);
            return this;
        }

        gte(column, value) {
            this.queryParams.set(column, `gte.${value}`);
            return this;
        }

        lt(column, value) {
            this.queryParams.set(column, `lt.${value}`);
            return this;
        }

        order(column, options = {}) {
            const direction = options.ascending ? 'asc' : 'desc';
            this.queryParams.set('order', `${column}.${direction}`);
            return this;
        }

        range(from, to) {
            this.headers['Range'] = `${from}-${to}`;
            this.headers['Range-Unit'] = 'items';
            return this;
        }

        limit(count) {
            this.queryParams.set('limit', count);
            return this;
        }

        async single() {
            this.headers['Accept'] = 'application/vnd.pgrst.object+json';
            const result = await this.execute();
            return result;
        }

        async execute() {
            const endpoint = `/rest/v1/${this.table}?${this.queryParams.toString()}`;
            const result = await this.client.request(endpoint, {
                method: this.method,
                headers: this.headers,
                body: this.body
            });

            // Extract count from Content-Range header if requested
            let count = null;
            if (result.responseHeaders) {
                // Content-Range header format: "0-6/62" or "0-6/*"
                const contentRange = result.responseHeaders.match(/content-range:\s*(\d+)-(\d+)\/(\d+|\*)/i);
                if (contentRange && contentRange[3] !== '*') {
                    count = parseInt(contentRange[3]);
                    console.log('Extracted count from Content-Range:', count);
                }
            }
            return { ...result, count };
        }

        then(resolve, reject) {
            return this.execute().then(resolve, reject);
        }
    }

    function initSupabase() {
        supabaseClient = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase REST client initialized');
    }

    // ==================== AUTHENTICATION ====================
    async function checkSession() {
        const sessionData = GM_getValue('ems:session');
        if (!sessionData) return false;

        try {
            const { data, error } = await supabaseClient.auth.setSession(sessionData);
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
            const { data, error } = await supabaseClient.auth.signInWithPassword({
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

        let query = supabaseClient
            .from('rip_and_runs')
            .select('*', { count: 'exact' })
            .order('incident_date', { ascending: false })
            .range(from, to);

        // Apply filters
        if (filters.incidentNumber) {
            // incident_number is bigint, use exact match
            const incidentNum = parseInt(filters.incidentNumber);
            if (!isNaN(incidentNum)) {
                query = query.eq('incident_number', incidentNum);
            }
        }

        if (filters.date) {
            const startDate = new Date(filters.date);
            const endDate = new Date(filters.date);
            endDate.setDate(endDate.getDate() + 1);
            query = query.gte('incident_date', startDate.toISOString())
                        .lt('incident_date', endDate.toISOString());
        }
        // No default date filter - show all incidents

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching incidents:', error);
            return { data: [], count: 0 };
        }

        return { data, count };
    }

    async function fetchIncidentDetails(incidentNumber, unitId) {
        const { data: incident, error: incidentError } = await supabaseClient
            .from('rip_and_runs')
            .select('*')
            .eq('incident_number', incidentNumber)
            .eq('unit_id', unitId)
            .single();

        if (incidentError) {
            console.error('Error fetching incident:', incidentError);
            return null;
        }

        // No separate statuses table, just return the incident
        incident.statuses = [];

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
                <h2>EMS Incidents</h2>

                <div class="ems-search-area">
                    <div class="ems-form-group">
                        <label for="ems-search-number">Incident Number</label>
                        <input type="text" id="ems-search-number" value="${searchFilters.incidentNumber}" placeholder="Search by incident number">
                    </div>
                    <div class="ems-form-group">
                        <label for="ems-search-date">Date</label>
                        <input type="date" id="ems-search-date" value="${searchFilters.date}">
                    </div>
                    <div class="ems-search-buttons">
                        <button id="ems-search-btn" class="ems-btn ems-btn-secondary">Search</button>
                        <button id="ems-clear-btn" class="ems-btn ems-btn-secondary">Clear</button>
                    </div>
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
                    <span id="ems-page-info" class="ems-page-info">Loading...</span>
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
            <tr class="ems-incident-row" data-incident-number="${incident.incident_number}" data-unit-id="${incident.unit_id}">
                <td>${incident.incident_number || 'N/A'}</td>
                <td>${incident.unit_id || 'N/A'}</td>
                <td>${formatDateTime(incident.incident_date)}</td>
                <td>${incident.location || 'N/A'}</td>
                <td>${incident.incident_type || 'N/A'}</td>
            </tr>
        `).join('');
    }

    function parseIncidentTimeline(content) {
        try {
            const data = JSON.parse(content);
            const times = data.incidentTimes?.times || {};

            // Convert times object to array of {status, datetime}
            const timeline = [];
            for (const [key, value] of Object.entries(times)) {
                if (value.date && value.time) {
                    // Combine date and time into a single datetime string
                    const datetimeStr = `${value.date} ${value.time}`;
                    const datetime = new Date(datetimeStr);

                    // Convert camelCase key to readable status
                    const status = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())
                        .trim();

                    timeline.push({
                        status: status,
                        datetime: datetime,
                        datetimeStr: datetimeStr
                    });
                }
            }

            // Sort by datetime
            timeline.sort((a, b) => a.datetime - b.datetime);

            return timeline;
        } catch (e) {
            console.error('Error parsing incident timeline:', e);
            return [];
        }
    }

    function formatTimelineDateTime(datetime) {
        if (!datetime || isNaN(datetime.getTime())) return 'N/A';

        const month = String(datetime.getMonth() + 1).padStart(2, '0');
        const day = String(datetime.getDate()).padStart(2, '0');
        const year = datetime.getFullYear();
        const hours = String(datetime.getHours()).padStart(2, '0');
        const minutes = String(datetime.getMinutes()).padStart(2, '0');
        const seconds = String(datetime.getSeconds()).padStart(2, '0');

        return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
    }

    function renderTimelineRows(timeline) {
        if (timeline.length === 0) {
            return '<tr><td colspan="2" class="ems-empty">No timeline data available</td></tr>';
        }

        return timeline.map(item => `
            <tr>
                <td>${item.status}</td>
                <td>${formatTimelineDateTime(item.datetime)}</td>
            </tr>
        `).join('');
    }

    function renderIncidentDetailsView(incident) {
        const timeline = parseIncidentTimeline(incident.content);

        return `
            <div class="ems-details-container">
                <a href="#" id="ems-back-link" class="ems-back-link">← Back to incidents</a>
                <h2>Incident Details – ${incident.incident_number || 'N/A'}</h2>

                <div class="ems-panel">
                    <h3>Incident Information</h3>
                    <div class="ems-detail-grid">
                        <div class="ems-detail-item">
                            <label>Unit ID:</label>
                            <span>${incident.unit_id || 'N/A'}</span>
                        </div>
                        <div class="ems-detail-item">
                            <label>Location:</label>
                            <span>${incident.location || 'N/A'}</span>
                        </div>
                        <div class="ems-detail-item">
                            <label>Incident Type:</label>
                            <span>${incident.incident_type || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="ems-panel">
                    <h3>Incident Timeline</h3>
                    <table class="ems-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Date/Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTimelineRows(timeline)}
                        </tbody>
                    </table>
                </div>

                <button id="ems-select-btn" class="ems-btn ems-btn-primary ems-btn-large">Select This Incident</button>
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
                if (data && data.incidentNumber && data.unitId) {
                    const incident = await fetchIncidentDetails(data.incidentNumber, data.unitId);
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
        totalCount = count || 0;

        tbody.innerHTML = renderIncidentRows(incidents);
        attachIncidentRowHandlers();

        // Update pagination buttons
        const prevBtn = document.getElementById('ems-prev-btn');
        const nextBtn = document.getElementById('ems-next-btn');
        const pageInfo = document.getElementById('ems-page-info');

        if (prevBtn) prevBtn.disabled = currentPage === 0;
        if (nextBtn) nextBtn.disabled = data.length < PAGE_SIZE;

        // Update pagination info
        if (pageInfo) {
            const startIndex = currentPage * PAGE_SIZE + 1;
            const endIndex = currentPage * PAGE_SIZE + data.length;
            if (data.length === 0) {
                pageInfo.innerHTML = 'No incidents found';
            } else {
                pageInfo.innerHTML = `Showing Incidents<br>${startIndex} - ${endIndex}<br>of ${totalCount}`;
            }
        }
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
        const clearBtn = document.getElementById('ems-clear-btn');
        const prevBtn = document.getElementById('ems-prev-btn');
        const nextBtn = document.getElementById('ems-next-btn');
        const incidentNumberInput = document.getElementById('ems-search-number');
        const dateInput = document.getElementById('ems-search-date');

        // Make fields mutually exclusive - when one is filled, clear the other
        incidentNumberInput.addEventListener('input', () => {
            if (incidentNumberInput.value.trim()) {
                dateInput.value = '';
                searchFilters.date = '';
            }
        });

        dateInput.addEventListener('input', () => {
            if (dateInput.value) {
                incidentNumberInput.value = '';
                searchFilters.incidentNumber = '';
            }
        });

        searchBtn.addEventListener('click', () => {
            searchFilters.incidentNumber = incidentNumberInput.value.trim();
            searchFilters.date = dateInput.value;
            currentPage = 0;
            loadIncidents();
        });

        clearBtn.addEventListener('click', () => {
            // Reset search filters
            searchFilters.incidentNumber = '';
            searchFilters.date = '';

            // Clear input fields
            incidentNumberInput.value = '';
            dateInput.value = '';

            // Reset to first page and reload
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
                const incidentNumber = row.getAttribute('data-incident-number');
                const unitId = row.getAttribute('data-unit-id');
                navigateTo('details', { incidentNumber, unitId });
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
            // Parse the content JSON to get the full incident data
            let incidentData;
            try {
                incidentData = JSON.parse(currentIncident.content);
                // Merge top-level database fields with parsed content
                incidentData.incident_number = currentIncident.incident_number;
                incidentData.unit_id = currentIncident.unit_id;
                incidentData.incident_date = currentIncident.incident_date;
                incidentData.location = currentIncident.location;
            } catch (e) {
                console.error('Error parsing incident content:', e);
                incidentData = currentIncident;
            }

            // Dispatch custom event for cross-script communication
            const event = new CustomEvent('ems:incidentSelected', {
                detail: { incident: incidentData }
            });
            window.dispatchEvent(event);
            console.log('[EMS Drawer] Incident selected and event dispatched:', incidentData);

            // Close the drawer immediately (no alert)
            toggleDrawer();
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
            /* Close Button */
            #ems-close-btn {
                position: absolute;
                top: 10px;
                right: 10px;
                width: 30px;
                height: 30px;
                background: #f0f0f0;
                border: 1px solid #ddd;
                border-radius: 4px;
                cursor: pointer;
                font-size: 18px;
                font-weight: bold;
                color: #666;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                transition: background 0.2s;
            }

            #ems-close-btn:hover {
                background: #e0e0e0;
                color: #333;
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
                box-shadow: -4px 0 16px rgba(0,0,0,0.3);
                z-index: 9999;
                transition: right 0.3s ease;
                overflow-y: auto;
                border-left: 1px solid #bbb;
                opacity: 1;
            }

            #ems-drawer.ems-drawer-open {
                right: 0;
            }

            #ems-drawer-content {
                padding: 12px;
                background: #ffffff;
                opacity: 1;
            }

            /* Login View */
            .ems-login-container {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: #ffffff;
            }

            .ems-login-card {
                background: #ffffff;
                padding: 32px;
                border-radius: 8px;
                border: 1px solid #e0e0e0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
            .ems-list-container {
                background: #ffffff;
            }

            .ems-list-container h2 {
                margin: 0 0 20px 0;
                font-size: 20px;
                color: #1a1a1a;
            }

            .ems-search-area {
                display: flex;
                flex-direction: column;
                gap: 12px;
                margin-bottom: 20px;
                padding: 16px;
                background: #f5f5f5;
                border-radius: 6px;
                border: 1px solid #e0e0e0;
            }

            .ems-search-area .ems-form-group {
                margin-bottom: 0;
            }

            .ems-search-buttons {
                display: flex;
                gap: 8px;
                margin-top: 4px;
            }

            .ems-search-buttons .ems-btn {
                white-space: nowrap;
                flex: 1;
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
                background: #fafafa;
                position: sticky;
                top: 0;
                z-index: 10;
            }

            .ems-table th {
                padding: 12px 8px;
                text-align: left;
                font-weight: 600;
                color: #1a1a1a;
                border-bottom: 2px solid #ddd;
            }

            .ems-table td {
                padding: 10px 8px;
                border-bottom: 1px solid #f0f0f0;
                color: #555;
            }

            .ems-incident-row {
                cursor: pointer;
                transition: background 0.1s;
                background: #ffffff;
            }

            .ems-incident-row:hover {
                background: #f0f7ff;
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
                text-align: center;
                line-height: 1.4;
            }

            /* Details View */
            .ems-details-container {
                background: #ffffff;
            }

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
                background: #ffffff;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 20px;
            }

            .ems-panel h3 {
                margin: 0 0 16px 0;
                font-size: 16px;
                color: #1a1a1a;
                font-weight: 600;
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
        console.log('[EMS Drawer] Initializing...');
        try {
            // Initialize Supabase REST client
            initSupabase();

            // Inject styles
            injectStyles();

            // Create drawer
            const drawer = document.createElement('div');
            drawer.id = 'ems-drawer';
            drawer.innerHTML = `
                <button id="ems-close-btn" title="Close">×</button>
                <div id="ems-drawer-content"></div>
            `;
            document.body.appendChild(drawer);

            // Add close button handler
            document.getElementById('ems-close-btn').addEventListener('click', () => {
                toggleDrawer();
            });

            // Listen for drawer open requests via custom events
            window.addEventListener('ems:openDrawer', async function() {
                console.log('[EMS Drawer] Received openDrawer event');
                const drawer = document.getElementById('ems-drawer');
                if (drawer && !drawer.classList.contains('ems-drawer-open')) {
                    // Check session and navigate to appropriate view when opening drawer
                    const hasSession = await checkSession();
                    if (hasSession) {
                        await navigateTo('list');
                    } else {
                        await navigateTo('login');
                    }
                    toggleDrawer();
                }
            });

            // Initialize with login view (but don't show the drawer yet)
            await navigateTo('login');
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Failed to initialize EMS Incident Manager: ' + error.message);
        }
    }

    // Start the application
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
