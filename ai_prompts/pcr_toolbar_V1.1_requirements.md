**Requirements for Updating `pcr_toolbar.user.js`**

1. **Toolbar Appearance**

   * The toolbar background color must be **blue**.
   * It must **fit within the existing button bar area**.
   * All text shown in the toolbar must be **white**.

2. **Toolbar Placement**

   * The toolbar must be created **inside a `<div id="top-pane">`**.

3. **Incident Number Display**

   * Retrieve the value stored under `GM_getValue("incident_json")`.
   * Extract the **incidentNumber** field from the JSON.
   * Display the incident number as **plain white text** on the toolbar (not a hyperlink).

4. **Toolbar Buttons**

   * Add two buttons to the toolbar:

     * **Times**
     * **Address**
   * Both buttons should appear **disabled** initially.

5. **Times Button Activation Logic**

   * The **Times** button becomes enabled only when **all** of the following are true:

     1. The current page contains a `<div id="panel-header">` element.
     2. The text content of that element is exactly **"Mileage / CAD / Times"**.
     3. A valid JSON object is available from `GM_getValue("incident_json")`.

6. **Times Button Behavior**

   * When the Times button is pressed:

     * Parse the `incident_json` object.
     * Populate the corresponding time fields on the page using values from the JSON.
