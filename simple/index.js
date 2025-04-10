// Imports are from the demo-util folder in the repo
// https://github.com/torch2424/wasm-by-example/blob/master/demo-util/

const go = new Go(); // Defined in wasm_exec.js. Don't forget to add this in your index.html.


export const wasmBrowserInstantiate = async (wasmModuleUrl, importObject) => {
    let response = undefined;
  
    if (!importObject) {
      importObject = {
        env: {
          abort: () => console.log("Abort!")
        }
      };
    }
  
    if (WebAssembly.instantiateStreaming) {
      response = await WebAssembly.instantiateStreaming(
        fetch(wasmModuleUrl),
        importObject
      );
    } else {
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



const runWasmAdd = async () => {
    // Get the importObject from the go instance.
    const importObject = go.importObject;
  
    // Instantiate our wasm module
    const wasmModule = await wasmBrowserInstantiate("./main.wasm", importObject);
  
    // Allow the wasm_exec go instance, bootstrap and execute our wasm module
    go.run(wasmModule.instance);
  
    // Call the Add function export from wasm, save the result
    const addResult = wasmModule.instance.exports.add(14, 24);
  
    // Set the result onto the body
    document.body.textContent = `Hello World! addResult: ${addResult}`;
  };
  runWasmAdd();
  