import { eventName, NList, styles } from "../../lib/qwqframe.js";
import { body } from "../ui/body.js";
import { showFavoritePage } from "./favoritePage.js";
import { showListPage } from "./ListPage.js";
import { showPlayerPage } from "./playerPage.js";

/**
 * 显示主页
 */
export function showHomePage()
{
    let page = NList.getElement([
        styles({
            position: "fixed",
            top: "0",
            left: "0",
            height: "100%",
            width: "100%",
            backgroundColor: "rgb(10, 10, 10)",
            color: "rgb(245, 245, 245)",
            fontSize: "1.6em"
        }),

        [ // 顶栏
            styles({
                position: "absolute",
                top: "0",
                left: "0",
                height: "60px",
                width: "100%",
                backgroundColor: "rgb(45, 45, 45)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }),
            "这里将会有一个搜索框(TODO)",
        ],

        [ // 中间内容
            styles({
                position: "absolute",
                top: "60px",
                bottom: "60px",
                left: "0",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: "40px"
            }),
            [],
            ...([
                {
                    text: "收藏夹",
                    cb: () => { showFavoritePage(); }
                },
                {
                    text: "稍后再看",
                    cb: () =>
                    {
                        showListPage("稍后再看", async (pageIndex) =>
                        {
                            try
                            {
                                if (pageIndex >= 1)
                                    return [];
                                let info = await (await fetch(
                                    "https://api.bilibili.com/x/v2/history/toview",
                                    {
                                        credentials: "include"
                                    }
                                )).json();
                                /** @type {Array<Object>} */
                                let list = info.data.list;
                                return list.map(o => ({
                                    title: o.title,
                                    bvid: o.bvid,
                                    upperName: o.owner.name,
                                    cover: o.pic
                                }));
                            }
                            catch (err)
                            {
                                console.log(err);
                                return [];
                            }
                        });
                    }
                },
                {
                    text: "历史记录",
                    cb: () =>
                    {
                        showListPage("历史记录", async (pageIndex) =>
                        {
                            try
                            {
                                if (pageIndex >= 1)
                                    return [];
                                let info = await (await fetch(
                                    "https://api.bilibili.com/x/web-interface/history/cursor?view_at=0&type=archive&ps=20",
                                    {
                                        credentials: "include"
                                    }
                                )).json();
                                /** @type {Array<Object>} */
                                let list = info.data.list;
                                return list.map(o => ({
                                    title: o.title,
                                    bvid: o.bvid,
                                    upperName: o.author_name,
                                    cover: o.cover
                                }));
                            }
                            catch (err)
                            {
                                console.log(err);
                                return [];
                            }
                        });
                    }
                },
                {
                    text: "推荐视频",
                    cb: () =>
                    {
                        showListPage("推荐视频", async (pageIndex) =>
                        {
                            return [];
                        });
                    }
                },
                {
                    text: "打开BV号",
                    cb: () => { showPlayerPage(prompt("bvid")); }
                }
            ].map(o =>
            {
                return [
                    styles({
                        width: "80%",
                        height: "80px",
                        backgroundColor: "rgb(65, 65, 65)",
                        borderRadius: "8px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                    }),
                    o.text,
                    eventName.click(() =>
                    {
                        o.cb();
                    })
                ];
            }))
        ],

        [ // 底栏
            styles({
                position: "absolute",
                bottom: "0",
                left: "0",
                height: "60px",
                width: "100%",
                backgroundColor: "rgb(45, 45, 45)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }),
            "由 QwQ0 使用 ❤ 制作"
        ]
    ]);

    body.addChild(page);
}