import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    name: 'NoteScape',
    description: 'Không gian tab mới với ghi chú, thời tiết và lối tắt của bạn.',
    // Public key only. It keeps the unpacked extension ID stable across machines.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsFFvuLMmrtgzzL/y310ibQNml3ad5QlFtD57UG5F8+VSOxToT2YpbpPwMV2VezrglrpjuXIil8i4XGsAEgt0mcaUFO6j4vpOkvoHy+iQRWDmCBLpgox5xEAxmwFILR0ZKf6iCSeDFvx2a8Sej6IabOrJaLdF1O3m8lcDg5lmHDmPSK00IL7tz8P/kaq1pst8F4TSFTko73GZDjBwByM0jAAZV61PB1W6CJmgMue6jn2GDwGN4OBkkFLD/c2b/D7vgmXUeTYtMZBXRl7V4ecD3qC/6K+pliPRYBsPh1z8k14um+6v9e2+0a5AnFFx6A0SELrM+pEB9/+BZ2Dm2ultMQIDAQAB',
    permissions: ['storage'],
    host_permissions: [
      'https://api.open-meteo.com/*',
      'https://geocoding-api.open-meteo.com/*',
    ],
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
})
