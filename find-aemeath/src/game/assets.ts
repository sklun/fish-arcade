export type AssetOption = {
  id: string
  label: string
  url: string
}

export const ICON_ASSETS: AssetOption[] = [
  { id: 'default', label: '爱弥斯 · 默认', url: new URL('../../resource/icon/Aemeath.jpg', import.meta.url).href },
]

export const BACKGROUND_ASSETS: AssetOption[] = [
  { id: 'default', label: '爱弥斯 · 默认', url: new URL('../../resource/background/Aemeath.webp', import.meta.url).href },
]

export const assetUrl = (assets: AssetOption[], id: string): string =>
  assets.find((asset) => asset.id === id)?.url ?? assets[0]?.url ?? ''
