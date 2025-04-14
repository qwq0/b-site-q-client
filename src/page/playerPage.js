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
                backgroundColor: "rgb(45, 45, 45)",
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
                ele => { video = ele; }
            ]
        ],

        [ // 播放器以下内容
        ]
    ]);

    body.addChild(page);


    (async () =>
    {
        try
        {
            let info = await (await fetch(`https://api.bilibili.com/x/web-interface/wbi/view?bvid=${bvid}`)).json();
            let videostream = await (await fetch(`https://api.bilibili.com/x/player/wbi/playurl?bvid=${bvid}&cid=${info.data.cid}&qn=116&fnver=0&fnval=1`)).json();
            video.element.src = videostream.data.durl[0].url;
        }
        catch (err)
        {
            console.error(err);
        }
    })();
}