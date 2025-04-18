import { bindValue, createHookObj, eventName, NAttr, NElement, NList, nTagName, NTagName, styles } from "../../lib/qwqframe.js";
import { body } from "../ui/body.js";

/**
 * 显示播放器页面
 * @param {string} bvid
 */
export function showPlayerPage(bvid)
{
    /**
     * @type {NElement<HTMLVideoElement>}
     */
    let video = null;

    /**
     * @type {Array<{
     *  start: number,
     *  end: number,
     *  text: string
     * }>}
     */
    let skipSeg = [];

    let lastUpdateTime = 0;


    let dataInfo = createHookObj({
        viewCount: 0,
        likesCount: 0,
        coinsCount: 0,
        favoriteCount: 0,
        title: "",
        describe: "",
        upperName: "",
        skipCount: 0
    });

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

        [ // 播放器
            styles({
                position: "absolute",
                top: "0",
                left: "0",
                height: "320px",
                width: "100%",
                backgroundColor: "rgb(10, 10, 10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
            }),

            [
                nTagName.video,
                new NAttr("autoplay", "true"),
                new NAttr("controls", "true"),
                styles({
                    width: "100%",
                    height: "100%"
                }),
                ele => { video = ele; },
                eventName.timeupdate(o =>
                {
                    if (Math.abs(video.node.currentTime - lastUpdateTime) > 0.2)
                    {
                        let currentTime = video.node.currentTime;
                        lastUpdateTime = currentTime;
                        for (let o of skipSeg)
                        {
                            if (o.start + 0.5 < currentTime && currentTime < o.end - 1)
                            {
                                video.node.currentTime = o.end - 0.5;
                                break;
                            }
                        }
                    }
                })
            ],

            [ // 返回按钮
                styles({
                    position: "absolute",
                    top: "0",
                    left: "0",
                    height: "45px",
                    width: "45px",
                    backgroundColor: "rgba(70, 70, 70, 0.1)",
                }),
                eventName.click(() =>
                {
                    page.remove();
                })
            ]
        ],

        [ // 播放器以下内容
            styles({
                position: "absolute",
                left: "0",
                width: "100%",
                top: "320px",
                bottom: "0px",
                backgroundColor: "rgb(45, 45, 45)",
            }),

            [ // 视频信息
                styles({
                    margin: "5px"
                }),
                [
                    bindValue(dataInfo, "upperName"),
                    styles({
                        fontSize: "0.7em",
                        color: "rgb(190, 190, 190)"
                    }),
                ],
                [
                    bindValue(dataInfo, "title")
                ],
                [
                    bindValue(dataInfo, "describe"),
                    styles({
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "normal",
                        width: "100%",
                        height: "40px",
                        minHeight: "40px",
                        fontSize: "0.8em"
                    }),

                    ele =>
                    {
                        let expandedDescription = false;
                        ele.addEventListener("click", o =>
                        {
                            if (expandedDescription)
                            {
                                expandedDescription = false;
                                ele.setStyles({
                                    height: "40px",
                                    whiteSpace: "normal"
                                });
                            }
                            else
                            {
                                expandedDescription = true;
                                ele.setStyles({
                                    height: "fit-content",
                                    whiteSpace: "pre-wrap"
                                });
                            }
                        });
                    }
                ],
                [
                    ` 播放量: `,
                    bindValue(dataInfo, "viewCount", o => String(o)),
                    ` 点赞: `,
                    bindValue(dataInfo, "likesCount", o => String(o)),
                    ` 硬币: `,
                    bindValue(dataInfo, "coinsCount", o => String(o)),
                    ` 收藏: `,
                    bindValue(dataInfo, "favoriteCount", o => String(o)),
                ],
                [
                    ` 跳过片段数: `,
                    bindValue(dataInfo, "skipCount", o => String(o))
                ]
            ]
        ]
    ]);

    body.addChild(page);


    (async () =>
    {
        try
        {
            let info = await (await fetch(`https://api.bilibili.com/x/web-interface/wbi/view?bvid=${bvid}`)).json();
            let infoData = info.data;
            let cid = infoData.cid;
            let videostream = await (await fetch(`https://api.bilibili.com/x/player/wbi/playurl?bvid=${bvid}&cid=${cid}&qn=116&fnver=0&fnval=1`)).json();
            video.element.src = videostream.data.durl[0].url;

            dataInfo.title = infoData.title;
            dataInfo.describe = infoData.desc;
            dataInfo.upperName = infoData.owner.name;
            dataInfo.viewCount = infoData.stat.view;
            dataInfo.likesCount = infoData.stat.like;
            dataInfo.coinsCount = infoData.stat.coin;
            dataInfo.favoriteCount = infoData.stat.favorite;

            try
            {
                /**
                 * @type {Array<Object>}
                 */
                let segmentInfo = await (await fetch(`https://bsbsb.top/api/skipSegments?videoID=${bvid}`)).json();
                segmentInfo.forEach(o =>
                {
                    if (o.cid == cid)
                    {
                        if (o.category == "sponsor")
                        {
                            skipSeg.push({
                                start: o.segment[0],
                                end: o.segment[1],
                                text: "赞助广告"
                            });
                        }
                    }
                });
                dataInfo.skipCount = skipSeg.length;
                console.log("获取到信息");
            }
            catch (err)
            {
                console.error(err);
                console.log("未获取到信息");
            }
        }
        catch (err)
        {
            console.error(err);
        }
    })();
}