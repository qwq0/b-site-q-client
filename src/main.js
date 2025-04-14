import { delayPromise, getNElement } from "../lib/qwqframe.js";
import { showHomePage } from "./page/homePage.js";
import { body } from "./ui/body.js";


async function showLoginPage()
{
    // @ts-ignore
    document.getElementsByClassName("header-login-entry")[0].click();
    await delayPromise(1000);
    Array.from(document.getElementsByClassName("bili-mini-content-wp")).forEach(o =>
    {
        // @ts-ignore
        getNElement(o).setStyles({
            height: "100%",
            width: "100%",
            flexDirection: "column"
        });
    });
}


(async () =>
{
    if (window["bsqcIjFlag"])
        return;

    window["bsqcIjFlag"] = {};

    // @ts-ignore
    navigator.sendBeacon = (a, b) => { return true; };

    /** @type {typeof fetch} */
    let oldFetch = window.fetch.bind(window);

    window.fetch = async (...param) =>
    {
        if (
            typeof (param[0]) == "string" &&
            (
                param[0].startsWith("https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd") ||
                param[0].startsWith("https://api.bilibili.com/x/web-interface/index/top/feed/rcmd") ||
                param[0].startsWith("//api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd") ||
                param[0].startsWith("//api.bilibili.com/x/web-interface/index/top/feed/rcmd")
            )
        )
        {
            // @ts-ignore
            let response = await oldFetch(...param);

            if (!response.ok)
                return response;

            try
            {
                let jsonText = await (response.clone()).text();
                /**
                     * @type {{
                     *  data: {
                     *      item: Array<{
                     *          goto: string
                     *      }>
                     *  }
                     * }}
                     */
                let dataObj = JSON.parse(jsonText);
                dataObj.data.item = dataObj.data.item.filter(o => o.goto != "ad");
                return Response.json(dataObj);
            }
            catch (err)
            {
                console.error("Filter agent error, fallen back to original data.", err);
                return response;
            }
        }
        if (
            typeof (param[0]) == "string" &&
            (
                param[0].startsWith("https://data.bilibili.com/log/web?") ||
                param[0].startsWith("//data.bilibili.com/log/web?") ||
                param[0].startsWith("https://data.bilibili.com/v2/log/web?") ||
                param[0].startsWith("//data.bilibili.com/v2/log/web?")
            )
        )
        {
            return new Promise(() => { });
        }
        else
        {
            // @ts-ignore
            return oldFetch(...param);
        }
    };

    if (document.readyState == "loading")
        await (new Promise((resolve) =>
        {
            document.addEventListener("load", () => { resolve(); });
        }));


    await delayPromise(1100);
    if (!window["UserStatus"]?.userInfo?.isLogin)
    {
        console.log("未登录");
        showLoginPage();

        setInterval(() =>
        {
            if (window["UserStatus"]?.userInfo?.isLogin)
            {
                location.reload();
            }
        }, 1000);
    }
    else
    {
        console.log("已登录");
        await delayPromise(1100);
        body.removeChilds();
        showHomePage();
    }
})();