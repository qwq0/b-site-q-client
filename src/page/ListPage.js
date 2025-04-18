import { eventName, NAttr, NList, nTagName, styles } from "../../lib/qwqframe.js";
import { body } from "../ui/body.js";
import { showPlayerPage } from "./playerPage.js";

/**
 * 显示视频列表页面
 * @param {string} title
 * @param {(pageIndex: number) => Promise<Array<{
 *  title: string,
 *  upperName: string,
 *  bvid: string,
 *  cover: string
 * }>>} getList
 */
export function showListPage(title, getList)
{
    /**
     * @type {() => void}
     */
    let refresh = null;

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
                alignItems: "center",
                justifyContent: "space-between"
            }),

            [
                "< 返回",
                eventName.click(() =>
                {
                    page.remove();
                })
            ],

            [
                title
            ],

            [
                "刷新",
                eventName.click(() =>
                {
                    refresh();
                })
            ]
        ],

        [ // 中间内容
            styles({
                position: "absolute",
                left: "0",
                top: "60px",
                bottom: "0px",
                width: "100%",
                backgroundColor: "rgb(10, 10, 10)",
                overflowY: "auto"
            }),

            ele =>
            {
                let isEnd = false;
                let nowPageIndex = -1;
                let tryLoadId = "";
                ele.addEventListener("scroll", () =>
                {
                    if (ele.element.scrollTop + ele.element.offsetHeight + 20 >= ele.element.scrollHeight)
                    {
                        if (!isEnd)
                            refreshListElement();
                    }
                });
                async function refreshListElement()
                {
                    if (tryLoadId != "")
                        return;

                    let loadId = Math.floor(Math.random() * 100000000).toString(16);
                    tryLoadId = loadId;

                    nowPageIndex++;
                    console.log(`正在获取列表 page=${nowPageIndex}`);
                    let listInfo = await getList(nowPageIndex);
                    if (tryLoadId != loadId)
                        return;

                    if (listInfo.length)
                    {
                        for (let o of listInfo)
                        {
                            ele.addChild(NList.getElement([ // 列表项
                                styles({
                                    borderBottom: "1px solid rgba(245, 245, 245, 0.2)",
                                    height: "120px",
                                    borderRadius: "3px",
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "stretch",
                                    justifyContent: "flex-start"
                                }),
                                [ // 左侧封面
                                    styles({
                                        width: "200px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginLeft: "5px"
                                    }),
                                    [
                                        nTagName.img,
                                        new NAttr("src", o.cover),
                                        styles({
                                            maxHeight: "100%",
                                            maxWidth: "100%"
                                        })
                                    ]
                                ],
                                [ // 右侧文本
                                    styles({
                                        marginLeft: "15px",
                                        marginRight: "5px"
                                    }),
                                    [
                                        o.title
                                    ],
                                    [
                                        o.upperName,
                                        styles({
                                            fontSize: "0.8em",
                                            color: "rgb(190, 190, 190)"
                                        })
                                    ],
                                ],
                                eventName.click(() =>
                                {
                                    showPlayerPage(o.bvid);
                                })
                            ]));
                        }
                    }
                    else
                    {
                        isEnd = true;
                    }

                    tryLoadId = "";
                };
                setTimeout(refreshListElement, 100);

                refresh = () =>
                {
                    tryLoadId = "";
                    nowPageIndex = -1;
                    isEnd = false;
                    ele.removeChilds();
                    refreshListElement();
                };
            }
        ]
    ]);

    body.addChild(page);
}