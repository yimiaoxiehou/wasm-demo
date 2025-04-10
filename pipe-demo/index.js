// 初始化Go WASM运行时环境
const go = new Go(); // 定义在wasm_exec.js中，别忘了在index.html中添加

// WASM模块实例化函数
export const wasmBrowserInstantiate = async (wasmModuleUrl, importObject) => {
    let response = undefined;
  
    // 如果没有提供导入对象，创建默认的
    if (!importObject) {
      importObject = {
        env: {
          abort: () => console.log("Abort!")
        }
      };
    }
  
    // 优先使用流式实例化
    if (WebAssembly.instantiateStreaming) {
      response = await WebAssembly.instantiateStreaming(
        fetch(wasmModuleUrl),
        importObject
      );
    } else {
      // 回退方案：先获取再实例化
      const fetchAndInstantiateTask = async () => {
        const wasmArrayBuffer = await fetch(wasmModuleUrl).then(response =>
          response.arrayBuffer()
        );
        return WebAssembly.instantiate(wasmArrayBuffer, importObject);
      };
      response = await fetchAndInstantiateTask();
    }
  
    return response;
};

// 创建JS和Go WASM之间的消息管道
const createMessagePipe = () => {
  const messageQueue = []; // 消息队列
  let wasmCallback = null; // WASM回调函数

  // 从JS发送消息到WASM
  const sendToWasm = (message) => {
    // 确保消息是字符串格式
    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }
    messageQueue.push(message);
    
    // 如果有回调等待，立即通知
    if (wasmCallback) {
      const cb = wasmCallback;
      wasmCallback = null;
      setTimeout(() => cb(messageQueue.shift()), 0);
    }
  };

  // WASM从JS接收消息
  const receiveFromJS = (callback) => {
    // 如果队列中有消息，立即处理
    if (messageQueue.length > 0) {
      setTimeout(() => callback(messageQueue.shift()), 0);
    } else {
      // 否则保存回调等待消息到达
      wasmCallback = callback;
    }
  };

  return {
    sendToWasm,
    receiveFromJS
  };
};

// 创建全局消息管道
const messagePipe = createMessagePipe();

// 全局暴露发送函数
window.sendToWasm = messagePipe.sendToWasm;
// 全局暴露接收函数
window.receiveFromJS = messagePipe.receiveFromJS;

// 运行WASM加法示例
const runWasmAdd = async () => {
  // 获取Go实例的导入对象
  const importObject = go.importObject;
  
  // 将接收函数添加到导入对象
  importObject.env = importObject.env || {};
  importObject.env.receiveFromJS = messagePipe.receiveFromJS;

  // 实例化WASM模块
  const wasmModule = await wasmBrowserInstantiate("./main.wasm", importObject);

  // 运行WASM模块
  go.run(wasmModule.instance);
  
  // 注册WASM发送消息到JS的回调
  window.receiveFromWasm = (message) => {
    console.log("来自WASM的消息:", message);
    const messagesElement = document.getElementById('wasm-messages');
    if (messagesElement) {
      messagesElement.textContent += message + '\n';
    }
  };
};

// 启动WASM
runWasmAdd();
// 测试发送消息
sendToWasm("test");