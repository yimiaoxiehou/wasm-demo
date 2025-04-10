// 初始化Go WASM运行时
const go = new Go(); 

const BLOCK_SIZE = 1000; // 块大小
const RANDOM_SEED = 10; // 随机种子

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

// 存储WASM模块实例
let wasmModule;

// 初始化WASM模块
const initWasm = async () => {
  // 从Go实例获取导入对象
  const importObject = go.importObject;

  // 实例化WASM模块
  wasmModule = await wasmBrowserInstantiate("./main.wasm", importObject);

  // 运行WASM模块
  go.run(wasmModule.instance);
  console.log('WASM模块初始化完成');
  // WASM加载完成后启用处理按钮
  document.getElementById('start').disabled = false;
};

// DOM加载完成后设置事件监听器
document.addEventListener('DOMContentLoaded', () => {
  // 初始禁用处理按钮，等待WASM加载完成
  document.getElementById('start').disabled = true;
  // 初始化WASM模块
  initWasm();

  // 开始按钮点击事件
  document.getElementById('start').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    
    // 检查用户是否选择了文件
    if (fileInput.files.length === 0) {
      alert('请先选择文件');
      return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    // 文件读取完成回调函数
    reader.onload = (event) => {

      // 将文件内容转换为Uint8Array
      const fileData = new Uint8Array(event.target.result);
      // 获取WASM内存实例
      const memory = wasmModule.instance.exports.memory;
      // 在WASM内存中分配空间存储文件数据
      const filePtr = wasmModule.instance.exports.allocate(fileData.length);
      // 创建指向WASM内存的视图
      const wasmMemory = new Uint8Array(memory.buffer, filePtr, fileData.length);
      // 将文件数据复制到WASM内存空间
      wasmMemory.set(fileData);
      
      // 初始化LT编码器参数：
      // filePtr - 文件数据在WASM内存中的指针
      // fileData.length - 文件长度
      // BLOCK_SIZE - 编码块大小(1024字节)
      // RANDOM_SEED - 随机种子(10)
      wasmModule.instance.exports.initEncode(filePtr, fileData.length, BLOCK_SIZE, RANDOM_SEED);
      wasmModule.instance.exports.initDecode();
      const intervalId = setInterval(() => {
        const memory = wasmModule.instance.exports.memory;
        // Call WASM function to get block data pointer
        const size = wasmModule.instance.exports.getNextBlock();
        const ptr = wasmModule.instance.exports.getNextBlockPtr();
        
        // Create view into WASM memory (assuming fixed block size)
        const blockView = new Uint8Array(memory.buffer, ptr, size);
        
        // Copy data to JavaScript space
        const blockData = new Uint8Array(blockView);
        
        // Convert to base64 and display
        // const base64String = btoa(String.fromCharCode(...blockData));
        // document.getElementById('qrcode').src = "data:image/png;base64," + base64String;
        // document.getElementById('qrcode').style.display = "block";
        const fileSize = wasmModule.instance.exports.decodeNext(ptr, size);
        if (fileSize > 0) {
          const memory = wasmModule.instance.exports.memory;
          const filePtr = wasmModule.instance.exports.getDecodedFilePtr();
          const fileData = new Uint8Array(memory.buffer, filePtr, fileSize);
          // Create download link
          const blob = new Blob([fileData]);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'decoded_file'; // Set filename
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          // Stop the interval after download
          clearInterval(intervalId);
        }
      }, 80);
    };
    
    // 开始读取文件为ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
});