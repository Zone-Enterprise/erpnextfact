// ERPNext Desktop electron-builder configuration
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * electron-builder configuration for ERPNext Desktop
 * This file defines how the application should be packaged and distributed
 * across different platforms (Windows, macOS, Linux)
 */

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const buildDirPath = path.join(root, 'desktop/dist_electron/build');
const packageDirPath = path.join(root, 'desktop/dist_electron/bundled');

// Define file associations for ERPNext related files
const fileAssociations = [
  {
    ext: 'erpnext',
    name: 'ERPNext File',
    description: 'ERPNext Data File',
    role: 'Editor',
    icon: 'build/icons/file-icon.ico'
  }
];

const erpnextDesktopConfig = {
  productName: 'ERPNext Desktop',
  appId: 'com.zone-enterprise.erpnext-desktop',
  copyright: `Copyright © ${new Date().getFullYear()} Zone Enterprise`,
  asarUnpack: [
    '**/*.node',
    '**/assets/bench-template/**',
    '**/assets/mariadb/**'
  ],
  extraResources: [
    { from: 'desktop/assets', to: 'assets' },
    { from: 'desktop/config', to: 'config' },
    { from: 'erpnext/public/images', to: 'images' }
  ],
  files: [
    'desktop/dist_electron/build/**/*',
    '!node_modules/**/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!node_modules/**/{test,__tests__,tests,powered-test,example,examples}',
    '!node_modules/**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!node_modules/**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,__pycache__,thumbs.db,.gitignore,.gitattributes,.editorconfig,.flowconfig,.yarn-metadata.json,.idea,appveyor.yml,.travis.yml,circle.yml,npm-debug.log,.nyc_output,yarn.lock,.yarn-integrity}'
  ],
  extends: null,
  directories: {
    output: packageDirPath,
    app: buildDirPath,
    buildResources: path.join(root, 'desktop/build')
  },
  afterPack: './desktop/scripts/after-pack.js',
  publish: [
    {
      provider: 'github',
      owner: 'Zone-Enterprise',
      repo: 'erpnextfact',
      releaseType: 'release'
    }
  ],
  // Mac specific configuration
  mac: {
    category: 'public.app-category.business',
    icon: 'desktop/build/icon.icns',
    type: 'distribution',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    darkModeSupport: true,
    entitlements: 'desktop/build/entitlements.mac.plist',
    entitlementsInherit: 'desktop/build/entitlements.mac.plist',
    notarize: {
      teamId: process.env.APPLE_TEAM_ID || '',
    },
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    binaries: [
      'Contents/MacOS/ERPNext Desktop',
      'Contents/Resources/assets/mariadb/bin/mysql',
      'Contents/Resources/assets/mariadb/bin/mysqld'
    ],
    extraFiles: [
      {
        from: 'desktop/assets/scripts/mac',
        to: 'MacOS/scripts'
      }
    ]
  },
  // DMG specific configuration
  dmg: {
    background: 'desktop/build/background.png',
    icon: 'desktop/build/icon.icns',
    iconSize: 128,
    contents: [
      {
        x: 380,
        y: 240,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 130,
        y: 240,
        type: 'file'
      }
    ],
    window: {
      width: 540,
      height: 380
    }
  },
  // Windows specific configuration
  win: {
    icon: 'desktop/build/icon.ico',
    publisherName: 'Zone Enterprise',
    signDlls: true,
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    fileAssociations: fileAssociations,
    extraFiles: [
      {
        from: 'desktop/assets/scripts/win',
        to: 'resources/scripts'
      }
    ]
  },
  // NSIS installer configuration
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'desktop/build/installerIcon.ico',
    uninstallerIcon: 'desktop/build/uninstallerIcon.ico',
    installerHeaderIcon: 'desktop/build/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ERPNext Desktop',
    include: 'desktop/build/installer.nsh',
    artifactName: '${productName}-Setup-${version}.${ext}',
    menuCategory: 'Zone Enterprise',
    displayLanguageSelector: true,
    license: 'license.txt',
    runAfterFinish: true
  },
  // Linux specific configuration
  linux: {
    icon: 'desktop/build/icons',
    category: 'Office',
    packageCategory: 'Office',
    description: 'ERPNext Desktop - Open Source ERP System',
    synopsis: 'Desktop application for ERPNext',
    desktop: {
      Name: 'ERPNext Desktop',
      Comment: 'Open Source ERP System',
      GenericName: 'ERP System',
      Type: 'Application',
      StartupNotify: true,
      StartupWMClass: 'erpnext-desktop'
    },
    target: [
      {
        target: 'deb',
        arch: ['x64', 'arm64']
      },
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'rpm',
        arch: ['x64', 'arm64']
      }
    ],
    artifactName: '${productName}-${version}-${arch}.${ext}',
    fileAssociations: fileAssociations,
    extraFiles: [
      {
        from: 'desktop/assets/scripts/linux',
        to: 'resources/scripts'
      }
    ]
  },
  // DEB specific configuration
  deb: {
    depends: [
      'libgtk-3-0',
      'libnotify4',
      'libnss3',
      'libxss1',
      'libxtst6',
      'xdg-utils',
      'libatspi2.0-0',
      'libuuid1',
      'libsecret-1-0'
    ],
    afterInstall: 'desktop/assets/scripts/linux/after-install.sh',
    afterRemove: 'desktop/assets/scripts/linux/after-remove.sh'
  },
  // RPM specific configuration
  rpm: {
    depends: [
      'libXScrnSaver',
      'libnotify',
      'nss',
      'libXtst',
      'libatspi',
      'libuuid',
      'libsecret'
    ],
    afterInstall: 'desktop/assets/scripts/linux/after-install.sh',
    afterRemove: 'desktop/assets/scripts/linux/after-remove.sh',
    fpm: ['--rpm-rpmbuild-define=_build_id_links none']
  },
  // AppImage specific configuration
  appImage: {
    license: 'license.txt',
    artifactName: '${productName}-${version}-${arch}.${ext}'
  },
  // Auto-update configuration
  updater: {
    provider: 'github',
    repo: 'erpnextfact',
    owner: 'Zone-Enterprise',
    vPrefixedTagName: true,
    releaseType: 'release',
    url: 'https://github.com/Zone-Enterprise/erpnextfact/releases/download/v${version}',
    channel: 'latest',
    requestHeaders: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    }
  }
};

export default erpnextDesktopConfig;
