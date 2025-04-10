package main

import (
	"fmt"
	"syscall/js"
	"time"
)

// 检查JavaScript全局函数是否存在
func jsGlobalFunctionExists(name string) bool {
	return !js.Global().Get(name).IsUndefined()
}

// 从JavaScript接收消息
func receiveFromJS() string {
	// 创建通道接收消息
	msgChan := make(chan string)

	// 创建JavaScript回调函数
	callback := js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		if len(args) > 0 {
			// 从JavaScript获取消息
			msg := args[0].String()
			// 发送到Go通道
			msgChan <- msg
		}
		return nil
	})

	// 检查JavaScript函数是否存在
	if !jsGlobalFunctionExists("receiveFromJS") {
		fmt.Println("警告: JavaScript中未找到receiveFromJS函数")
		return "错误: receiveFromJS不可用"
	}

	// 调用JavaScript函数获取消息
	js.Global().Get("receiveFromJS").Invoke(callback)

	// 等待消息
	msg := <-msgChan

	// 释放回调避免内存泄漏
	callback.Release()

	return msg
}

// 发送消息到JavaScript
func sendToJS(message string) {
	// 检查JavaScript函数是否存在
	if !jsGlobalFunctionExists("receiveFromWasm") {
		fmt.Println("警告: JavaScript中未找到receiveFromWasm函数")
		return
	}

	js.Global().Get("receiveFromWasm").Invoke(message)
}

// 启动消息处理后台工作
func startMessageProcessor() {
	// 创建goroutine持续处理消息
	go func() {
		// 等待JavaScript函数初始化完成
		time.Sleep(500 * time.Millisecond)

		for {
			// 从JavaScript等待消息
			msg := receiveFromJS()

			// 处理消息(示例中只是添加时间戳后返回)
			response := fmt.Sprintf("[%s] Go收到: %s", time.Now().Format(time.RFC3339), msg)

			// 发送响应回JavaScript
			sendToJS(response)
		}
	}()
}

func main() {
	fmt.Println("Go WebAssembly初始化完成")

	// 创建通道用于JavaScript就绪信号
	jsReadyChan := make(chan struct{})

	// 注册JavaScript就绪检查函数
	js.Global().Set("goWasmReady", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		fmt.Println("JavaScript发送就绪信号")
		// 发送JavaScript就绪信号
		close(jsReadyChan)
		return nil
	}))

	// 设置轮询机制检查JavaScript函数可用性
	go func() {
		// 最多尝试20次(10秒)
		for i := 0; i < 20; i++ {
			if jsGlobalFunctionExists("receiveFromWasm") && jsGlobalFunctionExists("receiveFromJS") {
				fmt.Println("检测到JavaScript函数!")
				// 启动消息处理器
				startMessageProcessor()

				// 发送初始消息
				sendToJS("Go WASM模块准备接收消息!")
				return
			}

			fmt.Println("等待JavaScript函数可用...")
			time.Sleep(500 * time.Millisecond)
		}
		fmt.Println("等待JavaScript函数超时")
	}()

	// 同时等待JavaScript显式就绪信号
	go func() {
		// 等待JavaScript就绪信号
		<-jsReadyChan

		// 如果尚未启动则启动消息处理器
		startMessageProcessor()

		// 发送初始消息
		sendToJS("Go WASM模块准备接收消息(通过显式就绪信号)!")
	}()

	// 保持程序运行
	<-make(chan bool)
}
