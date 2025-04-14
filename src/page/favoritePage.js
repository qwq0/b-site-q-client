import { eventName, NList, styles } from "../../lib/qwqframe.js";
import { body } from "../ui/body.js";

/**
 * 显示收藏夹页面
 */
export function showFavoritePage()
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
                "收藏夹"
            ],

            []
        ],

        [ // 中间内容
        ]
    ]);

    body.addChild(page);
}