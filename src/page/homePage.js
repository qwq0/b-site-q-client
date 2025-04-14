import { NList, styles } from "../../lib/qwqframe.js";
import { body } from "../ui/body.js";

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
        }),

        "欢迎回来~"
    ]);

    body.addChild(page);
}