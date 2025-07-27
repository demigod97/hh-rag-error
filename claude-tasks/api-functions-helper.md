# API Functions Helper

## Purpose
Helper script to add missing API compatibility functions to `src/lib/api.ts` that are expected by existing components.

## Missing Functions

### 1. `sendChat(sessionId: string, message: string)`
**Used by**: `ChatStream.tsx`
**Purpose**: Send chat message and get AI response
**Implementation**: Calls existing `sendChatMessage()` and formats response

### 2. `genTemplate(params)`
**Used by**: `PermitDrawer.tsx` 
**Purpose**: Generate permit/report from template
**Implementation**: Uses `generateReport()` and waits for completion

### 3. `uploadFile(file: File, notebookId: string)`  
**Used by**: `SourcesSidebar.tsx`
**Purpose**: Upload and process document files
**Implementation**: Calls `uploadAndProcessFile()` and formats response

## Usage
```bash
# Apply the compatibility functions
node claude-tasks/add-api-functions.js
```

## What It Does
1. Reads `DOCUMENTATION AND INSTRUCTIONS/api-compatibility-functions.ts`
2. Extracts the compatibility functions 
3. Adds them to existing `src/lib/api.ts`
4. Ensures proper imports and dependencies

## Expected Result
- Components will no longer have import errors
- Functions will integrate with existing backend API
- Maintains compatibility with current component interfaces