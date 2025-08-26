# Protocol Design Feature

## Overview

The Protocol Design feature allows the sidebar and VariablesBrowser to display Protocol data in a structured way, breaking down the design components into individual, browsable datasets.

## How It Works

### 1. Data Structure

When the Python backend processes Protocol files, it extracts design information and structures it as:

```typescript
interface ProtocolDesign {
  endpoints: ProtocolEndpoint[]
  objectives: ProtocolObjective[]
  populations: ProtocolPopulation[]
  soa: ProtocolSOA
}
```

### 2. Transformation

The `transformSourceAgnosticToUI` function automatically detects Protocol entities with `type: 'protocol_design'` and creates separate datasets for each design component:

- **Endpoints**: Shows each endpoint as a variable with its ID, description, and type
- **Objectives**: Shows each objective as a variable with its ID and description  
- **Populations**: Shows each population as a variable with its ID and description
- **SOA**: Shows forms and schedules as variables with their IDs and names

### 3. UI Display

In the sidebar, Protocol design components appear as separate items under the "Protocol" group:

```
Protocol
├── Endpoints (3)
├── Objectives (2) 
├── Populations (1)
└── SOA (2 forms, 2 schedules)
```

When clicked, each component opens in the VariablesBrowser showing individual items as variables.

## Example Data Flow

### Input (from Python backend):
```json
{
  "standards": {
    "Protocol": {
      "datasetEntities": {
        "USDM_Design": {
          "type": "protocol_design",
          "metadata": {
            "design": {
              "endpoints": [
                {
                  "id": "Endpoint_1",
                  "name": "END1", 
                  "type": "Primary Endpoint",
                  "description": "Alzheimer's Disease Assessment Scale"
                }
              ],
              "objectives": [...],
              "populations": [...],
              "soa": {...}
            }
          }
        }
      }
    }
  }
}
```

### Output (in sidebar):
- **Endpoints**: Shows "Endpoint_1" as a variable with description "Alzheimer's Disease Assessment Scale"
- **Objectives**: Shows each objective ID as a variable
- **Populations**: Shows each population ID as a variable  
- **SOA**: Shows form and schedule IDs as variables

## Benefits

1. **Structured View**: Protocol design data is organized into logical, browsable components
2. **Consistent UI**: Uses the same variable browsing interface as other data types
3. **ID-Focused**: Each design item displays its ID as the primary identifier
4. **Rich Metadata**: Shows descriptions, types, and counts in labels and tooltips
5. **Source Traceability**: Maintains links to original source files

## Technical Implementation

### Type Definitions
- `ProtocolEndpoint`, `ProtocolObjective`, `ProtocolPopulation`, `ProtocolSOA` interfaces
- Extended `EntityMetadata` with `design` and `stats` properties
- Added `"protocol_design"` to `EntityType` union

### Data Transformation
- Special handling in `transformSourceAgnosticToUI` for Protocol design entities
- Automatic creation of individual datasets for each design component
- Conversion of design items to Variable objects with appropriate metadata

### UI Components
- Existing components work without modification
- Sidebar automatically groups Protocol design components
- VariablesBrowser displays design items as variables
- VariableCard shows ID as primary text with description in tooltip

## Usage

1. Upload Protocol files to the Python backend
2. Backend extracts design information and structures it
3. Frontend automatically transforms and displays design components
4. Users can browse Endpoints, Objectives, Populations, and SOA separately
5. Each item shows its ID and can be explored for more details

## Future Enhancements

- Add filtering by endpoint type (Primary/Secondary)
- Show relationships between objectives and endpoints
- Display SOA timeline visualization
- Add search within Protocol design components
- Support for nested design hierarchies
