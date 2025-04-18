(function () {
    'use strict';

    /**
     * 正向遍历数组
     * 在回调中返回不为false或void的值主动结束遍历
     * 主动结束遍历 返回true
     * 未主动结束遍历完全部内容 返回false
     * @template T
     * @param {ArrayLike<T>} o
     * @param {function(T, number):(boolean | void)} callback
     * @returns {boolean}
     */
    function forEach(o, callback)
    {
        if (!o)
            return false;
        for (let i = 0, Li = o.length; i < Li; i++)
            if (o[i] != undefined && callback(o[i], i))
                return true;
        return false;
    }

    /**
     * 为绑定回收的钩子
     */
    let unboundHook = new Set();

    /**
     * 所有钩子绑定类
     * @typedef { null |
     *  import("./array/ArrayHookBind").ArrayHookBind | 
     *  import("./map/MapHookBind").MapHookBind | 
     *  import("./object/HookBindValue").HookBindValue | 
     *  import("./object/HookBindCallback").HookBindCallback | 
     *  import("./set/SetHookBind").SetHookBind
     * } AllHookBind
     */

    /**
     * 目标钩子 到 绑定销毁此钩子的对象的数量 映射
     * @type {WeakMap<AllHookBind, number>}
     */
    const hookBindDestroyCountMap = new WeakMap();

    /**
     * 记录器

     * 在目标对象销毁时销毁钩子
     * @type {FinalizationRegistry<AllHookBind>}
     */
    const register = new FinalizationRegistry(heldValue =>
    {
        let hookBindDestroyCount = hookBindDestroyCountMap.get(heldValue);

        if (hookBindDestroyCount >= 2)
            hookBindDestroyCountMap.set(heldValue, hookBindDestroyCount - 1);
        else
            heldValue.destroy();
    });

    /**
     * 钩子绑定销毁
     * 用于在目标对象销毁时销毁钩子
     * @param {object} targetObj 
     * @param {AllHookBind} targetHook 
     */
    function hookBindDestroy(targetObj, targetHook)
    {
        let hookBindDestroyCount = hookBindDestroyCountMap.get(targetHook);

        if (hookBindDestroyCount == undefined)
            hookBindDestroyCount = 0;

        hookBindDestroyCountMap.set(targetHook, hookBindDestroyCount + 1);

        register.register(targetObj, targetHook, targetHook);
    }

    /**
     * 释放钩子绑定销毁
     * 解除 用于销毁钩子的对象 对 钩子 的引用
     * 防止手动销毁钩子时内存泄漏
     * @param {AllHookBind} targetHook
     */
    function freeHookBindDestroy(targetHook)
    {
        register.unregister(targetHook);
    }

    /**
     * 钩子绑定到回调类
     */
    class HookBindCallback
    {
        /**
         * 钩子信息
         * @type {import("./HookBindInfo").HookBindInfo}
         */
        #info = null;

        /**
         * 回调函数的弱引用
         * @type {WeakRef<function(any): void>}
         */
        #cbRef = null;
        /**
         * 回调函数
         * 当此钩子绑定自动释放时为null
         * @type {function(any): void}
         */
        #callback = null;

        /**
         * 目标对象引用映射
         * 用于建立目标对象到指定对象的强引用关系
         * @type {WeakMap<object, Set<object>>}
         */
        #targetRefMap = new WeakMap();

        /**
         * @param {import("./HookBindInfo").HookBindInfo} info
         * @param {function(any): void} callback
         */
        constructor(info, callback)
        {
            this.#info = info;
            this.#cbRef = new WeakRef(callback);
            this.#callback = callback;
            info.addHook(this);

            // 添加调试未绑定探针
            unboundHook.add(this);
        }

        /**
         * 触发此钩子
         */
        emit()
        {
            let callback = this.#cbRef.deref();
            if (callback)
            {
                try
                {
                    callback(this.#info.getValue());
                }
                catch (err)
                {
                    console.error(err);
                }
            }
        }

        /**
         * 销毁此钩子
         * 销毁后钩子将不再自动触发
         */
        destroy()
        {
            this.#info.removeHook(this);
            freeHookBindDestroy(this);

            // 移除调试未绑定探针
            unboundHook.delete(this);
        }

        /**
         * 绑定销毁
         * 当目标对象释放时销毁
         * @param {object} targetObj
         * @returns {HookBindCallback} 返回自身
         */
        bindDestroy(targetObj)
        {
            let targetRefSet = this.#targetRefMap.get(targetObj);
            if (targetRefSet == undefined)
            {
                targetRefSet = new Set();
                this.#targetRefMap.set(targetObj, targetRefSet);
            }
            targetRefSet.add(this.#callback);
            this.#callback = null;
            hookBindDestroy(targetObj, this);

            // 移除调试未绑定探针
            unboundHook.delete(this);

            return this;
        }
    }

    /**
     * 钩子绑定到值类
     */
    class HookBindValue
    {
        /**
         * 钩子信息
         * @type {import("./HookBindInfo").HookBindInfo}
         */
        #info = null;

        /**
         * 目标对象
         * @type {WeakRef<object>}
         */
        #targetRef = null;
        /**
         * 目标对象的键
         * @type {string | symbol}
         */
        #targetKey = "";

        /**
         * @param {import("./HookBindInfo").HookBindInfo} info
         * @param {object} targetObj
         * @param {string | symbol} targetKey
         */
        constructor(info, targetObj, targetKey)
        {
            this.#info = info;
            this.#targetRef = new WeakRef(targetObj);
            this.#targetKey = targetKey;
            info.addHook(this);
            hookBindDestroy(targetObj, this);
        }

        /**
         * 触发此钩子
         * 销毁后仍可通过此方法手动触发
         */
        emit()
        {
            let target = this.#targetRef.deref();
            if (target != undefined)
            {
                try
                {
                    target[this.#targetKey] = this.#info.getValue();
                }
                catch (err)
                {
                    console.error(err);
                }
            }
        }

        /**
         * 销毁此钩子
         * 销毁后钩子将不再自动触发
         */
        destroy()
        {
            this.#info.removeHook(this);
            freeHookBindDestroy(this);
        }
    }

    /**
     * 钩子绑定信息
     */
    class HookBindInfo
    {
        /**
         * 代理对象
         * @type {object}
         */
        #proxyObj = null;
        /**
         * 源对象
         * @type {object}
         */
        #srcObj = null;
        /**
         * 需要监听代理对象上的值
         * @type {Array<string | symbol>}
         */
        #keys = [];
        /**
         * 修改指定值时需要触发的钩子
         * 此值为 hookStatus 文件中 proxyMap 的 hookMap 的引用
         * @type {Map<string | symbol, Set<HookBindValue | HookBindCallback>>}
         */
        #hookMap = null;
        /**
         * 值处理函数
         * 若存在此函数则需要调用
         * @type {function(...any): any} 
         */
        #ctFunc = null;

        /**
         * @param {object} proxyObj
         * @param {object} srcObj
         * @param {Array<string | symbol>} keys
         * @param {Map<string | symbol, Set<HookBindValue | HookBindCallback>>} hookMap
         * @param {function(...any): any} ctFunc
         */
        constructor(proxyObj, srcObj, keys, hookMap, ctFunc)
        {
            this.proxyObj = proxyObj;
            this.#srcObj = srcObj;
            this.#keys = keys;
            this.#hookMap = hookMap;
            this.#ctFunc = ctFunc;
        }

        /**
         * 获取此钩子绑定的值
         */
        getValue()
        {
            return (this.#ctFunc ? this.#ctFunc(...this.#keys.map(o => this.#srcObj[o])) : this.#srcObj[this.#keys[0]]);
        }

        /**
         * 添加钩子
         * @package
         * @param {HookBindValue | HookBindCallback} hookObj
         */
        addHook(hookObj)
        {
            this.#keys.forEach(o =>
            {
                let set = this.#hookMap.get(o);
                if (set == undefined)
                {
                    set = new Set();
                    this.#hookMap.set(o, set);
                }
                set.add(hookObj);
            });
        }

        /**
         * 移除钩子
         * @package
         * @param {HookBindValue | HookBindCallback} hookObj
         */
        removeHook(hookObj)
        {
            this.#keys.forEach(o =>
            {
                let set = this.#hookMap.get(o);
                if (set)
                {
                    set.delete(hookObj);
                    if (set.size == 0)
                        this.#hookMap.delete(o);
                }
            });
        }

        /**
         * 绑定到值
         * @template {Object} T
         * @param {T} targetObj
         * @param {(keyof T) | (string & {}) | symbol} targetKey
         * @returns {HookBindValue}
         */
        bindToValue(targetObj, targetKey)
        {
            return new HookBindValue(this, targetObj, (/** @type {string | symbol} */(targetKey)));
        }

        /**
         * 绑定到回调函数
         * @param {function(any): void} callback
         * @returns {HookBindCallback}
         */
        bindToCallback(callback)
        {
            return new HookBindCallback(this, callback);
        }
    }

    /**
     * Comment节点的封装
     * 用于进行节点定位
     * @typedef {import("./NText").NText} NText
     */
    class NLocate
    {
        /**
         * Comment节点
         * @type {Comment}
         */
        node = null;

        /**
         * @param {Comment} [node]
         */
        constructor(node)
        {
            if (node instanceof Comment)
                this.node = node;
            else
                this.node = new Comment();
        }

        /**
         * 获取父元素
         * @returns {NElement}
         */
        getParent()
        {
            return NElement.byElement(this.node.parentElement);
        }

        /**
         * 在此节点之前插入节点
         * @param {NElement | NLocate | NText} target
         */
        insBefore(target)
        {
            this.node.before(target.node);
        }

        /**
         * 在此节点之后插入节点
         * @param {NElement | NLocate | NText} target
         */
        insAfter(target)
        {
            this.node.after(target.node);
        }

        /**
         * 使用指定节点替换此节点
         * @param {Array<NElement | NText | NLocate>} elements
         */
        replaceWith(...elements)
        {
            this.node.replaceWith(...(elements.map(o => o.node)));
        }
    }

    /**
     * Text节点的封装
     * 用于进行节点定位
     * @typedef {import("./NLocate").NLocate} NLocate
     */
    class NText
    {
        /**
         * Text节点
         * @type {Text}
         */
        node = null;

        /**
         * @param {string | Text} text
         */
        constructor(text)
        {
            if (text instanceof Text)
                this.node = text;
            else
            {
                this.node = new Text();
                if (text)
                    this.setText(text);
            }
        }

        /**
         * 获取父元素
         * @returns {NElement}
         */
        getParent()
        {
            return NElement.byElement(this.node.parentElement);
        }

        /**
         * 设置此文本节点的文本
         * @param {string} text 
         */
        setText(text)
        {
            this.node.data = text;
        }

        /**
         * 在此节点之前插入节点
         * @param {NElement | NLocate | NText} target
         */
        insBefore(target)
        {
            this.node.before(target.node);
        }

        /**
         * 在此节点之后插入节点
         * @param {NElement | NLocate | NText} target
         */
        insAfter(target)
        {
            this.node.after(target.node);
        }

        /**
         * 使用指定节点替换此节点
         * @param {Array<NElement | NText | NLocate>} elements
         */
        replaceWith(...elements)
        {
            this.node.replaceWith(...(elements.map(o => o.node)));
        }
    }

    /**
     * 流水线
     */
    class NAsse
    {
        /**
         * @type {function(import("../node/NElement").NElement): void}
         */
        callback = null;

        /**
         * @param {function(import("../node/NElement").NElement): void} callback
         */
        constructor(callback)
        {
            this.callback = callback;
        }

        /**
         * 将此特征应用于元素
         * @param {import("../node/NElement").NElement} e
         */
        apply(e)
        {
            this.callback(e);
        }
    }

    /**
     * @typedef {(keyof HTMLElement & string) | (string & {})} keyObjectOfHtmlElementAttr
     */
    /**
     * 属性
     * @template {keyObjectOfHtmlElementAttr} T
     */
    class NAttr
    {
        /**
         * @type {T}
         */
        key = null;
        /**
         * 若为函数则应用时调用
         * 若有返回值则赋值到属性
         * @type {string | number | boolean | Function}
         */
        value = null;

        /**
         * @param {T} key
         * @param {string | number | boolean | Function} value
         */
        constructor(key, value)
        {
            this.key = key;
            this.value = value;
        }

        /**
         * 将此特征应用于元素
         * @param {import("../node/NElement").NElement} e
         */
        apply(e)
        {
            if (typeof (this.value) == "function")
            {
                let cbRet = this.value(e);
                if (cbRet != undefined)
                    e.node.setAttribute(this.key, cbRet);
            }
            else
                e.node.setAttribute(this.key, this.value);
        }
    }

    /**
     * 事件
     * @template {keyof HTMLElementEventMap} T
     */
    class NEvent
    {
        /**
         * @type {T}
         */
        eventName = null;
        /**
         * @type {(event: HTMLElementEventMap[T], currentElement: import("../node/NElement").NElement) => void}
         */
        callback = null;

        /**
         * @param {T} key
         * @param {(event: HTMLElementEventMap[T], currentElement: import("../node/NElement").NElement) => void} callback
         */
        constructor(key, callback)
        {
            this.eventName = key;
            this.callback = callback;
        }

        /**
         * 将此特征应用于元素
         * @param {import("../node/NElement").NElement} element
         */
        apply(element)
        {
            element.addEventListener(this.eventName, event =>
            {
                this.callback(event, element);
            });
        }
    }

    /**
     * 快速创建 NEvent 实例
     * @type {{
     *  [x in keyof HTMLElementEventMap]?: (callback: (event: HTMLElementEventMap[x], currentElement: import("../node/NElement").NElement) => void) => NEvent<x>
     * }}
     */
    let eventName = new Proxy({}, {
        get: (_target, key) =>
        {
            return (/** @type {(event: Event , currentElement: import("../node/NElement").NElement<any>) => void} */ callback) =>
            {
                // @ts-ignore
                return new NEvent(key, callback);
            };
        },
        set: () => false
    });

    /**
     * @typedef {(keyof CSSStyleDeclaration & string) | (string & {})} keyOfStyle
     */
    /**
     * 样式
     * @template {keyOfStyle} T
     */
    class NStyle
    {
        /**
         * @type {T}
         */
        key = null;
        /**
         * @type {string | HookBindInfo}
         */
        value = null;

        /**
         * @param {T} key
         * @param {string | HookBindInfo} value
         */
        constructor(key, value)
        {
            this.key = key;
            this.value = value;
        }

        /**
         * 将此特征应用于元素
         * @param {import("../node/NElement.js").NElement} e
         */
        apply(e)
        {
            e.setStyle(this.key, this.value);
        }
    }

    /**
     * 创建一组NStyle的flat NList
     * @param {{ [x in keyOfStyle]?: string | HookBindInfo }} obj
     */
    function createNStyleList(obj)
    {
        return NList.flat(Object.keys(obj).map(key => new NStyle(key, obj[key])));
    }

    /**
     * 标签名
     * 标签名使用小写字母
     * 不包含此类的特征列表默认为div
     * 一层特征列表只能有唯一tagName (或等价的)
     * @template {keyof HTMLElementTagNameMap} T
     */
    class NTagName
    {
        /**
         * @type {T}
         */
        tagName = null;

        /**
         * @param {T} tagName
         */
        constructor(tagName)
        {
            this.tagName = /** @type {T} */(tagName.toLowerCase());
        }
    }

    /**
     * 快速创建 NTagName 实例
     * @type {{
     *  [x in keyof HTMLElementTagNameMap]?: NTagName<x>
     * }}
     */
    let nTagName = new Proxy({}, {
        get: (_target, key) =>
        {
            // @ts-ignore
            return new NTagName(key);
        },
        set: () => false
    });

    /**
     * 特征列表
     * @typedef {Array<string | HookBindInfo | NTagName | NStyle | NAttr | NEvent | NAsse | NList | NList_list | NElement | NText | NLocate | ((e: NElement) => void)>} NList_list
     * @typedef {NList_list[number]} NList_item
     */
    class NList
    {
        /**
         * @type {NList_list}
         */
        list = null;
        /**
         * 拉平特征
         * (默认)标记为false将作为子元素节点
         * 标记为true将作为上层节点的特征列表
         * @type {boolean}
         */
        flatFlag = false;

        /**
         * @param {NList_list} list
         */
        constructor(list)
        {
            this.list = list;
        }

        /**
         * 为元素应用特征列表
         * @param {NElement<HTMLElement>} element
         */
        apply(element)
        {
            const tagName = element.getTagName();
            this.list.forEach(o =>
            {
                if (o == undefined)
                    return;
                if (typeof (o) == "string") // 内部文本
                {
                    element.addText(o);
                }
                else if (typeof (o) == "function") // 流水线函数
                {
                    o(element);
                }
                else if (typeof (o) == "object")
                {
                    switch (Object.getPrototypeOf(o)?.constructor)
                    {
                        case HookBindInfo: { // 子元素或文本
                            element.addChild(/** @type {HookBindInfo} */(o));
                            break;
                        }

                        case NTagName: { // 标签名
                            if (tagName != (/** @type {NTagName} */(o)).tagName)
                                throw "(NList) The feature tagName does not match the element";
                            break;
                        }

                        case NStyle: // 样式
                        case NAttr: // 元素属性
                        case NEvent: // 事件
                        case NAsse: { // 流水线
                            (/** @type {NStyle | NAttr | NEvent | NAsse} */(o)).apply(element);
                            break;
                        }

                        case NElement: // 子元素
                        case NLocate: // 定位节点
                        case NText: { // 子文本节点
                            element.addChild(/** @type {NElement | NLocate | NText} */(o));
                            break;
                        }

                        case NList: { // 子列表
                            const childList = (/** @type {NList} */(o));
                            if (childList.flatFlag) // 子特征(列表)
                                childList.apply(element);
                            else // 子元素(列表)
                                element.addChild(childList.getElement());
                            break;
                        }

                        case Array: { // 子元素(列表)
                            element.addChild(NList.getElement((/** @type {Array} */(o))));
                            break;
                        }

                        default:
                            throw "(NList) Untractable feature types were found";
                    }
                }
                else
                    throw "(NList) Untractable feature types were found";
            });
        }

        /**
         * 获取列表的标签名
         * @returns {string}
         */
        getTagName()
        {
            let ret = "";
            this.list.forEach(o =>
            {
                let tagName = "";
                if (o instanceof NTagName)
                    tagName = o.tagName;
                else if ((o instanceof NList) && o.flatFlag)
                    tagName = o.getTagName();
                if (tagName)
                {
                    if (!ret)
                        ret = tagName;
                    else if (ret != tagName)
                        throw "(NList) Multiple TagNames exist in a feature list";
                }
            });
            return ret;
        }

        /**
         * 获取(生成)元素
         * @returns {NElement}
         */
        getElement()
        {
            let tagName = this.getTagName();
            if (tagName == "")
                tagName = "div";
            let ele = NElement.byElement(document.createElement(tagName));
            this.apply(ele);
            return ele;
        }

        /**
         * 生成拉平列表
         * @param {NList_list} list
         */
        static flat(list)
        {
            let ret = new NList(list);
            ret.flatFlag = true;
            return ret;
        }

        /**
         * 获取(生成)元素
         * @param {NList_list | NList} list
         */
        static getElement(list)
        {
            if (list instanceof NList)
                return list.getElement();
            else
                return (new NList(list)).getElement();
        }
    }

    /**
     * NElement的symbol
     * 用于将NElement绑定到对应的HTMLElement
     */
    const symbolKey = Symbol("NElement");

    /**
     * dom元素的封装
     * @template {HTMLElement} ElementObjectType
     */
    class NElement
    {
        /**
         * 元素对象
         * @readonly
         * @type {ElementObjectType}
         */
        node = null;
        /**
         * 样式名 到 钩子绑定 映射
         * @private
         * @type {Map<string, HookBindValue | HookBindCallback>}
         */
        styleHooks = new Map();

        /**
         * @private
         * @param {ElementObjectType} elementObj
         */
        constructor(elementObj)
        {
            this.node = elementObj;
        }

        /**
         * @returns {ElementObjectType}
         */
        get element()
        {
            return this.node;
        }

        /**
         * 获取父元素
         * @returns {NElement}
         */
        getParent()
        {
            return NElement.byElement(this.node.parentElement);
        }

        /**
         * 添加单个子节点
         * @param {NElement | NLocate | NText | Node | string | HookBindInfo} chi
         */
        addChild(chi)
        {
            if (
                chi instanceof NElement ||
                chi instanceof NLocate ||
                chi instanceof NText
            )
                this.node.appendChild(chi.node);
            else if (chi instanceof Node)
                this.node.appendChild(chi);
            else if (typeof (chi) == "string")
                this.addText(chi);
            else if (chi instanceof HookBindInfo)
            {
                /** @type {NElement | NText | NLocate} */
                let currentNode = null;

                let initVal = chi.getValue();
                currentNode = (initVal == null ? new NLocate() : (typeof (initVal) == "string" ? new NText(initVal) : initVal));
                this.node.appendChild(currentNode.node);

                chi.bindToCallback(val =>
                {
                    if (currentNode instanceof NText && typeof (val) == "string")
                    {
                        currentNode.setText(val);
                        return;
                    }
                    else
                    {
                        let newNode = (val == null ? new NLocate() : (typeof (val) == "string" ? new NText(val) : val));
                        currentNode.replaceWith(newNode);
                        currentNode = newNode;
                    }
                }).bindDestroy(this);
            }
            else
                throw "(NElement) Type of child node that cannot be added";
        }

        /**
         * 添加多个子节点
         * @param {Array<Parameters<NElement["addChild"]>[0] | Array<Parameters<NElement["addChild"]>[0]>>} chi
         */
        addChilds(...chi)
        {
            chi.forEach(o =>
            {
                if (Array.isArray(o))
                    o.forEach(s => this.addChild(s));
                else if (typeof (o) == "object")
                    this.addChild(o);
            });
        }

        /**
         * 插入单个子节点(在中间)
         * 如果此节点之前在树中则先移除后加入
         * @param {NElement | NLocate | NText} chi
         * @param {number | NElement | NLocate | NText} pos 添加到的位置 负数从后到前 超过范围添加到最后
         */
        insChild(chi, pos)
        {
            let e = this.node;
            if (typeof (pos) == "number")
            {
                if (pos >= 0 || pos < e.childElementCount)
                {
                    e.insertBefore(chi.node, e.children[pos]);
                }
                else if (pos < 0 || pos >= (-e.childElementCount))
                {
                    e.insertBefore(chi.node, e.children[e.childElementCount + pos]);
                }
                else
                {
                    e.appendChild(chi.node);
                }
            }
            else
                e.insertBefore(chi.node, pos.node);
        }

        /**
         * 查找子节点在当前节点中的位置
         * 从0开始
         * 不是子节点则返回-1
         * @param {NElement} chi
         * @returns {number}
         */
        childInd(chi)
        {
            let ind = -1;
            forEach(this.node.children, (o, i) =>
            {
                if (o == chi.node)
                {
                    ind = i;
                    return true;
                }
            });
            return ind;
        }

        /**
         * 在此节点之前插入节点
         * @param {NElement | NLocate | NText} target
         */
        insBefore(target)
        {
            this.node.before(target.node);
        }

        /**
         * 在此节点之后插入节点
         * @param {NElement | NLocate | NText} target
         */
        insAfter(target)
        {
            this.node.after(target.node);
        }

        /**
         * 移除此节点
         */
        remove()
        {
            this.node.remove();
        }

        /**
         * 移除此节点的子节点
         * @param {number} [begin] 开始删除的子节点下标 缺省则为从0开始
         * @param {number} [end] 结束删除的子节点下标 不包含end 缺省则为到结尾
         */
        removeChilds(begin = 0, end = Infinity)
        {
            let e = this.node;
            if (end > e.childElementCount)
                end = e.childElementCount;
            for (let i = begin; i < end; i++)
                e.children[begin].remove();
        }

        /**
         * 获取子节点列表
         * 返回的列表不会随dom树变化
         * @returns {Array<NElement>}
         */
        getChilds()
        {
            return Array.from(this.node.children).map(o => NElement.byElement(/** @type {HTMLElement} */(o)));
        }

        /**
         * 获取第ind个子节点
         * @param {number} ind
         * @returns {NElement}
         */
        getChild(ind)
        {
            return NElement.byElement(/** @type {HTMLElement} */(this.node.children[ind]));
        }

        /**
         * 使用指定节点替换此节点
         * @param {Array<NElement | NText | NLocate>} elements
         */
        replaceWith(...elements)
        {
            this.node.replaceWith(...(elements.map(o => o.node)));
        }

        /**
         * 修改样式
         * @param {import("../feature/NStyle.js").keyOfStyle} styleName
         * @param {string | number | HookBindInfo} value
         */
        setStyle(styleName, value)
        {
            if (this.styleHooks.has(styleName))
            {
                this.styleHooks.get(styleName)?.destroy();
                this.styleHooks.delete(styleName);
            }

            if (value instanceof HookBindInfo)
            {
                let hookBind = value.bindToValue(this.node.style, styleName);
                this.styleHooks.set(styleName, hookBind);
                hookBind.emit();
            }
            else
                // @ts-expect-error
                this.node.style[styleName] = value;
        }

        /**
         * 获取样式
         * @param {import("../feature/NStyle.js").keyOfStyle} styleName
         * @returns {string | number}
         */
        getStyle(styleName)
        {
            if (typeof (styleName) == "string")
                return this.node.style[styleName];
        }

        /**
         * 修改多个样式
         * @param {{ [x in (import("../feature/NStyle.js").keyOfStyle)]?: string | number | HookBindInfo }} obj
         */
        setStyles(obj)
        {
            forEach(Object.keys(obj), (key) => { this.setStyle(key, obj[key]); });
        }

        /**
         * 修改文本
         * @param {string} text
         */
        setText(text)
        {
            this.node.innerText = text;
        }

        /**
         * 添加文本
         * @param {string} text
         * @returns {Text}
         */
        addText(text)
        {
            return this.node.appendChild(document.createTextNode(text));
        }

        /**
         * 设置HTMLElement属性
         * @param {string} key
         * @param {string} value
         */
        setAttr(key, value)
        {
            this.node.setAttribute(key, value);
        }

        /**
         * 设置多个HTMLElement属性
         * @param {Object<string, string>} obj
         */
        setAttrs(obj)
        {
            forEach(Object.keys(obj), (key) => { this.setAttr(key, obj[key]); });
        }

        /**
         * 设置元素可见性
         * @param {"block" | "inline" | "flex" | "none" | "inline-block" | string} s
         */
        setDisplay(s)
        {
            this.setStyle("display", s);
        }

        /**
         * 添加事件监听器
         * @template {keyof HTMLElementEventMap} K
         * @param {K} eventName
         * @param {function(HTMLElementEventMap[K]): any} callback
         * @param {boolean | AddEventListenerOptions} [options]
         */
        addEventListener(eventName, callback, options)
        {
            this.node.addEventListener(eventName, callback, options);
        }

        /**
         * 移除事件监听器
         * @param {string} eventName
         * @param {function(Event) : void} callback
         * @param {boolean | EventListenerOptions} [options]
         */
        removeEventListener(eventName, callback, options)
        {
            this.node.removeEventListener(eventName, callback, options);
        }

        /**
         * 执行动画
         * @param {Array<Keyframe> | PropertyIndexedKeyframes} keyframes
         * @param {number | KeyframeAnimationOptions} options
         * @returns {Animation}
         */
        animate(keyframes, options)
        {
            return this.node.animate(keyframes, options);
        }

        /**
         * 执行动画并提交
         * 在执行完成动画后将最后的效果提交到style
         * @param {Array<Keyframe> | PropertyIndexedKeyframes} keyframes
         * @param {number | KeyframeAnimationOptions} options
         * @returns {Promise<void>} 动画执行完后返回
         */
        async animateCommit(keyframes, options)
        {
            if (typeof (options) == "number")
                options = {
                    duration: options,
                    fill: "forwards"
                };
            else
                options = Object.assign({ fill: "forwards" }, options);
            if (options.fill != "forwards" && options.fill != "both")
                throw "(NElelemt) animateCommit can only be used when fill forwards or both";
            let animate = this.node.animate(keyframes, options);
            await animate.finished;

            let errorObject = null;
            try
            {
                animate.commitStyles();
            }
            catch (err)
            {
                errorObject = err;
            }
            animate.cancel();
            if (errorObject != null)
            {
                console.error(errorObject);
            }
        }

        /**
         * 流水线
         * @param {function(NElement): void} asseFunc 流水线函数(无视返回值)
         * @returns {NElement} 返回本身
         */
        asse(asseFunc)
        {
            asseFunc(this);
            return this;
        }

        /**
         * 获取标签名
         * 标签名使用小写字母
         * @returns {keyof HTMLElementTagNameMap}
         */
        getTagName()
        {
            return (/** @type {keyof HTMLElementTagNameMap} */(this.node.tagName.toLowerCase()));
        }

        /**
         * 应用NList到元素
         * @param {NList | ConstructorParameters<typeof NList>[0]} list
         * @returns {NElement} 返回被操作的NElement
         */
        applyNList(list)
        {
            let nList = (list instanceof NList ? list : NList.flat(list));
            nList.apply(this);
            return this;
        }

        /**
         * 根据HTMLElement对象获取NElement对象
         * @template {HTMLElement} ElementObjectType
         * @param {ElementObjectType} element
         * @returns {NElement<ElementObjectType>}
         */
        static byElement(element)
        {
            if (element[symbolKey])
                return element[symbolKey];
            else if (element instanceof NElement)
                return element;
            else
                return element[symbolKey] = new NElement(element);
        }
    }


    /**
     * 根据HTMLElement对象获取NElement对象
     * @template {HTMLElement} ElementObjectType
     * @param {ElementObjectType} element
     * @returns {NElement<ElementObjectType>}
     */
    function getNElement(element)
    {
        return NElement.byElement(element);
    }

    /**
     * 键盘对应表
     */
    let keyNameTable = new Map([
        ["~", "`"],
        ["!", "1"],
        ["@", "2"],
        ["#", "3"],
        ["$", "4"],
        ["%", "5"],
        ["^", "6"],
        ["&", "7"],
        ["*", "8"],
        ["(", "9"],
        [")", "0"],
        ["_", "-"],
        ["+", "="],
        ["{", "["],
        ["}", "]"],
        ["|", "\\"],
        ["\"", "\'"],
        [":", ";"],
        ["<", ","],
        [">", "."],
        ["?", "/"]
    ]);
    const capitalA = "A".charCodeAt(0);
    const lowercaseA = "a".charCodeAt(0);
    for (let i = 0; i < 26; i++)
        keyNameTable.set(String.fromCharCode(capitalA + i), String.fromCharCode(lowercaseA + i));

    /**
     * 代理对象 到 钩子映射和源对象 映射
     * 
     * @type {WeakMap<object, {
     *  hookMap: Map<string | symbol, Set<import("./HookBindValue").HookBindValue | import("./HookBindCallback").HookBindCallback>>,
     *  srcObj: object
     * }>}
     */
    const proxyMap = new WeakMap();

    /**
     * 创建对象的代理
     * @template {object} T
     * @param {T} srcObj
     * @returns {T}
     */
    function createHookObj(srcObj)
    {
        if (proxyMap.has(srcObj)) // 已经是代理对象
            throw "Unable to create a proxy for a proxy object";
        /**
         * 修改指定值时需要触发的钩子
         * @type {Map<string | symbol, Set<HookBindValue | HookBindCallback>>}
         */
        const hookMap = new Map();
        const proxyObj = (new Proxy((/** @type {object} */(srcObj)), {
            get: (target, key) => // 取值
            {
                return Reflect.get(target, key);
            },

            set: (target, key, newValue) => // 设置值
            {
                let ret = Reflect.set(target, key, newValue);
                if (ret)
                {
                    let hookSet = hookMap.get(key);
                    if (hookSet) // 若此key上存在钩子集合
                    {
                        hookSet.forEach(o =>
                        {
                            o.emit(); // 触发每个钩子
                        });
                    }
                }
                return ret;
            },

            // TODO 应当当作设置为undefined 并创建专用方法解除绑定钩子
            deleteProperty: (target, key) => // 删除值
            {
                let ret = Reflect.deleteProperty(target, key);
                if (ret)
                {
                    let hookSet = hookMap.get(key);
                    if (hookSet) // 若此key上存在钩子集合
                    {
                        hookSet.forEach(o =>
                        {
                            o.destroy(); // 销毁每个钩子
                        });
                        hookMap.delete(key); // 移除此key上的钩子集合
                    }
                }
                return ret;
            }
        }));
        proxyMap.set(proxyObj, { hookMap, srcObj });
        return proxyObj;
    }

    /**
     * 获取代理对象中指定值的绑定信息
     * @template {Object} T
     * @param {T} proxyObj
     * @param {[(keyof T) | (string & {}) | symbol] | [((keyof T) | (string & {}) | symbol), ...Array<(keyof T) | (string & {}) | symbol>, function(...any): any]} keys
     * @returns {HookBindInfo}
     */
    function bindValue(proxyObj, ...keys)
    {
        const ctFunc = (/** @type {function(...any): any} */(keys.length >= 2 ? keys.pop() : null));
        const proxyMata = proxyMap.get(proxyObj);
        if (proxyMata == undefined)
            throw "bindValue: Values can only be bound from proxy objects";
        return new HookBindInfo(proxyObj, proxyMata.srcObj, (/** @type {Array<string | symbol>}*/(keys)), proxyMata.hookMap, ctFunc);
    }

    /**
     * 异步延迟
     * 将创建一个Promise并在指定延迟时间后解决
     * @param {number} time 单位:毫秒
     * @returns {Promise<void>}
     */
    function delayPromise(time)
    {
        return (new Promise((resolve) =>
        {
            setTimeout(() =>
            {
                resolve();
            }, time);
        }));
    }

    let body = getNElement(document.body);

    /**
     * 显示收藏夹页面
     */
    function showFavoritePage()
    {
        let page = NList.getElement([
            createNStyleList({
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
                createNStyleList({
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

    /**
     * 显示播放器页面
     * @param {string} bvid
     */
    function showPlayerPage(bvid)
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
            createNStyleList({
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
                createNStyleList({
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
                    createNStyleList({
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
                    createNStyleList({
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
                createNStyleList({
                    position: "absolute",
                    left: "0",
                    width: "100%",
                    top: "320px",
                    bottom: "0px",
                    backgroundColor: "rgb(45, 45, 45)",
                }),

                [ // 视频信息
                    createNStyleList({
                        margin: "5px"
                    }),
                    [
                        bindValue(dataInfo, "upperName"),
                        createNStyleList({
                            fontSize: "0.7em",
                            color: "rgb(190, 190, 190)"
                        }),
                    ],
                    [
                        bindValue(dataInfo, "title")
                    ],
                    [
                        bindValue(dataInfo, "describe"),
                        createNStyleList({
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
    function showListPage(title, getList)
    {
        /**
         * @type {() => void}
         */
        let refresh = null;

        let page = NList.getElement([
            createNStyleList({
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
                createNStyleList({
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
                createNStyleList({
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
                                    createNStyleList({
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
                                        createNStyleList({
                                            width: "200px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginLeft: "5px"
                                        }),
                                        [
                                            nTagName.img,
                                            new NAttr("src", o.cover),
                                            createNStyleList({
                                                maxHeight: "100%",
                                                maxWidth: "100%"
                                            })
                                        ]
                                    ],
                                    [ // 右侧文本
                                        createNStyleList({
                                            marginLeft: "15px",
                                            marginRight: "5px"
                                        }),
                                        [
                                            o.title
                                        ],
                                        [
                                            o.upperName,
                                            createNStyleList({
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
                    }                setTimeout(refreshListElement, 100);

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

    /**
     * 显示主页
     */
    function showHomePage()
    {
        let page = NList.getElement([
            createNStyleList({
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
                createNStyleList({
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
                createNStyleList({
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
                        createNStyleList({
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
                createNStyleList({
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

        body.addChild(NList.getElement([
            createNStyleList({
                position: "fixed",
                top: "0",
                left: "0",
                height: "100%",
                width: "100%",
                backgroundColor: "rgb(230, 230, 230)",
                zIndex: "9999999"
            })
        ]));

        await delayPromise(100);
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
            await delayPromise(1800);
            body.removeChilds();
            showHomePage();
        }
    })();

})();
