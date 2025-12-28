---
title: Populating data with Incident Data
nav_order: 4
---

# Populating data with Incident Data

![Toolbar with incident](images/toolbar_with_incident.png)

## Populating Data from Incidents

Once you have selected an incident, you can use the toolbar buttons to automatically populate form fields. **Important**: The toolbar buttons only become active when BOTH of these conditions are met:

1. You are on the correct page for that button
2. The selected incident contains the required data for that page

### Populating the Times Page

Navigate to the **Mileage / CAD / Times** page. If you have selected an incident that contains time data, the **Times** button will become active (no longer grayed out).

![Times Button](images/incidents_times_active.png)

Click the **Times** button to automatically populate all the call times from the incident data.

**Note**: If the Times button remains grayed out even though you're on the correct page, the selected incident may not contain time data (incidentTimes). You may need to select a different incident.

### Populating the Address Page

Navigate to the **Incident Address** page. If you have selected an incident that contains location data, the **Address** button will become active.

![Address Page](images/incidents_address_active.png)

Click the **Address** button to automatically populate the address fields from the incident data. The system will also automatically click the "Postal Code Lookup" button to populate city and state information.

**Note**: If the Address button remains grayed out, the selected incident may not contain location data (incidentLocation). You may need to select a different incident.
