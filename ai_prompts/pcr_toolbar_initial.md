# PCR Toolbar - Call Times Automation

## Overview
Create a Tampermonkey script that automates populating date and time fields on an EMS web form by loading JSON data from a local file. The field mapping configuration is also loaded from a separate local configuration file.

## Target URL
The script should activate on:
```
https://newjersey.imagetrendelite.com/Elite/Organizationnewjersey/Agencymartinsvil/EmsRunForm#/Incident20076371/Form2610
```

## UI Requirements

### Toolbar
- Create a fixed toolbar at the top of the page
- Toolbar should contain action buttons

### "Call Times" Button
- Add a button labeled "Call Times"
- When clicked, the button should:
  1. Open a file picker dialog to select a JSON file from the local computer
  2. Read and parse the JSON file
  3. Navigate to the correct form sections
  4. Populate the date/time fields based on the JSON data

## Configuration Management

### Field Mapping Configuration File
- The Tampermonkey script should load field mappings from a local configuration file
- This allows updating field mappings without modifying the script
- Configuration file should be loaded on script initialization or on first button click

## Data Format

### Call Times Data File (call_info.json)
The JSON file loaded by the user should contain data in this format:

```json
{
  "incidentTimes": {
    "cad": "123456789",
    "times": {
      "notifiedByDispatch": {
        "date": "11/20/2025",
        "time": "00:01:15"
      },
      "enRoute": {
        "date": "11/20/2025",
        "time": "00:06:45"
      },
      "onScene": {
        "date": "11/20/2025",
        "time": "00:18:30"
      },
      "arrivedAtPatient": {
        "date": "11/20/2025",
        "time": "00:23:10"
      },
      "leftScene": {
        "date": "11/20/2025",
        "time": "00:41:00"
      },
      "ptArrivedAtDestination": {
        "date": "11/20/2025",
        "time": "01:02:25"
      },
      "destinationPatientTransferOfCare": {
        "date": "11/20/2025",
        "time": "01:19:40"
      },
      "backInService": {
        "date": "11/20/2025",
        "time": "01:31:15"
      }
    }
  }
}
```

### Field Mapping Configuration File (field_mapping.json)
The configuration file should map JSON fields to HTML element IDs:

```json
{
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
  }
}
```

## Navigation Logic

### Section Navigation Function

Use this function to navigate between form sections:

```javascript
function clickSection(sectionName) {
    const label = Array.from(document.querySelectorAll('.section .text-padding'))
        .find(el => el.textContent.trim() === sectionName);

    if (label) {
        label.closest('.section').click();
        console.log(`Clicked ${sectionName} section.`);
    } else {
        console.log(`Section "${sectionName}" not found.`);
    }
}
```

### Navigation Sequence

To reach the Mileage/CAD/Times section:

1. Call `clickSection("Dispatch Info")`
2. Wait 5 seconds (allow page section to load)
3. Call `clickSection("Mileage / CAD / Times")`
4. Wait 5 seconds (allow page section to load)

## Complete Workflow

### On Script Load
1. Load field mapping configuration from local file
2. Store configuration in memory
3. Create and display toolbar with "Call Times" button

### When "Call Times" Button is Clicked

1. **Load JSON data file**
   - Open file picker dialog (accept only .json files)
   - Read the selected file
   - Parse JSON content
   - Validate the data structure

2. **Navigate to the correct section**
   - Click "Dispatch Info" section
   - Wait 5 seconds
   - Click "Mileage / CAD / Times" section
   - Wait 5 seconds

3. **Populate fields**
   - For each time field in the JSON data:
     - Find the corresponding element ID from the loaded configuration
     - Set the date field value (format: MM/DD/YYYY)
     - Set the time field value (format: HH:MM:SS)
   - Populate the CAD number field

4. **Provide feedback**
   - Show success message when complete
   - Show error message if any step fails

## Technical Notes

- Use hidden `<input type="file" accept=".json">` elements for both configuration and data file selection
- Use FileReader API to read file contents
- Handle async operations with promises or async/await
- Add error handling for:
  - Invalid JSON format
  - Missing required fields
  - File read errors
  - Element not found on page
  - Configuration not loaded
- Consider adding visual feedback:
  - Button state changes
  - Loading indicator during operation
  - Configuration load status indicator
- May need `@grant GM_xmlhttpRequest` or similar for loading configuration file
