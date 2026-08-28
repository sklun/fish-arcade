export type GameId = 'arrow' | 'find-aemeath'
export type GameArtwork = 'arrow' | 'aemeath'

export type GameAvailability =
    | { available: true; note: string }
    | { available: false; note: string }

export interface GameCatalogEntry {
    id: GameId
    index: string
    kind: string
    title: string
    englishTitle: string
    summary: string
    playHref: string
    image: string
    portraitImage?: string
    imageAlt: string
    artwork: GameArtwork
    availability: GameAvailability
    mode: string
    duration: string
    controls: string
}

export const gameCatalog: GameCatalogEntry[] = [
    {
        id: 'arrow',
        index: '01',
        kind: '顺序解谜',
        title: '箭序',
        englishTitle: 'ARROW',
        summary: '找准次序，让交错的箭头逐一离场。每一次点击，都可能为下一条路让出空间。',
        playHref: '/games/arrow/game',
        image: '/games/arrow.png',
        imageAlt: '箭序游戏中由彩色箭头组成的谜题棋盘',
        artwork: 'arrow',
        availability: {available: true, note: '棋盘生成算法尚未解决'},
        mode: '单人',
        duration: '约 3 分钟',
        controls: '点击 / 键盘',
    },
    {
        id: 'find-aemeath',
        index: '02',
        kind: '观察推理',
        title: '寻找爱弥斯',
        englishTitle: 'FIND AEMEATH',
        summary: '在色彩交叠的区域中锁定唯一目标，标记你的判断，在生命耗尽前完成同步。',
        playHref: '/games/find-aemeath/game',
        image: '/games/aemeath-hero.webp',
        portraitImage: '/games/aemeath-portrait.jpg',
        imageAlt: '寻找爱弥斯开始界面的爱弥斯角色背景',
        artwork: 'aemeath',
        availability: {available: true, note: ''},
        mode: '单人',
        duration: '约 4 分钟',
        controls: '点击 / 触摸',
    },
]
