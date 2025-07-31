# ERPNext Desktop Application Architecture

## Overview

ERPNext Desktop is a comprehensive Electron-based desktop application that provides a native experience for running ERPNext ERP system locally. This document provides detailed technical architecture analysis with visual diagrams and orchestration patterns.

## System Architecture Overview

```mermaid
graph TB
    subgraph "ERPNext Desktop Application"
        subgraph "Electron Framework"
            MP[Main Process<br/>main.ts]
            RP[Renderer Process<br/>Vue.js UI]
            PL[Preload Script<br/>Security Bridge]
        end
        
        subgraph "Backend Services"
            ES[ERPNext Server<br/>Frappe Framework]
            DB[(Database Layer)]
            FS[File System<br/>Data Storage]
        end
        
        subgraph "Database Options"
            MD[(MariaDB<br/>Embedded/System)]
            SQ[(SQLite<br/>File-based)]
        end
    end
    
    subgraph "Operating System"
        OS[Windows/macOS/Linux]
        API[Native OS APIs]
    end
    
    subgraph "External Services"
        UP[Update Server]
        WEB[Web Resources]
    end
    
    MP --> RP
    MP --> PL
    RP --> PL
    MP --> ES
    MP --> DB
    DB --> MD
    DB --> SQ
    MP --> FS
    MP --> API
    API --> OS
    MP --> UP
    RP --> WEB
    
    classDef electronProcess fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef database fill:#e8f5e8
    classDef system fill:#fff3e0
    
    class MP,RP,PL electronProcess
    class ES,FS backend
    class MD,SQ,DB database
    class OS,API system
```

## Process Architecture

### Multi-Process Model

ERPNext Desktop follows Electron's multi-process architecture pattern:

```mermaid
graph LR
    subgraph "Main Process"
        MP[Main Process<br/>Node.js Runtime]
        WM[Window Management]
        LM[Lifecycle Management]
        SM[Server Management]
        DM[Database Management]
        UM[Update Management]
    end
    
    subgraph "Renderer Processes"
        MW[Main Window<br/>Vue.js App]
        SW[Splash Window<br/>Loading Screen]
    end
    
    subgraph "Background Processes"
        ESP[ERPNext Server Process<br/>bench start]
        DBP[Database Process<br/>MariaDB/SQLite]
    end
    
    MP --> MW
    MP --> SW
    MP --> ESP
    MP --> DBP
    
    classDef main fill:#ffeb3b
    classDef renderer fill:#4caf50
    classDef background fill:#ff9800
    
    class MP,WM,LM,SM,DM,UM main
    class MW,SW renderer
    class ESP,DBP background
```

### Inter-Process Communication (IPC)

```mermaid
sequenceDiagram
    participant MW as Main Window
    participant PL as Preload Script
    participant MP as Main Process
    participant ES as ERPNext Server
    participant DB as Database
    
    Note over MW,DB: Application Startup Sequence
    
    MW->>PL: window.erpnextAPI.server.checkStatus()
    PL->>MP: ipcRenderer.invoke('check-server-status')
    MP->>DB: Check database connection
    DB-->>MP: Connection status
    MP->>ES: Check server process
    ES-->>MP: Server status
    MP-->>PL: Server ready status
    PL-->>MW: Promise resolved with status
    
    Note over MW,DB: Configuration Update
    
    MW->>PL: window.erpnextAPI.config.updateDatabase(config)
    PL->>MP: ipcRenderer.invoke('update-database-config', config)
    MP->>ES: Stop current server
    MP->>DB: Update database config
    MP->>ES: Start server with new config
    ES-->>MP: Server started
    MP-->>PL: Configuration updated
    PL-->>MW: Promise resolved
```

## Component Architecture

### Main Process Components

```mermaid
graph TB
    subgraph "Main Process (main.ts)"
        MC[Main Class<br/>Application Controller]
        
        subgraph "Core Modules"
            AL[App Lifecycle<br/>registerAppLifecycleListeners]
            AU[Auto Updater<br/>registerAutoUpdaterListeners]
            IA[IPC Actions<br/>registerIpcMainActionListeners]
            IM[IPC Messages<br/>registerIpcMainMessageListeners]
            PL[Process Listeners<br/>registerProcessListeners]
        end
        
        subgraph "Helpers & Utilities"
            HP[Helpers<br/>main/helpers.ts]
            LG[Logger<br/>main/logger.ts]
            PS[Preload Script<br/>main/preload.js]
        end
        
        subgraph "Window Management"
            MW[Main Window]
            SW[Splash Window]
            WO[Window Options]
        end
        
        subgraph "Server Management"
            SM[Server Manager]
            DM[Database Manager]
            EM[Environment Setup]
        end
    end
    
    MC --> AL
    MC --> AU
    MC --> IA
    MC --> IM
    MC --> PL
    MC --> HP
    MC --> LG
    MC --> MW
    MC --> SW
    MC --> SM
    MC --> DM
    
    classDef core fill:#2196f3
    classDef helper fill:#4caf50
    classDef window fill:#ff9800
    classDef server fill:#9c27b0
    
    class AL,AU,IA,IM,PL core
    class HP,LG,PS helper
    class MW,SW,WO window
    class SM,DM,EM server
```

### Database Architecture

```mermaid
erDiagram
    APPLICATION {
        string serverPort
        string siteName
        string databaseType
        boolean autoStart
        boolean firstRun
    }
    
    MARIADB_CONFIG {
        string host
        int port
        string user
        string password
        string database
    }
    
    SQLITE_CONFIG {
        string databasePath
        string dataDirectory
    }
    
    SERVER_PROCESS {
        int pid
        string status
        string logPath
        timestamp startTime
    }
    
    DATABASE_PROCESS {
        int pid
        string type
        string status
        string dataPath
    }
    
    APPLICATION ||--|| MARIADB_CONFIG : "uses when type=mariadb"
    APPLICATION ||--|| SQLITE_CONFIG : "uses when type=sqlite"
    APPLICATION ||--o{ SERVER_PROCESS : "manages"
    APPLICATION ||--o{ DATABASE_PROCESS : "manages"
```

## Security Architecture

### Sandboxing & Context Isolation

```mermaid
graph TB
    subgraph "Security Boundaries"
        subgraph "Main Process (Privileged)"
            MP[Main Process<br/>Full Node.js Access]
            NA[Native APIs]
            FS[File System]
            NET[Network Access]
        end
        
        subgraph "Renderer Process (Sandboxed)"
            RP[Renderer Process<br/>Limited Access]
            DOM[DOM APIs]
            WEB[Web APIs]
        end
        
        subgraph "Security Bridge"
            PL[Preload Script<br/>Context Bridge]
            API[Exposed APIs]
        end
    end
    
    MP --> PL
    PL --> RP
    MP --> NA
    MP --> FS
    MP --> NET
    RP --> DOM
    RP --> WEB
    
    classDef privileged fill:#f44336
    classDef sandboxed fill:#4caf50
    classDef bridge fill:#ff9800
    
    class MP,NA,FS,NET privileged
    class RP,DOM,WEB sandboxed
    class PL,API bridge
```

### Content Security Policy

```javascript
// Security configuration in index.html
{
  "default-src": "'self' http://localhost:* https://localhost:*",
  "script-src": "'self' 'unsafe-inline'",
  "style-src": "'self' 'unsafe-inline'", 
  "img-src": "'self' data: http://localhost:* https://localhost:*"
}
```

## Build & Packaging Architecture

```mermaid
graph TB
    subgraph "Development Environment"
        SRC[Source Code<br/>TypeScript/Vue.js]
        VITE[Vite Dev Server<br/>Hot Reload]
        ELEC[Electron Dev<br/>Main Process]
    end
    
    subgraph "Build Pipeline"
        TS[TypeScript Compilation]
        VUE[Vue.js Build]
        BUNDLE[Asset Bundling]
        ELECTRON[Electron Packaging]
    end
    
    subgraph "Platform Builds"
        WIN[Windows<br/>.exe, .zip]
        MAC[macOS<br/>.dmg, .zip]
        LINUX[Linux<br/>.deb, .rpm, .AppImage]
    end
    
    subgraph "Distribution"
        GH[GitHub Releases]
        UP[Auto Updater]
        SIGN[Code Signing]
    end
    
    SRC --> TS
    SRC --> VUE
    TS --> BUNDLE
    VUE --> BUNDLE
    BUNDLE --> ELECTRON
    ELECTRON --> WIN
    ELECTRON --> MAC
    ELECTRON --> LINUX
    WIN --> GH
    MAC --> GH
    LINUX --> GH
    GH --> UP
    WIN --> SIGN
    MAC --> SIGN
    
    classDef dev fill:#e3f2fd
    classDef build fill:#f3e5f5
    classDef platform fill:#e8f5e8
    classDef dist fill:#fff3e0
    
    class SRC,VITE,ELEC dev
    class TS,VUE,BUNDLE,ELECTRON build
    class WIN,MAC,LINUX platform
    class GH,UP,SIGN dist
```

## Server Integration Architecture

### ERPNext/Frappe Integration

```mermaid
graph TB
    subgraph "ERPNext Desktop"
        ED[Electron Desktop App]
        SM[Server Manager]
        PM[Process Manager]
    end
    
    subgraph "Frappe Framework"
        BENCH[Frappe Bench<br/>bench start]
        WEB[Web Server<br/>Werkzeug/Gunicorn]
        API[REST API]
        SOCKET[WebSocket Server]
    end
    
    subgraph "ERPNext Application"
        CORE[ERPNext Core]
        MODULES[Business Modules]
        CUSTOM[Custom Apps]
    end
    
    subgraph "Database Layer"
        ORM[Frappe ORM]
        DB[(Database<br/>MariaDB/SQLite)]
    end
    
    ED --> SM
    SM --> PM
    PM --> BENCH
    BENCH --> WEB
    WEB --> API
    WEB --> SOCKET
    API --> CORE
    SOCKET --> CORE
    CORE --> MODULES
    CORE --> CUSTOM
    CORE --> ORM
    ORM --> DB
    
    classDef desktop fill:#2196f3
    classDef frappe fill:#4caf50
    classDef erpnext fill:#ff9800
    classDef database fill:#9c27b0
    
    class ED,SM,PM desktop
    class BENCH,WEB,API,SOCKET frappe
    class CORE,MODULES,CUSTOM erpnext
    class ORM,DB database
```

## Performance Architecture

### Resource Management

```mermaid
graph TB
    subgraph "Resource Monitoring"
        CPU[CPU Usage<br/>Process Monitoring]
        MEM[Memory Usage<br/>Heap Monitoring]
        DISK[Disk I/O<br/>Database Operations]
        NET[Network I/O<br/>Server Communications]
    end
    
    subgraph "Optimization Strategies"
        LAZY[Lazy Loading<br/>On-demand Resources]
        CACHE[Caching Layer<br/>Static Assets]
        POOL[Connection Pooling<br/>Database Connections]
        COMPRESS[Asset Compression<br/>Bundle Optimization]
    end
    
    subgraph "Performance Metrics"
        START[Startup Time<br/>< 10 seconds]
        RESP[Response Time<br/>< 500ms]
        RENDER[Render Time<br/>< 100ms]
        MEM_LIMIT[Memory Limit<br/>< 1GB]
    end
    
    CPU --> LAZY
    MEM --> CACHE
    DISK --> POOL
    NET --> COMPRESS
    LAZY --> START
    CACHE --> RESP
    POOL --> RENDER
    COMPRESS --> MEM_LIMIT
    
    classDef monitor fill:#f44336
    classDef optimize fill:#4caf50
    classDef metrics fill:#2196f3
    
    class CPU,MEM,DISK,NET monitor
    class LAZY,CACHE,POOL,COMPRESS optimize
    class START,RESP,RENDER,MEM_LIMIT metrics
```

## Configuration Management

### Settings Store Architecture

```mermaid
graph TB
    subgraph "Configuration Sources"
        DEFAULT[Default Config<br/>Built-in Defaults]
        USER[User Settings<br/>electron-store]
        ENV[Environment Variables<br/>Runtime Config]
        CLI[Command Line<br/>Launch Arguments]
    end
    
    subgraph "Configuration Manager"
        STORE[electron-store<br/>Persistent Storage]
        SCHEMA[Config Schema<br/>Type Validation]
        MERGE[Config Merger<br/>Priority Resolution]
    end
    
    subgraph "Application Components"
        MAIN[Main Process]
        RENDERER[Renderer Process]
        SERVER[Server Process]
        DATABASE[Database Process]
    end
    
    DEFAULT --> MERGE
    USER --> STORE
    STORE --> MERGE
    ENV --> MERGE
    CLI --> MERGE
    MERGE --> SCHEMA
    SCHEMA --> MAIN
    SCHEMA --> RENDERER
    SCHEMA --> SERVER
    SCHEMA --> DATABASE
    
    classDef source fill:#e3f2fd
    classDef manager fill:#f3e5f5
    classDef component fill:#e8f5e8
    
    class DEFAULT,USER,ENV,CLI source
    class STORE,SCHEMA,MERGE manager
    class MAIN,RENDERER,SERVER,DATABASE component
```

## Error Handling & Recovery

### Error Management Flow

```mermaid
graph TB
    subgraph "Error Sources"
        SE[Server Errors<br/>ERPNext/Frappe]
        DE[Database Errors<br/>Connection/Query]
        EE[Electron Errors<br/>Process/IPC]
        UE[User Errors<br/>Input/Action]
    end
    
    subgraph "Error Handling"
        CATCH[Error Catching<br/>try/catch blocks]
        LOG[Error Logging<br/>File/Console]
        NOTIFY[User Notification<br/>Dialog/Toast]
        RECOVER[Auto Recovery<br/>Restart/Retry]
    end
    
    subgraph "Recovery Strategies"
        RESTART[Process Restart<br/>Server/Database]
        RESET[Config Reset<br/>Default Settings]
        REPAIR[Auto Repair<br/>Database/Files]
        FALLBACK[Fallback Mode<br/>Minimal Function]
    end
    
    SE --> CATCH
    DE --> CATCH
    EE --> CATCH
    UE --> CATCH
    CATCH --> LOG
    LOG --> NOTIFY
    NOTIFY --> RECOVER
    RECOVER --> RESTART
    RECOVER --> RESET
    RECOVER --> REPAIR
    RECOVER --> FALLBACK
    
    classDef error fill:#f44336
    classDef handle fill:#ff9800
    classDef recovery fill:#4caf50
    
    class SE,DE,EE,UE error
    class CATCH,LOG,NOTIFY,RECOVER handle
    class RESTART,RESET,REPAIR,FALLBACK recovery
```

## Auto-Update Architecture

### Update Mechanism

```mermaid
sequenceDiagram
    participant APP as Desktop App
    participant AU as Auto Updater
    participant GH as GitHub Releases
    participant FS as File System
    participant USER as User
    
    Note over APP,USER: Update Check Process
    
    APP->>AU: Check for updates
    AU->>GH: Request latest release info
    GH-->>AU: Release metadata
    AU->>AU: Compare versions
    
    alt Update Available
        AU->>USER: Show update notification
        USER->>AU: Confirm update
        AU->>GH: Download update package
        GH-->>AU: Update file stream
        AU->>FS: Write to temp directory
        AU->>AU: Verify download signature
        AU->>APP: Apply update (restart required)
        APP->>USER: Restart notification
        USER->>APP: Confirm restart
        APP->>AU: Install and restart
    else No Update
        AU->>APP: No update available
    end
```

## Cross-Platform Considerations

### Platform-Specific Implementations

```mermaid
graph TB
    subgraph "Windows Implementation"
        WIN_DB[Embedded MariaDB<br/>mysql_install_db.exe]
        WIN_PROC[Process Management<br/>taskkill commands]
        WIN_PATH[File Paths<br/>%APPDATA%]
        WIN_SIGN[Code Signing<br/>Windows Certificate]
    end
    
    subgraph "macOS Implementation"
        MAC_DB[System MariaDB<br/>Homebrew/System]
        MAC_PROC[Process Management<br/>SIGTERM signals]
        MAC_PATH[File Paths<br/>~/Library/Application Support]
        MAC_SIGN[Code Signing<br/>Apple Certificate]
    end
    
    subgraph "Linux Implementation"
        LINUX_DB[System MariaDB<br/>Package Manager]
        LINUX_PROC[Process Management<br/>SIGTERM signals]
        LINUX_PATH[File Paths<br/>~/.config]
        LINUX_SIGN[No Signing<br/>Package Verification]
    end
    
    subgraph "Common Interface"
        DB_MANAGER[Database Manager]
        PROC_MANAGER[Process Manager]
        PATH_MANAGER[Path Manager]
        SIGN_MANAGER[Signing Manager]
    end
    
    WIN_DB --> DB_MANAGER
    MAC_DB --> DB_MANAGER
    LINUX_DB --> DB_MANAGER
    WIN_PROC --> PROC_MANAGER
    MAC_PROC --> PROC_MANAGER
    LINUX_PROC --> PROC_MANAGER
    WIN_PATH --> PATH_MANAGER
    MAC_PATH --> PATH_MANAGER
    LINUX_PATH --> PATH_MANAGER
    WIN_SIGN --> SIGN_MANAGER
    MAC_SIGN --> SIGN_MANAGER
    LINUX_SIGN --> SIGN_MANAGER
    
    classDef windows fill:#0078d4
    classDef macos fill:#007aff
    classDef linux fill:#f57c00
    classDef common fill:#4caf50
    
    class WIN_DB,WIN_PROC,WIN_PATH,WIN_SIGN windows
    class MAC_DB,MAC_PROC,MAC_PATH,MAC_SIGN macos
    class LINUX_DB,LINUX_PROC,LINUX_PATH,LINUX_SIGN linux
    class DB_MANAGER,PROC_MANAGER,PATH_MANAGER,SIGN_MANAGER common
```

## Summary

The ERPNext Desktop Application implements a sophisticated multi-process architecture that provides:

1. **Security**: Through Electron's sandboxing and context isolation
2. **Performance**: Via optimized resource management and caching strategies  
3. **Reliability**: Through comprehensive error handling and auto-recovery
4. **Maintainability**: With modular design and clear separation of concerns
5. **Cross-Platform**: Supporting Windows, macOS, and Linux with platform-specific optimizations

The architecture is designed to provide a native desktop experience while maintaining the full functionality of the ERPNext ERP system in a local environment.