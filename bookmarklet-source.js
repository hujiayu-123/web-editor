/**
 * 网页随心改 - 书签小工具源代码
 * 
 * 使用方法:
 * 1. 将此代码压缩后放入书签的URL中,格式为: javascript:(压缩后的代码)
 * 2. 或者直接使用 bookmarklet.html 中的安装按钮
 * 
 * 功能:
 * - 点击任意元素编辑文字、颜色、大小等
 * - 删除或隐藏元素
 * - 撤销/重做操作
 * - 支持任何网站
 */

(function() {
    // 防止重复加载
    if (window.webPageEditor) {
        alert('编辑器已经在运行中!');
        return;
    }

    // 注入样式
    const style = document.createElement('style');
    style.textContent = `
        /* 侧边编辑面板 - 支持左右智能定位 */
        #webPageEditorPanel {
            position: fixed;
            top: 0;
            width: 400px;
            height: 100vh;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
            z-index: 2147483647;
            transition: all 0.3s;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* 右侧定位 */
        #webPageEditorPanel.position-right {
            right: -400px;
        }

        #webPageEditorPanel.position-right.open {
            right: 0;
        }

        /* 左侧定位 */
        #webPageEditorPanel.position-left {
            left: -400px;
        }

        #webPageEditorPanel.position-left.open {
            left: 0;
        }

        /* 浮动工具栏 */
        #webPageEditorToolbar {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 15px;
            border-radius: 50px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            z-index: 2147483646;
            display: flex;
            gap: 10px;
        }

        #webPageEditorToolbar button {
            background: rgba(255,255,255,0.9);
            border: none;
            width: 45px;
            height: 45px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 20px;
            transition: all 0.3s;
        }

        #webPageEditorToolbar button:hover {
            background: white;
            transform: scale(1.1);
        }

        #webPageEditorToolbar button.active {
            background: #ffd700;
            transform: scale(1.15);
        }

        /* 可编辑元素样式 */
        .wpe-editable:hover {
            outline: 2px dashed #667eea !important;
            outline-offset: 2px;
            cursor: pointer !important;
        }

        .wpe-selected {
            outline: 3px solid #667eea !important;
            outline-offset: 2px;
            background: rgba(102, 126, 234, 0.1) !important;
        }

        /* 面板内容样式 */
        #webPageEditorPanel h3 {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            margin: 0;
            font-size: 18px;
        }

        #webPageEditorPanel .control-group {
            padding: 15px;
            border-bottom: 1px solid #eee;
        }

        #webPageEditorPanel label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }

        #webPageEditorPanel input,
        #webPageEditorPanel textarea,
        #webPageEditorPanel select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
        }

        #webPageEditorPanel textarea {
            min-height: 80px;
            resize: vertical;
        }

        #webPageEditorPanel input[type="color"] {
            height: 45px;
            cursor: pointer;
        }

        #webPageEditorPanel button.delete-btn {
            width: 100%;
            padding: 12px;
            background: #ff4757;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
        }

        #webPageEditorPanel button.delete-btn:hover {
            background: #ff3838;
        }
    `;
    document.head.appendChild(style);

    // 创建工具栏
    const toolbar = document.createElement('div');
    toolbar.id = 'webPageEditorToolbar';
    toolbar.innerHTML = `
        <button id="wpeToggleEdit" title="切换编辑模式">✏️</button>
        <button id="wpeUndo" title="撤销">↶</button>
        <button id="wpeRedo" title="重做">↷</button>
        <button id="wpeScreenshot" title="截图">📸</button>
        <button id="wpeClose" title="关闭编辑器">✖️</button>
    `;
    document.body.appendChild(toolbar);

    // 创建侧边面板
    const panel = document.createElement('div');
    panel.id = 'webPageEditorPanel';
    panel.innerHTML = `
        <h3>编辑属性</h3>
        <div id="wpeContent" style="padding: 20px; color: #999; text-align: center;">
            点击页面元素开始编辑
        </div>
    `;
    document.body.appendChild(panel);

    // 状态变量
    let editMode = true;
    let selectedElement = null;
    let history = [];
    let historyIndex = -1;

    // 保存历史状态
    function saveState() {
        history = history.slice(0, historyIndex + 1);
        history.push(document.body.innerHTML);
        historyIndex++;
        // 限制历史记录数量
        if (history.length > 50) {
            history.shift();
            historyIndex--;
        }
    }

    // 初始化历史
    saveState();

    // RGB转HEX
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
        const result = rgb.match(/\d+/g);
        if (!result) return '#000000';
        return '#' + result.slice(0, 3).map(x => {
            const hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    // 更新编辑面板
    function updatePanel(element) {
        const style = window.getComputedStyle(element);
        
        let html = '<div class="control-group">';
        
        // 文本内容
        html += `
            <label>文本内容:</label>
            <textarea id="wpeText">${element.textContent}</textarea>
        `;

        // 字体大小
        html += `
            <label style="margin-top: 15px;">字体大小(px):</label>
            <input type="number" id="wpeFontSize" value="${parseInt(style.fontSize)}" min="8" max="200">
        `;

        // 文字颜色
        html += `
            <label style="margin-top: 15px;">文字颜色:</label>
            <input type="color" id="wpeColor" value="${rgbToHex(style.color)}">
        `;

        // 背景颜色
        html += `
            <label style="margin-top: 15px;">背景颜色:</label>
            <input type="color" id="wpeBgColor" value="${rgbToHex(style.backgroundColor)}">
        `;

        // 字体粗细
        html += `
            <label style="margin-top: 15px;">字体粗细:</label>
            <select id="wpeFontWeight">
                <option value="normal" ${style.fontWeight === '400' ? 'selected' : ''}>正常</option>
                <option value="bold" ${style.fontWeight === '700' ? 'selected' : ''}>粗体</option>
                <option value="lighter">细体</option>
            </select>
        `;

        // 文字对齐
        html += `
            <label style="margin-top: 15px;">文字对齐:</label>
            <select id="wpeTextAlign">
                <option value="left" ${style.textAlign === 'left' ? 'selected' : ''}>左对齐</option>
                <option value="center" ${style.textAlign === 'center' ? 'selected' : ''}>居中</option>
                <option value="right" ${style.textAlign === 'right' ? 'selected' : ''}>右对齐</option>
            </select>
        `;

        // 删除和隐藏按钮
        html += `
            <button class="delete-btn" id="wpeDelete">🗑️ 删除元素</button>
            <button class="delete-btn" id="wpeHide" style="background: #ffa502; margin-top: 5px;">👁️ 隐藏元素</button>
        `;

        html += '</div>';
        
        document.getElementById('wpeContent').innerHTML = html;

        // 绑定事件
        document.getElementById('wpeText').addEventListener('input', function() {
            element.textContent = this.value;
            saveState();
        });

        document.getElementById('wpeFontSize').addEventListener('input', function() {
            element.style.fontSize = this.value + 'px';
            saveState();
        });

        document.getElementById('wpeColor').addEventListener('input', function() {
            element.style.color = this.value;
            saveState();
        });

        document.getElementById('wpeBgColor').addEventListener('input', function() {
            element.style.backgroundColor = this.value;
            saveState();
        });

        document.getElementById('wpeFontWeight').addEventListener('change', function() {
            element.style.fontWeight = this.value;
            saveState();
        });

        document.getElementById('wpeTextAlign').addEventListener('change', function() {
            element.style.textAlign = this.value;
            saveState();
        });

        document.getElementById('wpeDelete').addEventListener('click', function() {
            if (confirm('确定删除这个元素?')) {
                element.remove();
                panel.classList.remove('open');
                selectedElement = null;
                saveState();
            }
        });

        document.getElementById('wpeHide').addEventListener('click', function() {
            element.style.display = 'none';
            panel.classList.remove('open');
            selectedElement = null;
            saveState();
        });
    }

    // 处理点击事件
    function handleClick(e) {
        if (!editMode) return;
        
        // 忽略工具栏和面板的点击
        if (e.target.closest('#webPageEditorPanel') || 
            e.target.closest('#webPageEditorToolbar')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // 取消之前的选择
        if (selectedElement) {
            selectedElement.classList.remove('wpe-selected');
        }

        // 选择新元素
        selectedElement = e.target;
        selectedElement.classList.add('wpe-selected', 'wpe-editable');

        // 打开面板
        panel.classList.add('open');
        updatePanel(selectedElement);
    }

    // 重新绑定事件(用于撤销/重做后)
    function rebindEvents() {
        document.removeEventListener('click', handleClick, true);
        document.addEventListener('click', handleClick, true);
        
        // 重新获取元素引用
        const toolbar = document.getElementById('webPageEditorToolbar');
        const panel = document.getElementById('webPageEditorPanel');
        
        // 重新绑定工具栏按钮
        document.getElementById('wpeToggleEdit').addEventListener('click', function() {
            editMode = !editMode;
            this.classList.toggle('active');
            if (!editMode) {
                panel.classList.remove('open');
                if (selectedElement) {
                    selectedElement.classList.remove('wpe-selected');
                    selectedElement = null;
                }
            }
            alert(editMode ? '编辑模式已开启' : '编辑模式已关闭');
        });

        document.getElementById('wpeUndo').addEventListener('click', function() {
            if (historyIndex > 0) {
                historyIndex--;
                document.body.innerHTML = history[historyIndex];
                rebindEvents();
            }
        });

        document.getElementById('wpeRedo').addEventListener('click', function() {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                document.body.innerHTML = history[historyIndex];
                rebindEvents();
            }
        });

        document.getElementById('wpeClose').addEventListener('click', function() {
            if (confirm('确定要关闭编辑器吗?')) {
                toolbar.remove();
                panel.remove();
                style.remove();
                window.webPageEditor = null;
            }
        });
    }

    // 工具栏按钮事件
    document.getElementById('wpeToggleEdit').addEventListener('click', function() {
        editMode = !editMode;
        this.classList.toggle('active');
        if (!editMode) {
            panel.classList.remove('open');
            if (selectedElement) {
                selectedElement.classList.remove('wpe-selected');
                selectedElement = null;
            }
        }
        alert(editMode ? '编辑模式已开启' : '编辑模式已关闭');
    });

    document.getElementById('wpeUndo').addEventListener('click', function() {
        if (historyIndex > 0) {
            historyIndex--;
            document.body.innerHTML = history[historyIndex];
            rebindEvents();
        }
    });

    document.getElementById('wpeRedo').addEventListener('click', function() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            document.body.innerHTML = history[historyIndex];
            rebindEvents();
        }
    });

    document.getElementById('wpeScreenshot').addEventListener('click', function() {
        alert('截图功能提示:\n\n1. 使用浏览器自带截图(推荐)\n2. 或使用 Ctrl/Cmd + Shift + S\n3. 或使用系统截图工具');
    });

    document.getElementById('wpeClose').addEventListener('click', function() {
        if (confirm('确定要关闭编辑器吗?所有修改将保留在当前页面。')) {
            toolbar.remove();
            panel.remove();
            style.remove();
            // 清理所有添加的类
            document.querySelectorAll('.wpe-editable, .wpe-selected').forEach(el => {
                el.classList.remove('wpe-editable', 'wpe-selected');
            });
            window.webPageEditor = null;
        }
    });

    // 监听点击事件(捕获阶段)
    document.addEventListener('click', handleClick, true);

    // 标记编辑器已加载
    window.webPageEditor = true;

    // 显示欢迎消息
    alert('✅ 网页编辑器已启动!\n\n点击页面上的任意元素开始编辑。\n\n提示:刷新页面后修改会消失,请及时截图保存!');
})();

