# Notion Time Tracker

A Chrome extension for tracking time on your Notion tasks. Select a task from your Notion database, start the timer, and watch your work sessions get logged automatically.

## Features

- **Task Integration**: Connect to your Notion tasks database and see all your tasks
- **Time Tracking**: Start, pause, and stop timers with automatic session logging
- **Work Sessions**: Automatically creates time entries in a linked Work Sessions database
- **Filters**: Filter tasks by status or checkbox properties
- **Running Total**: See cumulative time tracked across all sessions for each task
- **Background Timer**: Timer continues running even when the popup is closed
- **Dark Mode**: Supports light, dark, and system theme preferences

## Setup

### 1. Create a Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Give it a name (e.g., "Time Tracker")
4. Select your workspace
5. Copy the "Internal Integration Token"

### 2. Prepare Your Notion Databases

You need two databases:

**Tasks Database** (your existing task database):
- Must have a **Status** property (type: Status)
- Must have a **Relation** property pointing to Work Sessions

**Work Sessions Database**:
- Must have two **Date** properties (ideally named "Start" and "End")
- Must have a **Relation** property back to Tasks (two-way relation)

### 3. Connect the Integration

1. Open each database in Notion
2. Click "..." menu → "Add connections"
3. Select your integration

### 4. Configure the Extension

1. Click the extension icon
2. Go to Settings
3. Paste your API key
4. Select your Tasks database
5. Map the Status and Sessions properties
6. Configure Start/End date properties for Work Sessions

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Install Dependencies

```bash
npm install
```

### Development Build

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Load Extension in Chrome

1. Run `npm run build`
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Tech Stack

- **Svelte 5** - UI framework
- **Tailwind CSS 4** - Styling
- **Bits UI** - Accessible component primitives
- **Vite** - Build tool
- **Chrome Extension Manifest V3** - Extension platform

## Project Structure

```
src/
├── popup/
│   ├── App.svelte           # Main app component
│   ├── main.ts              # Entry point
│   ├── views/
│   │   ├── TaskList.svelte  # Task list view
│   │   ├── Timer.svelte     # Active timer view
│   │   └── Settings.svelte  # Settings/config view
│   ├── components/
│   │   ├── TaskItem.svelte
│   │   ├── TimerDisplay.svelte
│   │   ├── Select.svelte
│   │   └── FilterBuilder.svelte
│   └── lib/
│       ├── notion.ts        # Notion API client
│       ├── storage.ts       # Chrome storage helpers
│       ├── stores.ts        # Svelte stores
│       ├── time.ts          # Time utilities
│       └── types.ts         # TypeScript types
├── background/
│   └── service-worker.ts    # Background timer logic
├── styles/
│   └── app.css              # Global styles
└── popup.html
```

## License

MIT
