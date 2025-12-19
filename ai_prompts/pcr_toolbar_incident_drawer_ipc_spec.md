# Tampermonkey Interoperability Specification: PCR Toolbar ↔ Incident Drawer

## Purpose
Implement interoperation between two existing Tampermonkey scripts using Tampermonkey value-based IPC (`GM_setValue` + listeners). The goal is to allow the PCR toolbar script to open the incident drawer script, and for the drawer to return a selected incident back to the toolbar in a shared, reliable way.

---

## Scripts Involved

### Script 1: PCR Toolbar
- Name: `pcr_toolbar`
- Path:  
  `/Users/george.nowakowski/Projects/tampermonkey/mrs_tampermonkey/src/pcr_toolbar/pcr_toolbar.user.js`

### Script 2: Incident Drawer
- Name: `incident_drawer`
- Path:  
  `/Users/george.nowakowski/Projects/tampermonkey/mrs_tampermonkey/src/incident_drawer/ems-incident-drawer.user.js`

---

## Shared IPC Contract

The two scripts communicate exclusively via Tampermonkey storage values.

### IPC Keys
- **`ems:drawer:open`**
  - Type: boolean
  - Set by: PCR Toolbar
  - Listened to by: Incident Drawer
  - Purpose: Signal the drawer to open

- **`ems:selectedIncident`**
  - Type: object (incident JSON)
  - Set by: Incident Drawer
  - Listened to by: PCR Toolbar
  - Purpose: Provide the selected incident to the toolbar

### Incident Data Contract
- The incident JSON **must include** the field:
  - `incidentNumber`
- This field name is authoritative and must be used consistently by both scripts.

---

## PCR Toolbar Script Changes

### Initialization
On script load:
- Clear any previously selected incident:
  ```js
  GM_setValue("ems:selectedIncident", null);
  ```
- Clear any existing global incident data:
  ```js
  unsafeWindow.EMSIncidentData = null;
  ```
- Set the toolbar incident display text to:
  **`No Incident`**

---

### Toolbar UI Changes
- Add a **non-editable text field** on the **rightmost side** of the toolbar.
  - Initial text: `No Incident`
  - After selection: display the selected incident’s `incidentNumber`

- Add a button on the **leftmost side** of the toolbar:
  - Label: `Incidents`
  - Always enabled

---

### Toolbar Button Behavior
- When the **Incidents** button is clicked:
  ```js
  GM_setValue("ems:drawer:open", true);
  ```

---

### Handling Incident Selection
- Listen for changes to:
  ```js
  ems:selectedIncident
  ```
- When a non-null incident object is received:
  - Copy the object to:
    ```js
    unsafeWindow.EMSIncidentData
    ```
  - Update the toolbar display to show:
    ```
    incidentObject.incidentNumber
    ```
- If a different incident is later selected:
  - Overwrite the previous incident data
- If no incident is selected:
  - Toolbar remains showing **`No Incident`**

---

## Incident Drawer Script Changes

### Drawer Open Listener
- Add a Tampermonkey value-change listener for:
  ```js
  ems:drawer:open
  ```
- When the value becomes `true`:
  - Open / show the drawer UI
  - Reset the value after handling:
    ```js
    GM_setValue("ems:drawer:open", false);
    ```

---

### Drawer UI Changes
- Remove the existing **“EMS Incidents”** button
- Add a close control:
  - An **“X” button** at the top of the drawer
  - Clicking it hides the drawer

---

### Incident Selection Behavior
- When an incident is selected:
  - Do **not** display any popup or confirmation dialog
  - Save the incident JSON to:
    ```js
    GM_setValue("ems:selectedIncident", incidentObject);
    ```
  - Close the drawer immediately

- If another incident is selected later:
  - Overwrite the previous value

---

## Drawer Close Behavior
The drawer must close when:
- The **X** button is pressed, or
- The **Select** button is pressed after choosing an incident

Closing the drawer does **not** clear the selected incident.

---

## Error and Edge Case Handling
- If the drawer is opened and closed without selecting an incident:
  - No value is written to `ems:selectedIncident`
  - Toolbar remains displaying **`No Incident`**
- If incident loading fails:
  - Drawer may show an error state
  - No IPC values are written

---

## Summary
This specification defines a clean, decoupled IPC mechanism between two Tampermonkey scripts. The PCR toolbar controls when the incident drawer opens, and the drawer is the sole authority for selecting and publishing incident data. Incident state is explicit, overwrite-safe, and resilient to reloads.
