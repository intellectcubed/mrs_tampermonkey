
# EMS Incident Manager – Tampermonkey Script Specification

## Overview
Create a Tampermonkey userscript named **ems-incident-drawer.user.js** that runs on:


https://example.com/


The script injects a floating button and a right-side drawer overlay that acts as a **single-page application (SPA)** for selecting EMS incidents from Supabase and storing the selected incident for use by other scripts.

---

## UI Structure

### Floating Button
- Positioned at the **top-right corner** of the page
- Always visible
- Clicking the button **toggles** the drawer open/closed

### Drawer
- Overlays the page content (does not push layout)
- Positioned on the **right side**
- Width: approximately **25% of the screen**
- Hidden by default on page load
- Contains the SPA views described below

---

## SPA Views

### 1. Login View
- Displayed if no valid Supabase session exists
- Centered card with:
  - User ID input
  - Password input
  - Login button
- Minimal, professional EMS-style design
- On login:
  - Authenticate using **Supabase**
  - Persist session using `GM_setValue`
- If a valid session exists:
  - Skip login view automatically
- **No logout functionality required**

---

### 2. Incident List View (Main View)
- Title: **“EMS Incidents – Last 7 Days”**

#### Search Area
- Incident Number input
- Date picker (single day filter)
- Search button (no auto-search on typing)

#### Results Table
- Scrollable table
- Columns:
  - Incident Number
  - Unit ID
  - Date/Time
  - Address
  - Incident Type
- Page size: **20 incidents**
- Pagination:
  - **Next** and **Previous** buttons
  - Server-side pagination via Supabase (`limit` / `offset`)
- Hovering over rows highlights them
- Clicking a row opens the **Incident Details View**

---

### 3. Incident Details View
- Top link: **“← Back to incidents”**
- Title: **“Incident Details – {incident number}”**

#### Panel: Incident Information
- Incident Number
- Unit ID
- Date/Time
- Incident Type
- Address

#### Panel: Status History
- Table with columns:
  - Date/Time
  - Status
- Displays up to **20 rows**

#### Select Button
- Blue button labeled **“Select”**
- On click:
  - Save the full incident JSON object using:
    ```
    GM_setValue("ems:selectedIncident", incidentObject)
    ```

---

## Data & Authentication

### Supabase
- Use **Supabase anon public key**, embedded in the script
- Authentication handled via Supabase auth APIs
- Data access protected via Supabase **Row Level Security (RLS)**

### Shared Logic
- Supabase client and query logic are loaded via:
