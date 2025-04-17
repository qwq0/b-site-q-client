import { eventName, NAttr, NElement, NList, nTagName, NTagName, styles } from "../../lib/qwqframe.js";
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
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
            }),
        ]
    ]);

    body.addChild(page);


    (async () =>
    {
        try
        {
            let info = await (await fetch(`https://api.bilibili.com/x/web-interface/wbi/view?bvid=${bvid}`)).json();
            let cid = info.data.cid;
            let videostream = await (await fetch(`https://api.bilibili.com/x/player/wbi/playurl?bvid=${bvid}&cid=${cid}&qn=116&fnver=0&fnval=1`)).json();
            video.element.src = videostream.data.durl[0].url;



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